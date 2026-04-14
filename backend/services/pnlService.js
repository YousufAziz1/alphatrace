/**
 * pnlService.js
 * Calculates REAL PnL using actual live market prices from CoinGecko.
 *
 * Strategy (Paper Trading with Real Prices):
 *  - Each BUY  = opens a LONG  position (1 unit × entryPrice)
 *  - Each SELL = opens a SHORT position (1 unit × entryPrice)
 *  - HOLD      = no position change
 *  - When a new signal for the same market arrives, the old position closes
 *  - PnL = (exitPrice - entryPrice) for LONG
 *          (entryPrice - exitPrice) for SHORT
 *  - Open positions use live price as exitPrice
 *  - Unit size = $100 notional per trade
 */

'use strict'

const axios = require('axios')

const UNIT_SIZE_USD = 100  // $100 notional per trade
const CACHE_TTL_MS  = 30_000  // price cache: 30s

// Market symbol → CoinGecko ID
const COINGECKO_IDS = {
  'ETH/USDC': 'ethereum',
  'BTC/USDC': 'bitcoin',
  'SOL/USDC': 'solana',
  'ARB/USDC': 'arbitrum',
}

// ── Price cache ───────────────────────────────────────────────────────────────
const priceCache = new Map()  // symbol → { price, ts }

async function getLivePrice(market) {
  const cached = priceCache.get(market)
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.price

  const id = COINGECKO_IDS[market]
  if (!id) return null

  try {
    const apiKey = process.env.COINGECKO_API_KEY
    const headers = apiKey ? { 'x-cg-demo-api-key': apiKey } : {}
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`
    const { data } = await axios.get(url, { headers, timeout: 8000 })
    const price = data?.[id]?.usd ?? null
    if (price) priceCache.set(market, { price, ts: Date.now() })
    return price
  } catch {
    return null
  }
}

// ── computeRealPnL ────────────────────────────────────────────────────────────
/**
 * Given a list of decisions (sorted newest first) + current live prices,
 * compute real PnL for each closed/open trade.
 *
 * @param {Object[]} decisions  — all decisions (newest first)
 * @param {Map}      livePrices — market → currentPrice (optional pre-fetched)
 * @returns {{ totalPnL, winRate, trades, pnlHistory, openPositions }}
 */
async function computeRealPnL(decisions) {
  if (!decisions || decisions.length === 0) {
    return { totalPnL: 0, winRate: 0, trades: [], pnlHistory: [], openPositions: {} }
  }

  // Fetch live prices for all markets in parallel
  const markets = [...new Set(decisions.map((d) => d.market))]
  const livePriceMap = {}
  await Promise.all(
    markets.map(async (m) => {
      const p = await getLivePrice(m)
      if (p) livePriceMap[m] = p
    })
  )

  // Process decisions oldest→newest to build trade history
  const sorted = [...decisions].reverse()  // oldest first

  // Track open positions per market: { market → { action, entryPrice, openedAt, decisionId } }
  const openPos = {}
  const trades  = []

  for (const dec of sorted) {
    if (!dec.entryPrice || dec.action === 'HOLD') continue

    const existing = openPos[dec.market]

    // Close existing position (same market, new signal)
    if (existing) {
      const exitPrice = dec.entryPrice  // use the new decision's entry as exit
      const pnl = calcPnL(existing.action, existing.entryPrice, exitPrice)
      trades.push({
        id:         existing.decisionId,
        market:     dec.market,
        action:     existing.action,
        entryPrice: existing.entryPrice,
        exitPrice,
        pnl:        parseFloat(pnl.toFixed(4)),
        status:     'CLOSED',
        openedAt:   existing.openedAt,
        closedAt:   dec.timestamp,
        confidence: existing.confidence,
      })
    }

    // Open new position
    openPos[dec.market] = {
      action:     dec.action,
      entryPrice: dec.entryPrice,
      openedAt:   dec.timestamp,
      decisionId: dec.id,
      confidence: dec.confidence,
    }
  }

  // Mark still-open positions with current live price
  for (const [market, pos] of Object.entries(openPos)) {
    const currentPrice = livePriceMap[market]
    if (!currentPrice) continue
    const pnl = calcPnL(pos.action, pos.entryPrice, currentPrice)
    trades.push({
      id:           pos.decisionId,
      market,
      action:       pos.action,
      entryPrice:   pos.entryPrice,
      exitPrice:    currentPrice,
      pnl:          parseFloat(pnl.toFixed(4)),
      status:       'OPEN',
      openedAt:     pos.openedAt,
      closedAt:     null,
      confidence:   pos.confidence,
      livePrice:    currentPrice,
    })
  }

  // Total PnL
  const totalPnL = trades.reduce((sum, t) => sum + t.pnl, 0)

  // Win rate  
  const nonZero = trades.filter((t) => t.pnl !== 0)
  const wins    = nonZero.filter((t) => t.pnl > 0).length
  const winRate = nonZero.length > 0 ? Math.round((wins / nonZero.length) * 100) : 0

  // PnL history — cumulative over time (for chart)
  const pnlHistory = buildPnLHistory(decisions, livePriceMap)

  return {
    totalPnL:      parseFloat(totalPnL.toFixed(4)),
    winRate,
    trades,
    pnlHistory,
    openPositions: openPos,
    livePrices:    livePriceMap,
  }
}

// ── calcPnL ───────────────────────────────────────────────────────────────────
function calcPnL(action, entryPrice, exitPrice) {
  if (!entryPrice || !exitPrice || entryPrice === 0) return 0
  const priceDiff = action === 'BUY'
    ? exitPrice - entryPrice    // LONG: profit when price goes UP
    : entryPrice - exitPrice    // SHORT: profit when price goes DOWN
  // Return dollar PnL for $100 notional
  return (priceDiff / entryPrice) * UNIT_SIZE_USD
}

// ── buildPnLHistory ───────────────────────────────────────────────────────────
/**
 * Build a time-series of cumulative PnL for the chart.
 * Uses real price movement between consecutive same-market decisions.
 */
function buildPnLHistory(decisions, livePriceMap) {
  const sorted = [...decisions].reverse()  // oldest first
  const marketPos = {}  // market → { action, entryPrice }
  let cumPnL = 0
  const points = []

  for (const dec of sorted) {
    if (!dec.entryPrice) {
      points.push({ timestamp: dec.timestamp, pnl: parseFloat(cumPnL.toFixed(2)), market: dec.market, action: dec.action })
      continue
    }

    if (dec.action !== 'HOLD') {
      const prev = marketPos[dec.market]
      if (prev) {
        // Close previous trade using this decision's entry as exit
        const pnl = calcPnL(prev.action, prev.entryPrice, dec.entryPrice)
        cumPnL += pnl
      }
      marketPos[dec.market] = { action: dec.action, entryPrice: dec.entryPrice }
    }

    points.push({
      timestamp:  dec.timestamp,
      pnl:        parseFloat(cumPnL.toFixed(2)),
      market:     dec.market,
      action:     dec.action,
      confidence: dec.confidence,
    })
  }

  // Add final live point for each open position
  for (const [market, pos] of Object.entries(marketPos)) {
    const livePrice = livePriceMap[market]
    if (!livePrice) continue
    const openPnL = calcPnL(pos.action, pos.entryPrice, livePrice)
    points.push({
      timestamp:  new Date().toISOString(),
      pnl:        parseFloat((cumPnL + openPnL).toFixed(2)),
      market,
      action:     'LIVE',
    })
  }

  return points
}

module.exports = { computeRealPnL, getLivePrice }
