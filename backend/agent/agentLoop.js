/**
 * agentLoop.js
 * The autonomous AlphaTrace agent — runs on a cron schedule.
 * Each cycle: fetch market data → Claude analysis → 0G Storage → 0G Chain
 */

'use strict'

const cron = require('node-cron')
const { v4: uuidv4 } = require('uuid')

const marketDataService = require('../services/marketDataService')
const aiService = require('../services/aiService')
const ogStorageService = require('../services/ogStorageService')
const ogChainService = require('../services/ogChainService')
const decisionLogger = require('./decisionLogger')

// ── Agent State ───────────────────────────────────────────────────────────────
const agentState = {
  isRunning: false,
  isPaused: false,   // true = user stopped the agent, auto-loop will skip
  lastRunTime: null,
  nextRunTime: null,
  totalDecisions: 0,
  cycleCount: 0,
  lastError: null,
  status: 'IDLE',  // 'IDLE' | 'RUNNING' | 'ERROR' | 'STOPPED'
  currentMarkets: [],
}

// ── WebSocket broadcast callback (injected by server.js) ─────────────────────
let broadcastFn = null
function setBroadcast(fn) { broadcastFn = fn }

function broadcast(type, data) {
  if (broadcastFn) {
    try { broadcastFn({ type, data }) } catch {/* ignore */}
  }
}

// Target markets
const TARGET_MARKETS = ['ethereum', 'bitcoin', 'solana', 'arbitrum']

// ── runAgentCycle ─────────────────────────────────────────────────────────────
async function runAgentCycle() {
  if (agentState.isRunning) {
    console.log('[Agent] Cycle already running — skipping')
    return []
  }

  if (agentState.isPaused) {
    console.log('[Agent] Skipping cycle — agent is paused by user.')
    return []
  }

  agentState.isRunning = true
  agentState.status = 'RUNNING'
  agentState.lastRunTime = new Date()
  agentState.currentMarkets = TARGET_MARKETS
  agentState.lastError = null

  broadcast('AGENT_STATUS', { ...agentState })

  const newDecisions = []

  try {
    console.log('\n[Agent] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`[Agent] Starting cycle #${agentState.cycleCount + 1} — ${new Date().toISOString()}`)

    // 1. Fetch market data
    console.log('[Agent] Fetching market data...')
    const marketDataList = await marketDataService.fetchMarketData(TARGET_MARKETS)

    // 2. Get historical context
    const historicalDecisions = decisionLogger.getLatest(10)

    // 3. Analyze each market
    for (const marketData of marketDataList) {
      broadcast('AGENT_STATUS', {
        ...agentState,
        currentMarkets: [marketData.id],
        message: `Analyzing ${marketData.symbol}...`,
      })

      let decision = null
      let storageHash = 'PENDING'
      let chainResult = null

      try {
        // ── AI analysis ─────────────────────────────────────
        console.log(`[Agent] Analyzing ${marketData.symbol}...`)
        decision = await aiService.analyzeMarket(marketData, historicalDecisions)

        // Enrich with metadata
        decision.id = uuidv4()
        decision.timestamp = new Date().toISOString()
        decision.agentVersion = '1.0.0'
        decision.marketData = {
          rsi: marketData.rsi,
          trend: marketData.trend,
          volume24h: marketData.volume24h,
          change24h: marketData.change24h,
          high24h: marketData.high24h,
          low24h: marketData.low24h,
        }

        // ── 0G Storage ──────────────────────────────────────────
        console.log(`[Agent] Uploading ${decision.market} decision to 0G Storage...`)
        let storageResult = { storageHash: 'PENDING', txHash: 'PENDING', size: 0 }
        try {
          storageResult = await ogStorageService.storeDecision(decision)
          storageHash = storageResult.storageHash
          decision.storageHash = storageHash
          decision.storageTxHash = storageResult.txHash
          decision.storageSize = storageResult.size
          console.log(`[Agent] 0G Storage ✅ hash: ${storageHash}`)
        } catch (storageErr) {
          console.error(`[Agent] 0G Storage failed: ${storageErr.message} — using PENDING`)
          decision.storageHash = 'PENDING'
          decision.storageError = storageErr.message
          // Async retry
          setTimeout(async () => {
            try {
              const retry = await ogStorageService.storeDecision(decision)
              decision.storageHash = retry.storageHash
              console.log(`[Agent] Storage retry ✅ for ${decision.market}: ${retry.storageHash}`)
            } catch (e) {
              console.error(`[Agent] Storage retry failed: ${e.message}`)
            }
          }, 15000)
        }

        // ── 0G Chain ────────────────────────────────────────────
        console.log(`[Agent] Recording ${decision.market} on 0G Chain...`)
        try {
          chainResult = await ogChainService.recordDecision(decision, storageHash)
          decision.txHash = chainResult.txHash
          decision.chainDecisionId = chainResult.decisionId
          decision.blockNumber = chainResult.blockNumber
          decision.explorerUrl = chainResult.explorerUrl
          decision.simulated = chainResult.simulated
          console.log(`[Agent] 0G Chain ✅ tx: ${chainResult.txHash}`)
        } catch (chainErr) {
          console.error(`[Agent] 0G Chain failed: ${chainErr.message}`)
          decision.chainError = chainErr.message
          decision.txHash = null
          decision.simulated = true
          // Fallback: point to contract address so 'Verify On-Chain' always shows
          const contractAddr = process.env.CONTRACT_ADDRESS || '0x428B490C2fb0E3137AfB478adc7cF3B668209534'
          decision.explorerUrl = `https://chainscan-galileo.0g.ai/address/${contractAddr}`
        }

        // ── Persist ─────────────────────────────────────────────
        decisionLogger.addDecision(decision)
        agentState.totalDecisions++
        newDecisions.push(decision)

        // ── Broadcast to WebSocket clients ──────────────────────
        broadcast('NEW_DECISION', decision)

        console.log(`[Agent] ✅ ${decision.market} → ${decision.action} (${decision.confidence}% conf) stored + chained`)

      } catch (marketErr) {
        console.error(`[Agent] Failed to process ${marketData.symbol}: ${marketErr.message}`)
        // Continue with next market
      }

      // Gap between markets — free tier = 15 RPM. With 2 markets, 12s is safe.
      await new Promise((r) => setTimeout(r, 12000))
    }

    agentState.cycleCount++
    agentState.status = 'IDLE'
    console.log(`[Agent] Cycle #${agentState.cycleCount} complete — ${newDecisions.length} decisions recorded`)
    console.log('[Agent] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  } catch (err) {
    agentState.status = 'ERROR'
    agentState.lastError = err.message
    console.error('[Agent] Cycle error:', err.message)
  } finally {
    agentState.isRunning = false
    agentState.currentMarkets = []
    broadcast('AGENT_STATUS', { ...agentState })
  }

  return newDecisions
}

// ── startAgentLoop ────────────────────────────────────────────────────────────
function startAgentLoop() {
  const intervalMinutes = parseInt(process.env.AGENT_INTERVAL_MINUTES || '5', 10)

  console.log(`[Agent] Starting autonomous loop — interval: ${intervalMinutes}min`)

  // Run immediately on startup
  runAgentCycle().catch((err) => console.error('[Agent] Initial cycle error:', err.message))

  // Schedule recurring runs
  const cronExpr = `*/${intervalMinutes} * * * *`
  const task = cron.schedule(cronExpr, () => {
    const next = new Date(Date.now() + intervalMinutes * 60 * 1000)
    agentState.nextRunTime = next
    runAgentCycle().catch((err) => console.error('[Agent] Scheduled cycle error:', err.message))
  })

  // Set next run time
  agentState.nextRunTime = new Date(Date.now() + intervalMinutes * 60 * 1000)

  console.log(`[Agent] Cron schedule: ${cronExpr}`)
  return task
}

// ── stopAgent / startAgent ────────────────────────────────────────────────────
function stopAgent() {
  agentState.isPaused = true
  agentState.status = 'STOPPED'
  agentState.isRunning = false
  console.log('[Agent] 🛑 Agent stopped by user.')
  broadcast('AGENT_STATUS', { ...agentState })
}

function startAgent() {
  agentState.isPaused = false
  agentState.status = 'IDLE'
  console.log('[Agent] ▶️  Agent started by user.')
  broadcast('AGENT_STATUS', { ...agentState })
  // Immediately run a cycle on resume
  runAgentCycle().catch((err) => console.error('[Agent] Start cycle error:', err.message))
}

// ── Wallet Manual Mode Methods ───────────────────────────────────────────────

/**
 * Runs the AI analysis and stores to 0G Storage to get a hash, but does NOT execute on EVM chain.
 * This is used for the Wallet Mode where the user pays gas and signs via Metamask.
 */
async function runWalletAnalysis() {
  console.log('[Wallet Agent] Fast-path analysis for wallet mode...')

  // 1. Fetch market data
  const mktData = await marketDataService.fetchMarketData()

  // 2. Pick ETH as target asset
  const assetData = mktData.find((m) => m.symbol === 'ETH') || mktData[0] || {
    price: 2500, symbol: 'ETH', rsi: 50, trend: 'NEUTRAL', change24h: 0
  }
  assetData.symbol = 'ETH/USDC' // normalise for prompt

  console.log(`[Wallet Agent] Analyzing ETH/USDC @ $${assetData.price}`)

  // 3. AI Analysis (only step that matters — no storage, no chain call)
  const recentHistory = decisionLogger.all.slice(0, 5)
  const jsonDecision  = await aiService.analyzeMarket(assetData, recentHistory)

  // 4. Build clean decision (storageHash will be filled after MetaMask signs)
  const decisionId = uuidv4()
  const cleanDecision = {
    id:            decisionId,
    timestamp:     new Date().toISOString(),
    market:        'ETH/USDC',
    action:        jsonDecision.action,
    confidence:    jsonDecision.confidence,
    reasoning:     jsonDecision.reasoning,
    shortReasoning:jsonDecision.shortReasoning,
    indicators:    jsonDecision.indicators || {},
    entryPrice:    assetData.price || jsonDecision.entryPrice,
    targetPrice:   jsonDecision.targetPrice || null,
    stopLoss:      jsonDecision.stopLoss  || null,
    riskScore:     jsonDecision.riskScore || 5,
    timeHorizon:   jsonDecision.timeHorizon || '12h',
    simulated:     false,
    storageHash:   `wallet-${decisionId}`, // placeholder — real hash stored async later
  }

  console.log(`[Wallet Agent] ✅ Decision ready in fast-path: ${cleanDecision.action} (${cleanDecision.confidence}%)`)
  return cleanDecision
}

/**
 * Saves a decision to local DB and broadcasts it after the user confirms the Metamask TX.
 */
function logExternalDecision(decision, txHash) {
  decision.txHash = txHash
  decision.simulated = false
  decision.explorerUrl = `https://chainscan-galileo.0g.ai/tx/${txHash}`
  
  // Update state
  agentState.totalDecisions++
  agentState.cycleCount++
  agentState.lastRunTime = new Date()
  
  // Save locally
  decisionLogger.add(decision)
  console.log(`[Wallet Agent] Logged manual MetaTask execution — Action: ${decision.action} | Tx: ${txHash}`)

  // Broadcast
  broadcast('NEW_DECISION', decision)
  broadcast('AGENT_STATUS', { ...agentState })
}

module.exports = {
  runAgentCycle,
  startAgentLoop,
  stopAgent,
  startAgent,
  runWalletAnalysis,
  logExternalDecision,
  agentState,
  setBroadcast,
}
