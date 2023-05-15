let web3Chains = require('viem/chains');
const { createPublicClient, http, decodeAbiParameters } = require('viem');

const { parseManualUrl } = require('./mode/manual');
const { parseAutoUrl } = require('./mode/auto');
const { isSupportedDomainName, resolveDomainNameForEIP4804 } = require('./name-service/index')

/**
 * For a given web3:// URL, parse it into components necessary to make the call.
 * Can throw exceptions in case of bad URL, or error during optional RPC calls (name resolution, ...)
 */
async function parseUrl(url) {
  let result = {
    contractAddress: null,
    nameResolution: {
      chainId: null,
      resolvedName: null,
    },
    chainId: null,
    // Web3 'mode': auto or 'manual'
    mode: null,
    // How do we call the smartcontract
    // 'calldata' : We send the specified calldata
    // 'method': We use the specified method parameters
    contractCallMode: null,
    // For contractCallMode: calldata
    calldata: null,
    // For contractCallMode: method
    methodName: null,
    methodArgTypes: [],
    methodArgValues: [],
    methodReturnTypes: ['string'],
    methodReturnJsonEncode: false,
    // The output shall be marked as being this mimetype
    mimeType: null
  }

  let matchResult = url.match(/^(?<protocol>[^:]+):\/\/(?<hostname>[^:\/]+)(:(?<chainId>[1-9][0-9]*))?(?<path>\/.*)?$/)
  if(matchResult == null) {
    throw new Error("Failed basic parsing of the URL");
  }
  urlMainParts = matchResult.groups

  if(urlMainParts.protocol !== "web3") {
    throw new Error("Bad protocol name");
  }


  // Web3 network : if provided in the URL, use it, or mainnet by default
  let web3chain = web3Chains["mainnet"];
  result.chainId = 1
  // Was the network id specified?
  if(urlMainParts.chainId !== undefined && isNaN(parseInt(urlMainParts.chainId)) == false) {
    let web3ChainId = parseInt(urlMainParts.chainId);
    // Find the matching chain
    web3chain = Object.values(web3Chains).find(chain => chain.id == web3ChainId)
    if(web3chain == null) {
      throw new Error('No chain found for id ' + web3ChainId);       
    }
    result.chainId = web3ChainId
  }


  // Prepare the web3 client
  let web3Client = createPublicClient({
    chain: web3chain,
    transport: http(),
  });

  // Contract address / Domain name
  // Is the hostname an ethereum address? 
  if(/^0x[0-9a-fA-F]{40}/.test(urlMainParts.hostname)) {
    result.contractAddress = urlMainParts.hostname;
  } 
  // Hostname is not an ethereum address, try name resolution
  else {
    if(isSupportedDomainName(urlMainParts.hostname, web3chain)) {
      // Debugging : Store the chain id of the resolver
      result.nameResolution.chainId = web3Client.chain.id;
      result.nameResolution.resolvedName = urlMainParts.hostname

      let resolutionInfos = null
      try {
        resolutionInfos = await resolveDomainNameForEIP4804(urlMainParts.hostname, web3Client)
      }
      catch(err) {
        throw new Error('Failed to resolve domain name ' + urlMainParts.hostname);
      }

      // Set contractAddress address
      result.contractAddress = resolutionInfos.address
      // We got an address on another chain? Update the web3Client
      if(resolutionInfos.chainId) {
        web3chain = Object.values(web3Chains).find(chain => chain.id == resolutionInfos.chainId)
        web3Client = createPublicClient({
          chain: web3chain,
          transport: http(),
        });
      }
    }
    // Domain name not supported in this chain
    else {
      throw new Error('Unresolvable domain name : ' + urlMainParts.hostname + ' : no supported resolvers found in this chain');
    }
  }


  // Determining the web3 mode
  // 2 modes :
  // - Auto : we parse the path and arguments and send them
  // - Manual : we forward all the path & arguments as calldata

  // Default is auto
  result.mode = "auto"

  // Detect if the contract is manual mode : resolveMode must returns "manual"
  let resolveMode = '';
  try {
    resolveMode = await web3Client.readContract({
      address: result.contractAddress,
      abi: [{
        inputs: [],
        name: 'resolveMode',
        outputs: [{type: 'bytes32'}],
        stateMutability: 'view',
        type: 'function',
      }],
      functionName: 'resolveMode',
      args: [],
    })
  }
  catch(err) {/** If call to resolveMode fails, we default to auto */}

  let resolveModeAsString = Buffer.from(resolveMode.substr(2), "hex").toString().replace(/\0/g, '');
  if(['', 'auto', 'manual'].indexOf(resolveModeAsString) === -1) {
    throw new Error("web3 resolveMode '" + resolveModeAsString + "' is not supported")
  }
  if(resolveModeAsString == "manual") {
    result.mode = 'manual';
  }


  // Parse the URL per the selected mode
  if(result.mode == 'manual') {
    parseManualUrl(result, urlMainParts.path)
  }
  else if(result.mode == 'auto') {
    await parseAutoUrl(result, urlMainParts.path, web3Client)
  }

  return result
}


/**
 * Execute a parsed web3:// URL from parseUrl()
 */
async function fetchParsedUrl(parsedUrl) {
  // Find the matching chain
  web3chain = Object.values(web3Chains).find(chain => chain.id == parsedUrl.chainId)
  if(web3chain == null) {
    throw new Error('No chain found for id ' + parsedUrl.chainId);
  }

  // Prepare the web3 client
  let web3Client = createPublicClient({
    chain: web3chain,
    transport: http(),
  });

  let output = null;
  // Raw calldata call
  if(parsedUrl.contractCallMode == 'calldata') {
    let rawOutput = await web3Client.call({
      to: parsedUrl.contractAddress,
      data: parsedUrl.calldata
    })

    // Looks like this is what happens when calling non-contracts
    if(rawOutput.data === undefined) {
      throw new Error("Looks like the address is not a contract.");
    }

    rawOutput = decodeAbiParameters([
        { type: 'bytes' },
      ],
      rawOutput.data,
    )

    output = Buffer.from(rawOutput[0].substr(2), "hex")
  }
  // Method call
  else if(parsedUrl.contractCallMode == 'method') {
    // Contract definition
    let abi = [
      {
        inputs: parsedUrl.methodArgTypes.map(x => ({type: x})),
        name: parsedUrl.methodName,
        // Assuming string output
        outputs: parsedUrl.methodReturnTypes.map(x => ({type: x})),
        stateMutability: 'view',
        type: 'function',
      },
    ];
    let contract = {
      address: parsedUrl.contractAddress,
      abi: abi,
    };

    output = await web3Client.readContract({
      ...contract,
      functionName: parsedUrl.methodName,
      args: parsedUrl.methodArgValues,
    })
  }

  if(parsedUrl.methodReturnJsonEncode) {
    if((output instanceof Array) == false) {
        output = [output]
      }
      output = JSON.stringify(output.map(x => "" + x))
  }

  let result = {
    output: output,
    mimeType: parsedUrl.mimeType
  }
  return result;
}

/**
 * Fetch a web3:// URL
 */
async function fetchUrl(url) {
  let parsedUrl = await parseUrl(url)
  let result = await fetchParsedUrl(parsedUrl)

  return result;
}

module.exports = { parseUrl, fetchParsedUrl, fetchUrl };