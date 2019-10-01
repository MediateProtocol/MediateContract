const EscrowDai = artifacts.require("EscrowDai");
const EscrowEth = artifacts.require("EscrowEth");
const EscrowDB = artifacts.require("EscrowDB");
const DaiToken = artifacts.require("DaiToken");
const CronJobManager = artifacts.require("CronJobManager");

const FEES_CANCELLED = 1; //percentage
const FEES_RELEASED = 2; //percentage
const FEE_DEPOSIT = 1; //percentage

const companyAddress = "0xB17Bf32a11A68c4E6756DbAdB414A8bd19B21ab8";

module.exports = function(deployer, network, accounts) {
  deployer
    .deploy(DaiToken)
    .then(() => deployer.deploy(CronJobManager))
    .then(() =>
      deployer.deploy(EscrowDB, FEES_CANCELLED, FEES_RELEASED, FEE_DEPOSIT)
    )
    .then(() =>
      deployer.deploy(
        EscrowDai,
        DaiToken.address,
        companyAddress,
        EscrowDB.address,
        CronJobManager.address
      )
    )
    .then(() =>
      deployer.deploy(
        EscrowEth,
        companyAddress,
        EscrowDB.address,
        CronJobManager.address
      )
    )
    .then(async () => {
      escrowDB = await EscrowDB.deployed();
      cronJobManager = await CronJobManager.deployed();

      await escrowDB.setEscrowDai(EscrowDai.address);
      await escrowDB.setEscrowEth(EscrowEth.address);
      await escrowDB.initialize(CronJobManager.address);
      await cronJobManager.initialize(EscrowDB.address);
    });
};
