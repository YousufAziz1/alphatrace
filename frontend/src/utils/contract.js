// contract.js — Handles Web3 Wallet connection and executing the AlphaTrace smart contract
import { ethers } from 'ethers'

// Replace with from hardhat compilation (contracts/artifacts/contracts/AlphaTrace.sol/AlphaTrace.json)
const ABI = [
  "function recordDecision(string market, string action, string storageHash) external",
  "function getContractStats() external view returns (uint256, uint256)"
]

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || '0x428B490C2fb0E3137AfB478adc7cF3B668209534' // Fallback to our deployed contract
const CHAIN_ID = 16602 // 0G Newton Testnet
const RPC_URL = 'https://evmrpc-testnet.0g.ai'

/**
 * Connects the MetaMask wallet and ensures correct network
 */
export async function connectWallet() {
  if (!window.ethereum) {
    throw new Error("MetaMask not found! Please install MetaMask extensions.")
  }

  // Request accounts
  const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
  if (accounts.length === 0) throw new Error("No accounts authorized.")

  const account = accounts[0]

  // Switch to the correct network
  const currentChainId = await window.ethereum.request({ method: 'eth_chainId' })
  if (currentChainId !== `0x${CHAIN_ID.toString(16)}`) {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${CHAIN_ID.toString(16)}` }],
      })
    } catch (switchError) {
      // If the network is not added to metamask, you can add it
      if (switchError.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: `0x${CHAIN_ID.toString(16)}`,
              chainName: '0G Newton Testnet',
              rpcUrls: [RPC_URL],
              nativeCurrency: { name: '0G', symbol: 'A0GI', decimals: 18 },
              blockExplorerUrls: ['https://chainscan-galileo.0g.ai'],
            },
          ],
        })
      } else {
        throw new Error("Failed to switch network in MetaMask.")
      }
    }
  }

  return account
}

/**
 * Prompts user to send the transaction to the AlphaTrace Smart Contract on 0G
 */
export async function recordDecisionOnChain(market, action, storageHash) {
  if (!window.ethereum) throw new Error("MetaMask is not connected.")

  const provider = new ethers.BrowserProvider(window.ethereum)
  const signer = await provider.getSigner()
  
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer)

  console.log('[Web3] Prompting MetaMask to sign transaction...', { market, action, storageHash })
  
  // Prompt metamask to execute the transaction
  const tx = await contract.recordDecision(market, action, storageHash)
  
  console.log('[Web3] Transaction submitted, waiting for confirmation...', tx.hash)
  
  // Wait for 1 confirmation
  const receipt = await tx.wait(1)
  
  if (receipt.status === 1) {
    console.log('[Web3] Transaction confirmed!', tx.hash)
    return tx.hash
  } else {
    throw new Error('Transaction failed on-chain.')
  }
}
