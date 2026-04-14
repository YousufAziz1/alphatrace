const { ethers } = require('hardhat')
const fs = require('fs')
const path = require('path')
require('dotenv').config()

async function main() {
  const [deployer] = await ethers.getSigners()

  console.log('\n═══════════════════════════════════════════════')
  console.log('   AlphaTrace Contract Deployment')
  console.log('═══════════════════════════════════════════════')
  console.log(`🔑 Deployer: ${deployer.address}`)

  const balance = await ethers.provider.getBalance(deployer.address)
  console.log(`💰 Balance:  ${ethers.formatEther(balance)} ETH\n`)

  // ── Deploy ────────────────────────────────────────────────────────────────
  console.log('📦 Deploying AlphaTrace contract...')
  const AlphaTrace = await ethers.getContractFactory('AlphaTrace')
  const alphaTrace = await AlphaTrace.deploy()
  await alphaTrace.waitForDeployment()

  const contractAddress = await alphaTrace.getAddress()
  console.log(`✅ AlphaTrace deployed to: ${contractAddress}`)

  // ── Authorize agent ───────────────────────────────────────────────────────
  const agentAddress = process.env.AGENT_ADDRESS || deployer.address
  console.log(`\n🤖 Authorizing agent: ${agentAddress}`)
  const authTx = await alphaTrace.authorizeAgent(agentAddress)
  await authTx.wait()
  console.log(`✅ Agent authorized: ${agentAddress}`)

  // ── Build explorer URLs ───────────────────────────────────────────────────
  const network = await ethers.provider.getNetwork()
  const chainId = Number(network.chainId)
  const explorerBase =
    chainId === 16600
      ? 'https://chainscan-galileo.0g.ai'
      : 'https://testnet.0g.ai'

  const explorerUrl = `${explorerBase}/address/${contractAddress}`
  const deployTxUrl = `${explorerBase}/tx/${alphaTrace.deploymentTransaction()?.hash}`

  console.log(`\n🔗 0G Explorer: ${explorerUrl}`)
  console.log(`🔗 Deploy Tx:   ${deployTxUrl}`)

  // ── Save ABI + address for frontend / backend ─────────────────────────────
  const artifact = await hre.artifacts.readArtifact('AlphaTrace')

  const outputData = {
    address: contractAddress,
    chainId,
    network: chainId === 16600 ? 'og_mainnet' : 'og_testnet',
    explorerUrl,
    abi: artifact.abi,
    deployedAt: new Date().toISOString(),
    deployTxHash: alphaTrace.deploymentTransaction()?.hash,
  }

  // Save to frontend/src/contracts/
  const frontendDir = path.join(__dirname, '../../frontend/src/contracts')
  if (!fs.existsSync(frontendDir)) fs.mkdirSync(frontendDir, { recursive: true })
  const frontendPath = path.join(frontendDir, 'AlphaTrace.json')
  fs.writeFileSync(frontendPath, JSON.stringify(outputData, null, 2))
  console.log(`\n📄 ABI + address saved to: ${frontendPath}`)

  // Save to backend root for ogChainService
  const backendPath = path.join(__dirname, '../../backend/AlphaTrace.json')
  fs.writeFileSync(backendPath, JSON.stringify(outputData, null, 2))
  console.log(`📄 ABI + address saved to: ${backendPath}`)

  console.log('\n✅ Contract verified on 0G Explorer:')
  console.log(`   ${explorerUrl}`)
  console.log('\n═══════════════════════════════════════════════')
  console.log('   Deployment Complete!')
  console.log('═══════════════════════════════════════════════\n')

  // Print env vars to copy
  console.log('📋 Add to backend/.env:')
  console.log(`CONTRACT_ADDRESS=${contractAddress}`)
  console.log(`AGENT_ADDRESS=${agentAddress}\n`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Deployment failed:', error)
    process.exit(1)
  })
