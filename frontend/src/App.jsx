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
import { connectWallet, recordDecisionOnChain } from './utils/contract'
import { triggerWalletAgent, logExternalTx } from './utils/api'

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

  const { agentStatus, triggering, stopping, starting, triggerMessage, trigger, stop, start, updateFromWS } = useAgentStatus()
  const [selectedMarket, setSelectedMarket] = useState(null)
  
  // Wallet Mode State
  const [walletAddress, setWalletAddress] = useState(null)
  const isWalletConnected = !!walletAddress

  const handleConnectWallet = async () => {
    try {
      if (isWalletConnected) {
        setWalletAddress(null) // Disconnect logically
        return
      }
      
      const account = await connectWallet()
      setWalletAddress(account)
      
      // Stop the autonomous agent to prevent conflicts
      if (agentStatus.isRunning || !agentStatus.isPaused) {
        await stop()
      }
    } catch (err) {
      alert(`Wallet Connection Error: ${err.message}`)
    }
  }

  const [walletTriggering, setWalletTriggering] = useState(false)
  
  const handleTriggerWallet = async () => {
    if (!isWalletConnected) return
    try {
      setWalletTriggering(true)
      // 1. Ask Server to do analysis and store to 0G offchain data network
      const { decision } = await triggerWalletAgent()
      
      // 2. Ask User to Sign TX
      const txHash = await recordDecisionOnChain(decision.market, decision.action, decision.storageHash)
      
      // 3. Log External TX to DB and trigger feed update
      await logExternalTx(decision, txHash)
      
      alert('Transaction Submitted & Logged Successfully!')
    } catch(err) {
      alert(`Transaction Failed: ${err.message}`)
    } finally {
      setWalletTriggering(false)
    }
  }

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
        {/* Live Proof Banner */}
        <div className="animate-fade-up flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-green-500/10 border border-green-500/30 p-5 rounded-2xl relative overflow-hidden group" style={{ animationDelay: '0ms' }}>
          <div className="absolute inset-0 bg-green-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
          <div>
            <h3 className="text-green-400 font-bold text-lg mb-1 flex items-center gap-2">
               🔐 Live On-Chain Proof
            </h3>
            <p className="text-sm text-green-300/80 font-medium">Every decision is sequentially stored on 0G Storage and verified on 0G Chain.</p>
          </div>
          <a
            href="https://chainscan-galileo.0g.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 px-5 py-2.5 bg-green-500/20 text-green-400 font-bold text-sm rounded-xl border border-green-500/30 hover:bg-green-500/30 hover:-translate-y-0.5 transition-all duration-300 shadow-[0_0_20px_rgba(34,197,94,0.15)] hover:shadow-[0_0_30px_rgba(34,197,94,0.3)]"
          >
            View Latest Proof
          </a>
        </div>

        {/* Wallet Mode Banner */}
        <div className={`animate-fade-up flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border p-5 rounded-2xl relative overflow-hidden group transition-all duration-500 ${isWalletConnected ? 'bg-purple-900/10 border-purple-500/50' : 'bg-[#111118] border-gray-800'}`} style={{ animationDelay: '20ms' }}>
          <div>
            <h3 className={`font-bold text-lg mb-1 flex items-center gap-2 ${isWalletConnected ? 'text-purple-300' : 'text-gray-100'}`}>
              <span className="text-xl">🦊</span> {isWalletConnected ? 'Web3 Wallet Connected' : 'Web3 Wallet Integration'}
            </h3>
            <p className="text-sm text-gray-400 font-medium max-w-3xl">
              {isWalletConnected 
                ? `Connected: ${walletAddress.substring(0,6)}...${walletAddress.substring(walletAddress.length - 4)}. Autonomous agent is paused. You can now execute and cover gas fees manually.`
                : `Users can optionally connect their wallet to execute and verify AI decisions directly on-chain (gas fees apply on testnet).`
              }
            </p>
          </div>
          
          <button
            onClick={handleConnectWallet}
            className={`shrink-0 flex items-center gap-3 px-5 py-2.5 font-semibold text-sm rounded-xl border transition-all duration-300 ${
              isWalletConnected 
                ? 'bg-purple-600/20 text-purple-300 border-purple-500/40 hover:bg-purple-600/30' 
                : 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700 hover:text-white'
            }`}
          >
            {isWalletConnected ? 'Disconnect Wallet' : 'Switch to Wallet Mode (On-chain Execution)'}
            
            <div className={`w-8 h-4 rounded-full relative shadow-inner border transition-colors duration-300 ${isWalletConnected ? 'bg-purple-900 border-purple-500' : 'bg-gray-900 border-gray-700'}`}>
              <div className={`absolute top-[1px] w-3 h-3 rounded-full transition-all duration-300 ${isWalletConnected ? 'left-4 bg-purple-400' : 'left-0.5 bg-gray-500'}`} />
            </div>
          </button>
        </div>

        {/* Stats bar */}
        <div className="animate-fade-up" style={{ animationDelay: '40ms' }}>
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
              stopping={stopping}
              starting={starting}
              triggerMessage={triggerMessage}
              onTrigger={trigger}
              onStop={stop}
              onStart={start}
              isWalletConnected={isWalletConnected}
              onTriggerWallet={handleTriggerWallet}
              walletTriggering={walletTriggering}
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

        {/* Why this matters */}
        <div className="animate-fade-up mt-6 p-8 bg-[#0a0a0f] border border-gray-800 rounded-2xl relative overflow-hidden group" style={{ animationDelay: '200ms' }}>
          <div className="absolute -right-20 -top-20 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl pointer-events-none group-hover:bg-purple-600/20 transition-all duration-700" />
          
          <h2 className="text-xl font-display font-bold text-white mb-4 flex items-center gap-2">
            🚀 Why AlphaTrace Matters
          </h2>
          <p className="text-gray-400 leading-relaxed mb-6 max-w-2xl text-sm sm:text-base">
            Traditional AI trading bots are black boxes. You never truly know if they are front-running you, changing strategies mid-flight, or falsifying performance.
          </p>
          
          <p className="text-gray-300 font-medium mb-4">
            AlphaTrace changes this by making every decision:
          </p>
          <ul className="flex flex-col sm:flex-row gap-4 sm:gap-10 mb-6">
            <li className="flex items-center gap-2 font-medium text-gray-200"><span className="text-green-400 bg-green-500/10 p-1 rounded-full">✔</span> Transparent</li>
            <li className="flex items-center gap-2 font-medium text-gray-200"><span className="text-green-400 bg-green-500/10 p-1 rounded-full">✔</span> Verifiable</li>
            <li className="flex items-center gap-2 font-medium text-gray-200"><span className="text-green-400 bg-green-500/10 p-1 rounded-full">✔</span> Trustless</li>
          </ul>
          
          <div className="inline-block px-4 py-2 bg-purple-500/10 border border-purple-500/20 rounded-lg">
            <p className="text-purple-300 text-sm font-semibold tracking-wide uppercase">
              No more blind trust — verify everything permanently on-chain.
            </p>
          </div>
        </div>
      </main>

      {/* Live ticker at bottom */}
      <LiveTicker decisions={decisions} />
    </div>
  )
}
