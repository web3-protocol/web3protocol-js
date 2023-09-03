const { createPublicClient, http, decodeAbiParameters } = require('viem');

const { parseManualUrl } = require('./mode/manual');
const { parseAutoUrl } = require('./mode/auto');
const { parse5219Url } = require('./mode/5219');
const { isSupportedDomainName, resolveDomainNameForEIP4804 } = require('./name-service/index')
const { createChainForViem } = require('./chains/index.js')
const JSONbig = require('json-bigint');

/**
 * For a given web3:// URL, parse it into components necessary to make the call.
 * Can throw exceptions in case of bad URL, or error during optional RPC calls (name resolution, ...)
 */
async function parseUrl(url, opts) {
  // Option defaults
  opts = opts || {}
  opts = {...{
      useEmbeddedChainRPCs: true,
      // Will add or override a chain RPC definition
      chains: [],
    }, ...opts}

  let result = {
    contractAddress: null,
    nameResolution: {
      chainId: null,
      resolvedName: null,
    },
    chainId: null,
    // Web3 mode: 'auto', 'manual' or '5219'
    mode: null,
    // How do we call the smartcontract
    // 'calldata' : We send the specified calldata
    // 'method': We use the specified method parameters
    contractCallMode: null,
    // For contractCallMode: calldata
    calldata: null,
    // For contractCallMode: method
    methodName: null,
    methodArgs: [],
    methodArgValues: [],
    methodReturn: [{type: 'string'}],
    // Enum, possibilities are:
    // - firstValue: Will return the first value of the result
    // - jsonEncode: Will json-encode the entries of the result, and return it as a single string
    // - dataUrl: Will parse the result as a data URL
    // - erc5219: Will parse the result following the ERC-5219 spec
    contractReturnProcessing: 'firstValue',
    contractReturnProcessingOptions: {
      // If contractReturnProcessing == 'firstValue', specify the mime type to use on the 
      // Content-Type HTTP header
      mimeType: null
    },
  }

  let matchResult = url.match(/^(?<protocol>[^:]+):\/\/(?<hostname>[^:\/]+)(:(?<chainId>[1-9][0-9]*))?(?<path>\/.*)?$/)
  if(matchResult == null) {
    throw new Error("Failed basic parsing of the URL");
  }
  let urlMainParts = matchResult.groups

  if(urlMainParts.protocol !== "web3") {
    throw new Error("Bad protocol name");
  }


  // Web3 network : if provided in the URL, use it, or mainnet by default
  let web3chain = createChainForViem(1, opts.useEmbeddedChainRPCs, opts.chains)
  // Was the network id specified?
  if(urlMainParts.chainId !== undefined && isNaN(parseInt(urlMainParts.chainId)) == false) {
    let web3ChainId = parseInt(urlMainParts.chainId);
    // Find the matching chain. Will throw an error if not found
    web3chain = createChainForViem(web3ChainId, opts.useEmbeddedChainRPCs, opts.chains)
  }
  result.chainId = web3chain.id

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
        throw new Error('Failed to resolve domain name ' + urlMainParts.hostname + ' : ' + err);
      }

      // Set contractAddress address
      result.contractAddress = resolutionInfos.address
      // We got an address on another chain? Update the chainId and the web3Client
      if(resolutionInfos.chainId) {
        result.chainId = resolutionInfos.chainId

        web3chain = createChainForViem(resolutionInfos.chainId, opts.useEmbeddedChainRPCs, opts.chains)
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
  if(['', 'auto', 'manual', '5219'].indexOf(resolveModeAsString) === -1) {
    throw new Error("web3 resolveMode '" + resolveModeAsString + "' is not supported")
  }
  if(resolveModeAsString == "manual") {
    result.mode = 'manual';
  }
  if(resolveModeAsString == "5219") {
    result.mode = '5219';
  }


  // Parse the URL per the selected mode
  if(result.mode == 'manual') {
    parseManualUrl(result, urlMainParts.path)
  }
  else if(result.mode == 'auto') {
    await parseAutoUrl(result, urlMainParts.path, web3Client)
  }
  else if(result.mode == '5219') {
    parse5219Url(result, urlMainParts.path)
  }

  return result
}


/**
 * Execute a parsed web3:// URL from parseUrl()
 */
async function fetchParsedUrl(parsedUrl, opts) {
  // Option defaults
  opts = opts || {}
  opts = {...{
      useEmbeddedChainRPCs: true,
      // Will add or override a chain RPC definition
      chains: [],
    }, ...opts}

  // Find the matching chain
  let web3chain = createChainForViem(parsedUrl.chainId, opts.useEmbeddedChainRPCs, opts.chains)
  if(web3chain == null) {
    throw new Error('No chain found for id ' + parsedUrl.chainId);
  }

  // Prepare the web3 client
  let web3Client = createPublicClient({
    chain: web3chain,
    transport: http(),
  });

  let contractReturn = null;
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

    contractReturn = Buffer.from(rawOutput[0].substr(2), "hex")
  }
  // Method call
  else if(parsedUrl.contractCallMode == 'method') {
    // Contract definition
    let abi = [
      {
        inputs: parsedUrl.methodArgs,
        name: parsedUrl.methodName,
        // Assuming string output
        outputs: parsedUrl.methodReturn,
        stateMutability: 'view',
        type: 'function',
      },
    ];
    let contract = {
      address: parsedUrl.contractAddress,
      abi: abi,
    };

    contractReturn = await web3Client.readContract({
      ...contract,
      functionName: parsedUrl.methodName,
      args: parsedUrl.methodArgValues,
    })
  }

  // Contract return processing
  let output = null
  let httpCode = 200
  let httpHeaders = {}
  if(parsedUrl.contractReturnProcessing == 'firstValue') {
    output = contractReturn

    if(parsedUrl.contractReturnProcessingOptions.mimeType) {
      httpHeaders['Content-Type'] = parsedUrl.contractReturnProcessingOptions.mimeType
    }
  } 
  else if(parsedUrl.contractReturnProcessing == 'jsonEncode') {
    output = ((contractReturn instanceof Array) == false) ? [contractReturn] : contractReturn
    output = JSONbig.stringify(output)
    output = Buffer.from(output)
    httpHeaders['Content-Type'] = 'application/json'
  }
  else if(parsedUrl.contractReturnProcessing == 'erc5219') {
    httpCode = contractReturn[0]
    output = contractReturn[1]
    for(let i = 0; i < contractReturn[2].length; i++) {
      httpHeaders[contractReturn[2][i][0]] = contractReturn[2][i][1];
    }
  } 

  let result = {
    parsedUrl: parsedUrl,
    output: output,
    httpCode: httpCode,
    httpHeaders: httpHeaders,
  }
  return result;
}

/**
 * Fetch a web3:// URL
 */
async function fetchUrl(url, opts) {

  let parsedUrl = await parseUrl(url, opts)
  let result = await fetchParsedUrl(parsedUrl, opts)

  return result;
}

module.exports = { parseUrl, fetchParsedUrl, fetchUrl };
