import { getAddress } from 'viem'
import { openPremiumFeature } from './accessGate.js'

// Replace with a connected account and an onchain subscription id.
const account = getAddress('0x1aa5b1876782b4Aa61f5F74B39F6aB95dC60f3e8')
const result = await openPremiumFeature(1n, account)

console.log(JSON.stringify(result, null, 2))
