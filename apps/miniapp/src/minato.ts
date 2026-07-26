import { useAccount, useChainId, useSwitchChain } from 'wagmi'
import { formatMandateError } from '@mandate/sdk'

export const MINATO_CHAIN_ID = 1946
export const MINATO_CHAIN_NAME = 'Soneium Minato'

export function useMinatoNetwork() {
  const { isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChainAsync, isPending } = useSwitchChain()
  const isCorrectChain = !isConnected || chainId === MINATO_CHAIN_ID

  async function switchToMinato(): Promise<{ ok: boolean; message?: string }> {
    if (!isConnected) return { ok: false, message: 'Connect your wallet first.' }
    if (chainId === MINATO_CHAIN_ID) return { ok: true }
    try {
      await switchChainAsync({ chainId: MINATO_CHAIN_ID })
      return { ok: true }
    } catch (error) {
      return { ok: false, message: formatMandateError(error) }
    }
  }

  return {
    chainId,
    isCorrectChain,
    isSwitching: isPending,
    switchToMinato,
  }
}
