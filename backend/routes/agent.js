/**
 * agent.js route — POST /api/agent/trigger, GET /api/agent/status,
 *                  POST /api/agent/stop, POST /api/agent/start
 */

'use strict'

const express = require('express')
const router = express.Router()
const { runAgentCycle, agentState, stopAgent, startAgent, runWalletAnalysis, logExternalDecision } = require('../agent/agentLoop')

// GET /api/agent/status
router.get('/status', (req, res) => {
  res.json({ success: true, status: agentState })
})

// POST /api/agent/trigger
router.post('/trigger', async (req, res) => {
  if (agentState.isPaused) {
    return res.status(409).json({
      success: false,
      error: 'Agent is stopped. Start it first.',
    })
  }
  if (agentState.isRunning) {
    return res.status(409).json({
      success: false,
      error: 'Agent is already running. Wait for the current cycle to complete.',
    })
  }

  res.json({
    success: true,
    message: 'Agent cycle triggered. Decisions will stream via WebSocket.',
    timestamp: new Date().toISOString(),
  })

  runAgentCycle().catch((err) =>
    console.error('[AgentRoute] Triggered cycle error:', err.message)
  )
})

// POST /api/agent/stop — pause the autonomous loop
router.post('/stop', (req, res) => {
  stopAgent()
  res.json({ success: true, message: 'Agent stopped. Manual trigger still available.', status: agentState })
})

// POST /api/agent/start — resume the autonomous loop
router.post('/start', (req, res) => {
  startAgent()
  res.json({ success: true, message: 'Agent started. Autonomous loop resumed.', status: agentState })
})

// ── Wallet Manual Mode Endpoints ──────────────────────────────────────────────

// POST /api/agent/trigger-wallet — runs analysis but does not execute on chain
router.post('/trigger-wallet', async (req, res) => {
  try {
    const decision = await runWalletAnalysis()
    res.json({
      success: true,
      decision,
      message: 'Analysis complete. Awaiting user wallet signature.',
    })
  } catch (err) {
    console.error('[AgentRoute /trigger-wallet] Error:', err.message)
    res.status(500).json({ success: false, error: err.message })
  }
})

// POST /api/agent/log-wallet-tx — records the external UI transaction
router.post('/log-wallet-tx', (req, res) => {
  const { decision, txHash } = req.body
  if (!decision || !txHash) {
    return res.status(400).json({ success: false, error: 'Missing decision or txHash' })
  }
  
  try {
    logExternalDecision(decision, txHash)
    res.json({ success: true, message: 'User transaction successfully logged.' })
  } catch (err) {
    console.error('[AgentRoute /log-wallet-tx] Error:', err.message)
    res.status(500).json({ success: false, error: err.message })
  }
})

module.exports = router
