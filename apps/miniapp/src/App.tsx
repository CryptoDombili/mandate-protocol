import { useEffect, useState } from 'react'
import { sdk } from '@farcaster/miniapp-sdk'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { Logo } from './components/Logo'
import { PlanCard } from './components/PlanCard'
import { SubscribeSheet } from './components/SubscribeSheet'
import { plans, type Plan } from './data'
import { env, hasDeployment } from './env'

const activeMemberships = [
  { name: 'Arcade Pro Pass', next: '18 Aug', amount: '5 mUSDC', state: 'Active' },
  { name: 'Creator Inner Circle', next: '24 Aug', amount: '2 mUSDC', state: 'Paused' },
]

export function App() {
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  const [tab, setTab] = useState<'home' | 'passes' | 'merchant' | 'developers'>('home')
  const { address, isConnected } = useAccount()
  const { connectors, connect, isPending } = useConnect()
  const { disconnect } = useDisconnect()

  useEffect(() => {
    sdk.actions.ready().catch(() => undefined)
  }, [])

  const shortAddress = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : ''

  function connectWallet() {
    const connector = connectors[0]
    if (connector) connect({ connector })
  }

  return (
    <div className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="topbar">
        <Logo />
        <nav className="desktop-nav" aria-label="Main navigation">
          <button className={tab === 'home' ? 'active' : ''} onClick={() => setTab('home')}>Discover</button>
          <button className={tab === 'passes' ? 'active' : ''} onClick={() => setTab('passes')}>My passes</button>
          <button className={tab === 'merchant' ? 'active' : ''} onClick={() => setTab('merchant')}>Merchant</button>
          <button className={tab === 'developers' ? 'active' : ''} onClick={() => setTab('developers')}>Developers</button>
        </nav>
        <button className="wallet-button" onClick={isConnected ? () => disconnect() : connectWallet} disabled={isPending}>
          <span className="wallet-light" />
          {isPending ? 'Connecting…' : isConnected ? shortAddress : 'Connect Startale'}
        </button>
      </header>

      <main>
        {tab === 'home' && (
          <>
            <section className="hero">
              <div className="hero-copy">
                <span className="eyebrow"><i /> BUILT FOR STARTALE MINI APPS</span>
                <h1>Memberships without unlimited wallet access.</h1>
                <p>
                  Mandate gives games, creators and communities a safe way to sell recurring access while users keep hard limits on every payment.
                </p>
                <div className="hero-actions">
                  <button className="primary-button" onClick={() => document.getElementById('plans')?.scrollIntoView({ behavior: 'smooth' })}>
                    Explore passes
                  </button>
                  <button className="secondary-button" onClick={() => setTab('developers')}>Read the protocol</button>
                </div>
                <div className="trust-row">
                  <span>NO UNLIMITED APPROVALS</span>
                  <span>USER-CONTROLLED CAPS</span>
                  <span>MINATO TESTNET</span>
                </div>
              </div>

              <div className="hero-panel">
                <div className="hero-panel-head">
                  <span>PAYMENT MANDATE</span>
                  <span className="verified">VERIFIED TERMS</span>
                </div>
                <div className="mandate-orbit">
                  <div className="orbit orbit-a" />
                  <div className="orbit orbit-b" />
                  <div className="core-mark"><Logo compact /></div>
                </div>
                <div className="term-list">
                  <div><span>Merchant</span><strong>Only registered app</strong></div>
                  <div><span>Token</span><strong>mUSDC only</strong></div>
                  <div><span>Limit</span><strong>5 per 30 days</strong></div>
                  <div><span>Control</span><strong>Pause or cancel</strong></div>
                </div>
              </div>
            </section>

            <section className="metric-strip">
              <div><strong>0</strong><span>admin fund access</span></div>
              <div><strong>1</strong><span>clear payment rule</span></div>
              <div><strong>100%</strong><span>withdrawable remainder</span></div>
              <div><strong>1946</strong><span>Soneium Minato</span></div>
            </section>

            <section className="section" id="plans">
              <div className="section-head">
                <div>
                  <span className="eyebrow">DISCOVER</span>
                  <h2>Passes built on bounded permissions</h2>
                </div>
                <p>Every plan states the merchant, token, interval, maximum number of charges and lifetime cap before approval.</p>
              </div>
              <div className="plan-grid">
                {plans.map((plan) => <PlanCard key={plan.id} plan={plan} onSelect={setSelectedPlan} />)}
              </div>
            </section>

            <section className="section protocol-section">
              <div>
                <span className="eyebrow">PROTOCOL STATUS</span>
                <h2>{hasDeployment ? 'Connected to the Minato deployment.' : 'Ready for the first Minato deployment.'}</h2>
                <p>
                  The interface is currently running in {env.demoMode ? 'demo' : 'onchain'} mode. Deploy the included contracts and paste the addresses into the environment file to activate real testnet actions.
                </p>
              </div>
              <div className="status-card">
                <div><span>Protocol</span><strong>{hasDeployment ? `${env.protocolAddress.slice(0, 8)}…` : 'Not deployed'}</strong></div>
                <div><span>Token</span><strong>{hasDeployment ? `${env.tokenAddress.slice(0, 8)}…` : 'Mock USDC pending'}</strong></div>
                <div><span>Network</span><strong>Soneium Minato</strong></div>
                <div><span>Safety state</span><strong className="green">Withdrawals always open</strong></div>
              </div>
            </section>
          </>
        )}

        {tab === 'passes' && (
          <section className="section inner-page">
            <span className="eyebrow">YOUR CONTROL CENTER</span>
            <h1>My passes</h1>
            <p className="page-lead">See upcoming charges, pause access, cancel future payments, or withdraw unused vault funds.</p>
            <div className="membership-list">
              {activeMemberships.map((membership) => (
                <article key={membership.name}>
                  <div><span className="status-dot">{membership.state.toUpperCase()}</span><h3>{membership.name}</h3></div>
                  <div className="membership-meta"><span>Next: {membership.next}</span><strong>{membership.amount}</strong></div>
                  <div className="membership-actions"><button>Pause</button><button>Cancel</button></div>
                </article>
              ))}
            </div>
          </section>
        )}

        {tab === 'merchant' && (
          <section className="section inner-page">
            <span className="eyebrow">MERCHANT STUDIO</span>
            <h1>Launch a plan with terms users can trust.</h1>
            <p className="page-lead">Prices are immutable. To change terms, publish a new plan so existing members never receive a silent price increase.</p>
            <div className="merchant-grid">
              <article><span>01</span><h3>Define the plan</h3><p>Choose token, amount, period, maximum charges and metadata.</p></article>
              <article><span>02</span><h3>Integrate access</h3><p>Check paid access through one read call or the TypeScript SDK.</p></article>
              <article><span>03</span><h3>Receive payments</h3><p>Due charges are transferred directly to the registered merchant address.</p></article>
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
        <button className={tab === 'developers' ? 'active' : ''} onClick={() => setTab('developers')}>Dev</button>
      </nav>

      {selectedPlan && <SubscribeSheet plan={selectedPlan} onClose={() => setSelectedPlan(null)} />}
    </div>
  )
}
