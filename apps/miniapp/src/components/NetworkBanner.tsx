import { useState } from 'react'
import { useMinatoNetwork } from '../minato'

export function NetworkBanner() {
  const {
    isCorrectChain,
    isEmbeddedStartale,
    isProviderChainKnown,
    isSwitching,
    canSwitch,
    writeBlockedReason,
    switchToMinato,
  } = useMinatoNetwork()
  const [message, setMessage] = useState('')

  if (isCorrectChain) return null

  async function handleSwitch() {
    setMessage('')
    const result = await switchToMinato()
    if (!result.ok) setMessage(result.message ?? 'Could not switch the wallet network.')
  }

  const title = !isProviderChainKnown
    ? 'Checking wallet network'
    : isEmbeddedStartale
      ? 'Startale Preview is read-only for this Minato deployment'
      : 'Wrong network'

  return (
    <div className={`network-banner ${isEmbeddedStartale ? 'host-network-banner' : ''}`} role="alert">
      <div>
        <strong>{title}</strong>
        <span>{writeBlockedReason}</span>
        {message && <small>{message}</small>}
      </div>
      {canSwitch && (
        <button type="button" onClick={() => void handleSwitch()} disabled={isSwitching}>
          {isSwitching ? 'Switching…' : 'Switch to Minato'}
        </button>
      )}
    </div>
  )
}
