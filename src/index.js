const { createPublicClient, http, decodeAbiParameters, hexToBytes, stringToBytes, encodeFunctionData } = require('viem');

const { parseManualUrl } = require('./mode/manual');
const { parseAutoUrl } = require('./mode/auto');
const { parseResourceRequestUrl, processResourceRequestContractReturn } = require('./mode/5219');
const { getEligibleDomainNameResolver, resolveDomainNameForEIP4804 } = require('./name-service/index')


class Client {
  #chainList = []

  constructor(chainList) {
    this.#chainList = chainList
  }

  /**
   * Fetch a web3:// URL
   */
  async fetchUrl(url) {

    let parsedUrl = await this.parseUrl(url)
    let contractReturn = await this.fetchContractReturn(parsedUrl)
    let result = await this.processContractReturn(parsedUrl, contractReturn)

    return result;
  }

  /**
   * Step 1 : Parse the URL and determine how we are going to call the main contract.
   */
  async parseUrl(url) {
    let result = {
      contractAddress: null,
      nameResolution: {
        resolver: null,
        chainId: null,
        resolvedName: null,
      },
      chainId: null,
      // Web3 mode: 'auto', 'manual' or 'resourceRequest'
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
      // Enum, possibilities are:
      // - decodeABIEncodedBytes: Will return the first value of the result
      // - jsonEncodeRawBytes: Will JSON-encode the raw bytes of the returned data
      // - jsonEncodeValues: Will JSON-encode the entries of the result, and return it as a single string
      // - dataUrl: Will parse the result as a data URL
      // - erc5219: Will parse the result following the ERC-5219 spec
      contractReturnProcessing: 'decodeABIEncodedBytes',
      contractReturnProcessingOptions: {
        // If contractReturnProcessing == 'decodeABIEncodedBytes', specify the mime type to use on the 
        // Content-Type HTTP header
        mimeType: null,
        // If contractReturnProcessing == 'jsonEncodeValues', specify the ABI definition to use to decode
        // the returned data
        jsonEncodedValueTypes: [],
      },
    }

    let matchResult = url.match(/^(?<protocol>[^:]+):\/\/(?<hostname>[^:\/?]+)(:(?<chainId>[1-9][0-9]*))?(?<path>.*)?$/)
    if(matchResult == null) {
      throw new Error("Failed basic parsing of the URL");
    }
    let urlMainParts = matchResult.groups

    // Check protocol name
    if(["web3", "w3"].includes(urlMainParts.protocol) == false) {
      throw new Error("Bad protocol name");
    }


    // Web3 network : if provided in the URL, use it, or mainnet by default
    result.chainId = 1
    // Was the network id specified?
    if(urlMainParts.chainId !== undefined && isNaN(parseInt(urlMainParts.chainId)) == false) {
      result.chainId = parseInt(urlMainParts.chainId);
    }
    // Find the matching chain. Will throw an error if not found
    let web3chain = this.#createChainForViem(result.chainId)

    // Prepare the web3 client
    let web3Client = createPublicClient({
      chain: web3chain,
      transport: http(),
    });

    // Contract address / Domain name
    // Is the hostname an ethereum address? 
    if(/^0x[0-9a-fA-F]{40}$/.test(urlMainParts.hostname)) {
      result.contractAddress = urlMainParts.hostname;
    } 
    // Hostname is not an ethereum address, try name resolution
    else {
      let domainNameResolver = getEligibleDomainNameResolver(urlMainParts.hostname, web3chain);
      if(domainNameResolver) {
        // Store infos about the name resolution
        result.nameResolution.resolver = domainNameResolver;
        result.nameResolution.chainId = web3Client.chain.id;
        result.nameResolution.resolvedName = urlMainParts.hostname

        let resolutionInfos = null
        try {
          resolutionInfos = await resolveDomainNameForEIP4804(urlMainParts.hostname, web3Client, this.#chainList)
        }
        catch(err) {
          throw new Error('Failed to resolve domain name ' + urlMainParts.hostname + ' : ' + err);
        }

        // Set contractAddress address
        result.contractAddress = resolutionInfos.address
        // We got an address on another chain? Update the chainId and the web3Client
        if(resolutionInfos.chainId) {
          result.chainId = resolutionInfos.chainId

          web3chain = this.#createChainForViem(resolutionInfos.chainId)
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
    // 3 modes :
    // - Auto : we parse the path and arguments and send them
    // - Manual : we forward all the path & arguments as calldata
    // - ResourceRequest : we parse the path and arguments and send them

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
      result.mode = 'resourceRequest';
    }


    // Parse the URL per the selected mode
    if(result.mode == 'manual') {
      parseManualUrl(result, urlMainParts.path)
    }
    else if(result.mode == 'auto') {
      await parseAutoUrl(result, urlMainParts.path, web3Client)
    }
    else if(result.mode == 'resourceRequest') {
      parseResourceRequestUrl(result, urlMainParts.path)
    }

    return result
  }

  /**
   * Step 2: Make the call to the main contract.
   */
  async fetchContractReturn(parsedUrl) {

    // Find the matching chain
    let web3chain = this.#createChainForViem(parsedUrl.chainId)
    if(web3chain == null) {
      throw new Error('No chain found for id ' + parsedUrl.chainId);
    }

    // Prepare the web3 client
    let web3Client = createPublicClient({
      chain: web3chain,
      transport: http(),
    });

    // Prepare calldata
    let calldata = null
    // Method call
    if (parsedUrl.contractCallMode == 'method') {
      let abi = [
        {
          inputs: parsedUrl.methodArgs,
          name: parsedUrl.methodName,
          stateMutability: 'view',
          type: 'function',
        },
      ];
      calldata = encodeFunctionData({
        abi: abi,
        args: parsedUrl.methodArgValues,
        functionName: parsedUrl.methodName,
      })
    }
    // Raw calldata call
    else if(parsedUrl.contractCallMode == 'calldata') {
      calldata = parsedUrl.calldata
    }

    // Do the contract call
    let rawOutput = await web3Client.call({
      to: parsedUrl.contractAddress,
      data: calldata
    })

    // Looks like this is what happens when calling non-contracts
    if(rawOutput.data === undefined) {
      throw new Error("Looks like the address is not a contract.");
    }

    return rawOutput.data;
  }

  /**
   * Execute a parsed web3:// URL from parseUrl().
   * Returns an http code, http headers, and a Uint8Array body.
   */
  async processContractReturn(parsedUrl, contractReturn) {
    // Contract return processing
    let fetchedUrl = {
      httpCode: 200,
      httpHeaders: {},
      output: [], // Array of uint8 (bytes array)
      parsedUrl: parsedUrl,
    }

    if(parsedUrl.contractReturnProcessing == 'decodeABIEncodedBytes') {
      // Do the ABI decoding, receive the bytes in hex string format
      let decodedContractReturn = decodeAbiParameters([{ type: 'bytes' }], contractReturn)
      // Convert it into a Uint8Array byte buffer
      fetchedUrl.output = hexToBytes(decodedContractReturn[0])

      if(parsedUrl.contractReturnProcessingOptions.mimeType) {
        fetchedUrl.httpHeaders['Content-Type'] = parsedUrl.contractReturnProcessingOptions.mimeType
      }
    }
    else if(parsedUrl.contractReturnProcessing == 'jsonEncodeRawBytes') {
      // JSON-encode the contract return in hex string format inside an array
      let jsonData = JSON.stringify([contractReturn])
      // Convert it into a Uint8Array byte buffer
      fetchedUrl.output = stringToBytes(jsonData)

      fetchedUrl.httpHeaders['Content-Type'] = 'application/json'
    }
    else if(parsedUrl.contractReturnProcessing == 'jsonEncodeValues') {
      // Do the ABI decoding, get the vars
      let decodedContractReturn = decodeAbiParameters(parsedUrl.contractReturnProcessingOptions.jsonEncodedValueTypes, contractReturn)
      // JSON-encode them
      // (If we have some bigInts, convert them into hex string)
      let jsonEncodedValues = JSON.stringify(decodedContractReturn, 
        (key, value) => typeof value === "bigint" ? "0x" + value.toString(16) : value)
      // Convert it into a Uint8Array byte buffer
      fetchedUrl.output = stringToBytes(jsonEncodedValues)

      fetchedUrl.httpHeaders['Content-Type'] = 'application/json'
    }
    else if(parsedUrl.contractReturnProcessing == 'decodeErc5219Request') {
      processResourceRequestContractReturn(fetchedUrl, contractReturn)
    } 

    return fetchedUrl;
  }


  // Create a web3 client in the format accepted by the viem.sh lib
  #createChainForViem(chainId) {
    const chain = Object.values(this.#chainList).find(chain => chain.id == chainId)
    if(chain == undefined) {
      throw new Error("Chain not found for id " + chainId)
    }
    let viewChain = {
      id: chain.id,
      name: chain.name,
      shortName: chain.shortName,
      rpcUrls: {
        default: { http: chain.rpcUrls },
      },
      contracts: chain.contracts,
    }

    return viewChain
  }
}

module.exports = { Client };
