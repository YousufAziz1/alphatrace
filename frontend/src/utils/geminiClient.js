// geminiClient.js — Direct Gemini API call from frontend for Wallet Mode
// This bypasses the Render backend entirely, giving instant AI responses.
// The Gemini API key is set in Vercel as VITE_GEMINI_API_KEY env var.

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || ''
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`

const SYSTEM_PROMPT = `You are AlphaTrace, a DeFi trading agent. Respond ONLY with a valid JSON object — no markdown, no fences, no extra text.

JSON format:
{"market":"ETH/USDC","action":"BUY"|"SELL"|"HOLD","confidence":0-100,"reasoning":"2-3 sentences","shortReasoning":"<80 chars","entryPrice":0,"targetPrice":0,"stopLoss":0,"riskScore":1-10,"timeHorizon":"SHORT"|"MEDIUM"|"LONG","indicators":{"rsi":0,"trend":"BULLISH"|"BEARISH"|"NEUTRAL","volume":"HIGH"|"NORMAL"|"LOW","momentum":"STRONG"|"WEAK"|"NEUTRAL"}}

Rules: action must be BUY/SELL/HOLD exactly. confidence integer 0-100.`

/**
 * Calls Gemini 2.0 Flash directly from the browser.
 * Returns a validated trading decision for ETH/USDC.
 */
export async function analyzeMarketFrontend(marketPrice, rsi = 50, trend = 'NEUTRAL', change24h = 0) {
  if (!GEMINI_API_KEY) {
    throw new Error('VITE_GEMINI_API_KEY not set. Add it to Vercel environment variables.')
  }

  const prompt = `Analyze ETH/USDC and produce a trading decision.
Current price: $${marketPrice}
RSI: ${rsi}
Trend: ${trend}
24h change: ${change24h}%

Respond with ONLY the raw JSON object — no other text.`

  const resp = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 512 },
    }),
  })

  if (!resp.ok) {
    const errBody = await resp.text()
    throw new Error(`Gemini API error ${resp.status}: ${errBody.slice(0, 120)}`)
  }

  const json = await resp.json()
  const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text || ''

  // Parse JSON from response
  let decision
  try {
    decision = JSON.parse(rawText.trim())
  } catch {
    const match = rawText.match(/\{[\s\S]+\}/)
    if (match) decision = JSON.parse(match[0])
    else throw new Error('Could not parse Gemini response as JSON')
  }

  if (!['BUY', 'SELL', 'HOLD'].includes(decision.action)) {
    throw new Error(`Invalid action from Gemini: ${decision.action}`)
  }

  return decision
}
