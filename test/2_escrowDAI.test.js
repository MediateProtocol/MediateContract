const BigNumber = web3.utils.BN;
require("chai")
  .use(require("chai-shallow-deep-equal"))
  .use(require("chai-as-promised"))
  .should();

const EscrowDai = artifacts.require("EscrowDai");
const EscrowDB = artifacts.require("EscrowDB");
const DaiToken = artifacts.require("DaiToken");

let escrowDai, escrowDB, dai;

function formatDate(timestamp) {
  let date = new Date(null);
  date.setSeconds(timestamp);
  return date.toTimeString().replace(/.*(\d{2}:\d{2}:\d{2}).*/, "$1");
}

contract(
  "EscrowDai",
  ([
    owner,
    creator,
    mediator,
    recipient,
    random,
    newCompany,
    depositor1,
    depositor2,
    depositor3
  ]) => {
    describe("EscrowDai::instances", () => {
      it("instantiate contract", async () => {
        escrowDB = await EscrowDB.deployed();
        escrowDai = await EscrowDai.deployed();
        dai = await DaiToken.deployed();
      });
    });

    describe("EscrowDai::authority", () => {
      it("only owner can change company address", async () => {
        await escrowDai.setCompanyAddress(newCompany, { from: owner }).should.be
          .fulfilled;
      });

      it("only owner can change escrow fees", async () => {
        await escrowDB.updateFees(2, 3, 1, { from: owner }).should.be.fulfilled;
        await escrowDB.updateFees(1, 2, 1, { from: owner }).should.be.fulfilled;
      });
    });

    describe("EscrowDai::create", () => {
      it("needs to approve dai first", async () => {
        await escrowDai.createEscrow(
          "Lawyers Firm",
          web3.utils.toWei("100"),
          7 * 24 * 60 * 60 /*7 days */,
          mediator,
          recipient,
          web3.utils.toWei("1"),
          [depositor1, depositor2, depositor3],
          true,
          0,
          { from: creator }
        ).should.be.rejected;
      });

      it("user can't create an escrow without sending minimum deposit", async () => {
        await dai.mint(creator, web3.utils.toWei("1000"), { from: owner })
          .should.be.fulfilled;
        await dai.approve(escrowDai.address, web3.utils.toWei("5"), {
          from: creator
        }).should.be.fulfilled;
        await escrowDai.createEscrow(
          "Lawyers Firm",
          web3.utils.toWei("500"),
          7 * 24 * 60 * 60 /*7 days */,
          mediator,
          recipient,
          web3.utils.toWei("1"),
          [depositor1, depositor2, depositor3],
          true,
          0,
          { from: creator }
        ).should.be.rejected;
      });

      it("user creates an escrow ", async () => {
        await dai.mint(creator, web3.utils.toWei("1000"), { from: owner })
          .should.be.fulfilled;
        await dai.approve(escrowDai.address, web3.utils.toWei("5"), {
          from: creator
        }).should.be.fulfilled;
        await escrowDai.createEscrow(
          "Lawyers Firm",
          web3.utils.toWei("500"),
          7 * 24 * 60 * 60 /*7 days */,
          mediator,
          recipient,
          web3.utils.toWei("5"),
          [depositor1, depositor2, depositor3],
          true,
          0,
          { from: creator }
        ).should.be.fulfilled;
      });

      it("correct new escrow event", async () => {
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
        values.totalDeposited.toString().should.be.equal("0");
        values.contractValue
          .toString()
          .should.be.equal(web3.utils.toWei("500"));
      });
    });

    describe("EscrowDai::release scenario", () => {
      it("cannot deposit to escrow without approving dai first", async () => {
        await dai.mint(depositor1, web3.utils.toWei("10"), { from: owner })
          .should.be.fulfilled;
        await escrowDai.escrowDeposit(1, web3.utils.toWei("10"), {
          from: depositor1
        }).should.be.rejected;
      });

      it("only valid depositors can deposit funds to escrow", async () => {
        await dai.mint(depositor1, web3.utils.toWei("40"), { from: owner })
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

        let values = await escrowDB.getAmounts(1);
        values.totalDeposited
          .toString()
          .should.be.equal(web3.utils.toWei("200"));
      });

      it("cannot release escrow before completed", async () => {
        await escrowDai.releaseEscrow(1, { from: mediator }).should.be.rejected;
      });

      it("depositor cannot deposit more than contract value", async () => {
        await dai.mint(depositor3, web3.utils.toWei("350"), { from: owner })
          .should.be.fulfilled;
        await dai.approve(escrowDai.address, web3.utils.toWei("350"), {
          from: depositor3
        }).should.be.fulfilled;
        //This third depositor approves 350 DAI to be sent to contract
        // but only 295 are taken to complete the contract
        await escrowDai.escrowDeposit(1, web3.utils.toWei("350"), {
          from: depositor3
        }).should.be.fulfilled;

        let values = await escrowDB.getAmounts(1);
        values.totalDeposited
          .toString()
          .should.be.equal(web3.utils.toWei("500"));

        let depositEvents = await escrowDai.getPastEvents("NewDepositDai", {
          filter: { escrowId: 1 },
          fromBlock: 0,
          toBlock: "latest"
        });

        //Only depositors deposits count in events
        depositEvents.length.should.be.equal(3);

        let states = await escrowDB.getStates(1);
        states.completed.should.be.true;
      });

      it("only mediator can release escrow", async () => {
        await escrowDai.releaseEscrow(1, { from: random }).should.be.rejected;
      });

      it("successfully releases escrow", async () => {
        await escrowDai.releaseEscrow(1, { from: mediator }).should.be
          .fulfilled;

        let values = await escrowDB.getAmounts(1);
        values.totalDeposited
          .toString()
          .should.be.equal(web3.utils.toWei("500"));

        // 500 - 2%
        let newBalance = await dai.balanceOf(recipient);
        newBalance.toString().should.be.equal(web3.utils.toWei("490"));

        let states = await escrowDB.getStates(1);
        states.released.should.be.true;
      });
    });

    describe("EscrowDai::cancelled scenario", () => {
      it("user creates an escrow ", async () => {
        await dai.mint(creator, web3.utils.toWei("1000"), { from: owner })
          .should.be.fulfilled;
        await dai.approve(escrowDai.address, web3.utils.toWei("10"), {
          from: creator
        }).should.be.fulfilled;
        await escrowDai.createEscrow(
          "Buy Supplies",
          web3.utils.toWei("1000"),
          2 * 60 /*2 min */,
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

        events.length.should.be.equal(2);
      });

      it("depositors send tokens to contract", async () => {
        await dai.mint(depositor1, web3.utils.toWei("50"), { from: owner })
          .should.be.fulfilled;
        await dai.approve(escrowDai.address, web3.utils.toWei("50"), {
          from: depositor1
        }).should.be.fulfilled;
        await escrowDai.escrowDeposit(2, web3.utils.toWei("50"), {
          from: depositor1
        }).should.be.fulfilled;

        await dai.mint(depositor2, web3.utils.toWei("150"), { from: owner })
          .should.be.fulfilled;
        await dai.approve(escrowDai.address, web3.utils.toWei("150"), {
          from: depositor2
        }).should.be.fulfilled;
        await escrowDai.escrowDeposit(2, web3.utils.toWei("150"), {
          from: depositor2
        }).should.be.fulfilled;

        await dai.mint(depositor3, web3.utils.toWei("200"), { from: owner })
          .should.be.fulfilled;
        await dai.approve(escrowDai.address, web3.utils.toWei("200"), {
          from: depositor3
        }).should.be.fulfilled;
        await escrowDai.escrowDeposit(2, web3.utils.toWei("200"), {
          from: depositor3
        }).should.be.fulfilled;

        let values = await escrowDB.getAmounts(2);
        values.totalDeposited
          .toString()
          .should.be.equal(web3.utils.toWei("400"));
      });

      it("only mediator can release escrow", async () => {
        await escrowDai.cancelEscrow(2, { from: random }).should.be.rejected;
      });

      it("mediator cancels escrow", async () => {
        await escrowDai.cancelEscrow(2, { from: mediator }).should.be.fulfilled;

        let states = await escrowDB.getStates(2);
        states.cancelled.should.be.true;
      });

      it("depositors get back their funds", async () => {
        let balance = await dai.balanceOf(depositor1);
        balance.toString().should.be.equal(web3.utils.toWei("50"));

        balance = await dai.balanceOf(depositor2);
        balance.toString().should.be.equal(web3.utils.toWei("150"));

        balance = await dai.balanceOf(depositor3);
        balance.toString().should.be.equal(web3.utils.toWei("250"));
      });
    });

    describe("EscrowDai::open type scenario with mediator fee", () => {
      it("user creates an escrow ", async () => {
        await dai.mint(creator, web3.utils.toWei("1000"), { from: owner })
          .should.be.fulfilled;
        await dai.approve(escrowDai.address, web3.utils.toWei("10"), {
          from: creator
        }).should.be.fulfilled;
        await escrowDai.createEscrow(
          "Buy Supplies",
          web3.utils.toWei("1000"),
          2 * 60 /*2 min */,
          mediator,
          recipient,
          web3.utils.toWei("10"),
          [],
          false,
          1 /* mediator fee */,
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

        events.length.should.be.equal(3);
      });

      it("depositors send tokens to contract", async () => {
        await dai.mint(depositor1, web3.utils.toWei("50"), { from: owner })
          .should.be.fulfilled;
        await dai.approve(escrowDai.address, web3.utils.toWei("50"), {
          from: depositor1
        }).should.be.fulfilled;
        await escrowDai.escrowDeposit(3, web3.utils.toWei("50"), {
          from: depositor1
        }).should.be.fulfilled;

        await dai.mint(depositor2, web3.utils.toWei("150"), { from: owner })
          .should.be.fulfilled;
        await dai.approve(escrowDai.address, web3.utils.toWei("150"), {
          from: depositor2
        }).should.be.fulfilled;
        await escrowDai.escrowDeposit(3, web3.utils.toWei("150"), {
          from: depositor2
        }).should.be.fulfilled;

        await dai.mint(depositor3, web3.utils.toWei("200"), { from: owner })
          .should.be.fulfilled;
        await dai.approve(escrowDai.address, web3.utils.toWei("200"), {
          from: depositor3
        }).should.be.fulfilled;
        await escrowDai.escrowDeposit(3, web3.utils.toWei("200"), {
          from: depositor3
        }).should.be.fulfilled;

        let values = await escrowDB.getAmounts(3);
        values.totalDeposited
          .toString()
          .should.be.equal(web3.utils.toWei("400"));
      });

      it("only mediator can release escrow", async () => {
        await escrowDai.cancelEscrow(3, { from: random }).should.be.rejected;
      });

      it("mediator cancels escrow", async () => {
        await escrowDai.cancelEscrow(3, { from: mediator }).should.be.fulfilled;

        let states = await escrowDB.getStates(3);
        states.cancelled.should.be.true;
      });

      it("depositors get back their funds", async () => {
        // previous balances + deposited - mediator fee %
        let balance = await dai.balanceOf(depositor1);
        balance
          .toString()
          .should.be.equal(web3.utils.toWei(String(50 + 50 * 0.99)));

        balance = await dai.balanceOf(depositor2);
        balance
          .toString()
          .should.be.equal(web3.utils.toWei(String(150 + 150 * 0.99)));

        // 250 + 55 returned from first escrow
        balance = await dai.balanceOf(depositor3);
        balance
          .toString()
          .should.be.equal(web3.utils.toWei(String(250 + 200 * 0.99)));
      });
    });
  }
);
