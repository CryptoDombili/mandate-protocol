const { expect } = require('chai')
const { ethers } = require('hardhat')

const USDC = 10n ** 6n
const DAY = 24 * 60 * 60

async function deployFixture() {
  const [owner, merchant, alice, keeper, stranger] = await ethers.getSigners()

  const Token = await ethers.getContractFactory('MockUSDC')
  const token = await Token.deploy(owner.address)
  await token.waitForDeployment()

  const Protocol = await ethers.getContractFactory('MandateProtocol')
  const protocol = await Protocol.deploy(owner.address)
  await protocol.waitForDeployment()

  await protocol.setSupportedToken(await token.getAddress(), true)
  await token.mint(alice.address, 1_000n * USDC)
  await token.mint(merchant.address, 1_000n * USDC)

  await protocol
    .connect(merchant)
    .createPlan(await token.getAddress(), 5n * USDC, 30 * DAY, 12, 'ipfs://game-pass')

  return { owner, merchant, alice, keeper, stranger, token, protocol }
}

async function depositAndSubscribe(ctx, chargeLimit = 3, spendCap = 15n * USDC) {
  const { alice, token, protocol } = ctx
  await token.connect(alice).approve(await protocol.getAddress(), 100n * USDC)
  await protocol.connect(alice).deposit(await token.getAddress(), 100n * USDC)
  await protocol.connect(alice).subscribe(1, chargeLimit, spendCap)
}

describe('MandateProtocol', function () {
  it('charges a bounded subscription and grants paid access', async function () {
    const ctx = await deployFixture()
    await depositAndSubscribe(ctx)

    const before = await ctx.token.balanceOf(ctx.merchant.address)
    await expect(ctx.protocol.connect(ctx.keeper).charge(1)).to.emit(ctx.protocol, 'Charged')
    const after = await ctx.token.balanceOf(ctx.merchant.address)

    expect(after - before).to.equal(5n * USDC)
    expect(await ctx.protocol.vaultBalance(ctx.alice.address, await ctx.token.getAddress())).to.equal(
      95n * USDC,
    )
    expect(await ctx.protocol.hasActiveAccess(1)).to.equal(true)
  })

  it('prevents a second charge before the next period', async function () {
    const ctx = await deployFixture()
    await depositAndSubscribe(ctx)
    await ctx.protocol.charge(1)

    await expect(ctx.protocol.charge(1)).to.be.revertedWithCustomError(
      ctx.protocol,
      'ChargeNotDue',
    )
  })

  it('lets the user cancel while preserving withdrawal rights', async function () {
    const ctx = await deployFixture()
    await depositAndSubscribe(ctx)
    await ctx.protocol.connect(ctx.alice).cancelSubscription(1)

    await expect(ctx.protocol.charge(1)).to.be.revertedWithCustomError(
      ctx.protocol,
      'InvalidSubscriptionStatus',
    )

    await expect(
      ctx.protocol.connect(ctx.alice).withdraw(await ctx.token.getAddress(), 100n * USDC),
    ).to.emit(ctx.protocol, 'Withdrawn')
  })

  it('keeps withdrawals open during an emergency charge pause', async function () {
    const ctx = await deployFixture()
    await depositAndSubscribe(ctx)
    await ctx.protocol.connect(ctx.owner).setChargesPaused(true)

    await expect(ctx.protocol.charge(1)).to.be.revertedWithCustomError(
      ctx.protocol,
      'ChargesPaused',
    )
    await expect(
      ctx.protocol.connect(ctx.alice).withdraw(await ctx.token.getAddress(), 10n * USDC),
    ).to.emit(ctx.protocol, 'Withdrawn')
  })

  it('enforces user-approved lifetime spend caps', async function () {
    const ctx = await deployFixture()
    await depositAndSubscribe(ctx, 3, 15n * USDC)
    await ctx.protocol.charge(1)

    await ethers.provider.send('evm_increaseTime', [30 * DAY + 1])
    await ethers.provider.send('evm_mine', [])
    await ctx.protocol.charge(1)

    await ethers.provider.send('evm_increaseTime', [30 * DAY + 1])
    await ethers.provider.send('evm_mine', [])
    await ctx.protocol.charge(1)

    const subscription = await ctx.protocol.subscriptions(1)
    expect(subscription.status).to.equal(4n) // Completed
    expect(subscription.totalSpent).to.equal(15n * USDC)
  })

  it('credits merchant-funded refunds to the subscriber vault', async function () {
    const ctx = await deployFixture()
    await depositAndSubscribe(ctx)
    await ctx.protocol.charge(1)

    await ctx.token.connect(ctx.merchant).approve(await ctx.protocol.getAddress(), 2n * USDC)
    await expect(ctx.protocol.connect(ctx.merchant).refund(1, 2n * USDC)).to.emit(
      ctx.protocol,
      'Refunded',
    )

    expect(await ctx.protocol.vaultBalance(ctx.alice.address, await ctx.token.getAddress())).to.equal(
      97n * USDC,
    )
  })

  it('allows only the merchant to disable its plan', async function () {
    const ctx = await deployFixture()
    await expect(ctx.protocol.connect(ctx.stranger).setPlanEnabled(1, false)).to.be.revertedWithCustomError(
      ctx.protocol,
      'NotPlanMerchant',
    )
    await expect(ctx.protocol.connect(ctx.merchant).setPlanEnabled(1, false)).to.emit(
      ctx.protocol,
      'PlanEnabledSet',
    )
  })
})
