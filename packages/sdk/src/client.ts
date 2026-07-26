import type { Address, PublicClient, WalletClient } from 'viem'
import { zeroAddress } from 'viem'
import { erc20Abi, mandateProtocolAbi } from './abi.js'
import {
  SubscriptionStatus,
  type AccessDecision,
  type CreatePlanInput,
  type MandatePlan,
  type MandateSubscription,
} from './types.js'

export interface MandateClientConfig {
  protocolAddress: Address
  publicClient: PublicClient
  walletClient?: WalletClient
  account?: Address
}

type PlanTuple = readonly [Address, Address, bigint, bigint, number, boolean, string]
type SubscriptionTuple = readonly [bigint, Address, bigint, bigint, bigint, bigint, bigint, number, number, number]

export class MandateClient {
  readonly protocolAddress: Address
  readonly publicClient: PublicClient
  readonly walletClient?: WalletClient
  readonly account?: Address

  constructor(config: MandateClientConfig) {
    this.protocolAddress = config.protocolAddress
    this.publicClient = config.publicClient
    this.walletClient = config.walletClient
    this.account = config.account
  }

  async getPlan(planId: bigint): Promise<MandatePlan | null> {
    const plan = (await this.publicClient.readContract({
      address: this.protocolAddress,
      abi: mandateProtocolAbi,
      functionName: 'plans',
      args: [planId],
    })) as PlanTuple

    if (plan[0] === zeroAddress) return null

    return {
      id: planId,
      merchant: plan[0],
      token: plan[1],
      amountPerPeriod: plan[2],
      periodSeconds: plan[3],
      merchantChargeLimit: plan[4],
      enabled: plan[5],
      metadataURI: plan[6],
    }
  }

  async getSubscription(subscriptionId: bigint): Promise<MandateSubscription | null> {
    const subscription = (await this.publicClient.readContract({
      address: this.protocolAddress,
      abi: mandateProtocolAbi,
      functionName: 'subscriptions',
      args: [subscriptionId],
    })) as SubscriptionTuple

    if (subscription[1] === zeroAddress) return null

    return {
      id: subscriptionId,
      planId: subscription[0],
      subscriber: subscription[1],
      spendCap: subscription[2],
      totalSpent: subscription[3],
      totalRefunded: subscription[4],
      nextChargeAt: subscription[5],
      paidUntil: subscription[6],
      chargeLimit: subscription[7],
      charges: subscription[8],
      status: subscription[9] as SubscriptionStatus,
    }
  }

  async getVaultBalance(account: Address, token: Address): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.protocolAddress,
      abi: mandateProtocolAbi,
      functionName: 'vaultBalance',
      args: [account, token],
    })
  }

  async getTokenBalance(token: Address, account: Address): Promise<bigint> {
    return this.publicClient.readContract({
      address: token,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [account],
    })
  }

  async getTokenAllowance(token: Address, owner: Address): Promise<bigint> {
    return this.publicClient.readContract({
      address: token,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [owner, this.protocolAddress],
    })
  }

  async hasActiveAccess(subscriptionId: bigint): Promise<boolean> {
    return this.publicClient.readContract({
      address: this.protocolAddress,
      abi: mandateProtocolAbi,
      functionName: 'hasActiveAccess',
      args: [subscriptionId],
    })
  }

  async checkAccess(subscriptionId: bigint, expectedSubscriber?: Address): Promise<AccessDecision> {
    const checkedAt = BigInt(Math.floor(Date.now() / 1000))
    const subscription = await this.getSubscription(subscriptionId)

    if (!subscription) {
      return { granted: false, reason: 'subscription-not-found', checkedAt, subscription: null, plan: null }
    }

    const plan = await this.getPlan(subscription.planId)

    if (expectedSubscriber && subscription.subscriber.toLowerCase() !== expectedSubscriber.toLowerCase()) {
      return { granted: false, reason: 'subscriber-mismatch', checkedAt, subscription, plan }
    }

    const granted = await this.hasActiveAccess(subscriptionId)
    if (granted) {
      return { granted: true, reason: 'paid-access-active', checkedAt, subscription, plan }
    }

    if (subscription.status === SubscriptionStatus.Cancelled) {
      return { granted: false, reason: 'cancelled-and-expired', checkedAt, subscription, plan }
    }

    if (subscription.status === SubscriptionStatus.Completed) {
      return { granted: false, reason: 'completed-and-expired', checkedAt, subscription, plan }
    }

    if (subscription.totalSpent === 0n) {
      return { granted: false, reason: 'awaiting-first-payment', checkedAt, subscription, plan }
    }

    return { granted: false, reason: 'access-expired', checkedAt, subscription, plan }
  }

  async approveToken(token: Address, amount: bigint) {
    return this.write(token, erc20Abi, 'approve', [this.protocolAddress, amount])
  }

  async deposit(token: Address, amount: bigint) {
    return this.write(this.protocolAddress, mandateProtocolAbi, 'deposit', [token, amount])
  }

  async createPlan(input: CreatePlanInput) {
    return this.write(this.protocolAddress, mandateProtocolAbi, 'createPlan', [
      input.token,
      input.amountPerPeriod,
      input.periodSeconds,
      input.merchantChargeLimit,
      input.metadataURI,
    ])
  }

  async setPlanEnabled(planId: bigint, enabled: boolean) {
    return this.write(this.protocolAddress, mandateProtocolAbi, 'setPlanEnabled', [planId, enabled])
  }

  async subscribe(planId: bigint, chargeLimit: number, spendCap: bigint) {
    return this.write(this.protocolAddress, mandateProtocolAbi, 'subscribe', [
      planId,
      chargeLimit,
      spendCap,
    ])
  }

  async charge(subscriptionId: bigint) {
    return this.write(this.protocolAddress, mandateProtocolAbi, 'charge', [subscriptionId])
  }

  async pause(subscriptionId: bigint) {
    return this.write(this.protocolAddress, mandateProtocolAbi, 'pauseSubscription', [subscriptionId])
  }

  async resume(subscriptionId: bigint) {
    return this.write(this.protocolAddress, mandateProtocolAbi, 'resumeSubscription', [subscriptionId])
  }

  async cancel(subscriptionId: bigint) {
    return this.write(this.protocolAddress, mandateProtocolAbi, 'cancelSubscription', [subscriptionId])
  }

  async refund(subscriptionId: bigint, amount: bigint) {
    return this.write(this.protocolAddress, mandateProtocolAbi, 'refund', [subscriptionId, amount])
  }

  async withdraw(token: Address, amount: bigint) {
    return this.write(this.protocolAddress, mandateProtocolAbi, 'withdraw', [token, amount])
  }

  private async write(address: Address, abi: readonly unknown[], functionName: string, args: readonly unknown[]) {
    if (!this.walletClient || !this.account) {
      throw new Error('A wallet client and account are required for write operations.')
    }

    return this.walletClient.writeContract({
      account: this.account,
      chain: this.walletClient.chain,
      address,
      abi,
      functionName,
      args,
    } as never)
  }
}
