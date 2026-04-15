// AgentStatusCard.jsx — Shows agent lifecycle state with Start/Stop controls
import React from 'react'
import { formatTime } from '../utils/formatters'

const STATUS_CONFIG = {
  RUNNING: { color: 'text-cyan-400',  bg: 'bg-cyan-500/10 border-cyan-500/25',   dot: 'bg-cyan-400',  label: '⊙ RUNNING' },
  IDLE:    { color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/25',  dot: 'bg-green-400', label: '◉ IDLE' },
  ERROR:   { color: 'text-red-400',   bg: 'bg-red-500/10 border-red-500/25',      dot: 'bg-red-400',   label: '✕ ERROR' },
  STOPPED: { color: 'text-orange-400',bg: 'bg-orange-500/10 border-orange-500/25',dot: 'bg-orange-400',label: '⏹ STOPPED' },
}

export default function AgentStatusCard({ agentStatus, triggering, stopping, starting, triggerMessage, onTrigger, onStop, onStart, isWalletConnected, onTriggerWallet, walletTriggering }) {
  const cfg = STATUS_CONFIG[agentStatus?.status] || STATUS_CONFIG.IDLE
  const markets = ['ETH/USDC', 'BTC/USDC']
  const activeMarkets = agentStatus?.currentMarkets || []
  const isStopped = agentStatus?.isPaused || agentStatus?.status === 'STOPPED'

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 glow-card">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-purple-600/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
            </svg>
          </div>
          <span className="font-display font-semibold text-gray-100">Agent Monitor</span>
        </div>

        {/* Status badge */}
        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold ${cfg.bg} ${cfg.color}`}>
          <div className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${agentStatus?.isRunning ? 'animate-pulse' : ''}`} />
          {cfg.label}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-gray-800/60 rounded-lg p-3">
          <p className="text-xs text-gray-500 mb-1">Cycles Run</p>
          <p className="font-display font-bold text-gray-100">{agentStatus?.cycleCount ?? 0}</p>
        </div>
        <div className="bg-gray-800/60 rounded-lg p-3">
          <p className="text-xs text-gray-500 mb-1">Decisions</p>
          <p className="font-display font-bold text-gray-100">{agentStatus?.totalDecisions ?? 0}</p>
        </div>
        <div className="bg-gray-800/60 rounded-lg p-3">
          <p className="text-xs text-gray-500 mb-1">Last Run</p>
          <p className="font-display font-bold text-gray-100 text-sm">
            {agentStatus?.lastRunTime ? formatTime(agentStatus.lastRunTime) : '—'}
          </p>
        </div>
      </div>

      {/* Markets being analyzed */}
      <div className="mb-4">
        <p className="text-xs text-gray-500 mb-2">Markets</p>
        <div className="flex flex-wrap gap-1.5">
          {markets.map((m) => {
            const coinId = m.split('/')[0].toLowerCase()
            const isActive = agentStatus?.isRunning && (
              activeMarkets.length === 0 ||
              activeMarkets.some((am) => am.includes(coinId))
            )
            return (
              <span
                key={m}
                className={`px-2 py-1 rounded-md text-xs font-medium border transition-all ${
                  isActive
                    ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300 animate-pulse'
                    : 'bg-gray-800 border-gray-700 text-gray-400'
                }`}
              >
                {m}
              </span>
            )
          })}
        </div>
      </div>

      {/* Error */}
      {agentStatus?.lastError && (
        <div className="mb-3 p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-xs text-red-400">⚠ {agentStatus.lastError}</p>
        </div>
      )}

      {/* Trigger/Status message */}
      {triggerMessage && (
        <div className="mb-3 p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <p className="text-xs text-blue-300">{triggerMessage}</p>
        </div>
      )}

      {/* Start / Stop / Trigger buttons */}
      <div className="flex gap-2">
        {/* Stop button — only when running */}
        {!isStopped ? (
          <button
            onClick={onStop}
            disabled={stopping}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold transition-all duration-200"
            title="Stop autonomous loop"
          >
            {stopping ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            ) : (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
            )}
            Stop
          </button>
        ) : (
          /* Start button — when stopped */
          <button
            onClick={onStart}
            disabled={starting}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-green-500/15 border border-green-500/30 text-green-400 hover:bg-green-500/25 hover:shadow-[0_0_15px_rgba(34,197,94,0.3)] disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold transition-all duration-200"
            title="Start autonomous loop"
          >
            {starting ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            ) : (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            )}
            Start
          </button>
        )}

        {/* Trigger manually button */}
        {isWalletConnected ? (
          <button
            onClick={onTriggerWallet}
            disabled={walletTriggering}
            className="flex-1 py-2.5 px-4 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/40 text-yellow-300 font-bold text-sm transition-all duration-300 flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(234,179,8,0.2)] disabled:opacity-50 disabled:cursor-not-allowed"
            title="Fetch AI decision and sign on-chain via MetaMask"
          >
            {walletTriggering ? (
              <>
                <svg className="w-4 h-4 animate-spin text-yellow-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Waiting for signature...
              </>
            ) : (
              <>
                <span className="text-xl leading-none">🦊</span>
                Trigger & Sign (Metamask)
              </>
            )}
          </button>
        ) : (
          <button
            onClick={onTrigger}
            disabled={agentStatus?.isRunning || triggering || isStopped}
            className="btn-primary flex-1 py-2.5 px-4 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-medium text-sm transition-all flex items-center justify-center gap-2"
            title={isStopped ? 'Start the agent first' : 'Run one analysis cycle now'}
          >
            {agentStatus?.isRunning || triggering ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Running...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/>
                </svg>
                {isStopped ? 'Agent Stopped' : 'Trigger Manually'}
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
