/**
 * ogStorageService.js
 * Handles uploading/retrieving AI decision data on 0G Storage.
 */

'use strict'

const { ZgFile, Indexer, getFlowContract } = require('@0glabs/0g-ts-sdk')
const { ethers } = require('ethers')
const path = require('path')
const os = require('os')
const fs = require('fs')
const crypto = require('crypto')

let indexer = null
let provider = null
let signer = null

// ── Initialize ─────────────────────────────────────────────────────────────
function isRealKey(value) {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{64}$/.test(value)
}

function getClients() {
  if (!indexer) {
    const rpc        = process.env.OG_CHAIN_RPC || 'https://evmrpc.0g.ai'
    const indexerRpc = process.env.OG_INDEXER_RPC || 'https://indexer-storage.0g.ai'
    const privateKey = process.env.PRIVATE_KEY

    provider = new ethers.JsonRpcProvider(rpc)

    if (!isRealKey(privateKey)) {
      console.warn('[0GStorage] PRIVATE_KEY missing/placeholder — uploads will be simulated')
    } else {
      signer = new ethers.Wallet(privateKey, provider)
    }

    indexer = new Indexer(indexerRpc)
    console.log(`[0GStorage] Initialized — indexer: ${indexerRpc}`)
  }
  return { indexer, provider, signer }
}

// ── Helper: write temp file ─────────────────────────────────────────────────
function writeTempFile(data) {
  const tmpDir = os.tmpdir()
  const filename = `alphatrace_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.json`
  const filePath = path.join(tmpDir, filename)
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8')
  return filePath
}

// ── storeDecision ───────────────────────────────────────────────────────────
/**
 * Upload a decision JSON to 0G Storage.
 * @param {Object} decisionData — full decision object
 * @returns {Promise<{storageHash: string, txHash: string, size: number}>}
 */
async function storeDecision(decisionData) {
  const { indexer, signer } = getClients()

  const payload = {
    ...decisionData,
    agentVersion: '1.0.0',
    storedAt: new Date().toISOString(),
  }

  const jsonStr = JSON.stringify(payload, null, 2)
  const size = Buffer.byteLength(jsonStr, 'utf8')

  // Simulate if no real signer (placeholder key)
  if (!signer) {
    const simulatedHash = '0x' + crypto.createHash('sha256').update(jsonStr).digest('hex')
    console.log(`[0GStorage] ⚠️  Simulated (no key) — hash: ${simulatedHash.slice(0, 20)}...`)
    return { storageHash: simulatedHash, txHash: 'SIMULATED', size }
  }

  const tmpPath = writeTempFile(payload)

  try {
    const zgFile = await ZgFile.fromFilePath(tmpPath)
    const [tree, treeErr] = await zgFile.merkleTree()
    if (treeErr) throw new Error(`Merkle tree error: ${treeErr}`)

    const storageHash = tree.rootHash()
    const [txHash, uploadErr] = await indexer.upload(zgFile, signer)
    if (uploadErr) throw new Error(`Upload error: ${uploadErr}`)

    console.log(`[0GStorage] ✅ Stored — hash: ${storageHash} | tx: ${txHash}`)
    return { storageHash, txHash, size }
  } catch (err) {
    // Network unreachable — simulate gracefully
    const isNetErr = err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED' || err.message?.includes('ENOTFOUND')
    if (isNetErr) {
      const simulatedHash = '0x' + crypto.createHash('sha256').update(jsonStr).digest('hex')
      console.warn(`[0GStorage] Network unreachable — simulating with SHA-256 hash`)
      return { storageHash: simulatedHash, txHash: 'SIMULATED_OFFLINE', size }
    }
    throw err
  } finally {
    try { fs.unlinkSync(tmpPath) } catch {/* ignore */}
  }
}

// ── retrieveDecision ─────────────────────────────────────────────────────────
/**
 * Download and parse a decision from 0G Storage.
 * @param {string} storageHash — content root hash
 * @returns {Promise<Object>} Parsed decision JSON
 */
async function retrieveDecision(storageHash) {
  const { indexer } = getClients()

  if (!storageHash || storageHash === 'SIMULATED' || storageHash === 'PENDING') {
    throw new Error('Invalid storage hash — cannot retrieve')
  }

  const tmpPath = path.join(os.tmpdir(), `alphatrace_retrieve_${Date.now()}.json`)

  try {
    const [, downloadErr] = await indexer.download(storageHash, tmpPath, false)
    if (downloadErr) throw new Error(`Download error: ${downloadErr}`)

    const content = fs.readFileSync(tmpPath, 'utf8')
    return JSON.parse(content)
  } finally {
    try { fs.unlinkSync(tmpPath) } catch {/* ignore */}
  }
}

// ── verifyDecision ────────────────────────────────────────────────────────────
/**
 * Check if a file with the given hash exists on 0G Storage.
 * @param {string} storageHash
 * @returns {Promise<{exists: boolean, size: number}>}
 */
async function verifyDecision(storageHash) {
  if (!storageHash || storageHash === 'SIMULATED') {
    return { exists: false, size: 0, note: 'Simulated or invalid hash' }
  }

  if (storageHash === 'PENDING') {
    return { exists: false, size: 0, note: 'Upload pending' }
  }

  try {
    const { indexer } = getClients()
    // Attempt a metadata probe — not all SDK versions expose this directly
    // Try to query file info from the indexer
    const info = await indexer.getFileInfo(storageHash).catch(() => null)
    if (info) {
      return { exists: true, size: info.size || 0 }
    }
    // Fallback: attempt to download to check existence
    const tmpPath = path.join(os.tmpdir(), `verify_${Date.now()}.tmp`)
    try {
      const [, err] = await indexer.download(storageHash, tmpPath, false)
      if (!err) {
        const stat = fs.statSync(tmpPath)
        return { exists: true, size: stat.size }
      }
    } finally {
      try { fs.unlinkSync(tmpPath) } catch {/* ignore */}
    }
    return { exists: false, size: 0 }
  } catch (err) {
    console.warn(`[0GStorage] verifyDecision error: ${err.message}`)
    return { exists: false, size: 0, error: err.message }
  }
}

module.exports = { storeDecision, retrieveDecision, verifyDecision }
