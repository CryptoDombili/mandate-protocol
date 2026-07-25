require('@nomicfoundation/hardhat-toolbox')
require('dotenv').config()

const privateKey = process.env.DEPLOYER_PRIVATE_KEY

module.exports = {
  solidity: {
    version: '0.8.26',
    settings: {
      optimizer: { enabled: true, runs: 500 },
      viaIR: false,
    },
  },
  networks: {
    hardhat: {},
    minato: {
      url: process.env.MINATO_RPC_URL || 'https://rpc.minato.soneium.org/',
      chainId: 1946,
      accounts: privateKey ? [privateKey] : [],
    },
  },
  etherscan: {
    apiKey: {
      minato: process.env.MINATO_EXPLORER_API_KEY || 'empty',
    },
    customChains: [
      {
        network: 'minato',
        chainId: 1946,
        urls: {
          apiURL: 'https://soneium-minato.blockscout.com/api',
          browserURL: 'https://soneium-minato.blockscout.com',
        },
      },
    ],
  },
}
