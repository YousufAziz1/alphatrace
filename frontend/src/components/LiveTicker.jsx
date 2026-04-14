// LiveTicker.jsx — Horizontal infinite scrolling ticker of latest decisions
import React, { useMemo } from 'react'
import { formatPrice } from '../utils/formatters'

const ACTION_STYLES = {
  BUY:  { text: 'text-green-400', symbol: '▲' },
  SELL: { text: 'text-red-400',   symbol: '▼' },
  HOLD: { text: 'text-yellow-400', symbol: '◆' },
}

export default function LiveTicker({ decisions = [] }) {
  const tickerItems = useMemo(() => {
    const source = decisions.slice(0, 20)
    if (source.length === 0) {
      return [
        { market: 'ETH/USDC', action: 'BUY',  confidence: 87, entryPrice: 2341 },
        { market: 'BTC/USDC', action: 'HOLD', confidence: 63, entryPrice: 65200 },
        { market: 'SOL/USDC', action: 'SELL', confidence: 71, entryPrice: 142 },
        { market: 'ARB/USDC', action: 'BUY',  confidence: 79, entryPrice: 0.82 },
      ]
    }
    return source
  }, [decisions])

  // Duplicate for seamless loop
  const doubled = [...tickerItems, ...tickerItems]
  const isDemo = decisions.length === 0

  return (
    <div className="border-t border-gray-800/60 bg-gray-950/80 py-2.5 overflow-hidden relative">
      {/* Fade edges */}
      <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-gray-950 to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-gray-950 to-transparent z-10 pointer-events-none" />

      {/* Left label */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 z-20 flex items-center gap-1.5 pr-3">
        <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Live</span>
      </div>

      <div className="flex pl-20">
        <div className="ticker-track flex gap-8 whitespace-nowrap">
          {doubled.map((d, i) => {
            const style = ACTION_STYLES[d.action] || ACTION_STYLES.HOLD
            return (
              <span key={i} className="inline-flex items-center gap-2 text-xs">
                <span className="text-gray-500">{d.market}</span>
                <span className={`font-bold ${style.text}`}>
                  {style.symbol} {d.action}
                </span>
                <span className="text-gray-600">{d.confidence}%</span>
                {d.entryPrice && (
                  <span className="text-gray-500 font-mono">{formatPrice(d.entryPrice)}</span>
                )}
                <span className="text-gray-700">·</span>
              </span>
            )
          })}
        </div>
      </div>

      {isDemo && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 z-20">
          <span className="text-xs text-gray-700">demo</span>
        </div>
      )}
    </div>
  )
}
