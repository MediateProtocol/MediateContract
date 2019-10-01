pragma solidity ^0.5.5;

import "@openzeppelin/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./EscrowDB.sol";
import "./CronJobManager.sol";

/**
 * @title Escrow Dai
 * @dev application that enables users to complete simple 
 * escrow functions and have a third party decide whether 
 * the action is complete. Contract takes a small fee and 
 * send the rest to a different address
 * @author @wafflemakr @Xaleee
 */
contract EscrowDai is Ownable{

    using SafeMath for uint256;

    // EVENTS

    event NewDepositDai(uint indexed escrowId, address depositor, uint timeDeposit, uint depositValue);

    event EscrowReleased(uint indexed id, address recipient, uint totalReleased);

    event EscrowCancelled(uint indexed id, address controller, uint totalDeposited); 

    // GLOBAL VARIABLES
    IERC20 public daiToken;

    address payable companyAddress;

    EscrowDB public escrowDB;

    CronJobManager public cronJobManager;


    // MAIN CONTRACT

    modifier onlyExistent(uint id){
        (,uint contractValue) = escrowDB.getAmounts(id);
        require(contractValue > 0, "contract does not exist");
        (bool released, bool cancelled, ) = escrowDB.getStates(id);
        require(!released, "contract was released");
        require(!cancelled, "contract is cancelled");
        _;
    }

    modifier onlyCreator(uint id){
        (, , address creator) = escrowDB.getAddresses(id);
        require(msg.sender == creator, "only contract creator");
        _;
    }

    modifier onlyMediator(uint id){
        (address mediator, , ) = escrowDB.getAddresses(id);
        require(msg.sender == mediator, "only contract mediator");
        _;
    }

    modifier onlyCompleted(uint id){
        (,,bool isCompleted) = escrowDB.getStates(id);
        require(isCompleted, "escrow not completed");
        _;
    }

    modifier onlyInTime(uint id){
        (uint timeCreated, uint duration) = escrowDB.getEscrowTimes(id);
        require(now < timeCreated.add(duration), "time has expired");
        _;
    }

    constructor(address daiAddress, address payable _companyAddress, address _escrowDB, address _cronJob) public{
        daiToken = IERC20(daiAddress);
        setCompanyAddress(_companyAddress);
        escrowDB = EscrowDB(_escrowDB);
        cronJobManager = CronJobManager(_cronJob);
    }

    /**
     * @dev Create an escrow contract
     */
    function createEscrow(string calldata title, uint contractValueDai, uint duration, 
                    address mediator, address recipient, uint sentDai,  address[] calldata depositors, 
                    bool isPrivate, uint feeMediator)
        external
        payable
        returns(uint escrowId)
    {
        uint minDeposit = contractValueDai.mul(escrowDB.minDeposit()).div(100);
        require(sentDai == minDeposit, "Not enough dai deposited");
        require(daiToken.transferFrom(msg.sender, companyAddress, sentDai), "Not enough dai approved");

        escrowId = escrowDB.create(contractValueDai, duration, [msg.sender, mediator, recipient], 1);
        
        escrowDB.setAdditionalData(escrowId, title, isPrivate, depositors, feeMediator);

        //check for cronJob
        cronJob();
    }


    /**
     * @dev deposit ETH to the escrow contract
     * @param _id escrow contract id
     * @param _sentDai amount of dai to transfer to contract
     */
    function escrowDeposit(uint _id, uint _sentDai) 
        external
    {
        if(escrowDB.isPrivate(_id)){
            require(escrowDB.ifDepositor(_id, msg.sender), "contract is not open for non depositors");
        }       

        require(_sentDai > 0, "invalid amount sent");

        // If not already a registered depositor, add it
        if(!escrowDB.ifDepositor(_id, msg.sender)) escrowDB.addEscrowDepositor(_id, msg.sender);

        uint index = escrowDB.getIndex(_id, msg.sender);

        (uint totalDeposited, uint contractValue) = escrowDB.getAmounts(_id);

        uint sentDai;

        //Only transfer the amount left to finish contract value
        if(totalDeposited.add(_sentDai) >= contractValue) {
            sentDai = contractValue.sub(totalDeposited);
            escrowDB.complete(_id);
        }
        else sentDai = _sentDai;

        require(daiToken.transferFrom(msg.sender, address(this), sentDai), "error transfering dai to contract");

        escrowDB.deposit(_id, sentDai, index);

        emit NewDepositDai(_id, msg.sender, now, sentDai);   

        //check for cronJob
        cronJob();   
    }

    /**
    * @dev add a depositor to an existing escrow contract
    * @param _id escrow contract id
    */
    function setRecipient(uint _id, address recipient)
        external 
        onlyMediator(_id)
    {
        require(recipient != address(0), "invalid address");
        escrowDB.setRecipient(_id, recipient);
    }

    /**
     * @dev add a depositor to an existing escrow contract
     * @param _id escrow contract id
     */
    function releaseEscrow(uint _id)
        external 
        onlyMediator(_id)
        onlyCompleted(_id)
        onlyInTime(_id)
    {
        (, address recipient,) = escrowDB.getAddresses(_id);

        require(recipient != address(0), "you must set a valid recipient first");

        (uint totalDeposited, ) = escrowDB.getAmounts(_id);

        (, uint feeReleased,) = escrowDB.getFees();

        uint mediatorFee = escrowDB.getMediatorFee(_id);

        uint amountMediator = 0;

        //Send share to controller if any
        if(mediatorFee > 0){
            amountMediator = totalDeposited.mul(mediatorFee).div(100);
            require(daiToken.transfer(msg.sender, amountMediator), "transfer failed");
        }

        //Send share to company
        uint amountCompany = totalDeposited.mul(feeReleased).div(100);
        require(daiToken.transfer(companyAddress, amountCompany), "transfer failed");

        //Release amount left to recipient
        require(daiToken.transfer(recipient, totalDeposited.sub(amountMediator).sub(amountCompany)), "transfer failed");

        escrowDB.release(_id);

        emit EscrowReleased(_id, recipient, totalDeposited);

        //check for cronJob
        cronJob();
    }

    /**
     * @dev internal function to cancel escrow
     * @param _id escrow contract id
     */
    function cancel(uint _id) 
        internal
    {
        (uint totalDeposited, ) = escrowDB.getAmounts(_id);

        uint totalDepositors = escrowDB.getTotalDepositors(_id);

        (,,address creator) = escrowDB.getAddresses(_id);

        for(uint i = 0; i < totalDepositors; i++){
            uint mediatorFee = escrowDB.getMediatorFee(_id);

            (address depositor, uint deposited) = escrowDB.getDepositor(_id, i);

            if (creator != depositor) {
                if(mediatorFee > 0) {
                    uint amountMediator = deposited.mul(mediatorFee).div(100);
                    require(daiToken.transfer(msg.sender, amountMediator));
                    require(daiToken.transfer(depositor, deposited.sub(amountMediator)), "transfer failed");
                }
                else require(daiToken.transfer(depositor, deposited), "transfer failed");
                
            }
        }

        escrowDB.cancel(_id);

        emit EscrowCancelled(_id, msg.sender, totalDeposited);

        
    }

    /**
     * @dev controller cancels escrow
     * @param _id escrow contract id
     */
    function cancelEscrow(uint _id) 
        external
        onlyMediator(_id)
    {
        cancel(_id);
        //check for cronJob
        cronJob();
    }

    function cronJob()
        internal
    {
        (uint timestamp, uint id)= cronJobManager.getHeadCronJob();
        if(timestamp <= now && id != 0) cancel(id);
    }
    

    /* COMPANY THINGS */

    /**
     * @dev set a new company deposit address
     * @param _companyAddress new address
     */
    function setCompanyAddress(address payable _companyAddress) public onlyOwner{
        companyAddress = _companyAddress;
    }

    /**
     * @dev get current DAI balance in contract
     */
    function getTotalBalance() public view returns(uint){
        return daiToken.balanceOf(address(this));
    }
    
}