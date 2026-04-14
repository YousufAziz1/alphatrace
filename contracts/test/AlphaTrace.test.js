const { expect } = require('chai')
const { ethers } = require('hardhat')

describe('AlphaTrace', function () {
  let alphaTrace
  let owner
  let agent
  let user

  beforeEach(async function () {
    ;[owner, agent, user] = await ethers.getSigners()
    const AlphaTrace = await ethers.getContractFactory('AlphaTrace')
    alphaTrace = await AlphaTrace.deploy()
  })

  describe('Deployment', function () {
    it('Should set the right owner', async function () {
      expect(await alphaTrace.owner()).to.equal(owner.address)
    })

    it('Should start with zero decisions', async function () {
      expect(await alphaTrace.decisionCount()).to.equal(0)
    })

    it('Should have correct version', async function () {
      expect(await alphaTrace.VERSION()).to.equal('1.0.0')
    })
  })

  describe('Agent Authorization', function () {
    it('Should allow owner to authorize an agent', async function () {
      await alphaTrace.authorizeAgent(agent.address)
      expect(await alphaTrace.authorizedAgents(agent.address)).to.be.true
    })

    it('Should emit AgentAuthorized event', async function () {
      await expect(alphaTrace.authorizeAgent(agent.address))
        .to.emit(alphaTrace, 'AgentAuthorized')
        .withArgs(agent.address)
    })

    it('Should reject authorization from non-owner', async function () {
      await expect(
        alphaTrace.connect(user).authorizeAgent(agent.address)
      ).to.be.revertedWith('AlphaTrace: caller is not owner')
    })

    it('Should reject zero address', async function () {
      await expect(
        alphaTrace.authorizeAgent(ethers.ZeroAddress)
      ).to.be.revertedWith('AlphaTrace: zero address')
    })
  })

  describe('recordDecision', function () {
    beforeEach(async function () {
      await alphaTrace.authorizeAgent(agent.address)
    })

    it('Should record a decision and emit events', async function () {
      const tx = await alphaTrace.connect(agent).recordDecision(
        'ETH/USDC',
        'BUY',
        85,
        'RSI oversold, MACD crossover bullish signal',
        'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
        ethers.parseUnits('2341', 8)
      )

      await expect(tx).to.emit(alphaTrace, 'DecisionRecorded')
      await expect(tx).to.emit(alphaTrace, 'TradeSignalEmitted')
    })

    it('Should increment decisionCount', async function () {
      await alphaTrace.connect(agent).recordDecision(
        'BTC/USDC', 'HOLD', 63, 'Neutral market', 'hash1', ethers.parseUnits('65000', 8)
      )
      expect(await alphaTrace.decisionCount()).to.equal(1)
    })

    it('Should store decision data correctly', async function () {
      await alphaTrace.connect(agent).recordDecision(
        'ETH/USDC', 'BUY', 90, 'Strong bullish signal', 'storageHash123', 234100000000n
      )
      const decision = await alphaTrace.getDecision(1)
      expect(decision.market).to.equal('ETH/USDC')
      expect(decision.action).to.equal('BUY')
      expect(decision.confidence).to.equal(90)
      expect(decision.storageHash).to.equal('storageHash123')
    })

    it('Should reject unauthorized agent', async function () {
      await expect(
        alphaTrace.connect(user).recordDecision(
          'ETH/USDC', 'BUY', 80, 'Test', 'hash', 100n
        )
      ).to.be.revertedWith('AlphaTrace: caller is not an authorized agent')
    })

    it('Should reject confidence out of range', async function () {
      await expect(
        alphaTrace.connect(agent).recordDecision(
          'ETH/USDC', 'BUY', 101, 'Test', 'hash', 100n
        )
      ).to.be.revertedWith('AlphaTrace: confidence out of range')
    })
  })

  describe('getLatestDecisions', function () {
    beforeEach(async function () {
      await alphaTrace.authorizeAgent(agent.address)
      for (let i = 0; i < 5; i++) {
        await alphaTrace.connect(agent).recordDecision(
          'ETH/USDC', i % 2 === 0 ? 'BUY' : 'HOLD', 70 + i, 'Test', `hash${i}`, 100n
        )
      }
    })

    it('Should return last N decisions in reverse order', async function () {
      const decisions = await alphaTrace.getLatestDecisions(3)
      expect(decisions.length).to.equal(3)
      // Most recent first
      expect(decisions[0].id).to.equal(5n)
      expect(decisions[1].id).to.equal(4n)
      expect(decisions[2].id).to.equal(3n)
    })

    it('Should cap at total decision count', async function () {
      const decisions = await alphaTrace.getLatestDecisions(100)
      expect(decisions.length).to.equal(5)
    })
  })

  describe('getDecisionsByMarket', function () {
    beforeEach(async function () {
      await alphaTrace.authorizeAgent(agent.address)
      await alphaTrace.connect(agent).recordDecision('ETH/USDC', 'BUY', 80, 'T', 'h1', 100n)
      await alphaTrace.connect(agent).recordDecision('BTC/USDC', 'HOLD', 60, 'T', 'h2', 100n)
      await alphaTrace.connect(agent).recordDecision('ETH/USDC', 'SELL', 75, 'T', 'h3', 100n)
    })

    it('Should return only decisions for the specified market', async function () {
      const decisions = await alphaTrace.getDecisionsByMarket('ETH/USDC')
      expect(decisions.length).to.equal(2)
      expect(decisions[0].market).to.equal('ETH/USDC')
      expect(decisions[1].market).to.equal('ETH/USDC')
    })
  })

  describe('getTotalPnL', function () {
    it('Should return 0 (mock implementation)', async function () {
      expect(await alphaTrace.getTotalPnL()).to.equal(0)
    })
  })
})
