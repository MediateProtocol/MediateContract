const BigNumber = web3.utils.BN;
require("chai")
  .use(require("chai-shallow-deep-equal"))
  .use(require("chai-as-promised"))
  .should();

const EscrowDai = artifacts.require("EscrowDai");
const EscrowDB = artifacts.require("EscrowDB");
const DaiToken = artifacts.require("DaiToken");
const CronJobManager = artifacts.require("CronJobManager");

let escrowDai, escrowDB, dai;

function formatDate(timestamp) {
  let date = new Date(null);
  date.setSeconds(timestamp);
  return date.toTimeString().replace(/.*(\d{2}:\d{2}:\d{2}).*/, "$1");
}

function timeout(s) {
  // console.log(`~~~ Timeout for ${s} seconds`);
  return new Promise(resolve => setTimeout(resolve, s * 1000));
}

function randomValue() {
  return String(Math.floor(Math.random() * 100) + 1); // 0-100 DAI
}

contract(
  "CronJobManager",
  ([
    owner,
    creator,
    mediator,
    recipient,
    depositor1,
    depositor2,
    depositor3
  ]) => {
    describe("CronJobManager::instances", () => {
      it("instantiate contract", async () => {
        escrowDB = await EscrowDB.deployed();
        escrowDai = await EscrowDai.deployed();
        dai = await DaiToken.deployed();
        cron = await CronJobManager.deployed();
      });
    });

    describe("CronJobManager::cronjob release", () => {
      it("user creates an escrow ", async () => {
        await dai.mint(creator, web3.utils.toWei("1000"), { from: owner })
          .should.be.fulfilled;
        await dai.approve(escrowDai.address, web3.utils.toWei("10"), {
          from: creator
        }).should.be.fulfilled;
        await escrowDai.createEscrow(
          "Buy Supplies",
          web3.utils.toWei("1000"),
          20 /*20 seconds */,
          mediator,
          recipient,
          web3.utils.toWei("10"),
          [depositor1, depositor2, depositor3],
          true,
          0,
          { from: creator }
        ).should.be.fulfilled;

        let events = await escrowDB.getPastEvents("NewEscrow", {
          filter: { method: 1 },
          fromBlock: 0,
          toBlock: "latest"
        });

        events.map(e => {
          console.log("\n   ======= ESCROW EVENT ======");
          console.log("       Escrow Id:", e.returnValues.id);
          console.log("       Creator:", e.returnValues.creator);
          console.log(
            "       TimeCreated ",
            formatDate(e.returnValues.timeCreated)
          );
          console.log("       Duration:", e.returnValues.duration, "sec");
          console.log(
            "       Contract Value: ",
            web3.utils.fromWei(e.returnValues.totalValue),
            "DAI"
          );
          console.log("   ==============================\n");
        });

        events.length.should.be.equal(1);
      });
    });

    describe("CronJobManager::multiple escrow release", () => {
      it("creates 3 escrows", async () => {
        await dai.mint(creator, web3.utils.toWei("1000"), { from: owner })
          .should.be.fulfilled;
        await dai.approve(escrowDai.address, web3.utils.toWei("1000"), {
          from: creator
        }).should.be.fulfilled;

        await escrowDai.createEscrow(
          "Buy Supplies",
          web3.utils.toWei("100"),
          60,
          mediator,
          recipient,
          web3.utils.toWei("1"),
          [],
          false,
          0,
          { from: creator }
        ).should.be.fulfilled;

        await escrowDai.createEscrow(
          "Buy Supplies",
          web3.utils.toWei("500"),
          70,
          mediator,
          recipient,
          web3.utils.toWei("5"),
          [],
          false,
          0,
          { from: creator }
        ).should.be.fulfilled;

        await escrowDai.createEscrow(
          "Buy Supplies",
          web3.utils.toWei("800"),
          45,
          mediator,
          recipient,
          web3.utils.toWei("8"),
          [],
          false,
          0,
          { from: creator }
        ).should.be.fulfilled;

        let events = await escrowDB.getPastEvents("NewEscrow", {
          filter: { method: 1 },
          fromBlock: 0,
          toBlock: "latest"
        });

        events.map(e => {
          console.log("\n   ======= ESCROW EVENT ======");
          console.log("       Escrow Id:", e.returnValues.id);
          console.log("       Creator:", e.returnValues.creator);
          console.log(
            "       TimeCreated ",
            formatDate(e.returnValues.timeCreated)
          );
          console.log("       Duration:", e.returnValues.duration, "sec");
          console.log(
            "       Contract Value: ",
            web3.utils.fromWei(e.returnValues.totalValue),
            "DAI"
          );
          console.log("   ==============================\n");
        });

        events.length.should.be.equal(4);
      });

      it("show cron job details", async () => {
        await escrowDai.createEscrow(
          "Buy Supplies",
          web3.utils.toWei("500"),
          100,
          mediator,
          recipient,
          web3.utils.toWei("5"),
          [],
          false,
          0,
          { from: creator }
        ).should.be.fulfilled;
        for (let i = 1; i <= 5; i++) {
          let cronJobs = await cron.cronjobs(i);

          console.log("\n   ======= CRON JOB ======");
          console.log("       Cron Id:", cronJobs.id.toNumber());
          console.log("       Next id:", cronJobs.next.toNumber());
          console.log(
            "       Time to execute: ",
            formatDate(cronJobs.timestamp.toNumber())
          );
          console.log("       Previous:", cronJobs.previous.toNumber());
          console.log("   ==============================\n");
        }
      });

      it("deposit to escrow 4 cancels its own escrow", async () => {
        //This escrow deposit releases escrows
        await escrowDai.cancelEscrow(3, {
          from: mediator
        }).should.be.fulfilled;

        let states = await escrowDB.getStates(3);
        console.log(`    Escrow completed? ${states.completed}`);
        console.log(`    Escrow cancelled? ${states.cancelled}`);
        console.log(`    Escrow released? ${states.released}`);
        states.cancelled.should.be.true;
        states.released.should.be.false;

        for (let i = 1; i <= 5; i++) {
          let cronJobs = await cron.cronjobs(i);

          console.log("\n   ======= CRON JOB ======");
          console.log("       Cron Id:", cronJobs.id.toNumber());
          console.log("       Next id:", cronJobs.next.toNumber());
          console.log(
            "       Time to execute: ",
            formatDate(cronJobs.timestamp.toNumber())
          );
          console.log("       Previous:", cronJobs.previous.toNumber());
          console.log("   ==============================\n");
        }
      });
    });
  }
);
