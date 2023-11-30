import { ensResolveDomainName, ensResolveDomainNameInclErc6821 } from './ens.js'
import { linageeResolveDomainName, linageeResolveDomainNameInclErc6821 } from './linagee.js'

// For a given domain and chain, return a eligible resolver (ens, ...)
const getEligibleDomainNameResolver = (domainName, chainId) => {
  let result = null;

  if(typeof domainName == 'string' && 
    domainName.endsWith('.eth') && [1, 5, 11155111].includes(chainId)) {
    result = "ens";
  }
  else if(typeof domainName == 'string' && 
    domainName.endsWith('.og') && [1].includes(chainId)) {
    result = "linagee";
  }

  return result;
}

// Attempt resolution of the domain name
// Must return an exception if failure
const resolveDomainName = async (domainNameResolver, domainName, chainClient) => {
  let result = null;

  // ENS
  if(domainNameResolver == "ens") {
    result = ensResolveDomainName(domainName, chainClient, result)
  }
  else if(domainNameResolver == "linagee") {
    result = linageeResolveDomainName(domainName, chainClient, result)
  }
  else {
    throw new Error("Unknown resolver");
  }

  return result;
}

// Follow erc-6821 standard : if there is a contentcontract TXT record 
// with a common or EIP-3770 address, then go there. Otherwise, go to the resolved address.
const resolveDomainNameInclErc6821 = async (domainNameResolver, domainName, chainClient, chainList) => {
  let result = null

  // ENS
  if(domainNameResolver == "ens") {
     result = ensResolveDomainNameInclErc6821(domainName, chainClient, chainList)
  }
  // Linagee
  else if(domainNameResolver == "linagee") {
    result = linageeResolveDomainNameInclErc6821(domainName, chainClient, chainList)
  }
  else {
    throw new Error("Unknown resolver");
  }

  return result;
}


export { getEligibleDomainNameResolver, resolveDomainName, resolveDomainNameInclErc6821 };