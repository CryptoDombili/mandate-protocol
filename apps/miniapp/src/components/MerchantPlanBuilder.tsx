import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatUnits, parseUnits } from 'viem'
import { formatMandateError } from '@mandate/sdk'
import { useAccount, usePublicClient, useWriteContract } from 'wagmi'
import { env, hasDeployment } from '../env'
import { protocolReadAbi, type PlanTuple } from '../protocol'
import { TEST_TOKEN_LABEL, TEST_TOKEN_NOTE } from '../token'
import { useMinatoNetwork } from '../minato'

const intervalOptions = [
  { label: '7 days', seconds: 7 * 86_400 },
  { label: '30 days', seconds: 30 * 86_400 },
  { label: '90 days', seconds: 90 * 86_400 },
]

interface MerchantPlan {
  id: bigint
  amount: bigint
  periodSeconds: bigint
  chargeLimit: number
  enabled: boolean
  metadataURI: string
}

function formatPrice(amount: bigint): string {
  return Number(formatUnits(amount, 6)).toLocaleString('en-US', { maximumFractionDigits: 4 })
}

function metadataName(metadataURI: string, fallback: string): string {
  if (!metadataURI.startsWith('mandate://v1?')) return fallback
  try {
    return new URLSearchParams(metadataURI.slice('mandate://v1?'.length)).get('name') || fallback
  } catch {
    return fallback
  }
}

export function MerchantPlanBuilder({
  connectWallet,
  onPlanChanged,
}: {
  connectWallet: () => Promise<void>
  onPlanChanged: () => Promise<void>
}) {
  const { address, isConnected } = useAccount()
  const publicClient = usePublicClient()
  const { writeContractAsync } = useWriteContract()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [benefits, setBenefits] = useState('Member-only access, Priority features, Cancel anytime')
  const [price, setPrice] = useState('3')
  const [periodSeconds, setPeriodSeconds] = useState(30 * 86_400)
  const [maxCharges, setMaxCharges] = useState(3)
  const [badge, setBadge] = useState('MINI APP PASS')
  const [accent, setAccent] = useState<'violet' | 'coral' | 'blue'>('violet')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [merchantPlans, setMerchantPlans] = useState<MerchantPlan[]>([])
  const [plansLoading, setPlansLoading] = useState(false)
  const [toggleId, setToggleId] = useState<bigint | null>(null)
  const { isCorrectChain, switchToMinato, writeBlockedReason } = useMinatoNetwork()

  const lifetimeCap = useMemo(() => {
    const numericPrice = Number(price)
    return Number.isFinite(numericPrice) ? numericPrice * maxCharges : 0
  }, [price, maxCharges])

  const refreshMerchantPlans = useCallback(async () => {
    if (!publicClient || !address || !hasDeployment) {
      setMerchantPlans([])
      return
    }
    setPlansLoading(true)
    try {
      const count = (await publicClient.readContract({
        address: env.protocolAddress,
        abi: protocolReadAbi,
        functionName: 'planCount',
      })) as bigint
      const ids = Array.from({ length: Number(count) }, (_, index) => BigInt(index + 1))
      const loaded = await Promise.all(
        ids.map(async (id) => {
          const plan = (await publicClient.readContract({
            address: env.protocolAddress,
            abi: protocolReadAbi,
            functionName: 'plans',
            args: [id],
          })) as PlanTuple
          if (plan[0].toLowerCase() !== address.toLowerCase()) return null
          return {
            id,
            amount: plan[2],
            periodSeconds: plan[3],
            chargeLimit: plan[4],
            enabled: plan[5],
            metadataURI: plan[6],
          } satisfies MerchantPlan
        }),
      )
      setMerchantPlans(loaded.filter((plan): plan is MerchantPlan => plan !== null).reverse())
    } catch (error) {
      console.error('Could not load merchant plans:', error)
    } finally {
      setPlansLoading(false)
    }
  }, [address, publicClient])

  useEffect(() => {
    void refreshMerchantPlans()
  }, [refreshMerchantPlans])

  async function ensureMinato(): Promise<boolean> {
    if (isCorrectChain) return true
    const result = await switchToMinato()
    if (!result.ok) setMessage(result.message ?? 'Switch your wallet to Soneium Minato and try again.')
    return result.ok
  }

  async function createPlan() {
    if (!isConnected) {
      await connectWallet()
      return
    }
    if (!(await ensureMinato())) return
    if (!publicClient || !hasDeployment || env.demoMode) {
      setMessage('The live Minato contracts are not connected.')
      return
    }
    const numericPrice = Number(price)
    if (!name.trim() || name.trim().length < 3) {
      setMessage('Enter a plan name with at least 3 characters.')
      return
    }
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      setMessage('Enter a valid positive price.')
      return
    }
    if (!Number.isInteger(maxCharges) || maxCharges < 1 || maxCharges > 24) {
      setMessage('Maximum charges must be between 1 and 24.')
      return
    }

    const params = new URLSearchParams({
      name: name.trim().slice(0, 60),
      description: description.trim().slice(0, 180) || 'A bounded recurring access plan.',
      benefits: benefits.split(',').map((item) => item.trim().slice(0, 48)).filter(Boolean).slice(0, 4).join('|'),
      badge: badge.trim().slice(0, 28) || 'ONCHAIN PLAN',
      accent,
      monogram: name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase().slice(0, 2),
    })
    const metadataURI = `mandate://v1?${params.toString()}`

    setBusy(true)
    setMessage('')
    try {
      const hash = await writeContractAsync({
        address: env.protocolAddress,
        abi: protocolReadAbi,
        functionName: 'createPlan',
        args: [
          env.tokenAddress,
          parseUnits(price, 6),
          BigInt(periodSeconds),
          maxCharges,
          metadataURI,
        ],
      })
      await publicClient.waitForTransactionReceipt({ hash })
      setMessage('Plan published on Soneium Minato. It is now visible in Discover.')
      setName('')
      setDescription('')
      await Promise.all([refreshMerchantPlans(), onPlanChanged()])
    } catch (error) {
      setMessage(formatMandateError(error))
    } finally {
      setBusy(false)
    }
  }

  async function togglePlan(plan: MerchantPlan) {
    if (!publicClient) return
    setMessage('')
    if (!(await ensureMinato())) return
    setToggleId(plan.id)
    try {
      const hash = await writeContractAsync({
        address: env.protocolAddress,
        abi: protocolReadAbi,
        functionName: 'setPlanEnabled',
        args: [plan.id, !plan.enabled],
      })
      await publicClient.waitForTransactionReceipt({ hash })
      setMessage(plan.enabled ? 'Plan paused. New memberships and settlements are disabled.' : 'Plan re-enabled on Minato.')
      await Promise.all([refreshMerchantPlans(), onPlanChanged()])
    } catch (error) {
      setMessage(formatMandateError(error))
    } finally {
      setToggleId(null)
    }
  }

  return (
    <section className="plan-builder-shell">
      <div className="plan-builder-head">
        <div>
          <span className="eyebrow">LIVE PLAN BUILDER</span>
          <h2>Publish immutable membership terms.</h2>
          <p>The connected wallet becomes the merchant. Token, price, interval and charge limit are written to Minato and cannot be silently edited.</p>
        </div>
        <div className="builder-network-card">
          <span>Settlement token</span>
          <strong>{TEST_TOKEN_LABEL}</strong>
          <small>{TEST_TOKEN_NOTE}</small>
        </div>
      </div>

      {!isConnected ? (
        <div className="empty-pass-state">
          <strong>Connect your merchant wallet to publish a plan.</strong>
          <button className="primary-button" onClick={() => void connectWallet()}>Connect wallet</button>
        </div>
      ) : (
        <>
          <div className="plan-builder-grid">
            <label>
              <span>Plan name</span>
              <input value={name} onChange={(event) => setName(event.target.value)} maxLength={60} placeholder="Example: Builder Pro Pass" />
            </label>
            <label>
              <span>Price per period</span>
              <div className="input-with-suffix"><input type="number" min="0.000001" step="0.1" value={price} onChange={(event) => setPrice(event.target.value)} /><b>{TEST_TOKEN_LABEL}</b></div>
            </label>
            <label>
              <span>Billing interval</span>
              <select value={periodSeconds} onChange={(event) => setPeriodSeconds(Number(event.target.value))}>
                {intervalOptions.map((option) => <option key={option.seconds} value={option.seconds}>{option.label}</option>)}
              </select>
            </label>
            <label>
              <span>Maximum charges</span>
              <input type="number" min="1" max="24" value={maxCharges} onChange={(event) => setMaxCharges(Number(event.target.value))} />
            </label>
            <label className="builder-wide-field">
              <span>Description</span>
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={180} placeholder="What members receive and why the plan exists." />
            </label>
            <label className="builder-wide-field">
              <span>Benefits — comma separated</span>
              <input value={benefits} onChange={(event) => setBenefits(event.target.value)} maxLength={220} placeholder="Private access, Weekly drops, Priority support" />
            </label>
            <label>
              <span>Category label</span>
              <input value={badge} onChange={(event) => setBadge(event.target.value)} maxLength={28} />
            </label>
            <label>
              <span>Card accent</span>
              <select value={accent} onChange={(event) => setAccent(event.target.value as 'violet' | 'coral' | 'blue')}>
                <option value="violet">Violet</option>
                <option value="coral">Coral</option>
                <option value="blue">Blue</option>
              </select>
            </label>
          </div>

          <div className="builder-review-bar">
            <div><span>Merchant</span><strong>{address ? `${address.slice(0, 8)}…${address.slice(-6)}` : 'Not connected'}</strong></div>
            <div><span>Lifetime maximum</span><strong>{lifetimeCap.toLocaleString('en-US', { maximumFractionDigits: 4 })} {TEST_TOKEN_LABEL}</strong></div>
            <div><span>Terms</span><strong>Immutable after publish</strong></div>
            <button
              className="primary-button"
              onClick={createPlan}
              disabled={busy || (isConnected && !isCorrectChain)}
            >
              {isConnected && !isCorrectChain ? 'Minato unavailable in Preview' : busy ? 'Publishing…' : 'Publish plan on Minato'}
            </button>
          </div>
        </>
      )}

      {(message || (isConnected && !isCorrectChain)) && (
        <p className="passes-message">{message || writeBlockedReason}</p>
      )}

      {isConnected && (
        <div className="merchant-plan-list">
          <div className="merchant-plan-list-head">
            <div><span className="eyebrow">MY PUBLISHED PLANS</span><h3>Merchant registry</h3></div>
            <button className="secondary-button" onClick={() => void refreshMerchantPlans()} disabled={plansLoading}>{plansLoading ? 'Refreshing…' : 'Refresh'}</button>
          </div>
          {merchantPlans.length === 0 ? (
            <div className="builder-empty-plan">No plans have been published by this wallet yet.</div>
          ) : merchantPlans.map((plan) => (
            <article className="merchant-plan-row" key={plan.id.toString()}>
              <span className={`plan-status-dot ${plan.enabled ? 'enabled' : 'disabled'}`} />
              <div><strong>{metadataName(plan.metadataURI, `Plan #${plan.id.toString()}`)}</strong><small>Plan #{plan.id.toString()}</small></div>
              <div><span>Price</span><strong>{formatPrice(plan.amount)} {TEST_TOKEN_LABEL}</strong></div>
              <div><span>Interval</span><strong>{Number(plan.periodSeconds) / 86_400} days</strong></div>
              <div><span>Charge cap</span><strong>{plan.chargeLimit === 0 ? 'Open' : plan.chargeLimit}</strong></div>
              <button
                className={plan.enabled ? 'danger-button' : 'secondary-button'}
                onClick={() => togglePlan(plan)}
                disabled={toggleId !== null || (isConnected && !isCorrectChain)}
              >
                {toggleId === plan.id ? 'Waiting…' : plan.enabled ? 'Pause plan' : 'Re-enable'}
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
