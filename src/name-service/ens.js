const { normalize: ensNormalize, namehash } = require('viem/ens')
const { encodeFunctionData, decodeFunctionResult } = require('viem');

const ensResolveDomainName = async (domainName, web3Client) => {
  let result = {
    resolver: 'ens',
    resolverAddress: null,
    resolverChainId: null,
    resolverChainRpc: null,
    resolvedName: null,
    resultAddress: null,
  }

  // Set the resolver name and address
  result.resolverAddress = web3Client.chain.contracts.ensUniversalResolver.address
  result.resolverChainId = web3Client.chain.id
  result.resolverChainRpc = web3Client.chain.rpcUrls.default.http[0]

  // We normalize the domain name
  result.resolvedName = ensNormalize(domainName)

  let address = await web3Client.getEnsAddress({ name: result.resolvedName });
  if(address == null || address == "0x0000000000000000000000000000000000000000") {
    throw new Error("Unable to resolve the argument as an ethereum .eth address")
  }
  result.resultAddress = address;

  return result
}

const ensResolveDomainNameInclErc6821 = async (domainName, web3Client, chainList) => {
  let result = {
    resolver: 'ens',
    resolverAddress: null,
    resolverChainId: null,
    resolverChainRpc: null,
    resolvedName: null,
    resultAddress: null,
    resultChainId: null,
    // Enum, possibilities are
    // - direct: Direct domain name to address translation
    // - contentContractTxt: ERC-6821 Cross-chain resolution via the contentcontract TXT record
    resolutionType: null,
    // If resolutionType is erc6821, contains the content of the TXT record
    erc6821ContentContractTxt: null,
  }

  // Set the resolver name and address
  result.resolverAddress = web3Client.chain.contracts.ensUniversalResolver.address
  result.resolverChainId = web3Client.chain.id
  result.resolverChainRpc = web3Client.chain.rpcUrls.default.http[0]

  // We normalize the domain name
  result.resolvedName = ensNormalize(domainName)

   // Get the contentcontract TXT record
  result.erc6821ContentContractTxt = await web3Client.getEnsText({
    name: result.resolvedName,
    key: 'contentcontract',
  });

  // contentcontract TXT case
  if(result.erc6821ContentContractTxt) {
    result.resolutionType = 'contentContractTxt'

    let contentContractTxtParts = result.erc6821ContentContractTxt.split(':');
    // Simple address?
    if(contentContractTxtParts.length == 1) {
      if(/^0x[0-9a-fA-F]{40}/.test(result.erc6821ContentContractTxt) == false) {
        throw new Error("Invalid address in contentcontract TXT record")
      }
      result.resultAddress = result.erc6821ContentContractTxt;
    }
    // EIP-3770 address
    else if(contentContractTxtParts.length == 2) {
      // Search the chain by its chain short name
      let chainByShortName = Object.values(chainList).find(chain => chain.shortName == contentContractTxtParts[0])
      if(chainByShortName == null) {
        throw new Error("The chain short name of the contentcontract TXT record was not found")
      }
      if(/^0x[0-9a-fA-F]{40}/.test(contentContractTxtParts[1]) == false) {
        throw new Error("Invalid address in contentcontract TXT record")
      }
      result.resultChainId = chainByShortName.id
      result.resultAddress = contentContractTxtParts[1]
    }
    // Mistake
    else {
      throw new Error("Invalid address in contentcontract TXT record")
    }
  }
  // No contentcontract TXT
  else {
    result.resolutionType = 'direct'

    let nameResolution = await ensResolveDomainName(domainName, web3Client, result)
    result = {...result, ...nameResolution}
  }

  return result
}

module.exports = { ensResolveDomainName, ensResolveDomainNameInclErc6821 };