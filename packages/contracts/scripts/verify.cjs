const hre = require('hardhat')

async function main() {
  const protocol = process.env.PROTOCOL_ADDRESS
  const token = process.env.TOKEN_ADDRESS
  const owner = process.env.OWNER_ADDRESS

  if (!protocol || !token || !owner) {
    throw new Error('Set PROTOCOL_ADDRESS, TOKEN_ADDRESS, and OWNER_ADDRESS')
  }

  await hre.run('verify:verify', {
    address: token,
    constructorArguments: [owner],
  })
  await hre.run('verify:verify', {
    address: protocol,
    constructorArguments: [owner],
  })
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
