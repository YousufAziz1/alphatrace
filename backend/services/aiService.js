/**
 * aiService.js
 * Router to switch between Claude and Gemini based on AI_PROVIDER env variable.
 */

'use strict'

const claudeService = require('./claudeService')
const geminiService = require('./geminiService')

function getProvider() {
  const provider = (process.env.AI_PROVIDER || 'claude').toLowerCase()
  return provider === 'gemini' ? geminiService : claudeService
}

async function analyzeMarket(marketData, historicalDecisions = []) {
  const service = getProvider()
  console.log(`[AI Service] Routing to ${process.env.AI_PROVIDER || 'claude'}`)
  return service.analyzeMarket(marketData, historicalDecisions)
}

async function generateDailyReport(decisions) {
  const service = getProvider()
  return service.generateDailyReport(decisions)
}

module.exports = { analyzeMarket, generateDailyReport }
