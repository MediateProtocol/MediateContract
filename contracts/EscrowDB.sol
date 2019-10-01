pragma solidity ^0.5.5;

import "@openzeppelin/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "./CronJobManager.sol";

/**
 * @title EscrowDB
 * @dev application that enables users to complete simple 
 * escrow functions and have a third party decide whether 
 * the action is complete. Contract takes a small fee and 
 * send the rest to a different address
 * @author @wafflemakr @Xaleee
 */
contract EscrowDB is Ownable{

    using SafeMath for uint256;

    // ==== EVENTS ====

    event NewEscrow(uint id, address indexed creator, address indexed controller, address indexed recipient, uint totalValue, uint method);

    event NewDepositor(uint id, address indexed depositor);

    event EscrowCompleted(uint id, address indexed controller, uint datetime);

    event EscrowCancelled(uint id, address indexed controller, uint datetime);

    event EscrowReleased(uint id, address indexed recipient, uint amount, uint datetime, uint method);

    // ===============

    CronJobManager public cronJob;

    struct Contract{    
        uint duration; //in seconds
        uint timeCreated;
        uint contractValue;
        uint totalDeposited;
        uint method; // 0 - ETH,  1 -DAI
        uint feeMediator;
        address mediator;
        address recipient;
        address creator;       
        bool released;
        bool cancelled;
        bool completed;
        bool isPrivate;        
        string title;
    }

    struct Depositor{
        address account;
        uint deposited;
    }

    mapping(uint => Contract) public contracts;

    mapping(uint => Depositor[]) public depositors;

    mapping(uint => mapping(address => uint)) public indexDepositor;

    mapping(uint => mapping(address => bool)) public isDepositor; 

    uint public totalContracts;

    uint feeCancelled;
    uint feeReleased;
    uint public minDeposit;

    address escrowDai;
    address escrowEth;


    modifier onlyEscrows(){
        require(msg.sender == escrowDai || msg.sender == escrowEth, "only escrow contracts allowed");
        _;
    }

    constructor(uint _feeCancelled, uint _feeReleased, uint _minDeposit) public{
        feeCancelled = _feeCancelled;
        feeReleased = _feeReleased;
        minDeposit = _minDeposit;
    }

    function initialize(address _cronJob) external onlyOwner{
        cronJob = CronJobManager(_cronJob);
    }

    function setEscrowDai(address _escrowDai) external onlyOwner{
        escrowDai = _escrowDai;
    }

    function setEscrowEth(address _escrowEth) external onlyOwner{
        escrowEth = _escrowEth;
    }

    /*                                           ACTIONS TAKEN                                            */
    /*                                               START                                                */
    /* ================================================================================================== */

    function create(uint contractValue, uint duration, 
                    address[3] calldata addresses, uint method) 
                    external
                    onlyEscrows
                    returns(uint)
    {       
        totalContracts = totalContracts.add(1);

        Contract memory newContract;
        newContract.contractValue = contractValue;
        newContract.duration = duration;
        newContract.creator = addresses[0];
        newContract.mediator = addresses[1];
        newContract.recipient = addresses[2];        
        newContract.timeCreated = now;
        newContract.method = method;

        //Store new contract in mapping
        contracts[totalContracts] = newContract;

        //Add cronjob
        cronJob.addCronJob(totalContracts, (now.add(duration)));

        emit NewEscrow(totalContracts, newContract.creator, newContract.mediator, newContract.recipient, contractValue, method);

        return totalContracts;
    }

    function setAdditionalData
    (
        uint id, string calldata title, bool isPrivate,  
        address[] calldata _depositors, uint feeMediator
    ) 
        external 
        onlyEscrows
    {
        contracts[id].title = title;
        contracts[id].isPrivate = isPrivate;
        contracts[id].feeMediator = feeMediator; 

        if(isPrivate) 
            for(uint i=0; i < _depositors.length; i++) 
                addEscrowDepositor(totalContracts, _depositors[i]);  
    }

    /**
     * @dev add a depositor to an existing escrow contract
     * @param _id escrow contract id
     * @param _depositor uint256
     */
    function addEscrowDepositor(uint _id, address _depositor) 
        public
        onlyEscrows
    {
        Depositor memory newDepositor = Depositor(_depositor, 0);
        depositors[_id].push(newDepositor);
        indexDepositor[_id][_depositor] = depositors[_id].length - 1;
        isDepositor[_id][_depositor] = true;

        emit NewDepositor(_id, _depositor);
    }

    
    function deposit(uint _id, uint _sentDai, uint _index)
        external
        onlyEscrows
    {
        depositors[_id][_index].deposited = depositors[_id][_index].deposited.add(_sentDai);
        contracts[_id].totalDeposited = contracts[_id].totalDeposited.add(_sentDai);
    }

    function setRecipient(uint _id, address recipient)
        external
        onlyEscrows
    {
        require(contracts[_id].completed , "you can't set recipient before escrow completion");
        require( contracts[_id].recipient == address(0), "recipient already set");
        require(isDepositor[_id][recipient], "you can only set a recipient from depositor's list");        
        contracts[_id].recipient = recipient;
    }


    /*                                           ACTIONS TAKEN                                            */
    /*                                                END                                                 */
    /* ================================================================================================== */

    /*                                           CHANGE STATES                                            */
    /*                                               START                                                */
    /* ================================================================================================== */

    function complete(uint _id)
        external
        onlyEscrows
    {   
        contracts[_id].completed = true;
        emit EscrowCompleted(_id, contracts[_id].mediator, now);
    }

    //Releases contract
    function release(uint _id)
        external
        onlyEscrows
    {   
        cronJob.deleteCronJob(_id);
        contracts[_id].released = true;
        emit EscrowReleased(_id, contracts[_id].recipient, contracts[_id].contractValue, now, contracts[_id].method );
    }

    //Cancels contract
    function cancel(uint _id)
        external
        onlyEscrows
    {   
        cronJob.deleteCronJob(_id);
        contracts[_id].cancelled = true;
        emit EscrowCancelled(_id, contracts[_id].mediator, now);
    }



    /*                                           CHANGE STATES                                            */
    /*                                                END                                                 */
    /* ================================================================================================== */



    /*                                               FEES                                                 */
    /*                                               START                                                */
    /* ================================================================================================== */

    /**
     * @dev update company fees
     * @param _feeCancelled uint fee charged when escrow is cancelled
     * @param _feeReleased uint fee charged when escrow is released
     */

    function updateFees(uint _feeCancelled, uint _feeReleased, uint _minDeposit) external onlyOwner{
        feeCancelled = _feeCancelled;
        feeReleased = _feeReleased;
        minDeposit = _minDeposit;
    }

    function getFees()
        external
        view
        returns(uint, uint, uint)
    {
        return(feeCancelled, feeReleased, minDeposit);
    }


    /*                                               FEES                                                 */
    /*                                               END                                                  */
    /* ================================================================================================== */



    /*                                             DEPOSITORS                                             */
    /*                                               START                                                */
    /* ================================================================================================== */

    function ifDepositor(uint _id, address _depositor)
        external
        view
        returns(bool)
    {
        return isDepositor[_id][_depositor];
    }
   

    function getIndex(uint _id, address _depositor)
        external
        view
        returns(uint index)
    {
        index = indexDepositor[_id][_depositor];
    }

    function getDepositor(uint _id, uint index)
        external
        view
        returns(address depositor, uint amount)
    {
        depositor = depositors[_id][index].account;
        amount =  depositors[_id][index].deposited;
    }



    /*                                             DEPOSITORS                                             */
    /*                                                END                                                 */
    /* ================================================================================================== */



    /*                                         CONTRACT GETTERS                                           */
    /*                                               START                                                */
    /* ================================================================================================== */


    function getStates(uint _id)
        external
        view
        returns(bool released, bool cancelled, bool completed)
    {
        released = contracts[_id].released;
        cancelled = contracts[_id].cancelled;
        completed = contracts[_id].completed;
    }

    function getTitle(uint _id)
        external
        view
        returns(string memory title)
    {
        return contracts[_id].title;
    }

    function getMediatorFee(uint _id)
        external
        view
        returns(uint fee)
    {
        return contracts[_id].feeMediator;
    }


    //Gets recipient and total amount deposited
    function getAddresses(uint _id) 
        external
        view
        returns(address mediator, address recipient, address creator)
    {
        mediator = contracts[_id].mediator;
        recipient = contracts[_id].recipient;
        creator = contracts[_id].creator;
    }



    function getAmounts(uint _id)
        external
        view
        returns(uint totalDeposited, uint contractValue)
    {
        totalDeposited = contracts[_id].totalDeposited;
        contractValue = contracts[_id].contractValue;
    }


    function getTotalDepositors(uint _id)
        external
        view
        returns(uint totalDepositors)
    {
        totalDepositors = depositors[_id].length;
    }

     function getEscrowTimes(uint _id)
        external
        view
        returns(uint timeCreated, uint duration)
    {
        timeCreated = contracts[_id].timeCreated;
        duration = contracts[_id].duration;
    }

    function isPrivate(uint _id)
        external
        view
        returns(bool)
    {
        return contracts[_id].isPrivate;
    }

    /*                                         CONTRACT GETTERS                                           */
    /*                                                END                                                 */
    /* ================================================================================================== */

   
}