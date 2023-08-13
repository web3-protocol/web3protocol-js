const chainListJsonFileChains = require('./chainlist.js')
let viemChains = require('viem/chains');

function getChainList(useEmbeddedChainRPCs, chainOverrides) {
  // Fetch the chain list from chainid.network
  let originalChainList = chainListJsonFileChains

  // Make a simplified chain list, with RPCs and our overrides
  let chainList = []
  for(const originalChain of originalChainList) {
    // Fetch the RPCs and common contracts
    // Viem make a distinction between "public" and "default" RPCs, find out the diff later
    let publicRpcs = []
    let defaultRpcs = []
    let contracts = {}

    // If requested, we use the embedded RPCs of chainid.network and VIem
    if(useEmbeddedChainRPCs) {
      publicRpcs = originalChain.rpc.filter(rpc =>
        // Not containing a var such as https://mainnet.infura.io/v3/${INFURA_API_KEY}
        /\$\{[A-Z_]+\}/.test(rpc) == false &&
        // Starting with http[s]:// only
        /^http[s]?:\/\//.test(rpc)
      )
      defaultRpcs = [...publicRpcs]

      // If the chain is available in the viem.sh inventory, we use it as it contains better default
      // RPC URLs
      const viemChain = Object.values(viemChains).find(viemChain => viemChain.id == originalChain.chainId) || null
      if(viemChain) {
        publicRpcs = [...viemChain.rpcUrls.public.http]
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
    }

    let newChain = {
      id: originalChain.chainId,
      name: originalChain.name,
      rpcUrls: {
        public: { http: publicRpcs },
        default: { http: defaultRpcs },
      },
      contracts: contracts,
    }
    chainList.push(newChain)
  }

  // Process the chain overrides
  chainOverrides.forEach(chainOverride => {
    // Find if the chain already exist
    let alreadyDefinedChain = Object.entries(chainList).find(chain => chain[1].id == chainOverride.id) || null

    // If it exists, override RPCs
    if(alreadyDefinedChain) {
      chainList[alreadyDefinedChain[0]].rpcUrls.public.http = [...chainOverride.rpcUrls]
      chainList[alreadyDefinedChain[0]].rpcUrls.default.http = [...chainOverride.rpcUrls]
    }
    // If does not exist, create it
    else {
      let newChain = {
        id: chainOverride.id,
        name: 'custom-' + chainOverride.id,
        rpcUrls: {
          public: { http: [...chainOverride.rpcUrls] },
          default: { http: [...chainOverride.rpcUrls] },
        }
      }
      chainList.push(newChain)
    }
  })

  return chainList
}

// Create a web3 client in the format accepted by viem.sh
function createChainForViem(chainId, useEmbeddedChainRPCs, chainOverrides) {
  // Find the chain in the chainList inventory
  const chain = Object.values(getChainList(useEmbeddedChainRPCs, chainOverrides)).find(chain => chain.id == chainId)
  if(chain == undefined) {
    throw new Error("Chain not found for id " + chainId)
  }
  
  return chain
}

// Warn: This does not have the overriden RPC²s; do not use to get RPCs
function getChainByShortName(shortName) {
  const result = Object.values(chainListJsonFileChains).find(chain => chain.shortName == shortName)

  if(result == undefined) {
    throw new Error("Chain not found for short name " + shortName)
  }

  return result
}


module.exports = { getChainByShortName, createChainForViem }