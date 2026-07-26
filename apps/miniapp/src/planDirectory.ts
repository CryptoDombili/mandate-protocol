import { useCallback, useEffect, useState } from 'react'
import { formatUnits } from 'viem'
import { usePublicClient } from 'wagmi'
import { plans as fallbackPlans, type Plan } from './data'
import { env, hasDeployment } from './env'
import { protocolReadAbi, type PlanTuple } from './protocol'

const metadataPrefix = 'mandate://v1?'

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

function periodLabel(seconds: bigint): string {
  const days = Number(seconds) / 86_400
  if (Number.isInteger(days)) return days === 1 ? '1 day' : `${days} days`
  const hours = Number(seconds) / 3_600
  return hours === 1 ? '1 hour' : `${hours} hours`
}

function parseMetadata(uri: string): Partial<Plan> {
  if (!uri.startsWith(metadataPrefix)) return {}
  try {
    const params = new URLSearchParams(uri.slice(metadataPrefix.length))
    const accentValue = params.get('accent')
    const accent = accentValue === 'coral' || accentValue === 'blue' ? accentValue : 'violet'
    const benefits = (params.get('benefits') ?? '')
      .split('|')
      .map((benefit) => benefit.trim())
      .filter(Boolean)
      .slice(0, 4)

    return {
      name: params.get('name') || undefined,
      description: params.get('description') || undefined,
      benefits: benefits.length > 0 ? benefits : undefined,
      badge: params.get('badge') || undefined,
      accent,
      monogram: params.get('monogram') || undefined,
    }
  } catch {
    return {}
  }
}

export function usePlanDirectory() {
  const publicClient = usePublicClient()
  const [directoryPlans, setDirectoryPlans] = useState<Plan[]>([])
  const [plansLoading, setPlansLoading] = useState(false)
  const [plansError, setPlansError] = useState('')

  const refreshPlanDirectory = useCallback(async () => {
    if (!publicClient || !hasDeployment) {
      setDirectoryPlans(fallbackPlans)
      return
    }

    setPlansLoading(true)
    setPlansError('')
    try {
      const count = (await publicClient.readContract({
        address: env.protocolAddress,
        abi: protocolReadAbi,
        functionName: 'planCount',
      })) as bigint

      const planIds = Array.from({ length: Number(count) }, (_, index) => BigInt(index + 1))
      const onchain = await Promise.all(
        planIds.map(async (planId) => {
          const tuple = (await publicClient.readContract({
            address: env.protocolAddress,
            abi: protocolReadAbi,
            functionName: 'plans',
            args: [planId],
          })) as PlanTuple

          const local = fallbackPlans.find((plan) => BigInt(plan.id) === planId)
          const metadata = parseMetadata(tuple[6])
          const name = metadata.name ?? local?.name ?? `Plan #${planId.toString()}`
          const merchantAddress = tuple[0]
          const price = Number(formatUnits(tuple[2], 6))
          const monogram = metadata.monogram ?? local?.monogram ?? name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()

          return {
            id: Number(planId),
            name,
            merchant: local?.merchant ?? shortAddress(merchantAddress),
            merchantAddress,
            price,
            period: local?.period ?? periodLabel(tuple[3]),
            description: metadata.description ?? local?.description ?? 'A bounded recurring access plan published directly on Soneium Minato.',
            benefits: metadata.benefits ?? local?.benefits ?? ['Visible payment limit', 'Cancel at any time', 'Withdrawable unused balance'],
            badge: metadata.badge ?? local?.badge ?? 'ONCHAIN PLAN',
            accent: metadata.accent ?? local?.accent ?? 'violet',
            monogram,
            maxCharges: tuple[4] === 0 ? 3 : tuple[4],
            enabled: tuple[5],
          } satisfies Plan
        }),
      )

      setDirectoryPlans(onchain.filter((plan) => plan.enabled !== false))
    } catch (error) {
      console.error('Could not load plan directory:', error)
      setPlansError(error instanceof Error ? error.message : 'Could not load the Minato plan directory.')
      setDirectoryPlans(fallbackPlans)
    } finally {
      setPlansLoading(false)
    }
  }, [publicClient])

  useEffect(() => {
    void refreshPlanDirectory()
  }, [refreshPlanDirectory])

  return { directoryPlans, plansLoading, plansError, refreshPlanDirectory }
}
