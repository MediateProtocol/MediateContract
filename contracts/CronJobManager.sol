pragma solidity ^0.5.5;
import "@openzeppelin/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "./EscrowDB.sol";


contract CronJobManager is Ownable{


	EscrowDB public escrowDB;

	using SafeMath for uint256;

	function initialize(address _escrowDB) external onlyOwner{
        escrowDB = EscrowDB(_escrowDB);
    }

    modifier onlyEscrowDB(){
        require(msg.sender == address(escrowDB), "only escrowDB");
        _;
    }

    /*                                         CRONJOB VARIABLES                                          */
    /*                                               START                                                */
    /* ================================================================================================== */    

    struct CronJob{
        uint next;
        uint timestamp;
        uint id;
        uint previous;
    }

    uint totalCronJobs; 

    uint public headCronJob;

    mapping(uint => CronJob) public cronjobs;

    uint public maxCronJobs = 1;


    /*                                         CRONJOB VARIABLES                                          */
    /*                                                END                                                 */
    /* ================================================================================================== */

    /*                                         CRONJOB FUNCTIONS                                          */
    /*                                               START                                                */
    /* ================================================================================================== */


    function addCronJob(uint id, uint timestamp)
        public
        onlyEscrowDB
    {
        

        CronJob memory previousCronJob;
        if((timestamp<cronjobs[headCronJob].timestamp) || (totalCronJobs == 0)){
            CronJob memory newCronJob;
            newCronJob.next = headCronJob;
            cronjobs[headCronJob].previous = id;
            newCronJob.timestamp = timestamp;
            newCronJob.id = id;
            headCronJob = id;
            totalCronJobs = totalCronJobs.add(1);
            cronjobs[id] = newCronJob;
        }
        else{
            if(totalCronJobs > 1){
                previousCronJob = cronjobs[headCronJob];
                for(uint i=1; i<totalCronJobs; i++){
                    previousCronJob = cronjobs[previousCronJob.next];
                    if(timestamp<previousCronJob.timestamp){
                        CronJob memory newCronJob;
                        newCronJob.next = previousCronJob.id;
                        newCronJob.previous = previousCronJob.previous;
                        newCronJob.timestamp = timestamp;
                        newCronJob.id = id;
                        previousCronJob.previous = id;
                        totalCronJobs = totalCronJobs.add(1);
                        cronjobs[id] = newCronJob;
                        cronjobs[cronjobs[id].next] = previousCronJob;
                        cronjobs[cronjobs[id].previous].next = id;
                        break;
                    }
                }
                if((cronjobs[id].id)==0){
                    CronJob memory newCronJob;
                    previousCronJob.next = id;
                    newCronJob.previous = previousCronJob.id;
                    newCronJob.timestamp = timestamp;
                    newCronJob.id = id;
                    totalCronJobs = totalCronJobs.add(1);
                    cronjobs[id] = newCronJob;
                    cronjobs[cronjobs[id].previous] = previousCronJob;
                }
            }
            else{
                CronJob memory newCronJob;
                newCronJob.previous = headCronJob;
                newCronJob.timestamp = timestamp;
                newCronJob.id = id;
                cronjobs[headCronJob].next = id;
                totalCronJobs = totalCronJobs.add(1);
                cronjobs[id] = newCronJob;
            }
        }
    }

    function deleteCronJob(uint id)
        public
        onlyEscrowDB
        returns(bool)
    {

        //if head
        if(cronjobs[id].id == headCronJob){
            if(totalCronJobs == 1){
                headCronJob = 0;
                cronjobs[id] = CronJob(0,0,0,0);
                totalCronJobs = totalCronJobs.sub(1);
                return true;
            }
            else{
                cronjobs[cronjobs[headCronJob].next].previous = 0;
                headCronJob = cronjobs[headCronJob].next;
                cronjobs[id] = CronJob(0,0,0,0);
                totalCronJobs = totalCronJobs.sub(1);
                return true;
            }
        }

        //if last
        else if(cronjobs[id].next == 0){
            cronjobs[cronjobs[id].previous].next = 0;
            cronjobs[id] = CronJob(0,0,0,0);
            totalCronJobs = totalCronJobs.sub(1);
            return true;
        }

        //if middle
        else{
            cronjobs[cronjobs[id].previous].next = cronjobs[id].next;
            cronjobs[cronjobs[id].next].previous = cronjobs[id].previous;
            cronjobs[id] = CronJob(0,0,0,0);
            totalCronJobs = totalCronJobs.sub(1);
            return true; 
        }
    }

    function getHeadCronJob()
        external
        view
        returns(uint timestamp, uint id)
    {   
        timestamp = cronjobs[headCronJob].timestamp;
        id = headCronJob;
    }


    /*                                         CRONJOB FUNCTIONS                                          */
    /*                                                END                                                 */
    /* ================================================================================================== */
}