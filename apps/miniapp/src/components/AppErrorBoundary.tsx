import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State {
  failed: boolean
  reference: string
}

export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false, reference: '' }

  static getDerivedStateFromError(): State {
    return {
      failed: true,
      reference: `MND-${Date.now().toString(36).toUpperCase()}`,
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Mandate interface error:', error, info)
  }

  render() {
    if (!this.state.failed) return this.props.children

    return (
      <main className="fatal-error-shell" role="alert">
        <div className="fatal-error-card">
          <span>SAFE RECOVERY</span>
          <h1>The interface needs a refresh.</h1>
          <p>
            No onchain transaction is sent by this screen. Confirmed balances and memberships remain on Minato.
          </p>
          <div className="fatal-error-actions">
            <button type="button" onClick={() => window.location.reload()}>Reload Mandate</button>
            <a href="https://soneium-minato.blockscout.com" target="_blank" rel="noreferrer">Open Minato explorer</a>
          </div>
          <small>Reference: {this.state.reference}</small>
        </div>
      </main>
    )
  }
}
