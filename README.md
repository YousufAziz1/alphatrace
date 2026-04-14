# ⬡ AlphaTrace — Verifiable AI Trading Agent on 0G

> **AlphaTrace is an autonomous AI trading agent whose every decision is permanently stored on 0G Storage and verifiable on 0G Chain — making AI-driven DeFi trustless for the first time.**

License: MIT

---

## 🚀 Live Demo

🔗 **Frontend:** https://alphatrace-one.vercel.app/
🔗 **Explorer Proof:** https://testnet.0g.ai/address/0x428B490C2fb0E3137AfB478adc7cF3B668209534

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

**0G Testnet Contract:** `0x428B490C2fb0E3137AfB478adc7cF3B668209534`

---

## 🏗 Architecture

```text
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
```

> **⚡ Note:** Currently using Gemini API (free tier) for prototyping. The system supports upgrading to Claude or OpenAI for production.

---

## 🚀 Setup & Run (Local)

**1. Clone & Install**
```bash
git clone https://github.com/YousufAziz1/alphatrace
cd alphatrace

cd contracts && npm install
cd ../backend && npm install
cd ../frontend && npm install
```

**2. Environment Setup (`backend/.env`)**
```env
PORT=3001
GEMINI_API_KEY=your_gemini_api_key
OG_CHAIN_RPC=https://evmrpc-testnet.0g.ai
OG_CHAIN_ID=16602
PRIVATE_KEY=your_wallet_private_key
CONTRACT_ADDRESS=0x428B490C2fb0E3137AfB478adc7cF3B668209534
OG_STORAGE_RPC=https://rpc-storage.0g.ai
OG_INDEXER_RPC=https://indexer-storage.0g.ai
AGENT_INTERVAL_MINUTES=5
FRONTEND_URL=http://localhost:5173
```

**3. Start Services**
```bash
# In backend/
npm run dev

# In frontend/
npm run dev
```

---

## 🎯 Demo Flow (3 minutes for judges)

**1. Open the dashboard** → See the beautiful dark UI with live agent status.

**2. Click "Trigger Manually"** → Watch the agent:
   - Fetch real prices from CoinGecko
   - Call Gemini AI for analysis  
   - Store decision to 0G Storage
   - Record on 0G Chain

**3. New decision appears** → Card slides into the Decision Feed showing:
   - Market, Action (BUY/SELL/HOLD), Confidence %
   - AI reasoning, Technical indicators, Price targets

**4. Click "View on 0G Explorer"** → Live transaction hash opens on chain explorer.
   - This is on-chain PROOF that the AI made this decision.

**5. Click "Verify Storage"** → The full decision JSON is retrieved from 0G Storage.
   - Cross-reference: storage hash in the contract matches the retrieved data.
   - **Zero trust — anyone can verify.**

---

## 👥 Team

| Name | Role |
|------|------|
| [**Yousuf Aziz**](https://github.com/YousufAziz1) | Full-Stack Developer & AI/Blockchain Engineer |

---

*Built for the 0G Hackathon — "Build it like a funded startup. Ship it like a hacker."*
