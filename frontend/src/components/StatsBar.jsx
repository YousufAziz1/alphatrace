// StatsBar.jsx — 4 stat cards: decisions, win rate, PnL, last decision
import React from 'react'
import { formatTime, formatPnL } from '../utils/formatters'

function StatCard({ label, value, sub, valueClass = 'text-gray-50', icon }) {
  return (
    <div className="flex-1 min-w-0 bg-gray-900 border border-gray-800 rounded-xl p-4 glow-card">
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">{label}</span>
        {icon && (
          <span className="text-base opacity-60">{icon}</span>
        )}
      </div>
      <p className={`font-display text-2xl font-bold leading-none mt-2 ${valueClass}`}>{value}</p>
      {sub && <p className="text-xs text-gray-600 mt-1.5">{sub}</p>}
    </div>
  )
}

export default function StatsBar({ stats }) {
  if (!stats) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-4 h-24 skeleton" />
        ))}
      </div>
    )
  }

  const pnl = formatPnL(stats.totalPnL)
  const winRateColor = stats.winRate >= 55
    ? 'text-green-400'
    : stats.winRate >= 45
    ? 'text-yellow-400'
    : 'text-red-400'

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <StatCard
        label="Total Decisions"
        value={stats.total ?? 0}
        sub={`${stats.last24hDecisions ?? 0} in last 24h`}
        icon="⚡"
      />
      <StatCard
        label="Win Rate"
        value={`${stats.winRate ?? 0}%`}
        sub={`Avg confidence: ${stats.avgConfidence ?? 0}%`}
        valueClass={winRateColor}
        icon="🎯"
      />
      <StatCard
        label="Live PnL"
        value={pnl.text}
        sub={stats.realPnL ? 'Real prices · $100 notional' : 'Based on targets vs entries'}
        valueClass={pnl.colorClass}
        icon="⚡"
      />
      <StatCard
        label="BUY / SELL / HOLD"
        value={`${stats.byAction?.BUY ?? 0} / ${stats.byAction?.SELL ?? 0} / ${stats.byAction?.HOLD ?? 0}`}
        sub={`${stats.total} total signals`}
        icon="🧠"
      />
    </div>
  )
}
