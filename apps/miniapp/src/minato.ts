import { useEffect, useMemo, useState } from 'react'
import { useAccount, useChainId, useSwitchChain } from 'wagmi'
import { formatMandateError } from '@mandate/sdk'

export const MINATO_CHAIN_ID = 1946
export const SONEIUM_MAINNET_CHAIN_ID = 1868
export const MINATO_CHAIN_NAME = 'Soneium Minato'

interface Eip1193Provider {
  request(args: { method: string; params?: readonly unknown[] }): Promise<unknown>
  on?(event: 'chainChanged', listener: (chainId: unknown) => void): void
  removeListener?(event: 'chainChanged', listener: (chainId: unknown) => void): void
}

function parseChainId(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isSafeInteger(value)) return value
  if (typeof value === 'bigint' && value <= BigInt(Number.MAX_SAFE_INTEGER)) return Number(value)
  if (typeof value !== 'string' || value.trim() === '') return undefined

  const parsed = value.startsWith('0x') || value.startsWith('0X')
    ? Number.parseInt(value.slice(2), 16)
    : Number.parseInt(value, 10)

  return Number.isSafeInteger(parsed) ? parsed : undefined
}

function chainName(chainId: number | undefined): string {
  if (chainId === MINATO_CHAIN_ID) return MINATO_CHAIN_NAME
  if (chainId === SONEIUM_MAINNET_CHAIN_ID) return 'Soneium Mainnet'
  return chainId ? `chain ${chainId}` : 'an unknown network'
}

export function useMinatoNetwork() {
  const { isConnected, connector } = useAccount()
  const reportedChainId = useChainId()
  const { switchChainAsync, isPending } = useSwitchChain()
  const [providerChainId, setProviderChainId] = useState<number | undefined>()
  const [isResolvingProviderChain, setIsResolvingProviderChain] = useState(false)

  const isEmbedded = typeof window !== 'undefined' && window.parent !== window
  const connectorLabel = `${connector?.id ?? ''} ${connector?.name ?? ''} ${connector?.type ?? ''}`.toLowerCase()
  const isEmbeddedStartale = isEmbedded && connectorLabel.includes('startale')

  useEffect(() => {
    if (!isConnected || !connector) {
      setProviderChainId(undefined)
      setIsResolvingProviderChain(false)
      return
    }

    let active = true
    let provider: Eip1193Provider | undefined

    const updateProviderChain = (value: unknown) => {
      const parsed = parseChainId(value)
      if (active && parsed !== undefined) setProviderChainId(parsed)
    }

    setIsResolvingProviderChain(true)
    void connector
      .getProvider()
      .then((value) => {
        if (!active) return
        provider = value as Eip1193Provider
        provider.on?.('chainChanged', updateProviderChain)
        return provider.request({ method: 'eth_chainId' })
      })
      .then((value) => {
        if (value !== undefined) updateProviderChain(value)
      })
      .catch(() => {
        if (active) setProviderChainId(undefined)
      })
      .finally(() => {
        if (active) setIsResolvingProviderChain(false)
      })

    return () => {
      active = false
      provider?.removeListener?.('chainChanged', updateProviderChain)
    }
  }, [connector, isConnected, reportedChainId])

  const effectiveChainId = providerChainId ?? reportedChainId
  const providerProbeRequired = isConnected && isEmbeddedStartale
  const isProviderChainKnown = !providerProbeRequired || providerChainId !== undefined
  const isCorrectChain = !isConnected || (isProviderChainKnown && effectiveChainId === MINATO_CHAIN_ID)
  const canSwitch = isConnected && !isEmbeddedStartale

  const writeBlockedReason = useMemo(() => {
    if (!isConnected) return 'Connect your wallet first.'
    if (!isProviderChainKnown || isResolvingProviderChain) {
      return 'Checking the Startale host wallet network. No transaction has been prepared.'
    }
    if (isCorrectChain) return ''
    if (isEmbeddedStartale) {
      return `Startale Preview is connected to ${chainName(effectiveChainId)}. Mandate's current contracts are on Soneium Minato, so transaction buttons are disabled. No funds can move.`
    }
    return `Your wallet is connected to ${chainName(effectiveChainId)}. Switch to Soneium Minato to continue.`
  }, [effectiveChainId, isConnected, isCorrectChain, isEmbeddedStartale, isProviderChainKnown, isResolvingProviderChain])

  async function switchToMinato(): Promise<{ ok: boolean; message?: string }> {
    if (!isConnected) return { ok: false, message: 'Connect your wallet first.' }
    if (!isProviderChainKnown || isResolvingProviderChain) {
      return { ok: false, message: writeBlockedReason }
    }
    if (effectiveChainId === MINATO_CHAIN_ID) return { ok: true }
    if (isEmbeddedStartale) {
      return { ok: false, message: writeBlockedReason }
    }

    try {
      await switchChainAsync({ chainId: MINATO_CHAIN_ID })
      return { ok: true }
    } catch (error) {
      return { ok: false, message: formatMandateError(error) }
    }
  }

  return {
    chainId: effectiveChainId,
    reportedChainId,
    providerChainId,
    isCorrectChain,
    isEmbeddedStartale,
    isProviderChainKnown,
    isResolvingProviderChain,
    isSwitching: isPending,
    canSwitch,
    writeBlockedReason,
    switchToMinato,
  }
}
