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
    depositor3,
    depositor4,
    depositor5,
    depositor6,
    depositor7,
    depositor8,
    depositor9,
    depositor10
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
          fromBlock: 0,
          toBlock: "latest"
        });

        events
          .filter(e => e.method !== 1)
          .map(e => {
            console.log("\n   ======= ESCROW EVENT ======");
            console.log("       Escrow Id:", e.returnValues.id);
            console.log("       Creator:", e.returnValues.creator);
            console.log(
              "       Contract Value: ",
              web3.utils.fromWei(e.returnValues.totalValue),
              "DAI"
            );
            console.log("   ==============================\n");
          });

        events.length.should.be.equal(1);
      });

      it("depositors send tokens to contract", async () => {
        await dai.mint(depositor1, web3.utils.toWei("50"), { from: owner })
          .should.be.fulfilled;
        await dai.approve(escrowDai.address, web3.utils.toWei("50"), {
          from: depositor1
        }).should.be.fulfilled;
        await escrowDai.escrowDeposit(1, web3.utils.toWei("50"), {
          from: depositor1
        }).should.be.fulfilled;

        await dai.mint(depositor2, web3.utils.toWei("150"), { from: owner })
          .should.be.fulfilled;
        await dai.approve(escrowDai.address, web3.utils.toWei("150"), {
          from: depositor2
        }).should.be.fulfilled;
        await escrowDai.escrowDeposit(1, web3.utils.toWei("150"), {
          from: depositor2
        }).should.be.fulfilled;

        await dai.mint(depositor3, web3.utils.toWei("100"), { from: owner })
          .should.be.fulfilled;
        await dai.approve(escrowDai.address, web3.utils.toWei("100"), {
          from: depositor3
        }).should.be.fulfilled;
        await escrowDai.escrowDeposit(1, web3.utils.toWei("100"), {
          from: depositor3
        }).should.be.fulfilled;

        //300 dai deposited
        let values = await escrowDB.getAmounts(1);
        values.totalDeposited
          .toString()
          .should.be.equal(web3.utils.toWei("300"));
      });

      it("one last deposit after escrow expired", async () => {
        console.log("\n    WAITING FOR CONTRACT TO EXPIRE...");
        await timeout(20);

        await dai.mint(depositor1, web3.utils.toWei("50"), { from: owner })
          .should.be.fulfilled;
        await dai.approve(escrowDai.address, web3.utils.toWei("50"), {
          from: depositor1
        }).should.be.fulfilled;
        //This escrow deposit releases escrow
        await escrowDai.escrowDeposit(1, web3.utils.toWei("50"), {
          from: depositor1
        }).should.be.fulfilled;
      });

      it("depositors get back their funds and escrow cancelled", async () => {
        let states = await escrowDB.getStates(1);
        states.cancelled.should.be.true;

        //Depositor 1 gets the first 50 dai + 50 dai deposited later
        let balance = await dai.balanceOf(depositor1);
        balance.toString().should.be.equal(web3.utils.toWei("100"));
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
          20,
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
          50,
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
          35,
          mediator,
          recipient,
          web3.utils.toWei("8"),
          [],
          false,
          0,
          { from: creator }
        ).should.be.fulfilled;

        let events = await escrowDB.getPastEvents("NewEscrow", {
          fromBlock: 0,
          toBlock: "latest"
        });

        events
          .filter(e => e.method !== 1)
          .map(e => {
            console.log("\n   ======= ESCROW EVENT ======");
            console.log("       Escrow Id:", e.returnValues.id);
            console.log("       Creator:", e.returnValues.creator);
            console.log(
              "       Contract Value: ",
              web3.utils.fromWei(e.returnValues.totalValue),
              "DAI"
            );
            console.log("   ==============================\n");
          });

        events.length.should.be.equal(4);
      });

      it("depositors start sending dai to escrows", async () => {
        let amount;

        amount = web3.utils.toWei(randomValue());
        await dai.mint(depositor1, amount, { from: owner }).should.be.fulfilled;
        await dai.approve(escrowDai.address, amount, { from: depositor1 })
          .should.be.fulfilled;
        await escrowDai.escrowDeposit(2, amount, { from: depositor1 }).should.be
          .fulfilled;

        amount = web3.utils.toWei(randomValue());
        await dai.mint(depositor2, amount, { from: owner }).should.be.fulfilled;
        await dai.approve(escrowDai.address, amount, { from: depositor2 })
          .should.be.fulfilled;
        await escrowDai.escrowDeposit(2, amount, { from: depositor2 }).should.be
          .fulfilled;

        amount = web3.utils.toWei(randomValue());
        await dai.mint(depositor3, amount, { from: owner }).should.be.fulfilled;
        await dai.approve(escrowDai.address, amount, { from: depositor3 })
          .should.be.fulfilled;
        await escrowDai.escrowDeposit(2, amount, { from: depositor3 }).should.be
          .fulfilled;

        amount = web3.utils.toWei(randomValue());
        await dai.mint(depositor4, amount, { from: owner }).should.be.fulfilled;
        await dai.approve(escrowDai.address, amount, { from: depositor4 })
          .should.be.fulfilled;
        await escrowDai.escrowDeposit(3, amount, { from: depositor4 }).should.be
          .fulfilled;

        amount = web3.utils.toWei(randomValue());
        await dai.mint(depositor5, amount, { from: owner }).should.be.fulfilled;
        await dai.approve(escrowDai.address, amount, { from: depositor5 })
          .should.be.fulfilled;
        await escrowDai.escrowDeposit(3, amount, { from: depositor5 }).should.be
          .fulfilled;

        amount = web3.utils.toWei(randomValue());
        await dai.mint(depositor6, amount, { from: owner }).should.be.fulfilled;
        await dai.approve(escrowDai.address, amount, { from: depositor6 })
          .should.be.fulfilled;
        await escrowDai.escrowDeposit(3, amount, { from: depositor6 }).should.be
          .fulfilled;

        amount = web3.utils.toWei(randomValue());
        await dai.mint(depositor7, amount, { from: owner }).should.be.fulfilled;
        await dai.approve(escrowDai.address, amount, { from: depositor7 })
          .should.be.fulfilled;
        await escrowDai.escrowDeposit(4, amount, { from: depositor7 }).should.be
          .fulfilled;

        amount = web3.utils.toWei(randomValue());
        await dai.mint(depositor8, amount, { from: owner }).should.be.fulfilled;
        await dai.approve(escrowDai.address, amount, { from: depositor8 })
          .should.be.fulfilled;
        await escrowDai.escrowDeposit(4, amount, { from: depositor8 }).should.be
          .fulfilled;

        amount = web3.utils.toWei(randomValue());
        await dai.mint(depositor9, amount, { from: owner }).should.be.fulfilled;
        await dai.approve(escrowDai.address, amount, { from: depositor9 })
          .should.be.fulfilled;
        await escrowDai.escrowDeposit(4, amount, { from: depositor9 }).should.be
          .fulfilled;

        amount = web3.utils.toWei(randomValue());
        await dai.mint(depositor10, amount, { from: owner }).should.be
          .fulfilled;
        await dai.approve(escrowDai.address, amount, { from: depositor10 })
          .should.be.fulfilled;
        await escrowDai.escrowDeposit(4, amount, { from: depositor10 }).should
          .be.fulfilled;

        for (let i = 1; i <= 3; i++) {
          let values = await escrowDB.getAmounts(i);
          values.totalDeposited.toString().should.not.be.equal("0");
        }
      });

      it("show cron job details", async () => {
        for (let i = 1; i <= 4; i++) {
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

      it("deposit to escrow 3 cancels escrow 2 (first job)", async () => {
        console.log("\n    WAITING FOR ALL CONTRACTS TO EXPIRE...\n");

        await timeout(50);

        await dai.mint(depositor4, web3.utils.toWei("50"), { from: owner })
          .should.be.fulfilled;
        await dai.approve(escrowDai.address, web3.utils.toWei("50"), {
          from: depositor4
        }).should.be.fulfilled;
        //This escrow deposit releases escrows
        await escrowDai.escrowDeposit(3, web3.utils.toWei("50"), {
          from: depositor4
        }).should.be.fulfilled;

        //Depo
        let states = await escrowDB.getStates(2);
        console.log(`    Escrow completed? ${states.completed}`);
        console.log(`    Escrow cancelled? ${states.cancelled}`);
        console.log(`    Escrow released? ${states.released}`);
        states.cancelled.should.be.true;
        states.released.should.be.false;
      });

      it("deposit to escrow 3 cancels its own escrow", async () => {
        await dai.mint(depositor7, web3.utils.toWei("50"), { from: owner })
          .should.be.fulfilled;
        await dai.approve(escrowDai.address, web3.utils.toWei("50"), {
          from: depositor7
        }).should.be.fulfilled;
        //This escrow deposit releases escrows
        await escrowDai.escrowDeposit(4, web3.utils.toWei("50"), {
          from: depositor7
        }).should.be.fulfilled;

        let states = await escrowDB.getStates(4);
        console.log(`    Escrow completed? ${states.completed}`);
        console.log(`    Escrow cancelled? ${states.cancelled}`);
        console.log(`    Escrow released? ${states.released}`);
        states.cancelled.should.be.true;
        states.released.should.be.false;
      });

      it("deposit to escrow 4 cancels its own escrow", async () => {
        await dai.mint(depositor4, web3.utils.toWei("50"), { from: owner })
          .should.be.fulfilled;
        await dai.approve(escrowDai.address, web3.utils.toWei("50"), {
          from: depositor4
        }).should.be.fulfilled;
        //This escrow deposit releases escrows
        await escrowDai.escrowDeposit(3, web3.utils.toWei("50"), {
          from: depositor4
        }).should.be.fulfilled;

        let states = await escrowDB.getStates(3);
        console.log(`    Escrow completed? ${states.completed}`);
        console.log(`    Escrow cancelled? ${states.cancelled}`);
        console.log(`    Escrow released? ${states.released}`);
        states.cancelled.should.be.true;
        states.released.should.be.false;
      });
    });
  }
);
