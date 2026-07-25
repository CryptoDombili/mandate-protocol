import type { Address, PublicClient, WalletClient } from 'viem'
import { erc20Abi, mandateProtocolAbi } from './abi.js'

export interface MandateClientConfig {
  protocolAddress: Address
  publicClient: PublicClient
  walletClient?: WalletClient
  account?: Address
}

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

  async getVaultBalance(account: Address, token: Address): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.protocolAddress,
      abi: mandateProtocolAbi,
      functionName: 'vaultBalance',
      args: [account, token],
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

  async approveToken(token: Address, amount: bigint) {
    return this.write(token, erc20Abi, 'approve', [this.protocolAddress, amount])
  }

  async deposit(token: Address, amount: bigint) {
    return this.write(this.protocolAddress, mandateProtocolAbi, 'deposit', [token, amount])
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
