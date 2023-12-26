import * as viemChains from 'viem/chains'
import {default as chainListJsonFileChains} from './chainlist.js'


function getDefaultChainList() {
  // Fetch the chain list from chainid.network
  let originalChainList = chainListJsonFileChains

  // Make a simplified chain list, use the embedded RPCs of chainid.network and Viem
  let chainList = []
  for(const originalChain of originalChainList) {
    // Fetch the RPCs and common contracts
    let defaultRpcs = []
    let contracts = {}

    // We use the embedded RPCs of chainid.network and Viem
    defaultRpcs = originalChain.rpc.filter(rpc =>
      // Not containing a var such as https://mainnet.infura.io/v3/${INFURA_API_KEY}
      /\$\{[A-Z_]+\}/.test(rpc) == false &&
      // Starting with http[s]:// only
      /^http[s]?:\/\//.test(rpc)
    )

    // If the chain is available in the viem.sh inventory, we use it as it contains better default
    // RPC URLs
    const viemChain = Object.values(viemChains).find(viemChain => viemChain.id == originalChain.chainId) || null
    if(viemChain) {
      defaultRpcs = [...viemChain.rpcUrls.default.http]
      if(viemChain?.contracts?.ensRegistry) {
        contracts.ensRegistry = {
          address: viemChain.contracts.ensRegistry.address
        }
      }
      if(viemChain?.contracts?.ensUniversalResolver) {
        contracts.ensUniversalResolver = {
          address: viemChain.contracts.ensUniversalResolver.address,
          blockCreated: viemChain.contracts.ensUniversalResolver.blockCreated
        }
      }
      if(viemChain?.contracts?.multicall3) {
        contracts.multicall3 = {
          address: viemChain.contracts.multicall3.address,
          blockCreated: viemChain.contracts.multicall3.blockCreated
        }
      }
    }

    let newChain = {
      id: originalChain.chainId,
      name: originalChain.name,
      shortName: originalChain.shortName,
      rpcUrls: defaultRpcs,
      contracts: contracts,
    }
    chainList.push(newChain)
  }

  return chainList
}


export { getDefaultChainList }
