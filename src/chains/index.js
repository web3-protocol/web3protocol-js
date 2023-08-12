const chainListJsonFileChains = require('./chainlist.js')
let viemChains = require('viem/chains');

function getChainIdNetworkChainList(useEmbeddedChainRPCs, chainOverrides) {
  let chainList = chainListJsonFileChains

  // If asked, erase all embedded RPC URLs
  if(useEmbeddedChainRPCs == false) {
    for(let i = 0; i < chainList.length; i++) {
      chainList[i].rpc = []
    }
  }

  // Process the chain overrides
  chainOverrides.forEach(chainOverride => {
    // Find if the chain already exist
    let alreadyDefinedChain = Object.entries(chainList).find(chain => chain[1].chainId == chainOverride.id) || null

    // If it exists, override RPCs
    if(alreadyDefinedChain) {
      chainList[alreadyDefinedChain[0]].rpc = chainOverride.rpcUrls
    }
    // If does not exist, create it
    else {
      chainList.push({
        chainId: chainOverride.id,
        name: 'custom-' + chainOverride.id,
        rpc: chainOverride.rpcUrls,
      })
    }
  })

  return chainList
}

// Warn: This does not have the overriden RPCs; do not use to get RPCs
function getChainByShortName(shortName) {
  const result = Object.values(chainListJsonFileChains).find(chain => chain.shortName == shortName)

  if(result == undefined) {
    throw new Error("Chain not found for short name " + shortName)
  }

  return result
}



// Create a web3 client in the format accepted by viem.sh
function createChainForViem(chainId, useEmbeddedChainRPCs, chainOverrides) {
  // Find the chain in the chainList inventory
  const chainListChain = Object.values(getChainIdNetworkChainList(useEmbeddedChainRPCs, chainOverrides)).find(chain => chain.chainId == chainId)
  if(chainListChain == undefined) {
    throw new Error("Chain not found for id " + chainId)
  }
  
  // If the chain is available in the viem.sh inventory, we use it as it contains better default
  // RPC URLs
  const viemChain = Object.values(viemChains).find(viemChain => viemChain.id == chainId) || null
  // If we found a chain from viem.sh, use it
  let web3chain = null
  if(viemChain) {
    web3chain = viemChain;

    // If asked, erase the default RPCs
    if(useEmbeddedChainRPCs == false) {
      web3chain.rpcUrls = {
        public: { http: [] },
        default: { http: [] },
      }
    }

    // If there is RPC override, apply it
    const chainOverride = chainOverrides.find(chainOverride => chainOverride.id == web3chain.id)
    if(chainOverride) {
      web3chain.rpcUrls = {
        public: { http: chainOverride.rpcUrls },
        default: { http: chainOverride.rpcUrls },
      }
    }
  }
  // If not found, we build it from the chain from chainList
  else {
    let rpcUrls = chainListChain.rpc.filter(rpc =>
      // Not containing a var such as https://mainnet.infura.io/v3/${INFURA_API_KEY}
      /\$\{[A-Z_]+\}/.test(rpc) == false &&
      // Starting with http[s]:// only
      /^http[s]?:\/\//.test(rpc)
    )

    web3chain = {
      id: chainListChain.chainId,
      name: chainListChain.name,
      // network: chain.name,
      rpcUrls: {
        public: { http: rpcUrls },
        default: { http: rpcUrls },
      }
    }
  }

  return web3chain
}


module.exports = { getChainByShortName, createChainForViem }