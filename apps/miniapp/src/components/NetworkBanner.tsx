import { useState } from 'react'
import { useMinatoNetwork } from '../minato'

export function NetworkBanner() {
  const { isCorrectChain, isSwitching, switchToMinato } = useMinatoNetwork()
  const [message, setMessage] = useState('')

  if (isCorrectChain) return null

  async function handleSwitch() {
    setMessage('')
    const result = await switchToMinato()
    if (!result.ok) setMessage(result.message ?? 'Could not switch the wallet network.')
  }

  return (
    <div className="network-banner" role="alert">
      <div>
        <strong>Wrong network</strong>
        <span>Mandate only signs transactions on Soneium Minato. No action has been sent.</span>
        {message && <small>{message}</small>}
      </div>
      <button type="button" onClick={() => void handleSwitch()} disabled={isSwitching}>
        {isSwitching ? 'Switching…' : 'Switch to Minato'}
      </button>
    </div>
  )
}
