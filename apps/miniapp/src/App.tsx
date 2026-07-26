import { useCallback, useEffect, useState } from 'react'
import { sdk } from '@farcaster/miniapp-sdk'
import { formatUnits } from 'viem'
import { useAccount, useConnect, useDisconnect, usePublicClient, useWriteContract } from 'wagmi'
import { Logo } from './components/Logo'
import { PlanCard } from './components/PlanCard'
import { SubscribeSheet } from './components/SubscribeSheet'
import { plans, type Plan } from './data'
import { env, hasDeployment } from './env'
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

function getErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'shortMessage' in error) {
    return String((error as { shortMessage?: unknown }).shortMessage ?? 'Transaction failed.')
  }
  return error instanceof Error ? error.message : 'Transaction failed.'
}

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


export function App() {
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  const [tab, setTab] = useState<'home' | 'passes' | 'merchant' | 'developers'>('home')
  const { address, isConnected } = useAccount()
  const { connectors, connectAsync, isPending } = useConnect()
  const { disconnect } = useDisconnect()
  const publicClient = usePublicClient()
  const { writeContractAsync } = useWriteContract()
  const [memberships, setMemberships] = useState<LiveMembership[]>([])
  const [passesLoading, setPassesLoading] = useState(false)
  const [passesMessage, setPassesMessage] = useState('')
  const [walletTokenBalance, setWalletTokenBalance] = useState(0n)
  const [vaultTokenBalance, setVaultTokenBalance] = useState(0n)
  const [actionId, setActionId] = useState<bigint | null>(null)
  const [merchantActionId, setMerchantActionId] = useState<bigint | null>(null)
  const [merchantMessage, setMerchantMessage] = useState('')

  useEffect(() => {
    sdk.actions.ready().catch(() => undefined)
  }, [])

  const isEmbedded = typeof window !== 'undefined' && window.parent !== window
  const shortAddress = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : ''

  async function connectWallet() {
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
      window.alert(
        isEmbedded
          ? 'Startale host wallet could not be detected. Open this page through the Startale Mini App preview.'
          : 'MetaMask could not be detected. Please unlock the MetaMask extension and try again.',
      )
      return
    }

    try {
      await connectAsync({ connector, chainId: 1946 })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Wallet connection failed.'
      console.error('Wallet connection failed:', error)
      window.alert(message)
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

      const subscriptionIds = [...new Set(logs.map((log) => log.args.subscriptionId.toString()))].map(BigInt)
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

          return {
            id: subscriptionId,
            planId: subscription[0],
            name: localPlan?.name ?? plan[6].split('/').at(-1)?.replaceAll('-', ' ') ?? `Plan ${subscription[0]}`,
            amount: plan[2],
            nextChargeAt: subscription[5],
            paidUntil: subscription[6],
            status: subscription[9],
            chargeLimit: subscription[7],
            charges: subscription[8],
            accent: localPlan?.accent ?? 'violet',
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
    if (tab === 'passes' || tab === 'merchant') void refreshPasses()
  }, [tab, refreshPasses])

  async function runMembershipAction(membership: LiveMembership, action: 'pause' | 'resume' | 'cancel') {
    if (!publicClient) return
    setActionId(membership.id)
    setPassesMessage('')
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
    if (!publicClient || vaultTokenBalance === 0n) return
    setActionId(-1n)
    setPassesMessage('')
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
    setMerchantActionId(membership.id)
    setMerchantMessage('')
    try {
      const hash = await writeContractAsync({
        address: env.protocolAddress,
        abi: protocolReadAbi,
        functionName: 'charge',
        args: [membership.id],
      })
      await publicClient.waitForTransactionReceipt({ hash })
      setMerchantMessage(
        `${formatToken(membership.amount)} mUSDC settled for subscription #${membership.id.toString()}.`,
      )
      await refreshPasses()
    } catch (error) {
      setMerchantMessage(getErrorMessage(error))
    } finally {
      setMerchantActionId(null)
    }
  }

  return (
    <div className="app-shell">
      <div className="page-glow glow-one" />
      <div className="page-glow glow-two" />

      <div className="announcement">
        <span>Minato preview</span>
        User-controlled memberships for Startale Mini Apps.
      </div>
      <header className="topbar">
        <Logo />
        <nav className="desktop-nav" aria-label="Main navigation">
          <button className={tab === 'home' ? 'active' : ''} onClick={() => setTab('home')}>Discover</button>
          <button className={tab === 'passes' ? 'active' : ''} onClick={() => setTab('passes')}>My passes</button>
          <button className={tab === 'merchant' ? 'active' : ''} onClick={() => setTab('merchant')}>Merchant</button>
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
                    <strong>5 mUSDC</strong>
                    <small>Renews 18 Aug · Cap locked</small>
                  </article>
                  <article className="mini-membership coral-card">
                    <div className="mini-card-head"><span>CREATOR CLUB</span><i>CI</i></div>
                    <strong>2 mUSDC</strong>
                    <small>Renews 24 Aug · Cancel anytime</small>
                  </article>
                  <article className="mini-membership blue-card">
                    <div className="mini-card-head"><span>BUILDER TOOLKIT</span><i>BT</i></div>
                    <strong>3 mUSDC</strong>
                    <small>Renews 28 Aug · Terms verified</small>
                  </article>
                </div>
                <div className="spend-panel">
                  <div className="spend-title"><span>Monthly commitment</span><strong>10 / 20 mUSDC</strong></div>
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
            <section className="section" id="plans">
              <div className="section-head">
                <div>
                  <span className="eyebrow">DISCOVER</span>
                  <h2>Memberships with visible limits</h2>
                </div>
                <p>Every plan exposes the merchant, token, price, interval, charge count and lifetime cap before approval.</p>
              </div>
              <div className="plan-grid">
                {plans.map((plan) => <PlanCard key={plan.id} plan={plan} onSelect={setSelectedPlan} />)}
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
                <div><span>Token</span><strong>{hasDeployment ? `${env.tokenAddress.slice(0, 8)}…` : 'Mock USDC pending'}</strong></div>
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
                    <span>Wallet mUSDC</span>
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
                      disabled={vaultTokenBalance === 0n || actionId !== null}
                    >
                      {actionId === -1n ? 'Withdrawing…' : 'Withdraw all'}
                    </button>
                    <small>No admin can block this exit</small>
                  </article>
                </div>

                {passesMessage && <p className="passes-message">{passesMessage}</p>}

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
                            <strong>{formatToken(membership.amount)} mUSDC</strong>
                            <span>{membership.charges} / {membership.chargeLimit} charges used</span>
                          </div>
                          <div className="membership-actions">
                            {canPause && <button onClick={() => runMembershipAction(membership, 'pause')} disabled={isBusy}>{isBusy ? 'Waiting…' : 'Pause'}</button>}
                            {canResume && <button onClick={() => runMembershipAction(membership, 'resume')} disabled={isBusy}>{isBusy ? 'Waiting…' : 'Resume'}</button>}
                            {canCancel && <button className="danger-button" onClick={() => runMembershipAction(membership, 'cancel')} disabled={isBusy}>{isBusy ? 'Waiting…' : 'Cancel'}</button>}
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

              {merchantMessage && <p className="passes-message">{merchantMessage}</p>}

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
                          <strong>{formatToken(membership.amount)} mUSDC</strong>
                          <small>{membership.charges} / {membership.chargeLimit} charges settled</small>
                        </div>
                        <button
                          className="primary-button charge-button"
                          onClick={() => chargeMembership(membership)}
                          disabled={!canCharge || merchantActionId !== null}
                        >
                          {isBusy ? 'Settling…' : canCharge ? `Charge ${formatToken(membership.amount)} mUSDC` : availability}
                        </button>
                      </article>
                    )
                  })}
                </div>
              )}
            </div>
          </section>
        )}
        {tab === 'developers' && (
          <section className="section inner-page developer-page">
            <span className="eyebrow">OPEN INFRASTRUCTURE</span>
            <h1>One access layer for every Startale Mini App.</h1>
            <p className="page-lead">The SDK exposes deposits, subscriptions, access checks, pause, cancel and withdrawal with typed viem calls.</p>
            <div className="code-card">
              <div className="code-head"><span>TypeScript</span><button>Copy</button></div>
              <pre><code>{`import { MandateClient } from '@mandate/sdk'\n\nconst mandate = new MandateClient({\n  protocolAddress,\n  publicClient,\n  walletClient,\n  account,\n})\n\nconst active = await mandate.hasActiveAccess(42n)`}</code></pre>
            </div>
            <div className="developer-points">
              <article><strong>Immutable plan terms</strong><p>No silent price or interval changes.</p></article>
              <article><strong>Permissionless keeper</strong><p>Anyone may trigger a due charge; nobody may change the rules.</p></article>
              <article><strong>Exit always available</strong><p>Emergency pauses never block user withdrawals.</p></article>
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
