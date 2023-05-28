const { normalize: ensNormalize } = require('viem/ens')
const { linagee } = require('./linagee.js')
const { getChainByShortName } = require('../chains/index.js')

// Is it a supported domain name? (ENS, ...)
const isSupportedDomainName = (domainName, web3chain) => {
  return typeof domainName == 'string' && 
    // ENS is supported on mainnet, goerli and sepolia
    ((domainName.endsWith('.eth') && [1, 5, 11155111].includes(web3chain.id)) || 
    //Linagee is supported on mainnet
     (domainName.endsWith('.og') && [1].includes(web3chain.id)) );
}

// Attempt resolution of the domain name
// Must return an exception if failure
const resolveDomainName = async (domainName, web3Client) => {
  // ENS
  if(domainName.endsWith('.eth')) {
    let address = await web3Client.getEnsAddress({ name: ensNormalize(domainName) });
    if(address == null || address == "0x0000000000000000000000000000000000000000") {
      throw new Error("Unable to resolve the argument as an ethereum .eth address")
    }
    return address;
  }
  else if(domainName.endsWith('.og')){
    let address = await web3Client.readContract({ 
      address: linagee.address,
      abi: linagee.abi,
      functionName: "resolve",
      args: [ensNormalize(domainName)]
    });
    if(address == "0x0000000000000000000000000000000000000000") {
      throw new Error("Unable to resolve the argument as an ethereum .og address")
    }
    return address;
  }

  throw new Error('Unrecognized domain name : ' + domainName)
}

// Follow eip-6821 standard : if there is a contentcontract TXT record 
// with a common or EIP-3770 address, then go there. Otherwise, go to the resolved address.
const resolveDomainNameForEIP4804 = async (domainName, web3Client) => {
  let result = {
    address: null,
    chainId: null,
  };

  // ENS and Linagee contentContract support
  if(domainName.endsWith('.eth') || domainName.endsWith('.og')) {
    // Get the contentcontract TXT record
    let contentContractTxt;
    if(domainName.endsWith('.eth')){
      contentContractTxt = await web3Client.getEnsText({
        name: ensNormalize(domainName),
        key: 'contentcontract',
      });
    }
    else if(domainName.endsWith('.og')){
      contentContractTxt = await web3Client.readContract({ 
        address: linagee.address,
        abi: linagee.abi,
        functionName: "getTextRecord",
        args: [linagee.domainAsBytes32(ensNormalize(domainName)), 'contentcontract']
      });
    }

    // contentcontract TXT case
    if(contentContractTxt) {
      let contentContractTxtParts = contentContractTxt.split(':');
      // Simple address?
      if(contentContractTxtParts.length == 1) {
        if(/^0x[0-9a-fA-F]{40}/.test(contentContractTxt) == false) {
          throw new Error("Invalid address in contentcontract TXT record")
        }
        result.address = contentContractTxt;
      }
      // EIP-3770 address
      else if(contentContractTxtParts.length == 2) {
        // Search the chain by its chain short name
        let chainByShortName = getChainByShortName(contentContractTxtParts[0])
        if(chainByShortName == null) {
          throw new Error("The chain short name of the contentcontract TXT record was not found")
        }
        if(/^0x[0-9a-fA-F]{40}/.test(contentContractTxtParts[1]) == false) {
          throw new Error("Invalid address in contentcontract TXT record")
        }
        result.chainId = chainByShortName.chainId
        result.address = contentContractTxtParts[1]
      }
      // Mistake
      else {
        throw new Error("Invalid address in contentcontract TXT record")
      }
    }
    // No contentcontract TXT
    else {
      result.address = await resolveDomainName(domainName, web3Client);
    }
  }
  // All other domains
  else {
    result.address = await resolveDomainName(domainName, web3Client);
  }

  return result;
}


module.exports = { isSupportedDomainName, resolveDomainName, resolveDomainNameForEIP4804 };