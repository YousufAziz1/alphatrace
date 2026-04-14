/**
 * decisions.js route — GET /api/decisions and GET /api/decisions/:id
 */

'use strict'

const express = require('express')
const router = express.Router()
const decisionLogger = require('../agent/decisionLogger')

// GET /api/decisions
router.get('/', (req, res) => {
  try {
    const { limit = '50', market, action, page = '1' } = req.query
    const result = decisionLogger.getDecisions({
      limit: Math.min(parseInt(limit, 10) || 50, 200),
      market: market || null,
      action: action || null,
      page: parseInt(page, 10) || 1,
    })
    res.json({ success: true, ...result })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// GET /api/decisions/:id
router.get('/:id', (req, res) => {
  try {
    const decision = decisionLogger.getDecisionById(req.params.id)
    if (!decision) {
      return res.status(404).json({ success: false, error: 'Decision not found' })
    }
    res.json({ success: true, decision })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

module.exports = router
