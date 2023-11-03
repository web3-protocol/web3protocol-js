const { ensResolveDomainName, ensResolveDomainNameInclErc6821 } = require('./ens.js')
const { linageeResolveDomainName, linageeResolveDomainNameInclErc6821 } = require('./linagee.js')

// For a given domain and chain, return a eligible resolver (ens, ...)
const getEligibleDomainNameResolver = (domainName, web3chain) => {
  let result = null;

  if(typeof domainName == 'string' && 
    domainName.endsWith('.eth') && [1, 5, 11155111].includes(web3chain.id)) {
    result = "ens";
  }
  else if(typeof domainName == 'string' && 
    domainName.endsWith('.og') && [1].includes(web3chain.id)) {
    result = "linagee";
  }

  return result;
}

// Attempt resolution of the domain name
// Must return an exception if failure
const resolveDomainName = async (domainNameResolver, domainName, web3Client) => {
  let result = null;

  // ENS
  if(domainNameResolver == "ens") {
    result = ensResolveDomainName(domainName, web3Client, result)
  }
  else if(domainNameResolver == "linagee") {
    result = linageeResolveDomainName(domainName, web3Client, result)
  }
  else {
    throw new Error("Unknown resolver");
  }

  return result;
}

// Follow erc-6821 standard : if there is a contentcontract TXT record 
// with a common or EIP-3770 address, then go there. Otherwise, go to the resolved address.
const resolveDomainNameInclErc6821 = async (domainNameResolver, domainName, web3Client, chainList) => {
  let result = null

  // ENS
  if(domainNameResolver == "ens") {
     result = ensResolveDomainNameInclErc6821(domainName, web3Client, chainList)
  }
  // Linagee
  else if(domainNameResolver == "linagee") {
    result = linageeResolveDomainNameInclErc6821(domainName, web3Client, chainList)
  }
  else {
    throw new Error("Unknown resolver");
  }

  return result;
}


module.exports = { getEligibleDomainNameResolver, resolveDomainName, resolveDomainNameInclErc6821 };