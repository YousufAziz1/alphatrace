// App.jsx — Main AlphaTrace dashboard
import React, { useState, useEffect, useRef, useCallback } from 'react'
import Header from './components/Header'
import StatsBar from './components/StatsBar'
import AgentStatusCard from './components/AgentStatusCard'
import MarketSelector from './components/MarketSelector'
import DecisionFeed from './components/DecisionFeed'
import PnLChart from './components/PnLChart'
import LiveTicker from './components/LiveTicker'
import { useDecisions } from './hooks/useDecisions'
import { useAgentStatus } from './hooks/useAgentStatus'

export default function App() {
  const {
    decisions,
    loading,
    error,
    stats,
    total,
    hasMore,
    wsConnected,
    fetchMore,
    refetch,
    filter,
    setFilter,
    wsRef,
  } = useDecisions()

  const { agentStatus, triggering, triggerMessage, trigger, updateFromWS } = useAgentStatus()
  const [selectedMarket, setSelectedMarket] = useState(null)

  // Forward agent WS status updates from the shared WS connection
  useEffect(() => {
    const ws = wsRef.current
    if (!ws) return

    const originalOnMessage = ws.onmessage
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.type === 'AGENT_STATUS') updateFromWS(msg.data)
      } catch {/* ignore */}
      if (originalOnMessage) originalOnMessage(event)
    }
  }, [wsRef, updateFromWS])

  const handleMarketSelect = (market) => {
    setSelectedMarket(market)
    setFilter({ ...filter, market })
  }

  const pnlHistory = stats?.pnlHistory || []

  return (
    <div className="min-h-screen flex flex-col bg-gray-950 text-gray-50 relative overflow-hidden">
      {/* Background orbs */}
      <div className="orb w-[600px] h-[600px] bg-purple-600/8 -top-60 -left-40 pointer-events-none" style={{ animationDelay: '0s' }} />
      <div className="orb w-[400px] h-[400px] bg-cyan-500/6 bottom-20 -right-20 pointer-events-none" style={{ animationDelay: '-4s' }} />

      {/* Header */}
      <Header wsConnected={wsConnected} />

      {/* Main content */}
      <main className="flex-1 max-w-screen-2xl w-full mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Stats bar */}
        <div className="animate-fade-up" style={{ animationDelay: '0ms' }}>
          <StatsBar stats={stats} />
        </div>

        {/* Main 2-column grid */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-5" style={{ minHeight: '700px' }}>
          {/* Left: Decision Feed — takes 3/5 */}
          <div className="xl:col-span-3 animate-fade-up" style={{ animationDelay: '80ms', height: '750px' }}>
            <DecisionFeed
              decisions={decisions}
              loading={loading}
              error={error}
              total={total}
              hasMore={hasMore}
              filter={filter}
              onFilterChange={setFilter}
              onFetchMore={fetchMore}
              wsConnected={wsConnected}
            />
          </div>

          {/* Right: Agent + Market + Chart — takes 2/5 */}
          <div className="xl:col-span-2 space-y-4 animate-fade-up" style={{ animationDelay: '160ms' }}>
            {/* Agent status */}
            <AgentStatusCard
              agentStatus={agentStatus}
              triggering={triggering}
              triggerMessage={triggerMessage}
              onTrigger={trigger}
            />

            {/* Market selector */}
            <MarketSelector
              selectedMarket={selectedMarket}
              onSelect={handleMarketSelect}
            />

            {/* PnL chart */}
            <PnLChart pnlHistory={pnlHistory} />
          </div>
        </div>
      </main>

      {/* Live ticker at bottom */}
      <LiveTicker decisions={decisions} />
    </div>
  )
}
