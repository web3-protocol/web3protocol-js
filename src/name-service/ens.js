import { normalize as ensNormalize, namehash } from 'viem/ens'
import { encodeFunctionData, decodeFunctionResult } from 'viem'

const ensResolveDomainName = async (domainName, chainClient) => {
  let result = {
    resolver: 'ens',
    resolverAddress: null,
    resolverChainId: null,
    resolverChainRpc: null,
    resolvedName: null,
    resultAddress: null,
  }

  // We normalize the domain name
  result.resolvedName = ensNormalize(domainName)

  // Get resolver
  const nameHash = namehash(result.resolvedName)
  const getResolverAbi = [{
    type: 'function',
    name: 'resolver',
    inputs: [{type: 'bytes32'}],
    outputs: [{type: 'address'}],
    stateMutability: 'view',
  }];
  const {callResult: resolverAddressCall, decodedResult: resolverAddress} = await chainClient.callContract({
    abi: getResolverAbi,
    contractAddress: chainClient.infos().contracts.ensRegistry.address,
    functionName: 'resolver',
    args: [nameHash]
  })

  // Set the resolver name and address
  result.resolverAddress = resolverAddress
  result.resolverChainId = chainClient.infos().id
  result.resolverChainRpc = resolverAddressCall.rpcUrls[resolverAddressCall.rpcUrlUsedIndex]

  // Get address
  const getAddressAbi = [{
    type: 'function',
    name: 'addr',
    inputs: [{type: 'bytes32'}],
    outputs: [{type: 'address'}],
    stateMutability: 'view',
  }];
  const {callResult: getAddrCall, decodedResult: address} = await chainClient.callContract({
    abi: getAddressAbi,
    contractAddress: resolverAddress,
    functionName: 'addr',
    args: [nameHash]
  })

  if(address == null || address == "0x0000000000000000000000000000000000000000") {
    throw new Error("Unable to resolve the argument as an ethereum .eth address")
  }
  result.resultAddress = address;

  return result
}

const ensResolveDomainNameInclErc6821 = async (domainName, chainClient, chainList) => {
  let result = {
    resolver: 'ens',
    resolverAddress: null,
    resolverChainId: null,
    resolverChainRpc: null,
    resolvedName: null,
    // Enum, possibilities are
    // - direct: Direct domain name to address translation
    // - contentContractTxt: ERC-6821 Cross-chain resolution via the contentcontract TXT record
    resolutionType: null,
    // If resolutionType is erc6821, contains the content of the TXT record
    erc6821ContentContractTxt: null,
    // Result of the resolution
    resultAddress: null,
    resultChainId: null,
  }

  // We normalize the domain name
  result.resolvedName = ensNormalize(domainName)

  // Get resolver
  const nameHash = namehash(result.resolvedName)
  const getResolverAbi = [{
    type: 'function',
    name: 'resolver',
    inputs: [{type: 'bytes32'}],
    outputs: [{type: 'address'}],
    stateMutability: 'view',
  }];
  const {callResult: resolverAddressCall, decodedResult: resolverAddress} = await chainClient.callContract({
    abi: getResolverAbi,
    contractAddress: chainClient.infos().contracts.ensRegistry.address,
    functionName: 'resolver',
    args: [nameHash]
  })

  // Set the resolver name and address
  result.resolverAddress = resolverAddress
  result.resolverChainId = chainClient.infos().id
  result.resolverChainRpc = resolverAddressCall.rpcUrls[resolverAddressCall.rpcUrlUsedIndex]

  // Get ENS text
  const getTextAbi = [{
    type: 'function',
    name: 'text',
    inputs: [{type: 'bytes32'}, {type: 'string'}],
    outputs: [{type: 'string'}],
    stateMutability: 'view',
  }];
  const {callResult: getTextCall, decodedResult: contentContractTxt} = await chainClient.callContract({
    abi: getTextAbi,
    contractAddress: resolverAddress,
    functionName: 'text',
    args: [nameHash, "contentcontract"]
  })
  result.erc6821ContentContractTxt = contentContractTxt


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

    let nameResolution = await ensResolveDomainName(domainName, chainClient, result)
    result = {...result, ...nameResolution}
  }

  return result
}

export { ensResolveDomainName, ensResolveDomainNameInclErc6821 };