export type Plan = {
  id: number
  name: string
  merchant: string
  price: number
  period: string
  description: string
  benefits: string[]
  badge: string
}

export const plans: Plan[] = [
  {
    id: 1,
    name: 'Arcade Pro Pass',
    merchant: 'Soneium Arcade',
    price: 5,
    period: '30 days',
    description: 'One pass for premium tournaments and weekly in-game drops.',
    benefits: ['Premium tournaments', 'Weekly item pack', 'Founding member badge'],
    badge: 'GAME PASS',
  },
  {
    id: 2,
    name: 'Creator Inner Circle',
    merchant: 'Studio Kizuna',
    price: 2,
    period: '30 days',
    description: 'Private releases, community rooms and event priority.',
    benefits: ['Members-only posts', 'Private community', 'Event priority'],
    badge: 'CREATOR CLUB',
  },
  {
    id: 3,
    name: 'Builder Toolkit',
    merchant: 'Open Builders',
    price: 3,
    period: '30 days',
    description: 'Advanced templates and recurring technical briefings.',
    benefits: ['Premium templates', 'Weekly briefings', 'Governance access'],
    badge: 'BUILDER',
  },
]
