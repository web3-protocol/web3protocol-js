const { normalize: ensNormalize } = require('viem/ens')
const { stringToHex } = require('viem');

const linagee = {
  address :"0x6023E55814DC00F094386d4eb7e17Ce49ab1A190",
  abi: [{
    "inputs": [ {"internalType": "bytes32","name": "_name","type": "bytes32"},
                {"internalType": "string","name": "_key","type": "string"}],
    "name": "getTextRecord",
    "outputs": [{"internalType": "string","name": "","type": "string"}],
    "stateMutability": "view",
    "type": "function"},
    {
      "inputs": [{ "internalType": "string", "name": "_domain", "type": "string"}],
      "name": "resolve",
      "outputs": [{ "internalType": "address", "name": "", "type": "address"}],
      "stateMutability": "view",
      "type": "function"
  }],
  domainAsBytes32(domainName){
    // og domains are stored in a bytes32
    if(domainName.length > 35)
      throw new Error("Domain too long (32 bytes max for .og");
    //og names must be converted from a string into a bytes hex string without og on the end
    let domainBytes32 = stringToHex(domainName.slice(0,-3), {size: 32});
    // pad the string properly
    while (domainBytes32.length < 66) {
      domainBytes32 += '0';
    }
    return domainBytes32;
  }
}

const linageeResolveDomainName = async (domainName, web3Client) => {
  let result = {
    resolver: 'linagee',
    resolverAddress: null,
    resolverChainId: null,
    resolvedName: null,
    resultAddress: null,
  }

  let address = await web3Client.readContract({ 
    address: linagee.address,
    abi: linagee.abi,
    functionName: "resolve",
    args: [ensNormalize(domainName)]
  });
  if(address == "0x0000000000000000000000000000000000000000") {
    throw new Error("Unable to resolve the argument as an ethereum .og address")
  }
  result.resultAddress = address;

  return result
}

const linageeResolveDomainNameInclErc6821 = async (domainName, web3Client, chainList) => {
  let result = {
    resolver: 'linagee',
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

  result.erc6821ContentContractTxt = await web3Client.readContract({ 
    address: linagee.address,
    abi: linagee.abi,
    functionName: "getTextRecord",
    args: [linagee.domainAsBytes32(result.resolvedName), 'contentcontract']
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
      result.resolverChainId = chainByShortName.id
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

    let nameResolution = await linageeResolveDomainName(domainName, web3Client, result);
    result.resultAddress = nameResolution.resultAddress;
  }

  return result
}


module.exports = { linageeResolveDomainName, linageeResolveDomainNameInclErc6821 };