// api.js — All API calls to AlphaTrace backend
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const WS_URL   = import.meta.env.VITE_WS_URL  || 'ws://localhost:3001/ws'

const api = axios.create({
  baseURL: `${API_BASE}/api`,
  timeout: 15000,
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
