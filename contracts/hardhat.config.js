require('@nomicfoundation/hardhat-toolbox')
require('dotenv').config()

const PRIVATE_KEY = process.env.PRIVATE_KEY || '0x0000000000000000000000000000000000000000000000000000000000000001'

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: '0.8.20',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    og_mainnet: {
      url: process.env.OG_CHAIN_RPC || 'https://evmrpc.0g.ai',
      chainId: 16600,
      accounts: [PRIVATE_KEY],
      gasPrice: 'auto',
      timeout: 120000,
    },
    og_testnet: {
      url: process.env.OG_TESTNET_RPC || 'https://evmrpc-testnet.0g.ai',
      chainId: 16602,
      accounts: [PRIVATE_KEY],
      gasPrice: 'auto',
      timeout: 120000,
    },
    hardhat: {
      chainId: 31337,
    },
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
  },
  mocha: {
    timeout: 120000,
  },
}
