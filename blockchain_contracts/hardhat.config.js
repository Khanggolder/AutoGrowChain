require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-verify");
require('dotenv').config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || '';
const EXPLORER_API_KEY = process.env.EXPLORER_API_KEY || '';

module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.20",
        settings: {
          evmVersion: "cancun",
          optimizer: {
            enabled: true,
            runs: 1000,
          },
        },
      },
      {
        version: "0.8.28",
        settings: {
          evmVersion: "cancun",
          optimizer: {
            enabled: true,
            runs: 1000,
          },
        },
      },
    ]
  },
  networks: {
    pioneZero: {
      url: "https://rpc.zeroscan.org",
      chainId: 5080,
      accounts: [PRIVATE_KEY],
    },
    localhost: {
      url: "http://127.0.0.1:8545",
    },
  },
  etherscan: {
    apiKey: {
      pioneZero: EXPLORER_API_KEY
    },
    customChains: [
      {
        network: "pioneZero",
        chainId: 5080,
        urls: {
          apiURL: "https://zeroscan.org/api/",
          browserURL: "https://zeroscan.org/",
        },
      }
    ]
  }
};


