const { expect } = require('chai')
const { ethers } = require('hardhat')

describe('MandateMinatoDeployer', function () {
  const USDC = 10n ** 6n

  it('bootstraps the token, protocol, ownership handoff, and three usable plans', async function () {
    const [controller] = await ethers.getSigners()

    const Factory = await ethers.getContractFactory('MandateMinatoDeployer')
    const factory = await Factory.deploy()
    await factory.waitForDeployment()

    const token = await ethers.getContractAt('MockUSDC', await factory.token())
    const protocol = await ethers.getContractAt('MandateProtocol', await factory.protocol())

    expect(await token.owner()).to.equal(controller.address)
    expect(await token.balanceOf(controller.address)).to.equal(1_000_000n * USDC)
    expect(await protocol.supportedTokens(await token.getAddress())).to.equal(true)

    expect(await protocol.owner()).to.equal(await factory.getAddress())
    expect(await protocol.pendingOwner()).to.equal(controller.address)

    const firstPlan = await protocol.plans(1)
    const secondPlan = await protocol.plans(2)
    const thirdPlan = await protocol.plans(3)

    expect(firstPlan.merchant).to.equal(await factory.getAddress())
    expect(firstPlan.amountPerPeriod).to.equal(5n * USDC)
    expect(secondPlan.amountPerPeriod).to.equal(2n * USDC)
    expect(thirdPlan.amountPerPeriod).to.equal(3n * USDC)

    await protocol.acceptOwnership()
    expect(await protocol.owner()).to.equal(controller.address)

    await token.approve(await protocol.getAddress(), 15n * USDC)
    await protocol.deposit(await token.getAddress(), 15n * USDC)
    await protocol.subscribe(1, 3, 15n * USDC)
    await protocol.charge(1)

    expect(await token.balanceOf(await factory.getAddress())).to.equal(5n * USDC)
    await expect(factory.withdrawRevenue(5n * USDC)).to.emit(factory, 'RevenueWithdrawn')
    expect(await token.balanceOf(await factory.getAddress())).to.equal(0n)
  })
})
