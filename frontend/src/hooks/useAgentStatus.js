// useAgentStatus.js — Custom hook for agent status polling + start/stop
import { useState, useEffect, useCallback } from 'react'
import { getAgentStatus, triggerAgent, stopAgent, startAgent } from '../utils/api'

export function useAgentStatus() {
  const [agentStatus, setAgentStatus] = useState({
    isRunning: false,
    isPaused: false,
    status: 'IDLE',
    lastRunTime: null,
    nextRunTime: null,
    totalDecisions: 0,
    cycleCount: 0,
    currentMarkets: [],
    lastError: null,
  })
  const [triggering, setTriggering] = useState(false)
  const [stopping, setStopping] = useState(false)
  const [starting, setStarting] = useState(false)
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
    if (triggering || agentStatus.isRunning || agentStatus.isPaused) return
    try {
      setTriggering(true)
      const result = await triggerAgent()
      setTriggerMessage(result.message || 'Agent cycle started!')
      setTimeout(() => setTriggerMessage(null), 4000)
      const fastPoll = setInterval(fetchStatus, 1500)
      setTimeout(() => clearInterval(fastPoll), 60000)
    } catch (err) {
      setTriggerMessage(`Error: ${err.response?.data?.error || err.message}`)
      setTimeout(() => setTriggerMessage(null), 4000)
    } finally {
      setTriggering(false)
    }
  }, [triggering, agentStatus.isRunning, agentStatus.isPaused, fetchStatus])

  const stop = useCallback(async () => {
    try {
      setStopping(true)
      const result = await stopAgent()
      if (result.success) {
        setAgentStatus((prev) => ({ ...prev, ...result.status }))
        setTriggerMessage('🛑 Agent stopped.')
        setTimeout(() => setTriggerMessage(null), 3000)
      }
    } catch (err) {
      setTriggerMessage(`Stop Error: ${err.message}`)
      setTimeout(() => setTriggerMessage(null), 3000)
    } finally {
      setStopping(false)
    }
  }, [])

  const start = useCallback(async () => {
    try {
      setStarting(true)
      const result = await startAgent()
      if (result.success) {
        setAgentStatus((prev) => ({ ...prev, ...result.status }))
        setTriggerMessage('▶️ Agent started!')
        setTimeout(() => setTriggerMessage(null), 3000)
        const fastPoll = setInterval(fetchStatus, 1500)
        setTimeout(() => clearInterval(fastPoll), 30000)
      }
    } catch (err) {
      setTriggerMessage(`Start Error: ${err.message}`)
      setTimeout(() => setTriggerMessage(null), 3000)
    } finally {
      setStarting(false)
    }
  }, [fetchStatus])

  // Update from WebSocket message
  const updateFromWS = useCallback((wsData) => {
    setAgentStatus((prev) => ({ ...prev, ...wsData }))
  }, [])

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 5000)
    return () => clearInterval(interval)
  }, [fetchStatus])

  return { agentStatus, triggering, stopping, starting, triggerMessage, trigger, stop, start, updateFromWS }
}
