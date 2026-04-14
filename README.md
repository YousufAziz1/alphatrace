# ⬡ AlphaTrace — Verifiable AI Trading Agent on 0G

> **AlphaTrace is an autonomous AI trading agent whose every decision is permanently stored on 0G Storage and verifiable on 0G Chain — making AI-driven DeFi trustless for the first time.**

[![0G Chain](https://img.shields.io/badge/0G%20Mainnet-16600-purple)](https://chainscan-galileo.0g.ai)
[![Gemini](https://img.shields.io/badge/AI-Google%20Gemini-blue)](https://ai.google.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-green)](LICENSE)

---

## 🔴 The Problem

AI trading bots are **black boxes**. Billions of dollars flow through these systems with zero accountability:

- **Zero verifiability** — You can't prove what the AI actually decided
- **Front-running rampant** — Signals leak because strategies are centralized
- **"Trust me bro"** — Providers claim returns but publish no proof
- **Proprietary models** — No way to audit the AI's reasoning
- **Post-hoc manipulation** — Historical decisions can be fabricated retroactively

---

## ✅ The Solution: AlphaTrace

AlphaTrace is the **first AI trading agent where the entire decision history is publicly verifiable on-chain**. Here's how:

1. **Gemini AI (1.5 Flash)** analyzes crypto markets every 5 minutes with full market data
2. Every decision (BUY/SELL/HOLD + reasoning + confidence + indicators) is **stored immutably on 0G Storage**
3. The content hash of that decision is **anchored on 0G Chain** via a smart contract
4. Anyone can **cross-verify**: take the chain hash → retrieve from 0G Storage → confirm it matches
5. **Zero trust required** — the blockchain is the arbiter

---

## 🧩 0G Components Used

| Component | Role |
|-----------|------|
| **0G Storage** | Every AI decision JSON is stored immutably with content-addressed hashing |
| **0G Chain** | Smart contract records decision hash + metadata — publicly queryable |
| **0G Compute** | AI model inference runs via 0G Compute network (TEE-enabled) |
| **Sealed Inference** | Strategy logic runs in TEE to prevent front-running |

---

## 📋 Contract Address

> **0G Mainnet Contract:** `[DEPLOY_AND_FILL_THIS]`  
> **0G Explorer:** `https://chainscan-galileo.0g.ai/address/[CONTRACT_ADDRESS]`

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    AlphaTrace System                         │
└─────────────────────────────────────────────────────────────┘

  CoinGecko API                                    0G Explorer
      │                                                  ▲
      ▼                              Verify              │
  ┌───────────┐   ┌──────────────┐  ────────►  ┌──────────────┐
  │  Market   │   │  Gemini AI   │             │  0G Chain    │
  │  Data     │   │  (Flash)     │             │  Contract    │
  │  Service  │   └──────┬───────┘             │  AlphaTrace  │
  └───────────┘          │Decision             └──────────────┘
                         │JSON                        ▲
                         ▼                            │ txHash+hash
              ┌─────────────────┐                    │
              │  0G Storage     │                    │
              │  storeDecision()│───storageHash──────┘
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │  backend        │
              │  server.js      │───WebSocket──► React Dashboard
              │  (Express)      │               (Real-time UI)
              └─────────────────┘
                       │
              ┌────────▼────────┐
              │  Decision       │
              │  Logger         │
              │  (JSON + Memory)│
              └─────────────────┘
```

---

## 📁 Project Structure

```
alphatrace/
├── frontend/               # React 18 + Vite + Tailwind dashboard
│   └── src/
│       ├── components/     # Header, DecisionCard, PnLChart, etc.
│       ├── hooks/          # useDecisions, useAgentStatus
│       └── utils/          # api.js, formatters.js
├── backend/                # Node.js Express API
│   ├── services/           # Gemini, 0G Storage, 0G Chain, Market Data
│   ├── agent/              # agentLoop.js, decisionLogger.js
│   └── server.js           # Express + WebSocket server
├── contracts/              # Solidity + Hardhat
│   ├── contracts/AlphaTrace.sol
│   └── scripts/deploy.js
└── README.md
```

---

## 🚀 Local Development Setup

### Prerequisites
- Node.js 18+
- pnpm (or npm)
- Git
- MetaMask with 0G Mainnet configured

**0G Mainnet RPC:** `https://evmrpc.0g.ai` | **ChainID:** `16600`

---

### 1. Clone & Install

```bash
git clone https://github.com/yourusername/alphatrace
cd alphatrace

# Install contracts
cd contracts && npm install

# Install backend
cd ../backend && npm install

# Install frontend
cd ../frontend && npm install
```

---

### 2. Environment Setup

**Backend** (`backend/.env`):
```env
PORT=3001
GEMINI_API_KEY=AIzaSy...              # Get from https://aistudio.google.com/
OG_CHAIN_RPC=https://evmrpc.0g.ai
OG_CHAIN_ID=16600
PRIVATE_KEY=0x...                      # Your funded wallet private key
CONTRACT_ADDRESS=0x...                 # Set after deploy
OG_STORAGE_RPC=https://rpc-storage.0g.ai
OG_INDEXER_RPC=https://indexer-storage.0g.ai
COINGECKO_API_KEY=CG-...               # Free key at coingecko.com/api
AGENT_INTERVAL_MINUTES=5
FRONTEND_URL=http://localhost:5173
```

**Contracts** (`contracts/.env`):
```env
PRIVATE_KEY=0x...
OG_CHAIN_RPC=https://evmrpc.0g.ai
AGENT_ADDRESS=0x...                    # Wallet address that will call recordDecision
```

---

### 3. Deploy Smart Contract

```bash
cd contracts

# Compile
npx hardhat compile

# Run tests
npx hardhat test

# Deploy to 0G Mainnet
npx hardhat run scripts/deploy.js --network og_mainnet

# Or testnet first
npx hardhat run scripts/deploy.js --network og_testnet
```

Output:
```
✅ AlphaTrace deployed to: 0x...
✅ Agent authorized: 0x...
✅ Contract verified on 0G Explorer: https://chainscan-galileo.0g.ai/address/0x...
```

→ Copy `CONTRACT_ADDRESS` to `backend/.env`

---

### 4. Start Backend

```bash
cd backend
npm run dev
```

Server starts at `http://localhost:3001`  
WebSocket at `ws://localhost:3001/ws`

The autonomous agent loop starts immediately and runs every 5 minutes.

---

### 5. Start Frontend

```bash
cd frontend
npm run dev
```

Open `http://localhost:5173`

---

## 🌍 Production Deployment

### 1. GitHub Setup
Push your code to a public GitHub repository:
```bash
git init
git add .
git commit -m "Initial commit for AlphaTrace production ready"
git branch -M main
git remote add origin https://github.com/yourusername/alphatrace.git
git push -u origin main
```

### 2. Frontend (Vercel)
1. Go to [Vercel](https://vercel.com/) and link your GitHub account.
2. Import the `alphatrace` repository.
3. Configure the **Framework Preset** as **Vite**.
4. Set the **Root Directory** to `frontend`.
5. Add the Environment Variable:
   - `VITE_API_URL` = `https://your-render-backend-url.onrender.com`
   - `VITE_WS_URL` = `wss://your-render-backend-url.onrender.com/ws`
6. Click **Deploy**. Vercel will use `vercel.json` for SPA routing rules.

### 3. Backend (Render)
Since the backend uses long-polling WebSockets and a Node.js `setInterval` loop, it must be deployed as a Web Service.
1. Go to [Render.com](https://render.com/) and create a **New Web Service**.
2. Connect your GitHub repository.
3. Render will auto-detect the `backend/render.yaml` configuration file.
4. Add your secrets in the Render dashboard (Environment Variables section):
   ```env
   GEMINI_API_KEY=your_real_gemini_key
   PRIVATE_KEY=your_funded_testnet_wallet_key
   COINGECKO_API_KEY=your_coingecko_api_key (optional)
   FRONTEND_URL=https://your-vercel-frontend-url.vercel.app
   ```
5. Deploy. Render will execute `node server.js` to run the agent loop permanently.

---

## 🎯 Demo Flow (3 minutes for judges)

**1. Open the dashboard** → See the beautiful dark UI with live agent status

**2. Click "Trigger Manually"** → Watch the agent:
   - Fetch real prices from CoinGecko
   - Call Gemini AI for analysis  
   - Store decision to 0G Storage
   - Record on 0G Chain

**3. New decision appears** → Card slides into the Decision Feed showing:
   - Market, Action (BUY/SELL/HOLD), Confidence %
   - AI reasoning, Technical indicators, Price targets

**4. Click "View on 0G Explorer"** → Live transaction hash opens on chain explorer
   - This is on-chain PROOF that the AI made this decision

**5. Click "Verify Storage"** → The full decision JSON retrieved from 0G Storage
   - Cross-reference: storage hash in the contract matches the retrieved data
   - **Zero trust — anyone can verify**

**6. Show the scrolling Live Ticker** → Continuous stream of AI decisions

---

## 🛡 Security Architecture

- All private keys stored in `.env` — never committed
- Smart contract uses role-based authorization (`authorizedAgents` mapping)
- 0G Storage provides content-addressed immutability (hash = content)
- TEE-based Sealed Inference prevents strategy leakage before execution
- Rate limiting on all API routes
- Helmet.js + CORS protection on Express

---

## 📊 API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Server + agent status |
| `/api/decisions` | GET | List decisions (limit, market, action, page) |
| `/api/decisions/:id` | GET | Single decision |
| `/api/markets` | GET | Live market data |
| `/api/stats` | GET | Win rate, PnL, breakdown |
| `/api/agent/trigger` | POST | Manually trigger agent cycle |
| `/api/agent/status` | GET | Agent loop status |
| `/api/verify/:hash` | GET | Verify on 0G Storage |

**WebSocket** (`ws://localhost:3001/ws`):
- `NEW_DECISION` — streamed as each decision is finalized
- `AGENT_STATUS` — agent lifecycle updates
- `CONNECTED` — initial state on connection

---

## 🔬 Smart Contract ABI (Key Functions)

```solidity
// Record a new trading decision (agents only)
function recordDecision(
  string market,      // "ETH/USDC"
  string action,      // "BUY" | "SELL" | "HOLD"
  int256 confidence,  // 0-100
  string reasoning,   // ≤100 char summary
  string storageHash, // 0G Storage content hash ← KEY LINK
  uint256 entryPrice  // price × 1e8
) returns (uint256 id)

// View latest N decisions
function getLatestDecisions(uint256 count) view returns (Decision[] memory)

// Get decisions by market
function getDecisionsByMarket(string market) view returns (Decision[] memory)
```

---

## 👥 Team

| Name | Role |
|------|------|
| Yousuf | Full-Stack Developer & AI/Blockchain Engineer |

---

## 📄 License

MIT © 2025 AlphaTrace

---

*Built for the 0G Hackathon — "Build it like a funded startup. Ship it like a hacker."*
