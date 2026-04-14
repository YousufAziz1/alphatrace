// useDecisions.js — Custom hook for managing decisions state + WebSocket
import { useState, useEffect, useCallback, useRef } from 'react'
import { getDecisions, getStats } from '../utils/api'
import { WS_URL } from '../utils/api'

export function useDecisions() {
  const [decisions, setDecisions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [stats, setStats] = useState(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [wsConnected, setWsConnected] = useState(false)
  const [filter, setFilter] = useState({ market: null, action: null })

  const wsRef = useRef(null)
  const reconnectTimerRef = useRef(null)
  const LIMIT = 20

  // Fetch decisions from API
  const fetchDecisions = useCallback(async (pageNum = 1, append = false) => {
    try {
      if (!append) setLoading(true)
      setError(null)

      const params = { limit: LIMIT, page: pageNum }
      if (filter.market) params.market = filter.market
      if (filter.action) params.action = filter.action

      const result = await getDecisions(params)
      const newDecisions = result.decisions || []

      setDecisions((prev) => append ? [...prev, ...newDecisions] : newDecisions)
      setTotal(result.total || 0)
      setHasMore(pageNum * LIMIT < (result.total || 0))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [filter])

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const result = await getStats()
      setStats(result.stats)
    } catch {/* non-fatal */}
  }, [])

  // Fetch more (pagination)
  const fetchMore = useCallback(() => {
    const nextPage = page + 1
    setPage(nextPage)
    fetchDecisions(nextPage, true)
  }, [page, fetchDecisions])

  // WebSocket connection
  const connectWS = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    try {
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => {
        setWsConnected(true)
        console.log('[WS] Connected to AlphaTrace backend')
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)

          if (msg.type === 'NEW_DECISION') {
            const decision = msg.data
            setDecisions((prev) => {
              // Don't add if filtered out
              if (filter.market && decision.market !== filter.market) return prev
              if (filter.action && decision.action !== filter.action) return prev
              // Check duplicate
              if (prev.find((d) => d.id === decision.id)) return prev
              return [decision, ...prev]
            })
            setTotal((t) => t + 1)
            // Refresh stats
            fetchStats()
          }

          if (msg.type === 'AGENT_STATUS') {
            // Propagated via agentStatus context if needed
          }
        } catch {/* ignore parse errors */}
      }

      ws.onclose = () => {
        setWsConnected(false)
        console.log('[WS] Disconnected — reconnecting in 3s')
        reconnectTimerRef.current = setTimeout(connectWS, 3000)
      }

      ws.onerror = () => {
        ws.close()
      }
    } catch (err) {
      console.warn('[WS] Error:', err.message)
    }
  }, [filter, fetchStats])

  // Initial load
  useEffect(() => {
    fetchDecisions(1)
    fetchStats()
  }, [fetchDecisions, fetchStats])

  // WebSocket
  useEffect(() => {
    connectWS()
    return () => {
      if (wsRef.current) wsRef.current.close()
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
    }
  }, [connectWS])

  // Refresh stats every 30s
  useEffect(() => {
    const interval = setInterval(fetchStats, 30000)
    return () => clearInterval(interval)
  }, [fetchStats])

  const setFilterAndRefetch = useCallback((newFilter) => {
    setFilter(newFilter)
    setPage(1)
  }, [])

  return {
    decisions,
    loading,
    error,
    stats,
    total,
    hasMore,
    wsConnected,
    fetchMore,
    refetch: () => fetchDecisions(1),
    filter,
    setFilter: setFilterAndRefetch,
    wsRef,
  }
}
