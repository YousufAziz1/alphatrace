// useAgentStatus.js — Custom hook for agent status polling
import { useState, useEffect, useCallback } from 'react'
import { getAgentStatus, triggerAgent } from '../utils/api'

export function useAgentStatus() {
  const [agentStatus, setAgentStatus] = useState({
    isRunning: false,
    status: 'IDLE',
    lastRunTime: null,
    nextRunTime: null,
    totalDecisions: 0,
    cycleCount: 0,
    currentMarkets: [],
    lastError: null,
  })
  const [triggering, setTriggering] = useState(false)
  const [triggerMessage, setTriggerMessage] = useState(null)

  const fetchStatus = useCallback(async () => {
    try {
      const result = await getAgentStatus()
      if (result.success) {
        setAgentStatus(result.status)
      }
    } catch {/* non-fatal */}
  }, [])

  const trigger = useCallback(async () => {
    if (triggering || agentStatus.isRunning) return
    try {
      setTriggering(true)
      const result = await triggerAgent()
      setTriggerMessage(result.message || 'Agent cycle started!')
      setTimeout(() => setTriggerMessage(null), 4000)
      // Start polling faster
      const fastPoll = setInterval(fetchStatus, 1500)
      setTimeout(() => clearInterval(fastPoll), 60000)
    } catch (err) {
      setTriggerMessage(`Error: ${err.response?.data?.error || err.message}`)
      setTimeout(() => setTriggerMessage(null), 4000)
    } finally {
      setTriggering(false)
    }
  }, [triggering, agentStatus.isRunning, fetchStatus])

  // Update from WebSocket message
  const updateFromWS = useCallback((wsData) => {
    setAgentStatus((prev) => ({ ...prev, ...wsData }))
  }, [])

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 5000)
    return () => clearInterval(interval)
  }, [fetchStatus])

  return { agentStatus, triggering, triggerMessage, trigger, updateFromWS }
}
