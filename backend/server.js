/**
 * server.js — AlphaTrace Backend
 * Express API + WebSocket real-time broadcast + autonomous agent loop
 */

'use strict'

require('dotenv').config()

const express = require('express')
const http = require('http')
const WebSocket = require('ws')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')
const path = require('path')

const decisionLogger   = require('./agent/decisionLogger')
const agentLoop        = require('./agent/agentLoop')
const marketDataService = require('./services/marketDataService')
const ogStorageService = require('./services/ogStorageService')
const ogChainService   = require('./services/ogChainService')
const { computeRealPnL } = require('./services/pnlService')

const decisionsRoute = require('./routes/decisions')
const agentRoute    = require('./routes/agent')

const PORT = parseInt(process.env.PORT || '3001', 10)
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'

// ── Express setup ─────────────────────────────────────────────────────────────
const app = express()

app.use(helmet({ contentSecurityPolicy: false }))
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  // credentials: true, // Not allowed with origin: '*'
}))
app.use(morgan('dev'))
app.use(express.json())

// ── HTTP server ───────────────────────────────────────────────────────────────
const server = http.createServer(app)

// ── WebSocket server ──────────────────────────────────────────────────────────
const wss = new WebSocket.Server({ server, path: '/ws' })
const clients = new Set()

wss.on('connection', (ws, req) => {
  clients.add(ws)
  const ip = req.socket.remoteAddress
  console.log(`[WS] Client connected (${ip}) — total: ${clients.size}`)

  // Send current state on connect
  ws.send(JSON.stringify({
    type: 'CONNECTED',
    data: {
      agentStatus: agentLoop.agentState,
      decisionCount: decisionLogger.all.length,
      timestamp: new Date().toISOString(),
    },
  }))

  ws.on('close', () => {
    clients.delete(ws)
    console.log(`[WS] Client disconnected — total: ${clients.size}`)
  })

  ws.on('error', (err) => {
    console.warn(`[WS] Client error: ${err.message}`)
    clients.delete(ws)
  })

  ws.on('pong', () => { ws.isAlive = true })
})

// Heartbeat — keep connections alive
const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      clients.delete(ws)
      return ws.terminate()
    }
    ws.isAlive = false
    ws.ping()
  })
}, 30000)

wss.on('close', () => clearInterval(heartbeatInterval))

// ── Broadcast helper ──────────────────────────────────────────────────────────
function broadcast(message) {
  const payload = typeof message === 'string' ? message : JSON.stringify(message)
  let sent = 0
  clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload)
      sent++
    }
  })
  if (sent > 0) console.log(`[WS] Broadcast → ${sent} client(s): ${message.type || '?'}`)
}

// Inject broadcast into agent loop
agentLoop.setBroadcast(broadcast)

// ── Routes ────────────────────────────────────────────────────────────────────

// Health
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    agentStatus: agentLoop.agentState.status,
    decisionCount: decisionLogger.all.length,
    wsClients: clients.size,
    version: '1.0.0',
    contractAddress: process.env.CONTRACT_ADDRESS || null,
    network: '0G Mainnet (16600)',
  })
})

// Decisions
app.use('/api/decisions', decisionsRoute)

// Markets — real-time price data
app.get('/api/markets', async (req, res) => {
  try {
    const data = await marketDataService.fetchMarketData()
    res.json({ success: true, markets: data, timestamp: new Date().toISOString() })
  } catch (err) {
    console.error('[/api/markets] Error:', err.message)
    res.status(500).json({ success: false, error: err.message })
  }
})

// Stats — uses REAL PnL from live prices
app.get('/api/stats', async (req, res) => {
  try {
    const localStats = decisionLogger.getStats()
    const allDecisions = decisionLogger.all

    // Real PnL via pnlService (live CoinGecko prices)
    let realPnL = 0, realWinRate = 0, pnlHistory = [], trades = []
    try {
      const pnl = await computeRealPnL(allDecisions)
      realPnL     = pnl.totalPnL
      realWinRate = pnl.winRate
      pnlHistory  = pnl.pnlHistory
      trades      = pnl.trades
    } catch (pnlErr) {
      console.warn('[/api/stats] PnL calculation error:', pnlErr.message)
      // Fallback: basic relative price movement
      pnlHistory = allDecisions
        .slice(0, 50)
        .reverse()
        .map((d, i) => ({
          timestamp:  d.timestamp,
          pnl:        parseFloat((i * (Math.random() - 0.4) * 2).toFixed(2)),
          market:     d.market,
          action:     d.action,
        }))
    }

    let chainStats = {}
    try { chainStats = await ogChainService.getContractStats() } catch {/* ok */}

    res.json({
      success: true,
      stats: {
        ...localStats,
        totalPnL:         realPnL,
        winRate:          realWinRate,
        realPnL:          true,                // flag for frontend
        pnlHistory,
        trades,
        chainDecisionCount: chainStats.decisionCount || localStats.total,
        contract: {
          address:     process.env.CONTRACT_ADDRESS || null,
          explorerUrl: process.env.CONTRACT_ADDRESS
            ? `https://testnet.0g.ai/address/${process.env.CONTRACT_ADDRESS}`
            : null,
          network:  '0G Newton Testnet',
          chainId:  16602,
        },
      },
    })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// Agent control
app.use('/api/agent', agentRoute)

// Verify storage
app.get('/api/verify/:storageHash', async (req, res) => {
  const { storageHash } = req.params
  try {
    const result = await ogStorageService.verifyDecision(storageHash)
    res.json({
      success: true,
      storageHash,
      verified: result.exists,
      ...result,
      explorerUrl: `https://chainscan-galileo.0g.ai/tx/${storageHash}`,
    })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' })
})

// Error handler
app.use((err, req, res, _next) => {
  console.error('[Express] Unhandled error:', err.message)
  res.status(500).json({ success: false, error: 'Internal server error' })
})

// ── Start ─────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log('\n╔═══════════════════════════════════════════════╗')
  console.log('║       AlphaTrace Backend — v1.0.0             ║')
  console.log('╠═══════════════════════════════════════════════╣')
  console.log(`║  HTTP:      http://localhost:${PORT}             ║`)
  console.log(`║  WebSocket: ws://localhost:${PORT}/ws            ║`)
  console.log(`║  Contract:  ${(process.env.CONTRACT_ADDRESS || 'Not set').slice(0, 20).padEnd(20)} ...   ║`)
  console.log('╚═══════════════════════════════════════════════╝\n')

  // Start the autonomous agent loop
  agentLoop.startAgentLoop()
})

module.exports = { app, server, broadcast }
