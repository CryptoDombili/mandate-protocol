import { useEffect, useState } from 'react'
import { sdk } from '@farcaster/miniapp-sdk'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { Logo } from './components/Logo'
import { PlanCard } from './components/PlanCard'
import { SubscribeSheet } from './components/SubscribeSheet'
import { plans, type Plan } from './data'
import { env, hasDeployment } from './env'

const activeMemberships = [
  { name: 'Arcade Pro Pass', next: '18 Aug', amount: '5 mUSDC', state: 'Active', accent: 'violet' },
  { name: 'Creator Inner Circle', next: '24 Aug', amount: '2 mUSDC', state: 'Paused', accent: 'coral' },
]

export function App() {
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  const [tab, setTab] = useState<'home' | 'passes' | 'merchant' | 'developers'>('home')
  const { address, isConnected } = useAccount()
  const { connectors, connectAsync, isPending } = useConnect()
  const { disconnect } = useDisconnect()

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
            <p className="page-lead">Review upcoming charges, pause access, cancel future payments or withdraw unused vault funds.</p>
            <div className="membership-list">
              {activeMemberships.map((membership) => (
                <article key={membership.name} className={`membership-row row-${membership.accent}`}>
                  <span className="membership-badge">{membership.name.slice(0, 2).toUpperCase()}</span>
                  <div><span className={`state-pill state-${membership.state.toLowerCase()}`}>{membership.state}</span><h3>{membership.name}</h3></div>
                  <div className="membership-meta"><span>Next charge {membership.next}</span><strong>{membership.amount}</strong></div>
                  <div className="membership-actions"><button>Pause</button><button className="danger-button">Cancel</button></div>
                </article>
              ))}
            </div>
          </section>
        )}
        {tab === 'merchant' && (
          <section className="section inner-page">
            <span className="eyebrow">MERCHANT STUDIO</span>
            <h1>Launch a plan with terms users can trust.</h1>
            <p className="page-lead">Prices are immutable. Changing terms means publishing a new plan, so existing members never receive a silent price increase.</p>
            <div className="merchant-grid">
              <article><span>01</span><h3>Define the plan</h3><p>Choose token, amount, period, maximum charges and metadata.</p></article>
              <article><span>02</span><h3>Integrate access</h3><p>Check paid access through one read call or the TypeScript SDK.</p></article>
              <article><span>03</span><h3>Receive payments</h3><p>Due charges move directly to the registered merchant address.</p></article>
            </div>
            <button className="primary-button">Open plan builder — next milestone</button>
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
      {selectedPlan && <SubscribeSheet plan={selectedPlan} onClose={() => setSelectedPlan(null)} />}
    </div>
  )
}
