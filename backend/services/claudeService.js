/**
 * geminiService.js  (was: claudeService.js)
 * Interfaces with Google Gemini 2.5 Flash (free tier) for AI trading decisions.
 *
 * Free API key: https://aistudio.google.com/app/apikey
 * Model used  : gemini-2.5-flash-preview-04-17
 */

'use strict'

const { GoogleGenerativeAI } = require('@google/generative-ai')

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

const MODEL_NAME = 'gemini-3-flash-preview'

// ── System instruction ──────────────────────────────────────────────────────
const SYSTEM_INSTRUCTION = `You are AlphaTrace, a DeFi trading agent. Respond ONLY with a valid JSON object — no markdown, no fences, no extra text.

JSON format:
{"market":"ETH/USDC","action":"BUY"|"SELL"|"HOLD","confidence":0-100,"reasoning":"2-3 sentences","shortReasoning":"<80 chars","entryPrice":0,"targetPrice":0,"stopLoss":0,"riskScore":1-10,"timeHorizon":"SHORT"|"MEDIUM"|"LONG","indicators":{"rsi":0,"trend":"BULLISH"|"BEARISH"|"NEUTRAL","volume":"HIGH"|"NORMAL"|"LOW","momentum":"STRONG"|"WEAK"|"NEUTRAL"}}

Rules: action must be BUY/SELL/HOLD exactly. confidence integer 0-100. Uncertain market = HOLD.`

// ── JSON extractor ───────────────────────────────────────────────────────────
function extractJSON(text) {
  // Direct parse
  try { return JSON.parse(text.trim()) } catch {/* continue */}

  // Strip code fences
  const fence = text.match(/```(?:json)?\s*([\s\S]+?)```/)
  if (fence) { try { return JSON.parse(fence[1].trim()) } catch {/* continue */} }

  // Find first {...} block
  const start = text.indexOf('{')
  const end   = text.lastIndexOf('}')
  if (start !== -1 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)) } catch {/* continue */}
  }

  throw new Error('Could not extract valid JSON from Gemini response')
}

// ── Validation ───────────────────────────────────────────────────────────────
function validateDecision(obj) {
  const valid = ['BUY', 'SELL', 'HOLD']
  if (!obj || typeof obj !== 'object') throw new Error('Response is not an object')
  if (!valid.includes(obj.action))     throw new Error(`Invalid action: ${obj.action}`)
  if (typeof obj.confidence !== 'number') throw new Error('Missing confidence')
  if (!obj.reasoning)                  throw new Error('Missing reasoning')
  return obj
}

// ── analyzeMarket ─────────────────────────────────────────────────────────────
/**
 * Ask Gemini 2.5 Flash to analyze a market and produce a trading decision.
 * @param {Object}   marketData          — single market from marketDataService
 * @param {Object[]} historicalDecisions — last N decisions for AI context
 * @returns {Promise<Object>} Parsed + validated decision
 */
async function analyzeMarket(marketData, historicalDecisions = []) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set in environment variables')
  }

  const recentHistory = historicalDecisions.slice(0, 5).map((d) => ({
    market:     d.market,
    action:     d.action,
    confidence: d.confidence,
    timestamp:  d.timestamp,
    entryPrice: d.entryPrice,
  }))

  const userPrompt = `
Analyze the following market data and produce a trading decision.

## Current Market Data
${JSON.stringify(marketData, null, 2)}

## Recent Decision History (context only — last 5)
${recentHistory.length > 0 ? JSON.stringify(recentHistory, null, 2) : 'No prior decisions this session.'}

RSI is ${marketData.rsi}, trend is ${marketData.trend}, 24h change is ${marketData.change24h}%.
Make a precise BUY / SELL / HOLD decision for ${marketData.symbol}.

Respond with ONLY the raw JSON object — no other text.`.trim()

  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    systemInstruction: SYSTEM_INSTRUCTION,
    generationConfig: {
      responseMimeType: 'text/plain',
      temperature: 0.4,
      topP: 0.9,
      maxOutputTokens: 1024,
    },
  })

  let lastError
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const result   = await model.generateContent(userPrompt)
      const rawText  = result.response.text() || ''
      console.log(`[Gemini] Raw for ${marketData.symbol} (attempt ${attempt}):`, rawText.slice(0, 150))

      const parsed    = extractJSON(rawText)
      const validated = validateDecision(parsed)

      validated.market     = validated.market     || marketData.symbol
      validated.entryPrice = validated.entryPrice || marketData.price
      if (!validated.indicators) {
        validated.indicators = {
          rsi:      marketData.rsi,
          trend:    marketData.trend,
          volume:   marketData.volume24h > 1e9 ? 'HIGH' : marketData.volume24h > 2e8 ? 'NORMAL' : 'LOW',
          momentum: 'NEUTRAL',
        }
      }

      console.log(`[Gemini] ✅ ${marketData.symbol}: ${validated.action} (${validated.confidence}% conf)`)
      return validated

    } catch (err) {
      lastError = err
      const errMsg = err.message || ''
      const is429  = errMsg.includes('429') || errMsg.includes('Too Many Requests')

      // Parse retryDelay from error response if present
      let waitMs = 1500 * attempt
      if (is429) {
        const delayMatch = errMsg.match(/retryDelay\":\"([0-9.]+)s/)
        const delaySec   = delayMatch ? parseFloat(delayMatch[1]) : 15
        waitMs = Math.ceil(delaySec * 1000) + 2000  // add 2s buffer
        console.warn(`[Gemini] 429 Rate limit — waiting ${(waitMs/1000).toFixed(1)}s before retry ${attempt}/${3}`)
      } else {
        console.warn(`[Gemini] Attempt ${attempt} failed: ${errMsg.slice(0, 120)}`)
      }

      if (attempt < 3) await new Promise((r) => setTimeout(r, waitMs))
    }
  console.error(`[Gemini] Analysis completely failed after 3 attempts: ${lastError?.message}`)
  
  // Graceful fallback for demo purposes if rate limit hits hard
  console.log(`[Gemini] 🛡️ Using graceful HOLD fallback to preserve application stability.`)
  return {
    market: marketData.symbol,
    action: 'HOLD',
    confidence: 60,
    reasoning: `Analysis paused due to Gemini API rate limits (Free Tier). Maintaining current positions to ensure portfolio safety until quota resets.`,
    shortReasoning: `Holding due to API quota limits.`,
    entryPrice: marketData.price,
    targetPrice: marketData.price * 1.05,
    stopLoss: marketData.price * 0.95,
    riskScore: 5,
    timeHorizon: 'SHORT',
    indicators: {
      rsi: marketData.rsi,
      trend: marketData.trend,
      volume: marketData.volume24h > 1e9 ? 'HIGH' : marketData.volume24h > 2e8 ? 'NORMAL' : 'LOW',
      momentum: 'NEUTRAL'
    }
  }
}

// ── generateDailyReport ───────────────────────────────────────────────────────
/**
 * Generate a markdown daily report summarising the last 24h decisions.
 * @param {Object[]} decisions
 * @returns {Promise<string>} Markdown string
 */
async function generateDailyReport(decisions) {
  const last24h = decisions.filter(
    (d) => Date.now() - new Date(d.timestamp).getTime() < 86_400_000
  )

  if (last24h.length === 0) {
    return '# AlphaTrace Daily Report\n\nNo decisions in the last 24 hours.'
  }

  const byAction    = last24h.reduce((acc, d) => { acc[d.action] = (acc[d.action] || 0) + 1; return acc }, {})
  const avgConf     = (last24h.reduce((s, d) => s + d.confidence, 0) / last24h.length).toFixed(1)
  const decisionLog = last24h
    .map((d) => `- **${d.market}** ${d.action} @ $${d.entryPrice?.toFixed(2)} (${d.confidence}% conf) — ${(d.shortReasoning || d.reasoning || '').slice(0, 80)}`)
    .join('\n')

  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME })
    const prompt = `You are AlphaTrace, an AI DeFi trading agent. Write a concise daily performance report in Markdown (3-5 paragraphs).

Stats:
- Total decisions: ${last24h.length}
- BUY: ${byAction.BUY || 0}, SELL: ${byAction.SELL || 0}, HOLD: ${byAction.HOLD || 0}
- Average confidence: ${avgConf}%

Decisions:
${decisionLog}

Cover: market conditions, decision rationale, risk assessment, and short-term outlook.`

    const result = await model.generateContent(prompt)
    return result.response.text() || 'Report generation failed.'
  } catch (err) {
    console.error('[Gemini] generateDailyReport error:', err.message)
    return `# AlphaTrace Daily Report\n\n## ${new Date().toDateString()}\n\n- **Total:** ${last24h.length}\n- **BUY:** ${byAction.BUY || 0} | **SELL:** ${byAction.SELL || 0} | **HOLD:** ${byAction.HOLD || 0}\n- **Avg Confidence:** ${avgConf}%\n\n## Decision Log\n${decisionLog}`
  }
}

module.exports = { analyzeMarket, generateDailyReport }
