// VerifyModal.jsx — Modal to verify a decision on 0G Storage
import React, { useState, useEffect } from 'react'
import { verifyStorage } from '../utils/api'
import { formatHash, formatTime, formatPrice } from '../utils/formatters'

export default function VerifyModal({ decision, onClose }) {
  const [verifying, setVerifying] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)

  const storageHash = decision?.storageHash
  const txHash = decision?.txHash
  const explorerUrl = decision?.explorerUrl

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  const handleVerify = async () => {
    if (!storageHash || storageHash === 'PENDING' || storageHash === 'SIMULATED') {
      setError('No valid storage hash available for verification.')
      return
    }
    setVerifying(true)
    setError(null)
    try {
      const data = await verifyStorage(storageHash)
      setResult(data)
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    } finally {
      setVerifying(false)
    }
  }

  const copyHash = async (text) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  useEffect(() => {
    if (storageHash && storageHash !== 'PENDING' && storageHash !== 'SIMULATED') {
      handleVerify()
    }
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl animate-slide-in overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-600/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
              </svg>
            </div>
            <div>
              <h3 className="font-display font-semibold text-gray-100">Verify Decision</h3>
              <p className="text-xs text-gray-500">Cross-verify: 0G Storage ↔ 0G Chain</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-gray-200 transition-all">
            ✕
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Decision summary */}
          <div className="bg-gray-800/60 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-100">{decision?.market}</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                decision?.action === 'BUY' ? 'bg-green-500/20 text-green-400' :
                decision?.action === 'SELL' ? 'bg-red-500/20 text-red-400' :
                'bg-yellow-500/20 text-yellow-400'
              }`}>{decision?.action}</span>
            </div>
            <p className="text-xs text-gray-400">{decision?.shortReasoning || decision?.reasoning?.slice(0, 80)}</p>
            <div className="flex gap-3 mt-2 text-xs text-gray-500">
              <span>Entry: {formatPrice(decision?.entryPrice)}</span>
              <span>Confidence: {decision?.confidence}%</span>
              <span>{formatTime(decision?.timestamp)}</span>
            </div>
          </div>

          {/* Storage hash */}
          <div>
            <p className="text-xs text-gray-500 font-medium mb-2 uppercase tracking-wider">0G Storage Hash</p>
            <div className="flex items-center gap-2 bg-gray-800 rounded-lg p-3 border border-gray-700">
              <code className="text-xs text-purple-300 font-mono flex-1 truncate">
                {storageHash || '—'}
              </code>
              <button
                onClick={() => copyHash(storageHash)}
                className="shrink-0 text-gray-500 hover:text-gray-300 transition-colors"
              >
                {copied ? '✓' : '⎘'}
              </button>
            </div>
          </div>

          {/* Chain TX hash */}
          {txHash && (
            <div>
              <p className="text-xs text-gray-500 font-medium mb-2 uppercase tracking-wider">0G Chain Transaction</p>
              <div className="flex items-center gap-2 bg-gray-800 rounded-lg p-3 border border-gray-700">
                <code className="text-xs text-cyan-300 font-mono flex-1 truncate">{txHash}</code>
                {explorerUrl && (
                  <a href={explorerUrl} target="_blank" rel="noopener noreferrer"
                    className="shrink-0 text-gray-500 hover:text-cyan-400 transition-colors text-xs">
                    ↗
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Verification result */}
          {verifying && (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <svg className="w-4 h-4 animate-spin text-purple-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Querying 0G Storage network...
            </div>
          )}

          {result && !verifying && (
            <div className={`rounded-xl p-4 border ${
              result.verified
                ? 'bg-green-500/10 border-green-500/30'
                : 'bg-yellow-500/10 border-yellow-500/30'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-lg ${result.verified ? 'text-green-400' : 'text-yellow-400'}`}>
                  {result.verified ? '✅' : '⚠️'}
                </span>
                <span className={`font-semibold text-sm ${result.verified ? 'text-green-300' : 'text-yellow-300'}`}>
                  {result.verified ? 'Verified on 0G Storage ✓' : 'Not yet confirmed on 0G Storage'}
                </span>
              </div>
              {result.size != null && result.size > 0 && (
                <p className="text-xs text-gray-400">File size: {result.size} bytes</p>
              )}
              {result.note && (
                <p className="text-xs text-gray-500 mt-1">{result.note}</p>
              )}
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/25 rounded-xl p-3">
              <p className="text-xs text-red-400">⚠ {error}</p>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-5 border-t border-gray-800 flex gap-3">
          {explorerUrl && (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-2.5 px-4 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium text-center transition-all btn-primary"
            >
              View on 0G Explorer ↗
            </a>
          )}
          <button
            onClick={onClose}
            className="flex-1 py-2.5 px-4 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium transition-all border border-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
