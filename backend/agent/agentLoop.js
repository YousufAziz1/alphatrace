/**
 * agentLoop.js
 * The autonomous AlphaTrace agent — runs on a cron schedule.
 * Each cycle: fetch market data → Claude analysis → 0G Storage → 0G Chain
 */

'use strict'

const cron = require('node-cron')
const { v4: uuidv4 } = require('uuid')

const marketDataService = require('../services/marketDataService')
const claudeService = require('../services/claudeService')
const ogStorageService = require('../services/ogStorageService')
const ogChainService = require('../services/ogChainService')
const decisionLogger = require('./decisionLogger')

// ── Agent State ───────────────────────────────────────────────────────────────
const agentState = {
  isRunning: false,
  lastRunTime: null,
  nextRunTime: null,
  totalDecisions: 0,
  cycleCount: 0,
  lastError: null,
  status: 'IDLE',  // 'IDLE' | 'RUNNING' | 'ERROR'
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
        // ── Claude analysis ─────────────────────────────────────
        console.log(`[Agent] Analyzing ${marketData.symbol} with Claude...`)
        decision = await claudeService.analyzeMarket(marketData, historicalDecisions)

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
          decision.explorerUrl = null
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

module.exports = {
  runAgentCycle,
  startAgentLoop,
  agentState,
  setBroadcast,
}
