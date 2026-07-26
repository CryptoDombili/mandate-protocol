export type Plan = {
  id: number
  name: string
  merchant: string
  price: number
  period: string
  description: string
  benefits: string[]
  badge: string
  accent: 'violet' | 'coral' | 'blue'
  monogram: string
  maxCharges?: number
  merchantAddress?: string
  enabled?: boolean
}

export const plans: Plan[] = [
  {
    id: 1,
    name: 'Arcade Pro Pass',
    merchant: 'Soneium Arcade',
    price: 5,
    period: '30 days',
    description: 'Premium tournaments, weekly drops and a season-long member identity.',
    benefits: ['Premium tournaments', 'Weekly item pack', 'Founding member badge'],
    badge: 'GAME PASS',
    accent: 'violet',
    monogram: 'AP',
  },
  {
    id: 2,
    name: 'Creator Inner Circle',
    merchant: 'Studio Kizuna',
    price: 2,
    period: '30 days',
    description: 'Private releases, member rooms and priority access to live events.',
    benefits: ['Members-only posts', 'Private community', 'Event priority'],
    badge: 'CREATOR CLUB',
    accent: 'coral',
    monogram: 'CI',
  },
  {
    id: 3,
    name: 'Builder Toolkit',
    merchant: 'Open Builders',
    price: 3,
    period: '30 days',
    description: 'Advanced templates and recurring technical briefings for builders.',
    benefits: ['Premium templates', 'Weekly briefings', 'Governance access'],
    badge: 'BUILDER',
    accent: 'blue',
    monogram: 'BT',
  },
]
