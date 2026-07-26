import { useCallback, useEffect, useState } from 'react'
import { sdk } from '@farcaster/miniapp-sdk'
import {
  MandateClient,
  formatMandateError,
  mandateMinatoDeployment,
  type AccessDecision,
  type MandateClientConfig,
} from '@mandate/sdk'
import { formatUnits, type Hash } from 'viem'
import { useAccount, useConnect, useDisconnect, usePublicClient, useWriteContract } from 'wagmi'
import { Logo } from './components/Logo'
import { PlanCard } from './components/PlanCard'
import { SubscribeSheet } from './components/SubscribeSheet'
import { MerchantPlanBuilder } from './components/MerchantPlanBuilder'
import { NetworkBanner } from './components/NetworkBanner'
import { plans, type Plan } from './data'
import { usePlanDirectory } from './planDirectory'
import { useMinatoNetwork } from './minato'
import { env, hasDeployment } from './env'
import {
  chargedEvent,
  depositedEvent,
  refundedEvent,
  subscriptionCancelledEvent,
  subscriptionPausedEvent,
  subscriptionResumedEvent,
  withdrawnEvent,
  type ProofRecord,
} from './proof'
import { PRODUCTION_TOKEN_NOTE, TEST_TOKEN_LABEL, TEST_TOKEN_NOTE } from './token'
import {
  DEPLOYMENT_BLOCK,
  protocolReadAbi,
  subscriptionCreatedEvent,
  tokenReadAbi,
  type PlanTuple,
  type SubscriptionTuple,
} from './protocol'

const statusLabels = ['None', 'Active', 'Paused', 'Cancelled', 'Completed'] as const

interface LiveMembership {
  id: bigint
  planId: bigint
  name: string
  amount: bigint
  nextChargeAt: bigint
  paidUntil: bigint
  status: number
  charges: number
  chargeLimit: number
  accent: Plan['accent']
}

const getErrorMessage = formatMandateError

function formatToken(amount: bigint): string {
  return Number(formatUnits(amount, 6)).toLocaleString('en-US', { maximumFractionDigits: 2 })
}

function formatChargeTime(timestamp: bigint): string {
  if (timestamp === 0n) return 'Not scheduled'
  if (timestamp * 1000n <= BigInt(Date.now())) return 'Due now'
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(Number(timestamp) * 1000),
  )
}

const metadataPrefix = 'mandate://v1?'

function readMembershipMetadata(metadataURI: string): { name?: string; accent?: Plan['accent'] } {
  if (!metadataURI.startsWith(metadataPrefix)) return {}

  try {
    const params = new URLSearchParams(metadataURI.slice(metadataPrefix.length))
    const rawAccent = params.get('accent')
    const accent = rawAccent === 'coral' || rawAccent === 'blue' || rawAccent === 'violet'
      ? rawAccent
      : undefined
    const name = params.get('name')?.trim()

    return {
      name: name || undefined,
      accent,
    }
  } catch {
    return {}
  }
}

function fallbackPlanName(planId: bigint, metadataURI: string): string {
  if (metadataURI.startsWith('ipfs://')) {
    const slug = metadataURI.split('/').at(-1)
    if (slug) {
      return slug
        .split('-')
        .filter(Boolean)
        .map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`)
        .join(' ')
    }
  }

  return `Plan #${planId.toString()}`
}

const installSnippet = `npm install @mandate/sdk viem`
const accessSnippet = `import { MandateClient } from '@mandate/sdk'

const mandate = new MandateClient({
  protocolAddress,
  publicClient,
})

const decision = await mandate.checkAccess(
  subscriptionId,
  connectedAccount,
)

if (decision.granted) openPremiumFeature()`
const transactionSnippet = `const mandate = new MandateClient({
  protocolAddress,
  publicClient,
  walletClient,
  account,
})

await mandate.approveToken(token, lifetimeCap)
await mandate.deposit(token, lifetimeCap)
await mandate.subscribe(planId, chargeLimit, lifetimeCap)`


export function App() {
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  const [tab, setTab] = useState<'home' | 'passes' | 'merchant' | 'proofs' | 'developers'>('home')
  const { address, isConnected } = useAccount()
  const { connectors, connectAsync, isPending } = useConnect()
  const { disconnect } = useDisconnect()
  const publicClient = usePublicClient()
  const { writeContractAsync } = useWriteContract()
  const { directoryPlans, refreshPlanDirectory } = usePlanDirectory()
  const [memberships, setMemberships] = useState<LiveMembership[]>([])
  const [passesLoading, setPassesLoading] = useState(false)
  const [passesMessage, setPassesMessage] = useState('')
  const [walletTokenBalance, setWalletTokenBalance] = useState(0n)
  const [vaultTokenBalance, setVaultTokenBalance] = useState(0n)
  const [actionId, setActionId] = useState<bigint | null>(null)
  const [merchantActionId, setMerchantActionId] = useState<bigint | null>(null)
  const [merchantMessage, setMerchantMessage] = useState('')
  const [proofs, setProofs] = useState<ProofRecord[]>([])
  const [proofsLoading, setProofsLoading] = useState(false)
  const [proofsMessage, setProofsMessage] = useState('')
  const [developerSubscriptionId, setDeveloperSubscriptionId] = useState('1')
  const [developerDecision, setDeveloperDecision] = useState<AccessDecision | null>(null)
  const [developerChecking, setDeveloperChecking] = useState(false)
  const [developerMessage, setDeveloperMessage] = useState('')
  const [copiedDeveloperSnippet, setCopiedDeveloperSnippet] = useState('')
  const [connectionMessage, setConnectionMessage] = useState('')
  const { isCorrectChain, switchToMinato, writeBlockedReason } = useMinatoNetwork()

  useEffect(() => {
    sdk.actions.ready().catch(() => undefined)
  }, [])

  const isEmbedded = typeof window !== 'undefined' && window.parent !== window
  const shortAddress = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : ''

  async function connectWallet() {
    setConnectionMessage('')
    const startale = connectors.find((connector) => {
      const label = `${connector.id} ${connector.name} ${connector.type}`.toLowerCase()
      return label.includes('startale')
    })

    const browserWallet =
      connectors.find((connector) => connector.type === 'injected') ??
      connectors.find((connector) => {
        const label = `${connector.id} ${connector.name} ${connector.type}`.toLowerCase()
        return label.includes('metamask') || label.includes('injected')
      })

    // Inside Startale, use the host wallet. On the public website, use MetaMask.
    const connector = isEmbedded ? (startale ?? browserWallet) : browserWallet

    if (!connector) {
      setConnectionMessage(
        isEmbedded
          ? 'Startale host wallet could not be detected. Open Mandate through the Startale Mini App preview.'
          : 'MetaMask could not be detected. Unlock the extension and try again.',
      )
      return
    }

    try {
      await connectAsync({ connector, chainId: 1946 })
    } catch (error) {
      console.error('Wallet connection failed:', error)
      const message = getErrorMessage(error)
      setConnectionMessage(
        message.toLowerCase().includes('rejected')
          ? 'Wallet connection or network switch was cancelled. Switch MetaMask to Soneium Minato and connect again. No funds moved.'
          : message,
      )
    }
  }

  async function ensureWriteNetwork(setMessage: (message: string) => void): Promise<boolean> {
    if (!isConnected) {
      setMessage('Connect your wallet first.')
      return false
    }
    if (isCorrectChain) return true

    const result = await switchToMinato()
    if (!result.ok) {
      setMessage(result.message ?? 'Switch your wallet to Soneium Minato and try again.')
      return false
    }
    return true
  }

  async function runDeveloperAccessCheck() {
    if (!publicClient || !hasDeployment) {
      setDeveloperMessage('The Minato deployment is not available.')
      return
    }

    const rawId = developerSubscriptionId.trim()
    if (!/^\d+$/.test(rawId) || BigInt(rawId) === 0n) {
      setDeveloperDecision(null)
      setDeveloperMessage('Enter a valid subscription id greater than zero.')
      return
    }

    setDeveloperChecking(true)
    setDeveloperMessage('')
    try {
      const mandate = new MandateClient({
        protocolAddress: env.protocolAddress,
        publicClient: publicClient as unknown as MandateClientConfig['publicClient'],
      })
      const decision = await mandate.checkAccess(BigInt(rawId), address)
      setDeveloperDecision(decision)
    } catch (error) {
      setDeveloperDecision(null)
      setDeveloperMessage(getErrorMessage(error))
    } finally {
      setDeveloperChecking(false)
    }
  }

  async function copyDeveloperSnippet(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedDeveloperSnippet(key)
      window.setTimeout(() => setCopiedDeveloperSnippet(''), 1800)
    } catch {
      setDeveloperMessage('Clipboard access was blocked by the browser.')
    }
  }

  const refreshPasses = useCallback(async () => {
    if (!address || !publicClient || !hasDeployment) {
      setMemberships([])
      setWalletTokenBalance(0n)
      setVaultTokenBalance(0n)
      return
    }

    setPassesLoading(true)
    setPassesMessage('')
    try {
      const [tokenBalance, vaultBalance, logs] = await Promise.all([
        publicClient.readContract({
          address: env.tokenAddress,
          abi: tokenReadAbi,
          functionName: 'balanceOf',
          args: [address],
        }),
        publicClient.readContract({
          address: env.protocolAddress,
          abi: protocolReadAbi,
          functionName: 'vaultBalance',
          args: [address, env.tokenAddress],
        }),
        publicClient.getLogs({
          address: env.protocolAddress,
          event: subscriptionCreatedEvent,
          args: { subscriber: address },
          fromBlock: DEPLOYMENT_BLOCK,
          toBlock: 'latest',
          strict: true,
        }),
      ])

      setWalletTokenBalance(tokenBalance)
      setVaultTokenBalance(vaultBalance)

      const subscriptionIds = [...new Set(logs.map((log) => log.args.subscriptionId.toString()))].map((value) => BigInt(String(value)))
      const liveMemberships = await Promise.all(
        subscriptionIds.map(async (subscriptionId) => {
          const subscription = (await publicClient.readContract({
            address: env.protocolAddress,
            abi: protocolReadAbi,
            functionName: 'subscriptions',
            args: [subscriptionId],
          })) as SubscriptionTuple
          const plan = (await publicClient.readContract({
            address: env.protocolAddress,
            abi: protocolReadAbi,
            functionName: 'plans',
            args: [subscription[0]],
          })) as PlanTuple
          const localPlan = plans.find((item) => BigInt(item.id) === subscription[0])
          const metadata = readMembershipMetadata(plan[6])

          return {
            id: subscriptionId,
            planId: subscription[0],
            name: localPlan?.name ?? metadata.name ?? fallbackPlanName(subscription[0], plan[6]),
            amount: plan[2],
            nextChargeAt: subscription[5],
            paidUntil: subscription[6],
            status: subscription[9],
            chargeLimit: subscription[7],
            charges: subscription[8],
            accent: localPlan?.accent ?? metadata.accent ?? 'violet',
          } satisfies LiveMembership
        }),
      )

      setMemberships(liveMemberships.sort((a, b) => Number(b.id - a.id)))
    } catch (error) {
      console.error('Could not load passes:', error)
      setPassesMessage(getErrorMessage(error))
    } finally {
      setPassesLoading(false)
    }
  }, [address, publicClient])

  useEffect(() => {
    if (tab === 'passes' || tab === 'merchant' || tab === 'proofs') void refreshPasses()
  }, [tab, refreshPasses])

  async function runMembershipAction(membership: LiveMembership, action: 'pause' | 'resume' | 'cancel') {
    if (!publicClient) return
    setPassesMessage('')
    if (!(await ensureWriteNetwork(setPassesMessage))) return
    if (action === 'pause' && membership.status !== 1) {
      setPassesMessage('Only an active membership can be paused.')
      return
    }
    if (action === 'resume' && membership.status !== 2) {
      setPassesMessage('Only a paused membership can be resumed.')
      return
    }
    if (action === 'cancel' && ![1, 2].includes(membership.status)) {
      setPassesMessage('This membership already has no future charges.')
      return
    }
    setActionId(membership.id)
    try {
      const functionName =
        action === 'pause'
          ? 'pauseSubscription'
          : action === 'resume'
            ? 'resumeSubscription'
            : 'cancelSubscription'
      const hash = await writeContractAsync({
        address: env.protocolAddress,
        abi: protocolReadAbi,
        functionName,
        args: [membership.id],
      })
      await publicClient.waitForTransactionReceipt({ hash })
      setPassesMessage(
        action === 'pause'
          ? 'Membership paused on Minato.'
          : action === 'resume'
            ? 'Membership resumed on Minato.'
            : 'Membership cancelled on Minato.',
      )
      await refreshPasses()
    } catch (error) {
      setPassesMessage(getErrorMessage(error))
    } finally {
      setActionId(null)
    }
  }

  async function withdrawVault() {
    if (!publicClient) return
    setPassesMessage('')
    if (!(await ensureWriteNetwork(setPassesMessage))) return
    if (vaultTokenBalance === 0n) {
      setPassesMessage('There is no unused vault balance to withdraw.')
      return
    }
    setActionId(-1n)
    try {
      const hash = await writeContractAsync({
        address: env.protocolAddress,
        abi: protocolReadAbi,
        functionName: 'withdraw',
        args: [env.tokenAddress, vaultTokenBalance],
      })
      await publicClient.waitForTransactionReceipt({ hash })
      setPassesMessage('Unused vault balance withdrawn to your wallet.')
      await refreshPasses()
    } catch (error) {
      setPassesMessage(getErrorMessage(error))
    } finally {
      setActionId(null)
    }
  }


  async function chargeMembership(membership: LiveMembership) {
    if (!publicClient) return
    setMerchantMessage('')
    if (!(await ensureWriteNetwork(setMerchantMessage))) return
    if (membership.status !== 1) {
      setMerchantMessage('Only an active membership can be charged.')
      return
    }
    if (membership.nextChargeAt * 1000n > BigInt(Date.now())) {
      setMerchantMessage(`Payment is not due yet. Next settlement: ${formatChargeTime(membership.nextChargeAt)}.`)
      return
    }
    if (membership.charges >= membership.chargeLimit) {
      setMerchantMessage('This membership has reached its maximum charge count.')
      return
    }
    if (vaultTokenBalance < membership.amount) {
      setMerchantMessage('Protected vault balance is too low for this payment.')
      return
    }
    setMerchantActionId(membership.id)
    try {
      const plan = (await publicClient.readContract({
        address: env.protocolAddress,
        abi: protocolReadAbi,
        functionName: 'plans',
        args: [membership.planId],
      })) as PlanTuple
      if (!plan[5]) {
        setMerchantMessage('This plan is paused by its merchant, so settlement is disabled.')
        return
      }
      const hash = await writeContractAsync({
        address: env.protocolAddress,
        abi: protocolReadAbi,
        functionName: 'charge',
        args: [membership.id],
      })
      await publicClient.waitForTransactionReceipt({ hash })
      setMerchantMessage(
        `${formatToken(membership.amount)} ${TEST_TOKEN_LABEL} settled for subscription #${membership.id.toString()}.`,
      )
      await refreshPasses()
    } catch (error) {
      setMerchantMessage(getErrorMessage(error))
    } finally {
      setMerchantActionId(null)
    }
  }

  const refreshProofs = useCallback(async () => {
    if (!address || !publicClient || !hasDeployment) {
      setProofs([])
      return
    }

    setProofsLoading(true)
    setProofsMessage('')
    try {
      const [createdLogs, depositLogs, withdrawLogs, chargedLogs, pausedLogs, resumedLogs, cancelledLogs, refundedLogs] = await Promise.all([
        publicClient.getLogs({
          address: env.protocolAddress,
          event: subscriptionCreatedEvent,
          args: { subscriber: address },
          fromBlock: DEPLOYMENT_BLOCK,
          toBlock: 'latest',
          strict: true,
        }),
        publicClient.getLogs({
          address: env.protocolAddress,
          event: depositedEvent,
          args: { account: address, token: env.tokenAddress },
          fromBlock: DEPLOYMENT_BLOCK,
          toBlock: 'latest',
          strict: true,
        }),
        publicClient.getLogs({
          address: env.protocolAddress,
          event: withdrawnEvent,
          args: { account: address, token: env.tokenAddress },
          fromBlock: DEPLOYMENT_BLOCK,
          toBlock: 'latest',
          strict: true,
        }),
        publicClient.getLogs({
          address: env.protocolAddress,
          event: chargedEvent,
          args: { subscriber: address },
          fromBlock: DEPLOYMENT_BLOCK,
          toBlock: 'latest',
          strict: true,
        }),
        publicClient.getLogs({ address: env.protocolAddress, event: subscriptionPausedEvent, fromBlock: DEPLOYMENT_BLOCK, toBlock: 'latest', strict: true }),
        publicClient.getLogs({ address: env.protocolAddress, event: subscriptionResumedEvent, fromBlock: DEPLOYMENT_BLOCK, toBlock: 'latest', strict: true }),
        publicClient.getLogs({ address: env.protocolAddress, event: subscriptionCancelledEvent, fromBlock: DEPLOYMENT_BLOCK, toBlock: 'latest', strict: true }),
        publicClient.getLogs({
          address: env.protocolAddress,
          event: refundedEvent,
          args: { subscriber: address },
          fromBlock: DEPLOYMENT_BLOCK,
          toBlock: 'latest',
          strict: true,
        }),
      ])

      const ownedIds = new Set(createdLogs.map((log) => log.args.subscriptionId.toString()))
      const records: ProofRecord[] = []
      const push = (record: ProofRecord) => records.push(record)

      for (const log of depositLogs) push({
        id: `deposit-${log.transactionHash}-${log.logIndex}`,
        kind: 'Vault funded',
        detail: 'Test funds moved from the connected wallet into the protected Mandate vault.',
        amount: log.args.amount,
        blockNumber: log.blockNumber,
        logIndex: log.logIndex,
        transactionHash: log.transactionHash,
      })
      for (const log of withdrawLogs) push({
        id: `withdraw-${log.transactionHash}-${log.logIndex}`,
        kind: 'Vault withdrawal',
        detail: 'Unused test funds returned from the protected vault to the connected wallet.',
        amount: log.args.amount,
        blockNumber: log.blockNumber,
        logIndex: log.logIndex,
        transactionHash: log.transactionHash,
      })
      for (const log of createdLogs) push({
        id: `created-${log.transactionHash}-${log.logIndex}`,
        kind: 'Membership created',
        detail: `Plan #${log.args.planId.toString()} created with ${log.args.chargeLimit.toString()} maximum charges.`,
        subscriptionId: log.args.subscriptionId,
        blockNumber: log.blockNumber,
        logIndex: log.logIndex,
        transactionHash: log.transactionHash,
      })
      for (const log of chargedLogs) push({
        id: `charged-${log.transactionHash}-${log.logIndex}`,
        kind: 'Payment settled',
        detail: `Charge #${log.args.chargeNumber.toString()} settled to the immutable merchant address.`,
        amount: log.args.amount,
        subscriptionId: log.args.subscriptionId,
        blockNumber: log.blockNumber,
        logIndex: log.logIndex,
        transactionHash: log.transactionHash,
      })
      for (const log of pausedLogs) if (ownedIds.has(log.args.subscriptionId.toString())) push({
        id: `paused-${log.transactionHash}-${log.logIndex}`,
        kind: 'Membership paused',
        detail: 'Future settlement was paused by the subscriber.',
        subscriptionId: log.args.subscriptionId,
        blockNumber: log.blockNumber,
        logIndex: log.logIndex,
        transactionHash: log.transactionHash,
      })
      for (const log of resumedLogs) if (ownedIds.has(log.args.subscriptionId.toString())) push({
        id: `resumed-${log.transactionHash}-${log.logIndex}`,
        kind: 'Membership resumed',
        detail: 'The subscriber restored the bounded payment schedule.',
        subscriptionId: log.args.subscriptionId,
        blockNumber: log.blockNumber,
        logIndex: log.logIndex,
        transactionHash: log.transactionHash,
      })
      for (const log of cancelledLogs) if (ownedIds.has(log.args.subscriptionId.toString())) push({
        id: `cancelled-${log.transactionHash}-${log.logIndex}`,
        kind: 'Membership cancelled',
        detail: 'All future charges were permanently stopped.',
        subscriptionId: log.args.subscriptionId,
        blockNumber: log.blockNumber,
        logIndex: log.logIndex,
        transactionHash: log.transactionHash,
      })
      for (const log of refundedLogs) push({
        id: `refunded-${log.transactionHash}-${log.logIndex}`,
        kind: 'Payment refunded',
        detail: 'Merchant-funded refund credited to the subscriber’s withdrawable vault balance.',
        amount: log.args.amount,
        subscriptionId: log.args.subscriptionId,
        blockNumber: log.blockNumber,
        logIndex: log.logIndex,
        transactionHash: log.transactionHash,
      })

      const uniqueBlocks = [...new Set(records.map((record) => record.blockNumber.toString()))].map((value) => BigInt(String(value)))
      const blocks = await Promise.all(uniqueBlocks.map((blockNumber) => publicClient.getBlock({ blockNumber })))
      const timestamps = new Map(blocks.map((block) => [block.number.toString(), block.timestamp]))
      setProofs(
        records
          .map((record) => ({ ...record, timestamp: timestamps.get(record.blockNumber.toString()) }))
          .sort((a, b) => a.blockNumber === b.blockNumber ? b.logIndex - a.logIndex : a.blockNumber > b.blockNumber ? -1 : 1),
      )
    } catch (error) {
      console.error('Could not load proof records:', error)
      setProofsMessage(getErrorMessage(error))
    } finally {
      setProofsLoading(false)
    }
  }, [address, publicClient])

  useEffect(() => {
    if (tab === 'proofs') void refreshProofs()
  }, [tab, refreshProofs])

  function downloadProof(record: ProofRecord) {
    const payload = {
      product: 'Mandate',
      environment: 'Soneium Minato testnet',
      chainId: 1946,
      tokenDisplay: TEST_TOKEN_LABEL,
      tokenNotice: TEST_TOKEN_NOTE,
      productionTarget: 'Startale USD (USDSC)',
      protocolAddress: env.protocolAddress,
      tokenAddress: env.tokenAddress,
      event: record.kind,
      detail: record.detail,
      subscriptionId: record.subscriptionId?.toString(),
      amount: record.amount ? `${formatToken(record.amount)} ${TEST_TOKEN_LABEL}` : undefined,
      blockNumber: record.blockNumber.toString(),
      transactionHash: record.transactionHash,
      timestamp: record.timestamp ? new Date(Number(record.timestamp) * 1000).toISOString() : undefined,
      explorer: `https://soneium-minato.blockscout.com/tx/${record.transactionHash}`,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `mandate-${record.kind.toLowerCase().replaceAll(' ', '-')}-${record.transactionHash.slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  function openExplorer(hash: Hash) {
    window.open(`https://soneium-minato.blockscout.com/tx/${hash}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="app-shell">
      <div className="page-glow glow-one" />
      <div className="page-glow glow-two" />

      <div className="announcement">
        <span>Minato preview</span>
        User-controlled memberships for Startale Mini Apps · {TEST_TOKEN_NOTE}
      </div>
      <header className="topbar">
        <Logo />
        <nav className="desktop-nav" aria-label="Main navigation">
          <button className={tab === 'home' ? 'active' : ''} onClick={() => setTab('home')}>Discover</button>
          <button className={tab === 'passes' ? 'active' : ''} onClick={() => setTab('passes')}>My passes</button>
          <button className={tab === 'merchant' ? 'active' : ''} onClick={() => setTab('merchant')}>Merchant</button>
          <button className={tab === 'proofs' ? 'active' : ''} onClick={() => setTab('proofs')}>Proofs</button>
          <button className={tab === 'developers' ? 'active' : ''} onClick={() => setTab('developers')}>Developers</button>
        </nav>
        <button className="wallet-button" onClick={isConnected ? () => disconnect() : connectWallet} disabled={isPending}>
          <span className="wallet-avatar">S</span>
          {isPending
            ? 'Connecting…'
            : isConnected
              ? shortAddress
              : isEmbedded
                ? 'Connect Startale'
                : 'Connect MetaMask'}
        </button>
      </header>
      <NetworkBanner />
      {connectionMessage && (
        <div className="connection-notice" role="status">
          <span>{connectionMessage}</span>
          <button type="button" onClick={() => setConnectionMessage('')} aria-label="Dismiss wallet message">×</button>
        </div>
      )}
      <main>
        {tab === 'home' && (
          <>
            <section className="hero">
              <div className="hero-copy">
                <span className="eyebrow">MEMBERSHIP INFRASTRUCTURE</span>
                <h1>Recurring access, with rules users can see.</h1>
                <p>
                  Games, creators and communities can sell memberships without asking users for unlimited wallet approvals.
                </p>
                <div className="hero-actions">
                  <button className="primary-button" onClick={() => document.getElementById('plans')?.scrollIntoView({ behavior: 'smooth' })}>
                    Explore memberships
                  </button>
                  <button className="secondary-button" onClick={() => setTab('developers')}>View developer kit</button>
                </div>
                <div className="proof-row">
                  <span><b>01</b> Exact spend caps</span>
                  <span><b>02</b> Cancel at any time</span>
                  <span><b>03</b> Unused funds stay withdrawable</span>
                </div>
              </div>
              <div className="product-preview" aria-label="Membership dashboard preview">
                <div className="preview-head">
                  <div>
                    <span>Monthly access</span>
                    <strong>Your memberships</strong>
                  </div>
                  <span className="count-pill">3 active</span>
                </div>
                <div className="membership-stack">
                  <article className="mini-membership violet-card">
                    <div className="mini-card-head"><span>ARCADE PRO</span><i>AP</i></div>
                    <strong>5 {TEST_TOKEN_LABEL}</strong>
                    <small>Renews 18 Aug · Cap locked</small>
                  </article>
                  <article className="mini-membership coral-card">
                    <div className="mini-card-head"><span>CREATOR CLUB</span><i>CI</i></div>
                    <strong>2 {TEST_TOKEN_LABEL}</strong>
                    <small>Renews 24 Aug · Cancel anytime</small>
                  </article>
                  <article className="mini-membership blue-card">
                    <div className="mini-card-head"><span>BUILDER TOOLKIT</span><i>BT</i></div>
                    <strong>3 {TEST_TOKEN_LABEL}</strong>
                    <small>Renews 28 Aug · Terms verified</small>
                  </article>
                </div>
                <div className="spend-panel">
                  <div className="spend-title"><span>Monthly commitment</span><strong>10 / 20 {TEST_TOKEN_LABEL}</strong></div>
                  <div className="spend-track"><span /></div>
                  <div className="spend-foot"><span>Hard cap</span><strong>50% available</strong></div>
                </div>
              </div>
            </section>
            <section className="metric-grid">
              <article><span className="metric-icon">↗</span><strong>0</strong><p>admin access to user funds</p></article>
              <article><span className="metric-icon">◎</span><strong>1</strong><p>transparent rule per membership</p></article>
              <article><span className="metric-icon">↩</span><strong>100%</strong><p>unused balance remains withdrawable</p></article>
              <article><span className="metric-icon">S</span><strong>1946</strong><p>Soneium Minato chain ID</p></article>
            </section>
            <section className="token-clarity" aria-label="Test token notice">
              <div>
                <span className="eyebrow">TOKEN CLARITY</span>
                <strong>{TEST_TOKEN_LABEL}</strong>
                <p>{TEST_TOKEN_NOTE} {PRODUCTION_TOKEN_NOTE}</p>
              </div>
              <a href={`https://soneium-minato.blockscout.com/address/${env.tokenAddress}`} target="_blank" rel="noreferrer">View test token</a>
            </section>
            <section className="section" id="plans">
              <div className="section-head">
                <div>
                  <span className="eyebrow">DISCOVER</span>
                  <h2>Memberships with visible limits</h2>
                </div>
                <p>Every plan exposes the merchant, token, price, interval, charge count and lifetime cap before approval.</p>
              </div>
              <div className="plan-grid">
                {(directoryPlans.length > 0 ? directoryPlans : plans).map((plan) => <PlanCard key={plan.id} plan={plan} onSelect={setSelectedPlan} />)}
              </div>
            </section>
            <section className="protocol-section">
              <div className="protocol-copy">
                <span className="dark-eyebrow">PROTOCOL STATUS</span>
                <h2>{hasDeployment ? 'Connected to Minato.' : 'Built for the first Minato deployment.'}</h2>
                <p>
                  {hasDeployment && !env.demoMode
                    ? 'The live Minato contracts are connected. Membership approvals, vault funding and bounded subscriptions now execute onchain.'
                    : 'The interface is running in demo mode. Deploy the included contracts and add their addresses to activate real testnet actions.'}
                </p>
                <button className="protocol-button" onClick={() => setTab('developers')}>Explore the architecture</button>
              </div>
              <div className="status-board">
                <div><span>Protocol</span><strong>{hasDeployment ? `${env.protocolAddress.slice(0, 8)}…` : 'Not deployed'}</strong></div>
                <div><span>{TEST_TOKEN_LABEL}</span><strong>{hasDeployment ? `${env.tokenAddress.slice(0, 8)}…` : 'Pending'}</strong></div>
                <div><span>Network</span><strong>Soneium Minato</strong></div>
                <div><span>Exit guarantee</span><strong className="mint">Withdrawals always open</strong></div>
              </div>
            </section>
          </>
        )}
        {tab === 'passes' && (
          <section className="section inner-page">
            <span className="eyebrow">YOUR CONTROL CENTER</span>
            <h1>My passes</h1>
            <p className="page-lead">Live data from your connected account on Soneium Minato.</p>

            {!isConnected ? (
              <div className="empty-pass-state">
                <strong>Connect your wallet to load onchain passes.</strong>
                <button className="primary-button" onClick={connectWallet}>Connect wallet</button>
              </div>
            ) : (
              <>
                <div className="pass-balance-grid">
                  <article>
                    <span>Wallet {TEST_TOKEN_LABEL}</span>
                    <strong>{formatToken(walletTokenBalance)}</strong>
                    <small>Available in the connected wallet</small>
                  </article>
                  <article>
                    <span>Protected vault</span>
                    <strong>{formatToken(vaultTokenBalance)}</strong>
                    <small>Always withdrawable when unspent</small>
                  </article>
                  <article className="vault-action-card">
                    <span>Vault control</span>
                    <button
                      className="secondary-button"
                      onClick={withdrawVault}
                      disabled={vaultTokenBalance === 0n || actionId !== null || (isConnected && !isCorrectChain)}
                    >
                      {actionId === -1n ? 'Withdrawing…' : 'Withdraw all'}
                    </button>
                    <small>No admin can block this exit</small>
                  </article>
                </div>

                {(passesMessage || (isConnected && !isCorrectChain)) && (
                  <p className="passes-message">{passesMessage || writeBlockedReason}</p>
                )}

                {passesLoading ? (
                  <div className="empty-pass-state"><strong>Reading Minato activity…</strong></div>
                ) : memberships.length === 0 ? (
                  <div className="empty-pass-state">
                    <strong>No onchain memberships yet.</strong>
                    <p>The old sample passes have been removed. Create a real membership from Discover and it will appear here after confirmation.</p>
                    <button className="primary-button" onClick={() => setTab('home')}>Explore memberships</button>
                  </div>
                ) : (
                  <div className="membership-list">
                    {memberships.map((membership) => {
                      const state = statusLabels[membership.status] ?? 'Unknown'
                      const isBusy = actionId === membership.id
                      const canPause = membership.status === 1
                      const canResume = membership.status === 2
                      const canCancel = membership.status === 1 || membership.status === 2
                      return (
                        <article key={membership.id.toString()} className={`membership-row row-${membership.accent}`}>
                          <span className="membership-badge">{membership.name.slice(0, 2).toUpperCase()}</span>
                          <div>
                            <span className={`state-pill state-${state.toLowerCase()}`}>{state}</span>
                            <h3>{membership.name}</h3>
                            <small className="subscription-id">Subscription #{membership.id.toString()}</small>
                          </div>
                          <div className="membership-meta">
                            <span>Next charge: {formatChargeTime(membership.nextChargeAt)}</span>
                            <strong>{formatToken(membership.amount)} {TEST_TOKEN_LABEL}</strong>
                            <span>{membership.charges} / {membership.chargeLimit} charges used</span>
                          </div>
                          <div className="membership-actions">
                            {canPause && <button onClick={() => runMembershipAction(membership, 'pause')} disabled={isBusy || !isCorrectChain}>{isBusy ? 'Waiting…' : 'Pause'}</button>}
                            {canResume && <button onClick={() => runMembershipAction(membership, 'resume')} disabled={isBusy || !isCorrectChain}>{isBusy ? 'Waiting…' : 'Resume'}</button>}
                            {canCancel && <button className="danger-button" onClick={() => runMembershipAction(membership, 'cancel')} disabled={isBusy || !isCorrectChain}>{isBusy ? 'Waiting…' : 'Cancel'}</button>}
                            {!canPause && !canResume && !canCancel && <span className="closed-label">No future charges</span>}
                          </div>
                        </article>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </section>
        )}
        {tab === 'merchant' && (
          <section className="section inner-page">
            <span className="eyebrow">MERCHANT STUDIO</span>
            <h1>Settle due access without changing the rules.</h1>
            <p className="page-lead">
              Charges are permissionless to trigger, but the merchant, token, amount, interval, spend cap and charge count remain enforced by MandateProtocol.
            </p>
            <div className="merchant-grid">
              <article><span>01</span><h3>Immutable terms</h3><p>Existing members never receive a silent price or interval increase.</p></article>
              <article><span>02</span><h3>Permissionless keeper</h3><p>Any account may trigger a due charge, but cannot alter its amount or destination.</p></article>
              <article><span>03</span><h3>Direct settlement</h3><p>Successful charges move from the protected vault to the registered merchant.</p></article>
            </div>

            <MerchantPlanBuilder
              connectWallet={connectWallet}
              onPlanChanged={refreshPlanDirectory}
            />

            <div className="merchant-console">
              <div className="merchant-console-head">
                <div>
                  <span className="eyebrow">LIVE KEEPER CONSOLE</span>
                  <h2>Due charge queue</h2>
                  <p>This preview lists subscriptions created by the connected account and settles them through the live Minato protocol.</p>
                </div>
                <button
                  className="secondary-button"
                  onClick={() => void refreshPasses()}
                  disabled={!isConnected || passesLoading || merchantActionId !== null}
                >
                  {passesLoading ? 'Refreshing…' : 'Refresh queue'}
                </button>
              </div>

              {(merchantMessage || (isConnected && !isCorrectChain)) && (
                <p className="passes-message">{merchantMessage || writeBlockedReason}</p>
              )}

              {!isConnected ? (
                <div className="empty-pass-state">
                  <strong>Connect your wallet to load the live charge queue.</strong>
                  <button className="primary-button" onClick={connectWallet}>Connect wallet</button>
                </div>
              ) : passesLoading ? (
                <div className="empty-pass-state"><strong>Reading Minato subscriptions…</strong></div>
              ) : memberships.length === 0 ? (
                <div className="empty-pass-state">
                  <strong>No subscriptions are available to settle.</strong>
                  <p>Create a membership from Discover, then return here when its first charge is due.</p>
                  <button className="primary-button" onClick={() => setTab('home')}>Explore memberships</button>
                </div>
              ) : (
                <div className="charge-queue">
                  {memberships.map((membership) => {
                    const state = statusLabels[membership.status] ?? 'Unknown'
                    const dueNow = membership.nextChargeAt * 1000n <= BigInt(Date.now())
                    const hasCapacity = membership.charges < membership.chargeLimit
                    const canCharge = membership.status === 1 && dueNow && hasCapacity
                    const isBusy = merchantActionId === membership.id
                    const availability =
                      membership.status === 2
                        ? 'Resume required'
                        : membership.status === 3
                          ? 'Cancelled'
                          : membership.status === 4 || !hasCapacity
                            ? 'Charge limit complete'
                            : dueNow
                              ? 'Due now'
                              : `Next: ${formatChargeTime(membership.nextChargeAt)}`

                    return (
                      <article key={membership.id.toString()} className={`charge-row row-${membership.accent}`}>
                        <span className="membership-badge">{membership.name.slice(0, 2).toUpperCase()}</span>
                        <div className="charge-copy">
                          <span className={`state-pill state-${state.toLowerCase()}`}>{state}</span>
                          <h3>{membership.name}</h3>
                          <small>Subscription #{membership.id.toString()}</small>
                        </div>
                        <div className="charge-details">
                          <span>{availability}</span>
                          <strong>{formatToken(membership.amount)} {TEST_TOKEN_LABEL}</strong>
                          <small>{membership.charges} / {membership.chargeLimit} charges settled</small>
                        </div>
                        <button
                          className="primary-button charge-button"
                          onClick={() => chargeMembership(membership)}
                          disabled={!canCharge || merchantActionId !== null || !isCorrectChain}
                        >
                          {isBusy ? 'Settling…' : canCharge ? `Charge ${formatToken(membership.amount)} ${TEST_TOKEN_LABEL}` : availability}
                        </button>
                      </article>
                    )
                  })}
                </div>
              )}
            </div>
          </section>
        )}

        {tab === 'proofs' && (
          <section className="section inner-page proof-page">
            <span className="eyebrow">RECEIPTS & PROOF CENTER</span>
            <h1>Every important action, linked to Minato.</h1>
            <p className="page-lead">Live event records from MandateProtocol. Open any transaction in Blockscout or download a portable JSON receipt.</p>

            <div className="proof-summary-grid">
              <article><span>Confirmed operations</span><strong>{proofs.length}</strong><small>Loaded from chain logs</small></article>
              <article><span>Settled value</span><strong>{formatToken(proofs.filter((proof) => proof.kind === 'Payment settled').reduce((sum, proof) => sum + (proof.amount ?? 0n), 0n))}</strong><small>{TEST_TOKEN_LABEL}</small></article>
              <article><span>Protocol</span><strong className="proof-address">{env.protocolAddress.slice(0, 8)}…{env.protocolAddress.slice(-6)}</strong><a href={`https://soneium-minato.blockscout.com/address/${env.protocolAddress}`} target="_blank" rel="noreferrer">Open contract</a></article>
            </div>

            <div className="proof-token-note">
              <strong>{TEST_TOKEN_LABEL}</strong>
              <span>{TEST_TOKEN_NOTE} {PRODUCTION_TOKEN_NOTE}</span>
            </div>

            {!isConnected ? (
              <div className="empty-pass-state"><strong>Connect your wallet to load its proof history.</strong><button className="primary-button" onClick={connectWallet}>Connect wallet</button></div>
            ) : proofsLoading ? (
              <div className="empty-pass-state"><strong>Reading confirmed Minato events…</strong></div>
            ) : proofsMessage ? (
              <p className="passes-message">{proofsMessage}</p>
            ) : proofs.length === 0 ? (
              <div className="empty-pass-state"><strong>No confirmed operations found for this account.</strong></div>
            ) : (
              <div className="proof-list">
                {proofs.map((proof) => (
                  <article className="proof-row-card" key={proof.id}>
                    <span className="proof-kind">{proof.kind}</span>
                    <div className="proof-copy">
                      <strong>{proof.subscriptionId ? `Subscription #${proof.subscriptionId.toString()}` : 'Vault activity'}</strong>
                      <p>{proof.detail}</p>
                    </div>
                    <div className="proof-meta">
                      {proof.amount !== undefined && <strong>{formatToken(proof.amount)} {TEST_TOKEN_LABEL}</strong>}
                      <span>{proof.timestamp ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(Number(proof.timestamp) * 1000)) : `Block ${proof.blockNumber.toString()}`}</span>
                      <code>{proof.transactionHash.slice(0, 10)}…{proof.transactionHash.slice(-8)}</code>
                    </div>
                    <div className="proof-actions">
                      <button className="secondary-button" onClick={() => openExplorer(proof.transactionHash)}>Explorer</button>
                      <button className="receipt-button" onClick={() => downloadProof(proof)}>Download receipt</button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
        {tab === 'developers' && (
          <section className="section inner-page developer-page">
            <span className="eyebrow">MANDATE DEVELOPER KIT</span>
            <h1>Drop-in paid access for every Startale Mini App.</h1>
            <p className="page-lead">Use one typed SDK for membership plans, bounded payments, access decisions, merchant settlement and user-controlled exits.</p>

            <div className="sdk-status-grid">
              <article><span>SDK</span><strong>@mandate/sdk v0.8</strong><small>Typed viem client</small></article>
              <article><span>Network</span><strong>{mandateMinatoDeployment.chainName}</strong><small>Chain ID {mandateMinatoDeployment.chainId}</small></article>
              <article><span>Protocol</span><strong>{mandateMinatoDeployment.protocolAddress.slice(0, 10)}…{mandateMinatoDeployment.protocolAddress.slice(-6)}</strong><small>Live testnet deployment</small></article>
              <article><span>Wallet surface</span><strong>Host + browser</strong><small>Startale or injected wallet</small></article>
            </div>

            <div className="developer-token-note"><strong>Production asset: USDSC</strong><span>The Minato preview uses {TEST_TOKEN_LABEL}, a valueless mock token, while production deployments target Startale USD (USDSC).</span></div>

            <div className="developer-install-card">
              <div><span className="eyebrow">INSTALL</span><strong>Two dependencies. No custom indexer required.</strong></div>
              <code>{installSnippet}</code>
              <button className="secondary-button" onClick={() => copyDeveloperSnippet('install', installSnippet)}>{copiedDeveloperSnippet === 'install' ? 'Copied' : 'Copy'}</button>
            </div>

            <div className="developer-workbench">
              <div className="code-card">
                <div className="code-head"><span>Access gate · TypeScript</span><button onClick={() => copyDeveloperSnippet('access', accessSnippet)}>{copiedDeveloperSnippet === 'access' ? 'Copied' : 'Copy'}</button></div>
                <pre><code>{accessSnippet}</code></pre>
              </div>

              <article className="live-access-gate">
                <span className="eyebrow">LIVE SDK CHECK</span>
                <h2>Test a real Minato subscription.</h2>
                <p>The result comes from <code>MandateClient.checkAccess()</code>, including subscriber matching and paid-through access.</p>
                <label htmlFor="developer-subscription-id">Subscription ID</label>
                <div className="developer-check-row">
                  <input id="developer-subscription-id" inputMode="numeric" value={developerSubscriptionId} onChange={(event) => setDeveloperSubscriptionId(event.target.value)} />
                  <button className="primary-button" onClick={runDeveloperAccessCheck} disabled={developerChecking}>{developerChecking ? 'Checking…' : 'Check access'}</button>
                </div>
                {developerMessage && <p className="developer-check-message denied">{developerMessage}</p>}
                {developerDecision && (
                  <div className={`developer-decision ${developerDecision.granted ? 'granted' : 'denied'}`}>
                    <span>{developerDecision.granted ? 'ACCESS GRANTED' : 'ACCESS DENIED'}</span>
                    <strong>{developerDecision.reason.replaceAll('-', ' ')}</strong>
                    {developerDecision.subscription && <small>Subscription #{developerDecision.subscription.id.toString()} · Plan #{developerDecision.subscription.planId.toString()}</small>}
                    {developerDecision.subscription && developerDecision.subscription.paidUntil > 0n && <small>Paid through {new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(Number(developerDecision.subscription.paidUntil) * 1000))}</small>}
                  </div>
                )}
              </article>
            </div>

            <div className="code-card developer-transaction-code">
              <div className="code-head"><span>Bounded membership flow · TypeScript</span><button onClick={() => copyDeveloperSnippet('transactions', transactionSnippet)}>{copiedDeveloperSnippet === 'transactions' ? 'Copied' : 'Copy'}</button></div>
              <pre><code>{transactionSnippet}</code></pre>
            </div>

            <div className="developer-points">
              <article><strong>Typed access decisions</strong><p>Distinguish active paid access, an unpaid subscription, expiry, cancellation and subscriber mismatch.</p></article>
              <article><strong>Failure-safe UX</strong><p>Wallet rejection, wrong network, low gas and protocol reverts map to stable user-facing messages.</p></article>
              <article><strong>Startale host ready</strong><p>The same write calls use the host wallet in a Mini App and an injected wallet on the standalone site.</p></article>
              <article><strong>No backend authority</strong><p>Plans, caps, paid periods and exits are enforced by MandateProtocol on Minato.</p></article>
            </div>
          </section>
        )}
      </main>
      <footer>
        <Logo />
        <p>Open-source membership infrastructure for Soneium. Testnet software — not audited.</p>
      </footer>
      <nav className="mobile-nav">
        <button className={tab === 'home' ? 'active' : ''} onClick={() => setTab('home')}>Discover</button>
        <button className={tab === 'passes' ? 'active' : ''} onClick={() => setTab('passes')}>Passes</button>
        <button className={tab === 'merchant' ? 'active' : ''} onClick={() => setTab('merchant')}>Merchant</button>
        <button className={tab === 'proofs' ? 'active' : ''} onClick={() => setTab('proofs')}>Proofs</button>
        <button className={tab === 'developers' ? 'active' : ''} onClick={() => setTab('developers')}>Developers</button>
      </nav>
      {selectedPlan && (
        <SubscribeSheet
          plan={selectedPlan}
          onClose={() => setSelectedPlan(null)}
          onCreated={refreshPasses}
        />
      )}
    </div>
  )
}
