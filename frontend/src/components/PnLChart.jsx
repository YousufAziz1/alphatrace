// PnLChart.jsx — Recharts area chart: simulated cumulative PnL over time
import React, { useState, useMemo } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { formatTime, formatPrice } from '../utils/formatters'

const TIME_RANGES = [
  { label: '1H',  hours: 1 },
  { label: '6H',  hours: 6 },
  { label: '24H', hours: 24 },
  { label: '7D',  hours: 168 },
]

// Demo seed data shown before any real decisions arrive
function generateDemoData() {
  const points = []
  let pnl = 0
  const now = Date.now()
  for (let i = 47; i >= 0; i--) {
    pnl += (Math.random() - 0.45) * 12
    points.push({
      timestamp: new Date(now - i * 30 * 60 * 1000).toISOString(),
      pnl: parseFloat(pnl.toFixed(2)),
      market: 'DEMO',
      action: Math.random() > 0.5 ? 'BUY' : 'SELL',
    })
  }
  return points
}

const DEMO_DATA = generateDemoData()

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-3 shadow-xl text-xs">
      <p className="text-gray-400 mb-1">{formatTime(d?.timestamp)}</p>
      <p className={`font-bold font-mono text-sm ${d?.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
        {d?.pnl >= 0 ? '+' : ''}{formatPrice(d?.pnl)}
      </p>
      {d?.market && d.market !== 'DEMO' && (
        <p className="text-gray-500 mt-1">{d.market} · {d.action}</p>
      )}
    </div>
  )
}

export default function PnLChart({ pnlHistory = [] }) {
  const [selectedRange, setSelectedRange] = useState('24H')
  const isDemo = pnlHistory.length === 0

  const filteredData = useMemo(() => {
    const source = isDemo ? DEMO_DATA : pnlHistory
    const rangeHours = TIME_RANGES.find((r) => r.label === selectedRange)?.hours || 24
    const cutoff = Date.now() - rangeHours * 3600 * 1000
    const filtered = source.filter((d) => new Date(d.timestamp).getTime() >= cutoff)
    return filtered.length > 0 ? filtered : source.slice(-Math.min(10, source.length))
  }, [pnlHistory, selectedRange, isDemo])

  const finalPnL = filteredData[filteredData.length - 1]?.pnl ?? 0
  const isPositive = finalPnL >= 0

  const formatXAxis = (ts) => {
    const date = new Date(ts)
    if (selectedRange === '7D') return date.toLocaleDateString('en', { weekday: 'short' })
    return date.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 glow-card">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="font-display font-semibold text-gray-100">Live PnL Performance</h3>
            <span className="px-2 py-0.5 rounded-full bg-green-500/15 border border-green-500/25 text-green-400 text-xs font-semibold">
              ⚡ Real
            </span>
            {isDemo && (
              <span className="px-2 py-0.5 rounded-full bg-gray-700 border border-gray-600 text-gray-400 text-xs">
                Demo data
              </span>
            )}
          </div>
          <p className={`font-display font-bold text-2xl ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
            {isPositive ? '+' : ''}{formatPrice(finalPnL)}
          </p>
          <p className="text-xs text-gray-600 mt-0.5">$100 notional · actual market prices</p>
        </div>

        {/* Time range selector */}
        <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
          {TIME_RANGES.map((range) => (
            <button
              key={range.label}
              onClick={() => setSelectedRange(range.label)}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                selectedRange === range.label
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={filteredData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="pnlGradientPos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="pnlGradientNeg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
            <XAxis
              dataKey="timestamp"
              tickFormatter={formatXAxis}
              stroke="#374151"
              tick={{ fill: '#6b7280', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#374151"
              tick={{ fill: '#6b7280', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `$${v.toFixed(0)}`}
              width={45}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0} stroke="#374151" strokeDasharray="4 4" />
            <Area
              type="monotone"
              dataKey="pnl"
              stroke={isPositive ? '#22c55e' : '#ef4444'}
              strokeWidth={2}
              fill={isPositive ? 'url(#pnlGradientPos)' : 'url(#pnlGradientNeg)'}
              dot={false}
              activeDot={{ r: 4, fill: isPositive ? '#22c55e' : '#ef4444' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-gray-600 mt-3 text-center">
        PnL based on real CoinGecko price movements · $100 notional per signal · Not financial advice
      </p>
    </div>
  )
}
