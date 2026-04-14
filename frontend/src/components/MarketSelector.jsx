// MarketSelector.jsx — Market filter buttons with live price data
import React, { useState, useEffect } from 'react'
import { getMarkets } from '../utils/api'
import { formatPrice, getChangeColor, formatNumber } from '../utils/formatters'

const MARKETS = [
  { id: 'ETH/USDC', symbol: 'ETH', coinId: 'ethereum', icon: '⧡' },
  { id: 'BTC/USDC', symbol: 'BTC', coinId: 'bitcoin',  icon: '₿' },
]

export default function MarketSelector({ selectedMarket, onSelect }) {
  const [marketData, setMarketData] = useState({})
  const [loading, setLoading] = useState(true)

  const fetchPrices = async () => {
    try {
      const result = await getMarkets()
      const bySymbol = {}
      ;(result.markets || []).forEach((m) => { bySymbol[m.symbol] = m })
      setMarketData(bySymbol)
    } catch {/* non-fatal */} finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPrices()
    const interval = setInterval(fetchPrices, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="font-display font-semibold text-gray-100 text-sm">Markets</span>
        {loading && (
          <span className="text-xs text-gray-600 animate-pulse">Loading prices...</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {MARKETS.map((market) => {
          const data = marketData[market.id] || {}
          const isActive = selectedMarket === market.id
          const changeColor = getChangeColor(data.change24h)

          return (
            <button
              key={market.id}
              onClick={() => onSelect(isActive ? null : market.id)}
              className={`
                relative group rounded-xl p-3 text-left border transition-all duration-200
                ${isActive
                  ? 'bg-purple-600/20 border-purple-500/50 shadow-glow-purple'
                  : 'bg-gray-800/50 border-gray-700/50 hover:border-purple-500/30 hover:bg-purple-600/10'
                }
              `}
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className={`text-base ${isActive ? 'text-purple-300' : 'text-gray-400'}`}>
                    {market.icon}
                  </span>
                  <span className={`font-display font-bold text-sm ${isActive ? 'text-purple-200' : 'text-gray-200'}`}>
                    {market.symbol}
                  </span>
                </div>
                <span className={`text-xs font-medium ${changeColor}`}>
                  {data.change24h != null
                    ? `${data.change24h > 0 ? '+' : ''}${data.change24h.toFixed(1)}%`
                    : '—'
                  }
                </span>
              </div>

              <p className={`font-mono text-sm font-semibold ${isActive ? 'text-purple-100' : 'text-gray-100'}`}>
                {data.price ? formatPrice(data.price) : loading ? '...' : '—'}
              </p>

              {data.rsi != null && (
                <p className="text-xs text-gray-600 mt-1">
                  RSI {data.rsi} · {data.trend || '—'}
                </p>
              )}

              {isActive && (
                <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
              )}
            </button>
          )
        })}
      </div>

      {selectedMarket && (
        <button
          onClick={() => onSelect(null)}
          className="mt-2 w-full text-xs text-gray-500 hover:text-gray-300 transition-colors py-1"
        >
          ✕ Clear filter
        </button>
      )}
    </div>
  )
}
