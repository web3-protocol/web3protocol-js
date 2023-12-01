import { normalize as ensNormalize, namehash } from 'viem/ens'
import { encodeFunctionData, decodeFunctionResult } from 'viem'

const ensResolveDomainNameInclErc6821 = async (domainName, chainClient, chainList) => {
  let result = {
    resolver: 'ens',
    resolverChainId: chainClient.chain().id,
    // The name about ot be resolved
    resolvedName: null,
    // The optional call to get the domain resolver (ENS does that)
    fetchNameResolverCall: null,
    // The call for the TXT record for the ERC-6821 record
    erc6821ContentContractTxtCall: null,
    // The optional call for domain resolution (unused if ERC-6821 resolution is successful)
    resolveNameCall: null,
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

  // Get resolver for this domain name
  const nameHash = namehash(result.resolvedName)
  result.fetchNameResolverCall = await ensGetDomainNameResolver(nameHash, chainClient)

  // Get ENS text
  result.erc6821ContentContractTxtCall = {
    contractAddress: result.fetchNameResolverCall.result.decodedResult,
    chaidId: chainClient.chain().id,
    result: null
  }
  const getTextAbi = [{
    type: 'function',
    name: 'text',
    inputs: [{type: 'bytes32'}, {type: 'string'}],
    outputs: [{type: 'string'}],
    stateMutability: 'view',
  }];
  result.erc6821ContentContractTxtCall.result = await chainClient.callContract({
    abi: getTextAbi,
    contractAddress: result.erc6821ContentContractTxtCall.contractAddress,
    functionName: 'text',
    args: [nameHash, "contentcontract"]
  })
  result.erc6821ContentContractTxt = result.erc6821ContentContractTxtCall.result.decodedResult

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

    result.resolveNameCall = await ensResolveDomainNameWithResolver(nameHash, chainClient, result.fetchNameResolverCall.result.decodedResult)
    result.resultAddress = result.resolveNameCall.result.decodedResult
  }

  return result
}

const ensResolveDomainName = async (domainName, chainClient) => {
  let result = {
    resolver: 'ens',
    resolverChainId: chainClient.chain().id,
    resolvedName: null,
    // The call to get the domain resolver
    fetchNameResolverCall: null,
    // The call for domain resolution
    resolveNameCall: null,
    // The actual result of the resolution
    resultAddress: null,
  }

  // We normalize the domain name
  result.resolvedName = ensNormalize(domainName)

  // Get resolver for this domain name
  const nameHash = namehash(result.resolvedName)
  result.fetchNameResolverCall = await ensGetDomainNameResolver(nameHash, chainClient)

  // Get address
  result.resolveNameCall = await ensResolveDomainNameWithResolver(nameHash, chainClient, result.fetchNameResolverCall.result.decodedResult)
  result.resultAddress = result.resolveNameCall.result.decodedResult

  return result
}

const ensGetDomainNameResolver = async(domainNameHash, chainClient) => {
  let result = {
    contractAddress: chainClient.chain().contracts.ensRegistry.address,
    chaidId: chainClient.chain().id,
    result: null
  }

  const getResolverAbi = [{
    type: 'function',
    name: 'resolver',
    inputs: [{type: 'bytes32'}],
    outputs: [{type: 'address'}],
    stateMutability: 'view',
  }];

  result.result = await chainClient.callContract({
    abi: getResolverAbi,
    contractAddress: result.contractAddress,
    functionName: 'resolver',
    args: [domainNameHash]
  })

  return result;
}

const ensResolveDomainNameWithResolver = async (domainNameHash, chainClient, resolverAddress) => {
  let result = {
      contractAddress: resolverAddress,
      chaidId: chainClient.chain().id,
      result: null
    }

  const getAddressAbi = [{
    type: 'function',
    name: 'addr',
    inputs: [{type: 'bytes32'}],
    outputs: [{type: 'address'}],
    stateMutability: 'view',
  }];

  result.result = await chainClient.callContract({
    abi: getAddressAbi,
    contractAddress: result.contractAddress,
    functionName: 'addr',
    args: [domainNameHash]
  })

  if(result.result.decodedResult == null || result.result.decodedResult == "0x0000000000000000000000000000000000000000") {
    throw new Error("Unable to resolve the argument as an ethereum .eth address")
  }
  
  return result;
}

export { ensResolveDomainName, ensResolveDomainNameInclErc6821 };