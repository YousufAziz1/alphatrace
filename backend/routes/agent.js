/**
 * agent.js route — POST /api/agent/trigger, GET /api/agent/status,
 *                  POST /api/agent/stop, POST /api/agent/start
 */

'use strict'

const express = require('express')
const router = express.Router()
const { runAgentCycle, agentState, stopAgent, startAgent } = require('../agent/agentLoop')

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

module.exports = router
