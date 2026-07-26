import { sdk } from '@farcaster/miniapp-sdk'
import { startaleConnector } from '@startale/app-sdk'
import { connect, createConfig, getAccount, http } from '@wagmi/core'
import { sendTransaction, waitForTransactionReceipt } from '@wagmi/core/actions'
import { stringToHex } from 'viem'
import { soneium } from 'viem/chains'

const button = document.querySelector<HTMLButtonElement>('#run')
const status = document.querySelector<HTMLDivElement>('#status')

if (!button || !status) {
  throw new Error('Preview-check interface is incomplete.')
}

const config = createConfig({
  chains: [soneium],
  connectors: [startaleConnector({ appName: 'Mandate Preview Check' })],
  transports: {
    [soneium.id]: http('https://rpc.soneium.org/'),
  },
})

function setStatus(message: string, kind: 'info' | 'success' | 'error' = 'info') {
  status.textContent = message
  status.dataset.kind = kind
}

function getErrorMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    if ('shortMessage' in error && typeof error.shortMessage === 'string') return error.shortMessage
    if ('message' in error && typeof error.message === 'string') return error.message
  }
  return 'The transaction check failed.'
}

async function runCheck() {
  button.disabled = true
  setStatus('Connecting to the Startale host wallet…')

  try {
    await sdk.actions.ready().catch(() => undefined)

    let account = getAccount(config)
    if (!account.isConnected || !account.address) {
      const connector = config.connectors[0]
      if (!connector) throw new Error('Startale connector is unavailable.')
      await connect(config, { connector, chainId: soneium.id })
      account = getAccount(config)
    }

    if (!account.address) throw new Error('Startale account address was not returned.')
    if (account.chainId !== soneium.id) {
      throw new Error(`Wrong host network. Expected Soneium Mainnet (1868), received ${account.chainId ?? 'unknown'}.`)
    }

    setStatus('Waiting for Startale approval. Confirm only if the value is 0 ETH.')

    const hash = await sendTransaction(config, {
      to: '0x000000000000000000000000000000000000dEaD',
      value: 0n,
      data: stringToHex('Mandate Startale Preview Check'),
    })

    setStatus(`Transaction submitted: ${hash}. Waiting for confirmation…`)

    const receipt = await waitForTransactionReceipt(config, {
      chainId: soneium.id,
      hash,
      confirmations: 1,
    })

    const explorer = `https://soneium.blockscout.com/tx/${receipt.transactionHash}`
    status.dataset.kind = 'success'
    status.innerHTML = `Transaction signing passed. <a href="${explorer}" target="_blank" rel="noreferrer">Open receipt</a>`
    button.textContent = 'Transaction check passed'
  } catch (error) {
    setStatus(getErrorMessage(error), 'error')
    button.disabled = false
    button.textContent = 'Try safe check again'
  }
}

button.addEventListener('click', () => void runCheck())
