const HDWalletProvider = require("truffle-hdwallet-provider");
require('dotenv').config()

const providerFactory = network =>
  new HDWalletProvider(
    process.env.MNEMONICS || "", // Mnemonics of the deployer
    `https://${network}.infura.io/v3/${process.env.INFURA_KEY}`, // Provider URL => web3.HttpProvider
    0,
    20
  );

module.exports = {
  compilers: {
    solc: {
      version: "^0.5.5",
      optimizer: {
        enabled: true,
        runs: 200
      },
    }
  },
  networks: {
    mainnet: {
      provider: providerFactory("mainnet"),
      network_id: 1,
      gas: 7000000,
      gasPrice: 20000000000 // 20 Gwei, Change this value according to price average of the deployment time
    },
    rinkeby: {
      provider: providerFactory("rinkeby"),
      network_id: 4,
      gas: 6900000,
      gasPrice: 10000000000 // 10 Gwei
    },
    development: {
      host: "127.0.0.1",
      port: 8545,
      network_id: '999',
      gas: 7000000
    }
  },
  mocha: {
    enableTimeouts: false,
    useColors: true,
    reporter: "eth-gas-reporter",
    reporterOptions: {
      currency: "USD",
      gasPrice: 21
    }
  }
};