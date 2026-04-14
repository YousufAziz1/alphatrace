// Header.jsx — AlphaTrace navbar
import React from 'react'

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || ''
const EXPLORER_BASE = 'https://chainscan-galileo.0g.ai'

export default function Header({ wsConnected }) {
  const explorerContractUrl = CONTRACT_ADDRESS
    ? `${EXPLORER_BASE}/address/${CONTRACT_ADDRESS}`
    : `${EXPLORER_BASE}`

  return (
    <header className="sticky top-0 z-50 border-b border-gray-800/60 bg-gray-950/90 backdrop-blur-xl">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-lg">
            ⬡
          </div>
          <div>
            <h1 className="font-display font-bold text-lg leading-none gradient-text">
              AlphaTrace
            </h1>
            <p className="text-xs text-gray-500 leading-none mt-0.5 hidden sm:block">
              Autonomous DeFi Agent · Every decision on-chain
            </p>
          </div>
        </div>

        {/* Center: network badge */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-800/60 border border-gray-700/50">
          <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
          <span className="text-xs text-gray-300 font-medium">0G Mainnet</span>
          <span className="text-xs text-gray-600">·</span>
          <span className="text-xs text-gray-500">chainId 16600</span>
        </div>

        {/* Right: status + actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Live indicator */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-green-500/10 border border-green-500/20">
            <div
              className="w-2 h-2 rounded-full bg-green-400 live-pulse"
              style={{ boxShadow: wsConnected ? '0 0 0 0 rgba(34,197,94,0.6)' : 'none' }}
            />
            <span className="text-xs font-semibold text-green-400 hidden sm:block">
              {wsConnected ? 'AGENT LIVE' : 'CONNECTING'}
            </span>
          </div>

          {/* 0G Explorer */}
          <a
            href={explorerContractUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600/15 border border-purple-500/25 text-purple-300 hover:bg-purple-600/25 hover:border-purple-500/40 transition-all duration-200 text-xs font-medium"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            0G Explorer
          </a>

          {/* GitHub */}
          <a
            href="https://github.com/YousufAziz1/alphatrace"
            target="_blank"
            rel="noopener noreferrer"
            className="w-8 h-8 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center hover:bg-gray-700 transition-all duration-200"
          >
            <svg className="w-4 h-4 text-gray-300" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
            </svg>
          </a>
        </div>
      </div>
    </header>
  )
}
