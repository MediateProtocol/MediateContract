const BigNumber = web3.utils.BN;
require("chai")
  .use(require("chai-shallow-deep-equal"))
  .use(require("chai-as-promised"))
  .should();

const SUPPLY = new BigNumber(
    web3.utils.toWei("100000000", "ether") //100 Million
);

let DaiToken = artifacts.require("DaiToken");

let dai;

contract("DaiToken", ([owner, user1, user2, newMinter, random]) => {
  

  describe("DAI::instance", async() => {
    dai = await DaiToken.deployed();
  })

  describe("DAI::details", () => {
    it("has correct symbol", async() => {
      let _symbol = await dai.symbol();
      _symbol.should.be.equal("DAI", "incorrect symbol");
    })

    it("has correct decimals", async() => {
      let _decimals = await dai.decimals();
      _decimals.toNumber().should.be.equal(18, "incorrect decimals");
    })

    it("has correct supply", async() => {
        let _supply = await dai.totalSupply();
        _supply.toString().should.be.equal(SUPPLY.toString(), "incorrect supply");
      })
  })  

  describe("DAI::minting", () => {

    it("check minter roles", async() => {
      let isMinter = await dai.isMinter(owner);
      isMinter.should.be.true;

      isMinter = await dai.isMinter(random);
      isMinter.should.be.false;
    })

    it("random address can't mint tokens", async() => {
      await dai.mint(user1, "1000", {from : random}).should.not.be.fulfilled;
    })

    it("only owner can mint tokens", async() => {
      await dai.mint(user1, "1000", {from : owner}).should.be.fulfilled;
    })

    it("can add new minter of coins", async() => {
      await dai.addMinter(newMinter).should.be.fulfilled;
    })
  }) 

  describe("DAI::transfering", () => {

    it("user 1 can transfer tokens", async() => {
      await dai.transfer(user2, "1000", {from : user1}).should.be.fulfilled;
    })

    it("using approve and transfeFrom", async() => {
      await dai.mint(user1, "1000", {from : owner}).should.be.fulfilled;
      await dai.approve(owner, "1000", {from : user1});
      await dai.transferFrom(user1, user2, "1000", {from : owner}).should.be.fulfilled;
    })
  })
  
});