// formatters.js — Display formatting utilities for AlphaTrace

// ── Price ────────────────────────────────────────────────────────────────────
export function formatPrice(price) {
  if (price == null || isNaN(price)) return '$—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: price < 1 ? 4 : 2,
    maximumFractionDigits: price < 1 ? 4 : 2,
  }).format(price)
}

// ── Compact price ─────────────────────────────────────────────────────────────
export function formatPriceShort(price) {
  if (price == null || isNaN(price)) return '$—'
  if (price >= 10000) return `$${(price / 1000).toFixed(1)}k`
  return formatPrice(price)
}

// ── PnL ─────────────────────────────────────────────────────────────────────
export function formatPnL(pnl) {
  if (pnl == null || isNaN(pnl)) return { text: '$—', colorClass: 'text-gray-500' }
  const abs = Math.abs(pnl)
  const sign = pnl >= 0 ? '+' : '-'
  const text = `${sign}$${abs.toFixed(2)}`
  const colorClass = pnl >= 0 ? 'text-green-400' : 'text-red-400'
  return { text, colorClass }
}

// ── Relative time ────────────────────────────────────────────────────────────
export function formatTime(timestamp) {
  if (!timestamp) return '—'
  const now = Date.now()
  const then = new Date(timestamp).getTime()
  const diffSec = Math.floor((now - then) / 1000)

  if (diffSec < 5)   return 'just now'
  if (diffSec < 60)  return `${diffSec}s ago`

  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60)  return `${diffMin}m ago`

  const diffHrs = Math.floor(diffMin / 60)
  if (diffHrs < 24)  return `${diffHrs}h ago`

  const diffDays = Math.floor(diffHrs / 24)
  return `${diffDays}d ago`
}

// ── Hash shortener ───────────────────────────────────────────────────────────
export function formatHash(hash, len = 6) {
  if (!hash || hash === 'PENDING' || hash === 'SIMULATED') return hash || '—'
  if (hash.length <= len * 2 + 3) return hash
  return `${hash.slice(0, len)}...${hash.slice(-len)}`
}

// ── Action color classes ──────────────────────────────────────────────────────
export function getActionColor(action) {
  switch (action?.toUpperCase()) {
    case 'BUY':  return { bg: 'bg-green-500/15', text: 'text-green-400', border: 'border-green-500/30', bar: '#22c55e' }
    case 'SELL': return { bg: 'bg-red-500/15',   text: 'text-red-400',   border: 'border-red-500/30',   bar: '#ef4444' }
    case 'HOLD': return { bg: 'bg-yellow-500/15', text: 'text-yellow-400', border: 'border-yellow-500/30', bar: '#eab308' }
    default:     return { bg: 'bg-gray-500/15',  text: 'text-gray-400',  border: 'border-gray-500/30',  bar: '#6b7280' }
  }
}

// ── Confidence color ─────────────────────────────────────────────────────────
export function getConfidenceColor(confidence) {
  if (confidence == null) return 'text-gray-500'
  if (confidence >= 80) return 'text-green-400'
  if (confidence >= 60) return 'text-yellow-400'
  if (confidence >= 40) return 'text-orange-400'
  return 'text-red-400'
}

// ── Trend color ───────────────────────────────────────────────────────────────
export function getTrendColor(trend) {
  switch (trend?.toUpperCase()) {
    case 'BULLISH': return { text: 'text-green-400',  bg: 'bg-green-500/10' }
    case 'BEARISH': return { text: 'text-red-400',    bg: 'bg-red-500/10'   }
    default:        return { text: 'text-yellow-400', bg: 'bg-yellow-500/10' }
  }
}

// ── Number formatting ─────────────────────────────────────────────────────────
export function formatNumber(n) {
  if (n == null) return '—'
  if (n >= 1e9)  return `${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6)  return `${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3)  return `${(n / 1e3).toFixed(1)}K`
  return n.toFixed(2)
}

// ── Change color ──────────────────────────────────────────────────────────────
export function getChangeColor(change) {
  if (change > 0) return 'text-green-400'
  if (change < 0) return 'text-red-400'
  return 'text-gray-400'
}
