const hre = require('hardhat')

async function main() {
  const [deployer] = await hre.ethers.getSigners()
  console.log('Deploying from:', deployer.address)

  const MockUSDC = await hre.ethers.getContractFactory('MockUSDC')
  const token = await MockUSDC.deploy(deployer.address)
  await token.waitForDeployment()

  const MandateProtocol = await hre.ethers.getContractFactory('MandateProtocol')
  const protocol = await MandateProtocol.deploy(deployer.address)
  await protocol.waitForDeployment()

  const tokenAddress = await token.getAddress()
  const protocolAddress = await protocol.getAddress()

  await (await protocol.setSupportedToken(tokenAddress, true)).wait()
  await (await token.mint(deployer.address, 1_000_000n * 10n ** 6n)).wait()

  console.log('\nDeployment complete')
  console.log('MockUSDC:', tokenAddress)
  console.log('MandateProtocol:', protocolAddress)
  console.log('\nMini App env:')
  console.log(`VITE_PROTOCOL_ADDRESS=${protocolAddress}`)
  console.log(`VITE_TOKEN_ADDRESS=${tokenAddress}`)
  console.log('VITE_CHAIN_ID=1946')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
