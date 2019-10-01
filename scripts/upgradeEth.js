const EscrowEth = artifacts.require("EscrowEth");
const EscrowDB = artifacts.require("EscrowDB");

const companyAddress = "0x69310fC745bf6ff51966AE456Ee09Fa5402F5FcB";

module.exports = async callback => {
  try {
    console.log("Deploying new EscrowEth contract...");
    escrowEth = await EscrowEth.new(
      companyAddress,
      EscrowDB.address,
      CronJobManager.address
    );

    console.log("Updating address in DB...");
    escrowDB = await EscrowDB.deployed();
    await escrowDB.setEscrowEth(escrowEth.address);

    console.log("\nDone!");
    callback();
  } catch (e) {
    callback(e);
  }
};
