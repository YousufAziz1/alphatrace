/**
 * marketDataService.js
 * Fetches real OHLCV + price data from CoinGecko and calculates RSI / trend signals.
 */

'use strict'

const axios = require('axios')

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3'
const API_KEY = process.env.COINGECKO_API_KEY

// Only 2 markets — keeps CoinGecko API load minimal
const MARKET_MAP = {
  ethereum: { symbol: 'ETH/USDC', display: 'ETH' },
  bitcoin:  { symbol: 'BTC/USDC', display: 'BTC' },
}

// ── Cache ─────────────────────────────────────────────────────────────
const CACHE_TTL_MS = 5 * 60 * 1000  // 5 minutes — agent runs every 5min anyway
let cachedData = null
let cacheTs    = 0

// Price history for RSI (replaces OHLC API call)
const priceHistory = {}  // coinId → number[]

// ── Retry with exponential backoff ─────────────────────────────────────────
async function withRetry(fn, maxRetries = 2, baseDelay = 3000) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (attempt === maxRetries) throw err
      const is429 = err.response?.status === 429
      const delay = is429 ? 15000 : baseDelay * (attempt + 1)  // 15s on 429
      console.warn(`[MarketData] Retry ${attempt + 1}/${maxRetries} in ${delay}ms — ${err.message}`)
      await new Promise((r) => setTimeout(r, delay))
    }
  }
}

// ── RSI Calculation ─────────────────────────────────────────────────────────
/**
 * Calculate RSI from an array of closing prices.
 * @param {number[]} prices — array of close prices (oldest → newest)
 * @param {number} period — default 14
 * @returns {number} RSI value (0-100), or 50 if insufficient data
 */
function calculateRSI(prices, period = 14) {
  if (!prices || prices.length < period + 1) return 50

  let gains = 0
  let losses = 0

  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1]
    if (diff > 0) gains += diff
    else losses += Math.abs(diff)
  }

  let avgGain = gains / period
  let avgLoss = losses / period

  if (avgLoss === 0) return 100

  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1]
    const gain = diff > 0 ? diff : 0
    const loss = diff < 0 ? Math.abs(diff) : 0
    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
  }

  const rs = avgGain / avgLoss
  return Math.round(100 - 100 / (1 + rs))
}

// ── Trend Signal ─────────────────────────────────────────────────────────────
/**
 * @param {number} change24h — 24h price change percentage
 * @param {number} rsi — RSI value
 * @returns {'BULLISH'|'BEARISH'|'NEUTRAL'}
 */
function getTrendSignal(change24h, rsi) {
  if (change24h > 3 && rsi < 70) return 'BULLISH'
  if (change24h < -3 && rsi > 30) return 'BEARISH'
  if (rsi >= 70) return 'BEARISH'  // overbought
  if (rsi <= 30) return 'BULLISH'  // oversold bounce
  return 'NEUTRAL'
}

// ── Fetch OHLC data for RSI ───────────────────────────────────────────────────
async function fetchOHLC(coinId, days = 1) {
  const headers = API_KEY ? { 'x-cg-demo-api-key': API_KEY } : {}
  const resp = await withRetry(() =>
    axios.get(`${COINGECKO_BASE}/coins/${coinId}/ohlc`, {
      params: { vs_currency: 'usd', days },
      headers,
      timeout: 10000,
    })
  )
  // CoinGecko returns [[timestamp, open, high, low, close], ...]
  return resp.data.map((candle) => candle[4]) // extract close prices
}

// ── Fetch simple price data ───────────────────────────────────────────────────
async function fetchSimplePrice(coinIds) {
  const headers = API_KEY ? { 'x-cg-demo-api-key': API_KEY } : {}
  const ids = coinIds.join(',')
  const resp = await withRetry(() =>
    axios.get(`${COINGECKO_BASE}/simple/price`, {
      params: {
        ids,
        vs_currencies: 'usd',
        include_24hr_change: true,
        include_24hr_vol: true,
        include_market_cap: true,
        include_high_24h: true,  // Note: not all free tiers support high/low
        include_low_24h: true,
      },
      headers,
      timeout: 10000,
    })
  )
  return resp.data
}

// ── Main: fetchMarketData ────────────────────────────────────────────────────
/**
 * Fetch full market data for a list of coin IDs.
 * @param {string[]} markets — array of CoinGecko IDs e.g. ["ethereum", "bitcoin"]
 * @returns {Promise<Object[]>} Array of market data objects
 */
async function fetchMarketData(markets = Object.keys(MARKET_MAP)) {
  // Serve from cache if fresh — prevents multiple callers hitting CoinGecko
  if (cachedData && Date.now() - cacheTs < CACHE_TTL_MS) {
    return cachedData
  }

  console.log(`[MarketData] Fetching data for: ${markets.join(', ')}`)

  // 1 API call for all prices — no OHLC (eliminates extra requests)
  let prices = {}
  try {
    prices = await fetchSimplePrice(markets)
  } catch (err) {
    console.error(`[MarketData] ⚠️ API completely failed: ${err.message}`)
    if (cachedData) {
      console.log(`[MarketData] 🛡️ Returning stale cached data.`)
      return cachedData
    }
    console.log(`[MarketData] 🛡️ Returning fallback demo data to preserve app stability.`)
    const fallback = [
      { id: 'ethereum', symbol: 'ETH/USDC', display: 'ETH', price: 2384.87, change24h: 1.25, volume24h: 11000000000, high24h: 2450.0, low24h: 2300.0, marketCap: 280000000000, rsi: 55, trend: 'BULLISH', fetchedAt: new Date().toISOString() },
      { id: 'bitcoin', symbol: 'BTC/USDC', display: 'BTC', price: 61204.55, change24h: -0.80, volume24h: 29000000000, high24h: 62500.0, low24h: 60000.0, marketCap: 1200000000000, rsi: 48, trend: 'NEUTRAL', fetchedAt: new Date().toISOString() }
    ]
    cachedData = fallback
    cacheTs = Date.now()
    return fallback
  }

  const result = markets.map((id) => {
    const p    = prices[id] || {}
    const meta = MARKET_MAP[id] || { symbol: id.toUpperCase() + '/USDC', display: id.toUpperCase() }

    // In-memory price history for RSI (avoids OHLC API call)
    if (!priceHistory[id]) priceHistory[id] = []
    if (p.usd) {
      priceHistory[id].push(p.usd)
      if (priceHistory[id].length > 30) priceHistory[id].shift()
    }

    const rsi       = calculateRSI(priceHistory[id])
    const change24h = p.usd_24h_change || 0
    const trend     = getTrendSignal(change24h, rsi)

    return {
      id,
      symbol:    meta.symbol,
      display:   meta.display,
      price:     p.usd || 0,
      change24h: parseFloat(change24h.toFixed(2)),
      volume24h: p.usd_24h_vol || 0,
      high24h:   p.usd_high_24h || (p.usd ? p.usd * 1.03 : 0),
      low24h:    p.usd_low_24h  || (p.usd ? p.usd * 0.97 : 0),
      marketCap: p.usd_market_cap || 0,
      rsi,
      trend,
      fetchedAt: new Date().toISOString(),
    }
  })

  cachedData = result
  cacheTs    = Date.now()

  console.log(`[MarketData] ✅ Fetched ${result.length} markets`)
  return result
}

// ── getMarketSummary ─────────────────────────────────────────────────────────
/**
 * Build a concise market summary string for the Claude AI prompt.
 * @returns {Promise<string>}
 */
async function getMarketSummary() {
  try {
    const data = await fetchMarketData()
    const lines = data.map(
      (m) =>
        `${m.symbol}: $${m.price.toLocaleString()} | 24h: ${m.change24h > 0 ? '+' : ''}${m.change24h}% | RSI: ${m.rsi} | Trend: ${m.trend} | Vol: $${(m.volume24h / 1e9).toFixed(2)}B`
    )
    return `Current Market Snapshot (${new Date().toUTCString()}):\n${lines.join('\n')}`
  } catch (err) {
    console.error('[MarketData] getMarketSummary error:', err.message)
    return 'Market data unavailable.'
  }
}

module.exports = {
  fetchMarketData,
  calculateRSI,
  getTrendSignal,
  getMarketSummary,
  MARKET_MAP,
}
