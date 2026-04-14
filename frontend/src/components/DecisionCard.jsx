// DecisionCard.jsx — The core card displaying each AI trading decision
import React, { useState } from 'react'
import { formatPrice, formatTime, formatHash, getActionColor, getConfidenceColor, getTrendColor } from '../utils/formatters'
import VerifyModal from './VerifyModal'

export default function DecisionCard({ decision, isNew = false }) {
  const [showVerify, setShowVerify] = useState(false)
  const [copied, setCopied] = useState(false)

  const actionCfg = getActionColor(decision.action)
  const confColor = getConfidenceColor(decision.confidence)
  const trendCfg = getTrendColor(decision.indicators?.trend)

  const copyHash = async () => {
    await navigator.clipboard.writeText(decision.txHash || decision.storageHash || decision.id)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      {showVerify && (
        <VerifyModal decision={decision} onClose={() => setShowVerify(false)} />
      )}

      <div
        className={`
          relative bg-gray-900 border border-gray-800 rounded-xl overflow-hidden
          transition-all duration-300 hover:border-gray-700 hover:-translate-y-0.5
          hover:shadow-xl hover:shadow-black/40
          ${isNew ? 'animate-slide-in' : ''}
        `}
      >
        {/* Left accent bar */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
          style={{ backgroundColor: actionCfg.bar }}
        />

        <div className="pl-4 pr-4 pt-4 pb-3">
          {/* Top row */}
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Market badge */}
              <span className="px-2 py-0.5 rounded-md bg-gray-800 border border-gray-700 text-xs font-mono text-gray-300">
                {decision.market}
              </span>

              {/* Action badge */}
              <span className={`px-3 py-0.5 rounded-md text-xs font-bold border ${actionCfg.bg} ${actionCfg.text} ${actionCfg.border}`}>
                {decision.action}
              </span>

              {/* Confidence */}
              <span className={`text-xs font-semibold ${confColor}`}>
                {decision.confidence}% conf
              </span>
            </div>

            {/* Time */}
            <span className="text-xs text-gray-600 shrink-0">{formatTime(decision.timestamp)}</span>
          </div>

          {/* Reasoning */}
          <p className="text-sm text-gray-400 leading-relaxed mb-3">
            {decision.shortReasoning || decision.reasoning?.slice(0, 120) || 'No reasoning available'}
          </p>

          {/* Price row */}
          {(decision.entryPrice || decision.targetPrice || decision.stopLoss) && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs mb-3">
              {decision.entryPrice && (
                <span className="text-gray-400">
                  Entry <span className="text-gray-100 font-medium font-mono">{formatPrice(decision.entryPrice)}</span>
                </span>
              )}
              {decision.targetPrice && (
                <span className="text-gray-400">
                  Target <span className="text-green-400 font-medium font-mono">{formatPrice(decision.targetPrice)}</span>
                </span>
              )}
              {decision.stopLoss && (
                <span className="text-gray-400">
                  Stop <span className="text-red-400 font-medium font-mono">{formatPrice(decision.stopLoss)}</span>
                </span>
              )}
            </div>
          )}

          {/* Indicators row */}
          {decision.indicators && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {decision.indicators.rsi != null && (
                <span className="px-2 py-0.5 rounded-md bg-gray-800 text-xs text-gray-400 border border-gray-700">
                  RSI {decision.indicators.rsi}
                </span>
              )}
              {decision.indicators.trend && (
                <span className={`px-2 py-0.5 rounded-md text-xs border ${trendCfg.bg} ${trendCfg.text} border-current/20`}>
                  {decision.indicators.trend}
                </span>
              )}
              {decision.riskScore != null && (
                <span className={`px-2 py-0.5 rounded-md text-xs border ${
                  decision.riskScore <= 3 ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                  decision.riskScore <= 6 ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                  'bg-red-500/10 text-red-400 border-red-500/20'
                }`}>
                  Risk {decision.riskScore}/10
                </span>
              )}
              {decision.timeHorizon && (
                <span className="px-2 py-0.5 rounded-md bg-gray-800 text-xs text-gray-400 border border-gray-700">
                  {decision.timeHorizon}
                </span>
              )}
              {decision.indicators.volume && (
                <span className="px-2 py-0.5 rounded-md bg-gray-800 text-xs text-gray-400 border border-gray-700">
                  Vol {decision.indicators.volume}
                </span>
              )}
            </div>
          )}

          {/* Bottom row: actions */}
          <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-gray-800">
            {decision.explorerUrl && !decision.simulated ? (
              <a
                href={decision.explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/15 border border-green-500/30 text-green-400 hover:bg-green-500/25 hover:shadow-[0_0_15px_rgba(34,197,94,0.4)] text-xs font-bold transition-all duration-300"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Verify On-Chain
              </a>
            ) : decision.simulated ? (
              <span className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-500 text-xs">
                🔒 Simulated
              </span>
            ) : null}

            <button
              onClick={() => setShowVerify(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-cyan-600/15 border border-cyan-500/25 text-cyan-300 hover:bg-cyan-600/25 text-xs font-medium transition-all"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Verify Storage
            </button>

            <button
              onClick={copyHash}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-200 hover:bg-gray-700 text-xs transition-all"
              title="Copy hash"
            >
              {copied ? '✓ Copied' : (
                <>
                  <span>⎘</span>
                  <span className="font-mono">{formatHash(decision.txHash || decision.storageHash || decision.id, 4)}</span>
                </>
              )}
            </button>

            {decision.storageHash === 'PENDING' && (
              <span className="px-2 py-1 rounded-md bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs">
                Storage Pending
              </span>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
