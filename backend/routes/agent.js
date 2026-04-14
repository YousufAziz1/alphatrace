/**
 * agent.js route — POST /api/agent/trigger, GET /api/agent/status
 */

'use strict'

const express = require('express')
const router = express.Router()
const { runAgentCycle, agentState } = require('../agent/agentLoop')

// GET /api/agent/status
router.get('/status', (req, res) => {
  res.json({ success: true, status: agentState })
})

// POST /api/agent/trigger
router.post('/trigger', async (req, res) => {
  if (agentState.isRunning) {
    return res.status(409).json({
      success: false,
      error: 'Agent is already running. Wait for the current cycle to complete.',
    })
  }

  // Return immediately — run in background
  res.json({
    success: true,
    message: 'Agent cycle triggered. Decisions will stream via WebSocket.',
    timestamp: new Date().toISOString(),
  })

  // Fire and forget
  runAgentCycle().catch((err) =>
    console.error('[AgentRoute] Triggered cycle error:', err.message)
  )
})

module.exports = router
