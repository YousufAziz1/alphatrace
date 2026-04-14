/**
 * decisionLogger.js
 * In-memory + JSON file persistence for AI decisions.
 * Max 500 decisions kept in memory. JSON file is the persistence layer.
 */

'use strict'

const fs = require('fs')
const path = require('path')

const DECISIONS_FILE = path.join(__dirname, '../decisions.json')
const MAX_DECISIONS = 500

/** @type {Object[]} */
let decisions = []

// ── Load from disk ────────────────────────────────────────────────────────────
function loadFromDisk() {
  try {
    if (fs.existsSync(DECISIONS_FILE)) {
      const raw = fs.readFileSync(DECISIONS_FILE, 'utf8')
      const parsed = JSON.parse(raw)
      decisions = Array.isArray(parsed) ? parsed : []
      console.log(`[DecisionLogger] Loaded ${decisions.length} decisions from disk`)
    }
  } catch (err) {
    console.warn('[DecisionLogger] Could not load decisions.json:', err.message)
    decisions = []
  }
}

// ── Save to disk ──────────────────────────────────────────────────────────────
function saveToDisk() {
  try {
    fs.writeFileSync(DECISIONS_FILE, JSON.stringify(decisions, null, 2), 'utf8')
  } catch (err) {
    console.error('[DecisionLogger] Failed to save decisions.json:', err.message)
  }
}

// ── addDecision ───────────────────────────────────────────────────────────────
function addDecision(decision) {
  decisions.unshift(decision) // newest first
  if (decisions.length > MAX_DECISIONS) {
    decisions = decisions.slice(0, MAX_DECISIONS)
  }
  saveToDisk()
}

// ── getDecisions ──────────────────────────────────────────────────────────────
function getDecisions({ limit = 50, market = null, action = null, page = 1 } = {}) {
  let filtered = [...decisions]

  if (market) filtered = filtered.filter((d) => d.market === market)
  if (action) filtered = filtered.filter((d) => d.action === action.toUpperCase())

  const total = filtered.length
  const startIdx = (page - 1) * limit
  const paginated = filtered.slice(startIdx, startIdx + limit)

  return { decisions: paginated, total, page, limit }
}

// ── getDecisionById ────────────────────────────────────────────────────────────
function getDecisionById(id) {
  return decisions.find((d) => d.id === id || d.chainDecisionId === Number(id)) || null
}

// ── getLatest ─────────────────────────────────────────────────────────────────
function getLatest(n = 10) {
  return decisions.slice(0, n)
}

// ── getStats (sync baseline — real PnL computed async in server.js) ──────────
function getStats() {
  const total = decisions.length
  if (total === 0) {
    return {
      total: 0, winRate: 0, totalPnL: 0, realPnL: true,
      byAction: { BUY: 0, SELL: 0, HOLD: 0 },
      byMarket: {}, last24hDecisions: 0, avgConfidence: 0,
    }
  }

  const byAction = decisions.reduce((acc, d) => {
    acc[d.action] = (acc[d.action] || 0) + 1
    return acc
  }, { BUY: 0, SELL: 0, HOLD: 0 })

  const byMarket = decisions.reduce((acc, d) => {
    if (!acc[d.market]) acc[d.market] = { total: 0, BUY: 0, SELL: 0, HOLD: 0 }
    acc[d.market].total++
    acc[d.market][d.action] = (acc[d.market][d.action] || 0) + 1
    return acc
  }, {})

  const last24h = decisions.filter(
    (d) => Date.now() - new Date(d.timestamp).getTime() < 86400000
  ).length

  const avgConfidence = decisions.reduce((s, d) => s + (d.confidence || 0), 0) / total

  return {
    total,
    winRate:          0,   // overwritten by async pnlService in server.js
    totalPnL:         0,   // overwritten by async pnlService in server.js
    realPnL:          true,
    byAction,
    byMarket,
    last24hDecisions: last24h,
    avgConfidence:    parseFloat(avgConfidence.toFixed(1)),
  }
}

// ── getPnLHistory ─────────────────────────────────────────────────────────────
function getPnLHistory(hoursBack = 24) {
  const since = Date.now() - hoursBack * 3600 * 1000
  const relevant = decisions
    .filter((d) => new Date(d.timestamp).getTime() > since)
    .reverse() // oldest first for chart

  let cumPnL = 0
  return relevant.map((d) => {
    const pnlDelta = d.entryPrice && d.targetPrice
      ? (d.action === 'BUY'
          ? (d.targetPrice - d.entryPrice) * 0.1
          : d.action === 'SELL'
          ? (d.entryPrice - d.targetPrice) * 0.1
          : 0)
      : 0
    cumPnL += pnlDelta
    return {
      timestamp: d.timestamp,
      pnl: parseFloat(cumPnL.toFixed(2)),
      market: d.market,
      action: d.action,
      confidence: d.confidence,
    }
  })
}

// Init on require
loadFromDisk()

module.exports = {
  addDecision,
  getDecisions,
  getDecisionById,
  getLatest,
  getStats,
  getPnLHistory,
  loadFromDisk,
  get all() { return decisions },
}
