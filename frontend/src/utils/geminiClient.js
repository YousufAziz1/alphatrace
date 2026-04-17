// geminiClient.js — Direct Gemini API call from frontend for Wallet Mode
// Bypasses Render backend entirely — instant AI response (~2-3s).

// Frontend-dedicated Gemini key (separate from backend to avoid rate limits)
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY
  || 'AIzaSyAlGtGE-wNYfWJ5VHcYEsvEOOOCY4L1KUU' // demo fallback key

// Build URL immediately after key is resolved
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`

const SYSTEM_PROMPT = `You are AlphaTrace, a DeFi trading agent. Respond ONLY with a valid JSON object — no markdown, no fences, no extra text.

JSON format:
{"market":"ETH/USDC","action":"BUY"|"SELL"|"HOLD","confidence":0-100,"reasoning":"2-3 sentences","shortReasoning":"<80 chars","entryPrice":0,"targetPrice":0,"stopLoss":0,"riskScore":1-10,"timeHorizon":"SHORT"|"MEDIUM"|"LONG","indicators":{"rsi":0,"trend":"BULLISH"|"BEARISH"|"NEUTRAL","volume":"HIGH"|"NORMAL"|"LOW","momentum":"STRONG"|"WEAK"|"NEUTRAL"}}

Rules: action must be BUY/SELL/HOLD exactly. confidence integer 0-100.`

// ── Internal call helper ──────────────────────────────────────────────────────

async function callGeminiOnce(prompt) {
  const resp = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 512 },
    }),
  })

  if (resp.status === 429) throw new Error('RATE_LIMIT_429')

  if (!resp.ok) {
    const errBody = await resp.text()
    throw new Error(`Gemini API error ${resp.status}: ${errBody.slice(0, 120)}`)
  }

  return resp.json()
}

// ── analyzeMarketFrontend ─────────────────────────────────────────────────────

/**
 * Calls Gemini 2.0 Flash directly from the browser.
 * Retries once after 22s on 429 rate-limit errors.
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

  let json
  try {
    json = await callGeminiOnce(prompt)
  } catch (err) {
    if (err.message === 'RATE_LIMIT_429') {
      // Rate limited — wait 22s and retry once
      console.warn('[Gemini] 429 rate limit hit — waiting 22s before retry...')
      await new Promise(r => setTimeout(r, 22000))
      try {
        json = await callGeminiOnce(prompt)
      } catch (retryErr) {
        if (retryErr.message === 'RATE_LIMIT_429') {
          throw new Error(
            'Gemini rate limit exceeded. Get a separate API key at aistudio.google.com/app/apikey and set it as VITE_GEMINI_API_KEY in Vercel.'
          )
        }
        throw retryErr
      }
    } else {
      throw err
    }
  }

  const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text || ''

  // Parse JSON from AI response
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
