// api.js — All API calls to AlphaTrace backend
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const WS_URL   = import.meta.env.VITE_WS_URL  || 'ws://localhost:3001/ws'

const api = axios.create({
  baseURL: `${API_BASE}/api`,
  timeout: 60000, // 60 seconds (AI inference + 0G Storage can take time)
})

// ── Decisions ───────────────────────────────────────────────────────────────
export const getDecisions = async (params = {}) => {
  const { data } = await api.get('/decisions', { params })
  return data
}

export const getDecisionById = async (id) => {
  const { data } = await api.get(`/decisions/${id}`)
  return data
}

// ── Stats ────────────────────────────────────────────────────────────────────
export const getStats = async (hoursBack = 24) => {
  const { data } = await api.get('/stats', { params: { hoursBack } })
  return data
}

// ── Markets ──────────────────────────────────────────────────────────────────
export const getMarkets = async () => {
  const { data } = await api.get('/markets')
  return data
}

// ── Agent ────────────────────────────────────────────────────────────────────
export const triggerAgent = async () => {
  const { data } = await api.post('/agent/trigger')
  return data
}

export const getAgentStatus = async () => {
  const { data } = await api.get('/agent/status')
  return data
}

export const stopAgent = async () => {
  const { data } = await api.post('/agent/stop')
  return data
}

export const startAgent = async () => {
  const { data } = await api.post('/agent/start')
  return data
}

// Separate axios instance with longer timeout for AI-heavy wallet calls
const walletApi = axios.create({
  baseURL: `${API_BASE}/api`,
  timeout: 90000, // 90 seconds: Render cold start (~30s) + Gemini (~15s)
})

export const triggerWalletAgent = async () => {
  // Wake Render from cold sleep (free tier sleeps after 15min).
  // Health ping waits up to 55s — after this, main call only needs ~10s for Gemini.
  try {
    await api.get('/health', { timeout: 55000 })
    console.log('[API] Backend awake — proceeding with AI analysis...')
  } catch { /* ignore — continue regardless */ }

  const { data } = await walletApi.post('/agent/trigger-wallet')
  return data
}

export const logExternalTx = async (decision, txHash) => {
  const { data } = await api.post('/agent/log-wallet-tx', { decision, txHash })
  return data
}

// ── Storage verification ─────────────────────────────────────────────────────
export const verifyStorage = async (storageHash) => {
  const { data } = await api.get(`/verify/${encodeURIComponent(storageHash)}`)
  return data
}

// ── Health ───────────────────────────────────────────────────────────────────
export const getHealth = async () => {
  const { data } = await api.get('/health')
  return data
}

export { WS_URL, API_BASE }
export default api
