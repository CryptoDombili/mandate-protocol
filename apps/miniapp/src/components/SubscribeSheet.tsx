import { useMemo, useState } from 'react'
import { parseUnits } from 'viem'
import { useAccount, usePublicClient, useWriteContract } from 'wagmi'
import { erc20Abi, formatMandateError, mandateProtocolAbi } from '@mandate/sdk'
import type { Plan } from '../data'
import { env, hasDeployment } from '../env'
import { TEST_TOKEN_LABEL, TEST_TOKEN_NOTE } from '../token'
import { DEPLOYMENT_BLOCK, protocolReadAbi, subscriptionCreatedEvent, type PlanTuple, type SubscriptionTuple } from '../protocol'
import { useMinatoNetwork } from '../minato'

export function SubscribeSheet({
  plan,
  onClose,
  onCreated,
}: {
  plan: Plan
  onClose: () => void
  onCreated?: () => void | Promise<void>
}) {
  const { address, isConnected } = useAccount()
  const publicClient = usePublicClient()
  const { writeContractAsync, isPending } = useWriteContract()
  const [step, setStep] = useState<'review' | 'approved' | 'deposited' | 'created'>('review')
  const [message, setMessage] = useState('')
  const [checking, setChecking] = useState(false)
  const { isCorrectChain, switchToMinato } = useMinatoNetwork()

  const chargeLimit = plan.maxCharges ?? 3
  const amountPerCharge = useMemo(() => parseUnits(String(plan.price), 6), [plan.price])
  const total = amountPerCharge * BigInt(chargeLimit)

  async function ensureMinato(): Promise<boolean> {
    if (isCorrectChain) return true
    const result = await switchToMinato()
    if (!result.ok) setMessage(result.message ?? 'Switch your wallet to Soneium Minato and try again.')
    return result.ok
  }

  async function findExistingLiveMembership(): Promise<boolean> {
    if (!publicClient || !address) return false
    const logs = await publicClient.getLogs({
      address: env.protocolAddress,
      event: subscriptionCreatedEvent,
      args: { subscriber: address },
      fromBlock: DEPLOYMENT_BLOCK,
      toBlock: 'latest',
      strict: true,
    })
    const samePlan = logs.filter((log) => log.args.planId === BigInt(plan.id))
    for (const log of samePlan) {
      const subscription = (await publicClient.readContract({
        address: env.protocolAddress,
        abi: protocolReadAbi,
        functionName: 'subscriptions',
        args: [log.args.subscriptionId],
      })) as SubscriptionTuple
      if (subscription[9] === 1 || subscription[9] === 2) return true
    }
    return false
  }

  async function execute() {
    if (!isConnected) {
      setMessage('Connect the wallet first.')
      return
    }
    if (!publicClient) {
      setMessage('Minato RPC is not ready. Please refresh and try again.')
      return
    }
    if (!hasDeployment || env.demoMode) {
      setMessage('The live Minato contracts are not connected.')
      return
    }
    if (!(await ensureMinato())) return
    if (!address) {
      setMessage('The connected wallet address is not available yet.')
      return
    }

    setChecking(true)
    try {
      setMessage('')
      if (step === 'review') {
        const [tokenBalance, livePlan, duplicate] = await Promise.all([
          publicClient.readContract({
            address: env.tokenAddress,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [address],
          }),
          publicClient.readContract({
            address: env.protocolAddress,
            abi: protocolReadAbi,
            functionName: 'plans',
            args: [BigInt(plan.id)],
          }) as Promise<PlanTuple>,
          findExistingLiveMembership(),
        ])
        if (!livePlan[5]) {
          setMessage('This plan is currently paused by its merchant.')
          return
        }
        if (duplicate) {
          setMessage('You already have an active or paused membership for this plan.')
          return
        }
        if (tokenBalance < total) {
          setMessage(`Not enough ${TEST_TOKEN_LABEL}. This membership requires ${Number(total) / 1_000_000} ${TEST_TOKEN_LABEL}.`)
          return
        }
        const hash = await writeContractAsync({
          address: env.tokenAddress,
          abi: erc20Abi,
          functionName: 'approve',
          args: [env.protocolAddress, total],
        })
        await publicClient.waitForTransactionReceipt({ hash })
        setStep('approved')
        setMessage('Token cap approved on Minato.')
      } else if (step === 'approved') {
        const [tokenBalance, allowance] = await Promise.all([
          publicClient.readContract({
            address: env.tokenAddress,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [address],
          }),
          publicClient.readContract({
            address: env.tokenAddress,
            abi: erc20Abi,
            functionName: 'allowance',
            args: [address, env.protocolAddress],
          }),
        ])
        if (tokenBalance < total) {
          setMessage(`Not enough ${TEST_TOKEN_LABEL} remains in this wallet to fund the protected vault.`)
          return
        }
        if (allowance < total) {
          setStep('review')
          setMessage('The token allowance is lower than the membership cap. Approve the cap again.')
          return
        }
        const hash = await writeContractAsync({
          address: env.protocolAddress,
          abi: mandateProtocolAbi,
          functionName: 'deposit',
          args: [env.tokenAddress, total],
        })
        await publicClient.waitForTransactionReceipt({ hash })
        setStep('deposited')
        setMessage('Protected vault funded on Minato.')
      } else if (step === 'deposited') {
        const [vaultBalance, livePlan] = await Promise.all([
          publicClient.readContract({
            address: env.protocolAddress,
            abi: mandateProtocolAbi,
            functionName: 'vaultBalance',
            args: [address, env.tokenAddress],
          }),
          publicClient.readContract({
            address: env.protocolAddress,
            abi: protocolReadAbi,
            functionName: 'plans',
            args: [BigInt(plan.id)],
          }) as Promise<PlanTuple>,
        ])
        if (!livePlan[5]) {
          setMessage('This plan was paused before the membership was created. Your vault funds remain withdrawable.')
          return
        }
        if (vaultBalance < total) {
          setMessage('Protected vault balance is too low. Fund the vault before creating the membership.')
          return
        }
        if (await findExistingLiveMembership()) {
          setMessage('You already have an active or paused membership for this plan.')
          return
        }
        const hash = await writeContractAsync({
          address: env.protocolAddress,
          abi: mandateProtocolAbi,
          functionName: 'subscribe',
          args: [BigInt(plan.id), chargeLimit, total],
        })
        await publicClient.waitForTransactionReceipt({ hash })
        setStep('created')
        setMessage('Membership created on Minato. It is now visible in My passes.')
        await onCreated?.()
      }
    } catch (error) {
      setMessage(formatMandateError(error))
    } finally {
      setChecking(false)
    }
  }

  const buttonLabel =
    step === 'review'
      ? `Approve ${Number(total) / 1_000_000} ${TEST_TOKEN_LABEL} cap`
      : step === 'approved'
        ? 'Fund protected vault'
        : step === 'deposited'
          ? 'Create bounded membership'
          : 'Membership created'

  return (
    <div className="sheet-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="sheet" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
        <button className="sheet-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <span className="eyebrow">BOUNDED AUTHORIZATION</span>
        <h2>{plan.name}</h2>
        <p className="sheet-subtitle">Review exactly what this merchant can receive.</p>

        <div className="rule-grid">
          <div><span>Merchant</span><strong>{plan.merchant}</strong></div>
          <div><span>Token</span><strong>{TEST_TOKEN_LABEL}</strong></div>
          <div><span>Per period</span><strong>{plan.price} {TEST_TOKEN_LABEL}</strong></div>
          <div><span>Maximum charges</span><strong>{chargeLimit}</strong></div>
          <div><span>Lifetime cap</span><strong>{Number(total) / 1_000_000} {TEST_TOKEN_LABEL}</strong></div>
          <div><span>Cancellation</span><strong>Any time</strong></div>
        </div>

        <div className="safety-note">
          The merchant never receives access to your main wallet. Only the amount placed in the Mandate vault can be charged.
          <small>{TEST_TOKEN_NOTE}</small>
        </div>

        <div className="step-track">
          {['Approve', 'Fund', 'Create'].map((label, index) => {
            const completed =
              step === 'created' ||
              (step === 'deposited' && index < 2) ||
              (step === 'approved' && index < 1)
            return <span className={completed ? 'done' : ''} key={label}>{label}</span>
          })}
        </div>

        <button className="primary-button full" onClick={step === 'created' ? onClose : execute} disabled={isPending || checking}>
          {checking && !isPending ? 'Checking safety conditions…' : isPending ? 'Waiting for confirmation…' : step === 'created' ? 'Done' : buttonLabel}
        </button>
        {message && <p className="transaction-message">{message}</p>}
      </section>
    </div>
  )
}
