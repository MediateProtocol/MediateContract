const BigNumber = web3.utils.BN;
require("chai")
  .use(require("chai-shallow-deep-equal"))
  .use(require("chai-as-promised"))
  .should();

const EscrowEth = artifacts.require("EscrowEth");
const EscrowDB = artifacts.require("EscrowDB");
const CronJobManager = artifacts.require("CronJobManager");

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

let escrowEth, escrowDB;

function formatDate(timestamp) {
  let date = new Date(null);
  date.setSeconds(timestamp);
  return date.toTimeString().replace(/.*(\d{2}:\d{2}:\d{2}).*/, "$1");
}

contract(
  "EscrowEth",
  ([
    owner,
    creator,
    mediator,
    recipient,
    newCompany,
    depositor1,
    depositor2,
    depositor3
  ]) => {
    describe("EscrowEth::instances", () => {
      it("instantiate contract", async () => {
        escrowDB = await EscrowDB.deployed();
        escrowEth = await EscrowEth.deployed();
        cron = await CronJobManager.deployed();
      });
    });

    describe("EscrowEth::authority", () => {
      it("only owner can change company address", async () => {
        await escrowEth.setCompanyAddress(newCompany, { from: owner }).should.be
          .fulfilled;
      });

      it("only owner can change escrow fees", async () => {
        await escrowDB.updateFees(2, 3, 1, { from: owner }).should.be.fulfilled;
        await escrowDB.updateFees(1, 2, 1, { from: owner }).should.be.fulfilled;
      });
    });

    describe("EscrowEth::create", () => {
      it("user can't create an escrow without sending minimum deposit", async () => {
        await escrowEth.createEscrow(
          "Lawyers Firm",
          web3.utils.toWei("100"),
          300,
          mediator,
          recipient,
          [depositor1, depositor2, depositor3],
          true,
          0,
          { from: creator, value: web3.utils.toWei("0.5") }
        ).should.be.rejected;
      });

      it("user creates an escrow ", async () => {
        await escrowEth.createEscrow(
          "Lawyers Firm",
          web3.utils.toWei("100"),
          300,
          mediator,
          recipient,
          [depositor1, depositor2, depositor3],
          true,
          0,
          { from: creator, value: web3.utils.toWei("1") }
        ).should.be.fulfilled;
      });

      it("correct new escrow event", async () => {
        let events = await escrowDB.getPastEvents("NewEscrow", {
          fromBlock: 0,
          toBlock: "latest"
        });

        events
          .filter(e => e.method !== 0)
          .map(e => {
            console.log("\n   ======= ESCROW EVENT ======");
            console.log("       Escrow Id:", e.returnValues.id);
            console.log("       Creator:", e.returnValues.creator);
            console.log(
              "       Contract Value: ",
              web3.utils.fromWei(e.returnValues.totalValue),
              "ETH"
            );
            console.log("   ==============================\n");
          });

        events.length.should.be.equal(1);
      });

      it("correct main states", async () => {
        let states = await escrowDB.getStates(1);
        states.released.should.be.false;
        states.cancelled.should.be.false;
        states.completed.should.be.false;
      });

      it("correct escrow addresses", async () => {
        let addresses = await escrowDB.getAddresses(1);
        addresses.mediator.should.be.equal(mediator);
        addresses.recipient.should.be.equal(recipient);
        addresses.creator.should.be.equal(creator);
      });

      it("correct depositors addresses", async () => {
        let isDepositor = await escrowDB.ifDepositor(1, depositor1);
        isDepositor.should.be.true;

        isDepositor = await escrowDB.ifDepositor(1, depositor2);
        isDepositor.should.be.true;

        isDepositor = await escrowDB.ifDepositor(1, depositor3);
        isDepositor.should.be.true;

        //Total depositors
        let totalDepositors = await escrowDB.getTotalDepositors(1);
        totalDepositors.toNumber().should.be.equal(3);
      });

      it("correct contract values", async () => {
        let values = await escrowDB.getAmounts(1);
        values.totalDeposited.toString().should.be.equal(web3.utils.toWei("0"));
        values.contractValue
          .toString()
          .should.be.equal(web3.utils.toWei("100"));
      });
    });

    // Bet escrows = no recipient, 2 depositors, private
    describe("EscrowEth::bet", () => {
      it("user can't create a bet escrow without sending minimum deposit", async () => {
        await escrowEth.createEscrow(
          "",
          web3.utils.toWei("100"),
          300,
          mediator,
          ZERO_ADDRESS,
          [creator, depositor1],
          true,
          0,
          { from: creator, value: web3.utils.toWei("0.5") }
        ).should.be.rejected;
      });

      it("user creates a bet escrow ", async () => {
        await escrowEth.createEscrow(
          "",
          web3.utils.toWei("100"),
          300,
          mediator,
          ZERO_ADDRESS,
          [creator, depositor1],
          true,
          0,
          { from: creator, value: web3.utils.toWei("1") }
        ).should.be.fulfilled;
      });

      it("correct new escrow event", async () => {
        let events = await escrowDB.getPastEvents("NewEscrow", {
          fromBlock: 0,
          toBlock: "latest"
        });

        events
          .filter(e => e.method !== 0)
          .map(e => {
            console.log("\n   ======= ESCROW EVENT ======");
            console.log("       Escrow Id:", e.returnValues.id);
            console.log("       Creator:", e.returnValues.creator);
            console.log(
              "       Contract Value: ",
              web3.utils.fromWei(e.returnValues.totalValue),
              "ETH"
            );
            console.log("   ==============================\n");
          });

        events.length.should.be.equal(2);
      });

      it("correct main states", async () => {
        let states = await escrowDB.getStates(2);
        states.released.should.be.false;
        states.cancelled.should.be.false;
        states.completed.should.be.false;
      });

      it("correct escrow addresses", async () => {
        let addresses = await escrowDB.getAddresses(2);
        addresses.mediator.should.be.equal(mediator);
        addresses.recipient.should.be.equal(ZERO_ADDRESS);
        addresses.creator.should.be.equal(creator);
      });

      it("correct depositors addresses", async () => {
        let isDepositor = await escrowDB.ifDepositor(2, creator);
        isDepositor.should.be.true;

        isDepositor = await escrowDB.ifDepositor(2, depositor1);
        isDepositor.should.be.true;

        //Total depositors
        let totalDepositors = await escrowDB.getTotalDepositors(2);
        totalDepositors.toNumber().should.be.equal(2);
      });

      it("correct contract values", async () => {
        let values = await escrowDB.getAmounts(2);
        values.totalDeposited.toString().should.be.equal(web3.utils.toWei("0"));
        values.contractValue
          .toString()
          .should.be.equal(web3.utils.toWei("100"));
      });

      it("creator deposits bet amount", async () => {
        await escrowEth.escrowDeposit(2, {
          from: creator,
          value: web3.utils.toWei("50")
        }).should.be.fulfilled;
        let values = await escrowDB.getAmounts(2);
        values.totalDeposited
          .toString()
          .should.be.equal(web3.utils.toWei("50"));
      });

      it("unknown depositor can't participate in bet", async () => {
        await escrowEth.escrowDeposit(2, {
          from: depositor2,
          value: web3.utils.toWei("50")
        }).should.be.rejected;
        let values = await escrowDB.getAmounts(2);
        values.totalDeposited
          .toString()
          .should.be.equal(web3.utils.toWei("50"));
      });

      it("depositor accepts bet and pays remaining amount", async () => {
        await escrowEth.escrowDeposit(2, {
          from: creator,
          value: web3.utils.toWei("50")
        }).should.be.fulfilled;
        let values = await escrowDB.getAmounts(2);
        values.totalDeposited
          .toString()
          .should.be.equal(web3.utils.toWei("100"));
      });

      it("bet escrow is now funded and rady to mediate", async () => {
        let states = await escrowDB.getStates(2);
        states.completed.should.be.true;
      });

      it("mediator cannot release without setting recipient", async () => {
        await escrowEth.releaseEscrow(2, {
          from: mediator
        }).should.be.rejected;
        let states = await escrowDB.getStates(2);
        states.released.should.be.false;
      });

      it("mediator can't set bet winner (recipient) different from current depositors", async () => {
        await escrowEth.setRecipient(2, depositor3, {
          from: mediator
        }).should.be.rejected;
      });

      it("mediator sets bet winner (recipient) and releases bet", async () => {
        await escrowEth.setRecipient(2, depositor1, {
          from: mediator
        }).should.be.fulfilled;

        await escrowEth.releaseEscrow(2, {
          from: mediator
        }).should.be.fulfilled;

        let states = await escrowDB.getStates(2);
        states.released.should.be.true;

        let events = await escrowDB.getPastEvents("EscrowReleased", {
          filter: { id: 2 },
          fromBlock: 0,
          toBlock: "latest"
        });

        events[0].returnValues.recipient.should.be.equal(depositor1);
      });
    });
  }
);
