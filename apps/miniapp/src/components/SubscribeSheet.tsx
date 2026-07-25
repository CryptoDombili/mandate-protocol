import { useMemo, useState } from 'react'
import { parseUnits } from 'viem'
import { useAccount, useWriteContract } from 'wagmi'
import { erc20Abi, mandateProtocolAbi } from '@mandate/sdk'
import type { Plan } from '../data'
import { env, hasDeployment } from '../env'

export function SubscribeSheet({ plan, onClose }: { plan: Plan; onClose: () => void }) {
  const { isConnected } = useAccount()
  const { writeContractAsync, isPending } = useWriteContract()
  const [step, setStep] = useState<'review' | 'approved' | 'deposited' | 'created'>('review')
  const [message, setMessage] = useState('')

  const chargeLimit = 3
  const amountPerCharge = useMemo(() => parseUnits(String(plan.price), 6), [plan.price])
  const total = amountPerCharge * BigInt(chargeLimit)

  async function execute() {
    if (!isConnected) {
      setMessage('Connect the Startale smart account first.')
      return
    }
    if (!hasDeployment || env.demoMode) {
      setStep((current) =>
        current === 'review' ? 'approved' : current === 'approved' ? 'deposited' : 'created',
      )
      setMessage('Demo mode: the onchain transaction was simulated locally.')
      return
    }

    try {
      setMessage('')
      if (step === 'review') {
        await writeContractAsync({
          address: env.tokenAddress,
          abi: erc20Abi,
          functionName: 'approve',
          args: [env.protocolAddress, total],
        })
        setStep('approved')
      } else if (step === 'approved') {
        await writeContractAsync({
          address: env.protocolAddress,
          abi: mandateProtocolAbi,
          functionName: 'deposit',
          args: [env.tokenAddress, total],
        })
        setStep('deposited')
      } else if (step === 'deposited') {
        await writeContractAsync({
          address: env.protocolAddress,
          abi: mandateProtocolAbi,
          functionName: 'subscribe',
          args: [BigInt(plan.id), chargeLimit, total],
        })
        setStep('created')
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Transaction failed.')
    }
  }

  const buttonLabel =
    step === 'review'
      ? `Approve ${Number(total) / 1_000_000} mUSDC cap`
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
          <div><span>Token</span><strong>mUSDC only</strong></div>
          <div><span>Per period</span><strong>{plan.price} mUSDC</strong></div>
          <div><span>Maximum charges</span><strong>{chargeLimit}</strong></div>
          <div><span>Lifetime cap</span><strong>{Number(total) / 1_000_000} mUSDC</strong></div>
          <div><span>Cancellation</span><strong>Any time</strong></div>
        </div>

        <div className="safety-note">
          The merchant never receives access to your main wallet. Only the amount placed in the Mandate vault can be charged.
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

        <button className="primary-button full" onClick={step === 'created' ? onClose : execute} disabled={isPending}>
          {isPending ? 'Waiting for approval…' : step === 'created' ? 'Done' : buttonLabel}
        </button>
        {message && <p className="transaction-message">{message}</p>}
      </section>
    </div>
  )
}
