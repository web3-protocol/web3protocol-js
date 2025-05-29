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

    // Final manual overrides :
    // Ethereum mainnet :
    // Viem gives us https://cloudflare-eth.com as the only RPC, but this RPC
    // is flaky (weirdly, for ENS resolution calls, it tends to randomly revert execution)
    // So we add publicnode as the primary one, use cloudflare as the fallback
    if(originalChain.chainId == 1) {
      defaultRpcs = ['https://ethereum.publicnode.com', 'https://cloudflare-eth.com']
    }
    // Sepolia : 
    // Viem gives us https://rpc.sepolia.org but this RPC is not reliable
    // So we add the publicnode one as the primary one, use sepolia.org as the fallback
    if(originalChain.chainId == 11155111) {
      defaultRpcs = ['https://ethereum-sepolia-rpc.publicnode.com', 'https://rpc.sepolia.org']
    }
    // EthStorage : Shortnames && RPCs have been decided to be changed,
    // but they are not yet on chainid.network
    if(originalChain.chainId == 333) {
      originalChain.shortName = 'es'
    }
    if(originalChain.chainId == 3333) {
      originalChain.name = 'Sepolia - EthStorage';
      defaultRpcs = ['http://65.108.230.142:9545']
    }
    if(originalChain.chainId == 3335) {
      originalChain.name = 'Quarkchain L2 Testnet';
      defaultRpcs = ['https://rpc.beta.testnet.l2.quarkchain.io:8545']
    }
    if(originalChain.chainId == 3337) {
      originalChain.name = 'Quarkchain L2 - EthStorage';
      defaultRpcs = ['https://rpc.beta.testnet.l2.ethstorage.io:9596']
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