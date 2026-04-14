// DecisionFeed.jsx — Scrollable list of DecisionCards with filtering
import React, { useRef, useEffect, useState } from 'react'
import DecisionCard from './DecisionCard'

const FILTER_ACTIONS = ['ALL', 'BUY', 'SELL', 'HOLD']

function SkeletonCard() {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
      <div className="flex gap-2">
        <div className="h-5 w-20 skeleton rounded-md" />
        <div className="h-5 w-14 skeleton rounded-md" />
        <div className="h-5 w-16 skeleton rounded-md" />
      </div>
      <div className="h-4 skeleton rounded" />
      <div className="h-4 skeleton rounded w-3/4" />
      <div className="flex gap-2">
        <div className="h-4 w-16 skeleton rounded-md" />
        <div className="h-4 w-16 skeleton rounded-md" />
        <div className="h-4 w-16 skeleton rounded-md" />
      </div>
    </div>
  )
}

export default function DecisionFeed({
  decisions,
  loading,
  error,
  total,
  hasMore,
  filter,
  onFilterChange,
  onFetchMore,
  wsConnected,
}) {
  const [actionFilter, setActionFilter] = useState('ALL')
  const feedRef = useRef(null)
  const prevDecisionCount = useRef(decisions.length)

  // Auto-scroll to top when new decision arrives
  useEffect(() => {
    if (decisions.length > prevDecisionCount.current && feedRef.current) {
      feedRef.current.scrollTo({ top: 0, behavior: 'smooth' })
    }
    prevDecisionCount.current = decisions.length
  }, [decisions.length])

  const handleActionFilter = (action) => {
    const newAction = action === 'ALL' ? null : action
    setActionFilter(action)
    onFilterChange({ ...filter, action: newAction })
  }

  const displayDecisions = decisions

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="font-display font-semibold text-gray-100">Decision Log</span>
            <span className="px-2 py-0.5 rounded-full bg-purple-600/20 border border-purple-500/25 text-purple-300 text-xs font-medium">
              {total}
            </span>
            {wsConnected && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-400 text-xs">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                Live
              </span>
            )}
          </div>
        </div>

        {/* Action filter */}
        <div className="flex gap-1.5">
          {FILTER_ACTIONS.map((action) => (
            <button
              key={action}
              onClick={() => handleActionFilter(action)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all ${
                actionFilter === action
                  ? action === 'BUY'  ? 'bg-green-500/20 border-green-500/40 text-green-300'
                  : action === 'SELL' ? 'bg-red-500/20 border-red-500/40 text-red-300'
                  : action === 'HOLD' ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300'
                  : 'bg-purple-600/20 border-purple-500/40 text-purple-300'
                  : 'bg-gray-800 border-gray-700 text-gray-500 hover:border-gray-600 hover:text-gray-300'
              }`}
            >
              {action}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div ref={feedRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {loading && (
          <>
            {[0, 1, 2, 3].map((i) => <SkeletonCard key={i} />)}
          </>
        )}

        {!loading && error && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="text-4xl mb-3">⚠️</div>
            <p className="text-gray-400 text-sm">Could not load decisions</p>
            <p className="text-gray-600 text-xs mt-1">{error}</p>
          </div>
        )}

        {!loading && !error && displayDecisions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-purple-600/10 border border-purple-500/20 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
              </svg>
            </div>
            <p className="text-gray-300 font-semibold">Waiting for first decision...</p>
            <p className="text-gray-600 text-sm mt-2">
              The agent runs every few minutes.<br/>
              Trigger it manually from the Agent Monitor.
            </p>
          </div>
        )}

        {!loading && displayDecisions.map((decision, idx) => (
          <DecisionCard
            key={decision.id || idx}
            decision={decision}
            isNew={idx === 0}
          />
        ))}

        {/* Load more */}
        {hasMore && !loading && (
          <button
            onClick={onFetchMore}
            className="w-full py-3 text-sm text-gray-500 hover:text-gray-300 border border-gray-800 rounded-xl hover:border-gray-700 transition-all"
          >
            Load more decisions ↓
          </button>
        )}
      </div>
    </div>
  )
}
