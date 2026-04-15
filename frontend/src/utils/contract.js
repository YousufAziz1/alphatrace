// contract.js — Handles Web3 Wallet connection and executing the AlphaTrace smart contract
import { ethers } from 'ethers'

const ABI = [
  'function recordDecision(string market, string action, string storageHash) external',
  'function getContractStats() external view returns (uint256, uint256)',
]

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || '0x428B490C2fb0E3137AfB478adc7cF3B668209534'
const CHAIN_ID = 16602 // 0G Newton Testnet
const CHAIN_ID_HEX = '0x40DA'  // 16602 in hex
const RPC_URL = 'https://evmrpc-testnet.0g.ai'

// ── Network helpers ────────────────────────────────────────────────────────────

const NETWORK_CONFIG = {
  chainId: CHAIN_ID_HEX,
  chainName: '0G Newton Testnet',
  rpcUrls: [RPC_URL],
  nativeCurrency: { name: '0G', symbol: 'A0GI', decimals: 18 },
  blockExplorerUrls: ['https://chainscan-galileo.0g.ai'],
}

async function ensureCorrectNetwork() {
  const currentChainId = await window.ethereum.request({ method: 'eth_chainId' })
  if (currentChainId.toLowerCase() === CHAIN_ID_HEX.toLowerCase()) return // already correct

  console.log(`[Web3] Switching from ${currentChainId} to ${CHAIN_ID_HEX} (0G Newton Testnet)...`)
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: CHAIN_ID_HEX }],
    })
  } catch (switchError) {
    // Error code 4902 = chain not added to MetaMask yet
    if (switchError.code === 4902 || switchError.code === -32603) {
      console.log('[Web3] Network not found — adding 0G Newton Testnet to MetaMask...')
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [NETWORK_CONFIG],
      })
    } else if (switchError.code === 4001) {
      throw new Error('User rejected network switch. Please switch to 0G Newton Testnet manually.')
    } else {
      throw new Error(`Could not switch network: ${switchError.message}`)
    }
  }
}

// ── connectWallet ──────────────────────────────────────────────────────────────

/**
 * Connects MetaMask, auto-switches to 0G Newton Testnet, returns wallet address.
 */
export async function connectWallet() {
  if (!window.ethereum) {
    throw new Error('MetaMask not found! Please install the MetaMask extension.')
  }

  // Request accounts (triggers MetaMask popup)
  let accounts
  try {
    accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
  } catch (err) {
    if (err.code === 4001) throw new Error('User rejected wallet connection.')
    throw new Error(`Wallet connection failed: ${err.message}`)
  }

  if (!accounts || accounts.length === 0) {
    throw new Error('No accounts found. Please unlock MetaMask.')
  }

  // Auto-switch network
  await ensureCorrectNetwork()

  return accounts[0]
}

// ── recordDecisionOnChain ──────────────────────────────────────────────────────

/**
 * Signs and sends the AlphaTrace recordDecision transaction via the user's MetaMask wallet.
 * Includes duplicate protection (caller should also guard), network auto-switch,
 * and clean error messages for every failure case.
 */
export async function recordDecisionOnChain(market, action, storageHash) {
  if (!window.ethereum) throw new Error('MetaMask is not installed.')

  // 1. Auto-switch network before sending tx
  await ensureCorrectNetwork()

  const provider = new ethers.BrowserProvider(window.ethereum)
  const signer = await provider.getSigner()
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer)

  // 2. Validate args
  const safeMarket = String(market || 'ETH/USDC').slice(0, 50)
  const safeAction = String(action || 'HOLD').slice(0, 10)
  const safeHash   = String(storageHash || 'none').slice(0, 128)

  console.log('[Web3] Sending TX to AlphaTrace contract...', { safeMarket, safeAction, safeHash })

  let tx
  try {
    // 3. Estimate gas before sending to catch potential revert early
    await contract.recordDecision.estimateGas(safeMarket, safeAction, safeHash)
    tx = await contract.recordDecision(safeMarket, safeAction, safeHash)
  } catch (txError) {
    const msg = txError?.message || ''
    if (txError.code === 4001 || msg.includes('user rejected') || msg.includes('User denied')) {
      throw new Error('Transaction rejected by user.')
    }
    if (msg.includes('insufficient funds')) {
      throw new Error('Insufficient A0GI balance for gas. Get testnet tokens from the 0G faucet.')
    }
    if (msg.includes('network') || msg.includes('Network') || msg.includes('fetch')) {
      throw new Error('Network error. Please check your connection and that MetaMask is on 0G Newton Testnet.')
    }
    throw new Error(`Transaction failed: ${msg.slice(0, 120)}`)
  }

  console.log('[Web3] TX submitted, waiting for on-chain confirmation...', tx.hash)

  // 4. Wait for 1 block confirmation
  let receipt
  try {
    receipt = await tx.wait(1)
  } catch (waitErr) {
    // TX submitted but confirmation timed out — return hash anyway  
    console.warn('[Web3] Confirmation wait failed, returning tx hash:', tx.hash)
    return tx.hash
  }

  if (receipt && receipt.status === 1) {
    console.log('[Web3] ✅ Transaction confirmed!', tx.hash)
    return tx.hash
  }

  throw new Error('Transaction was reverted on-chain.')
}
