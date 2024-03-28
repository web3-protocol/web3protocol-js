import { decodeAbiParameters, hexToBytes, stringToBytes, encodeFunctionData } from 'viem';

import { parseManualUrl }  from './mode/manual.js';
import { parseAutoUrl } from './mode/auto.js';
import { parseResourceRequestUrl, processResourceRequestContractReturn } from './mode/5219.js';
import { Resolver as DomainNameResolver } from './name-service/index.js';
import { Determinator as ResolveModeDeterminator } from './mode/determinator.js';
import { ChainClientProvider } from './chains/client.js'


class Client {
  #chainList = []
  #chainClientProvider = null
  #domainNameResolver = null
  #resolveModeDeterminator = null
  #opts = []

  constructor(chainList, opts) {
    this.#chainList = chainList
    this.#opts = {...{
      // Enum, possibilities are
      // - fallback: One is tried after the other
      // - parallel : All RPCs are called in parralel, the first to answer is used
      multipleRpcMode: 'fallback',

      // Options for caching of domain names.
      domainNameResolverCache: null,

      // Options for caching of resolve modes.
      resolveModeDeterminatorCache: null,
    }, ...opts}

    // Manual enum check...
    if(this.#opts.multipleRpcMode != 'fallback' && this.#opts.multipleRpcMode != 'parallel') {
      throw new Error("Bad value for multipleRpcMode option. Valid values: fallback, parallel")
    }

    this.#chainClientProvider = new ChainClientProvider(chainList, {
      multipleRpcMode: this.#opts.multipleRpcMode
    })

    this.#domainNameResolver = new DomainNameResolver(this.#opts.domainNameResolverCache);

    this.#resolveModeDeterminator = new ResolveModeDeterminator(this.#opts.resolveModeDeterminatorCache);
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
      url: url
    }

    // Step 1.1 : Extract parts of the URL, determine if a chain id was provided.
    let {urlMainParts, chainId} = this.parseUrlBasic(url)
    result.chainId = chainId
    
    // Step 1.2 : For a given hostname, determine the target contract address.
    let {contractAddress, chainId: updatedChainId, nameResolution} = await this.determineTargetContractAddress(urlMainParts.hostname, result.chainId)
    result.contractAddress = contractAddress
    result.chainId = updatedChainId
    // Informations on how the hostname of the URL was resolved
    result.nameResolution = nameResolution

    // Step 1.3 : Determine the web3 mode.
    const resolveModeDeterminationResult = await this.determineResolveMode(result.contractAddress, result.chainId)
    // Web3 resolve mode: 'auto', 'manual' or 'resourceRequest'
    result.mode = resolveModeDeterminationResult.mode
    // Infos about the mode determination
    result.modeDetermination = resolveModeDeterminationResult.modeDetermination

    // Step 1.4 : Parse the path part of the URL, given the web3 resolve mode.
    let parsedPath = await this.parsePathForResolveMode(urlMainParts.path, result.mode, result.chainId)
    result = {...result, ...parsedPath}

    return result
  }

  /**
   * Step 1.1 : Extract parts of the URL, determine if a chain id was provided.
   */
  parseUrlBasic(url) {
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
    let chainId = 1
    // Was the network id specified?
    if(urlMainParts.chainId !== undefined && isNaN(parseInt(urlMainParts.chainId)) == false) {
      chainId = parseInt(urlMainParts.chainId);
    }

    return {urlMainParts, chainId}
  }

  /**
   * Step 1.2 : For a given hostname, determine the target contract address.
   * This includes ERC-6821 features, so only use that on the main hostname of a web3 URL,
   * not on auto-mode address arguments.
   */
  async determineTargetContractAddress(hostname, chainId) {
    let contractAddress = null
    let nameResolution = {
      // Enum, possibilities are
      // - ens
      // - linagee (for .og domains)
      resolver: null,
      // The chain where the resolution will take place
      resolverChainId: null,
      // The name about ot be resolved
      resolvedName: null,
      // Struct: The optional call to get the domain resolver (ENS does that).
      fetchNameResolverCall: null,
      // Struct: The call for the TXT record for the ERC-6821 record
      erc6821ContentContractTxtCall: null,
      // Struct: The optional call for domain resolution (unused if ERC-6821 resolution is successful)
      resolveNameCall: null,
      // Enum, possibilities are
      // - direct: Direct domain name to address translation
      // - contentContractTxt: ERC-6821 Cross-chain resolution via the contentcontract TXT record
      resolutionType: 'direct',
      // If resolutionType is erc6821, contains the content of the TXT record
      erc6821ContentContractTxt: null,
      // Result of the resolution
      resultAddress: null,
      resultChainId: null, // If null, we stay on the same chain
    }

    // Prepare the chain client
    let chainClient = this.#chainClientProvider.getChainClient(chainId)

    // Contract address / Domain name
    // Is the hostname an ethereum address? 
    if(/^0x[0-9a-fA-F]{40}$/.test(hostname)) {
      contractAddress = hostname;
    } 
    // Hostname is not an ethereum address, try name resolution
    else {
      let domainNameResolver = this.#domainNameResolver.getEligibleDomainNameResolver(hostname, chainClient.chain());
      if(domainNameResolver) {
        // Do the name resolution
        let resolutionInfos = null
        try {
          resolutionInfos = await this.#domainNameResolver.resolveDomainNameInclErc6821(domainNameResolver, hostname, chainClient, this.#chainList)
        }
        catch(err) {
          throw new Error('Failed to resolve domain name ' + hostname + ' : ' + err);
        }

        // Store infos about the name resolution
        nameResolution = {...nameResolution, ...resolutionInfos}

        // Set contractAddress address
        contractAddress = resolutionInfos.resultAddress
        // We got an address on another chain? Update the chainId and the chainClient
        if(resolutionInfos.resultChainId) {
          chainId = resolutionInfos.resultChainId
        }
      }
      // Domain name not supported in this chain
      else {
        throw new Error('Unresolvable domain name : ' + hostname + ' : no supported resolvers found in this chain');
      }
    }

    return {contractAddress, chainId, nameResolution}
  }

  /**
   * Step 1.3 : Determine the web3 mode.
   * 3 modes :
   * - Auto : we parse the path and arguments and send them
   * - Manual : we forward all the path & arguments as calldata
   * - ResourceRequest : we parse the path and arguments and send them
   */
  async determineResolveMode(contractAddress, chainId) {
    // Prepare the chain client
    let chainClient = this.#chainClientProvider.getChainClient(chainId)

    const resolveModeDeterminationResult = await this.#resolveModeDeterminator.determineResolveMode(chainClient, contractAddress)

    return resolveModeDeterminationResult
  }

  /**
   * Step 1.4 : Parse the path part of the URL, given the web3 resolve mode.
   */
  async parsePathForResolveMode(path, mode, chainId) {
    let result = {
      // How do we call the smartcontract
      // 'calldata' : We send the specified calldata
      // 'method': We use the specified method parameters
      contractCallMode: null,
      // For contractCallMode: method
      methodName: null,
      methodArgs: [],
      methodArgValues: [],
      // For contractCallMode: calldata, or method (derived)
      calldata: null,
      
      // Enum, possibilities are:
      // - decodeABIEncodedBytes: Will return the first value of the result
      // - jsonEncodeRawBytes: Will JSON-encode the raw bytes of the returned data
      // - jsonEncodeValues: Will JSON-encode the entries of the result, and return it as a single string
      // - decodeErc5219Request: Will parse the result following the ERC-5219 spec
      // - dataUrl: Will parse the result as a data URL
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

    // Prepare the chain client
    let chainClient = this.#chainClientProvider.getChainClient(chainId)

    // Parse the URL per the selected mode
    if(mode == 'manual') {
      parseManualUrl(result, path)
    }
    else if(mode == 'auto') {
      await parseAutoUrl(result, path, chainClient, this.#domainNameResolver)
    }
    else if(mode == 'resourceRequest') {
      parseResourceRequestUrl(result, path)
    }

    // If contract call mode is method, prepare calldata
    if (result.contractCallMode == 'method') {
      let abi = [
        {
          inputs: result.methodArgs,
          name: result.methodName,
          stateMutability: 'view',
          type: 'function',
        },
      ];
      result.calldata = encodeFunctionData({
        abi: abi,
        args: result.methodArgValues,
        functionName: result.methodName,
      })
    }

    return result;
  }


  /**
   * Step 2: Make the call to the main contract.
   */
  async fetchContractReturn(parsedUrl) {

    // Prepare the chain client
    let chainClient = this.#chainClientProvider.getChainClient(parsedUrl.chainId)

    // Do the contract call
    let callOutput = await chainClient.call({
      to: parsedUrl.contractAddress,
      input: parsedUrl.calldata
    })

    return callOutput;
  }

  /**
   * Execute a parsed web3:// URL from parseUrl().
   * Returns an http code, http headers, and a Uint8Array body.
   */
  async processContractReturn(parsedUrl, contractReturn) {
    // Contract return processing
    let fetchedUrl = {
      // The data to be used by the web client
      httpCode: 200,
      httpHeaders: {},
      output: null, // Readable stream 
      // The data indicating how the URL was processed
      // The result of processing of step 1 parseUrl()
      parsedUrl: parsedUrl,
      // The result of processing of step 2 fetchContractReturn()
      fetchedContractReturn: contractReturn,
      // The decoded contract return, depending of the contractReturnProcessing.
      // Can be null if contractReturnProcessing is 'jsonEncodeRawBytes'
      decodedContractReturn: null,
    }

    if(parsedUrl.contractReturnProcessing == 'decodeABIEncodedBytes') {
      // Do the ABI decoding, receive the bytes in hex string format
      fetchedUrl.decodedContractReturn = decodeAbiParameters([{ type: 'bytes' }], contractReturn.data)
      // Convert it into a Uint8Array byte buffer
      let outputBytes = hexToBytes(fetchedUrl.decodedContractReturn[0])
      // Make it a readable stream
      fetchedUrl.output = new ReadableStream({
        start(controller) {
          if(outputBytes.length > 0)
            controller.enqueue(outputBytes);
          controller.close();
        }
      });

      if(parsedUrl.contractReturnProcessingOptions.mimeType) {
        fetchedUrl.httpHeaders['Content-Type'] = parsedUrl.contractReturnProcessingOptions.mimeType
      }
    }
    else if(parsedUrl.contractReturnProcessing == 'jsonEncodeRawBytes') {
      // JSON-encode the contract return in hex string format inside an array
      let jsonData = JSON.stringify([contractReturn.data])
      // Convert it into a Uint8Array byte buffer
      let outputBytes = stringToBytes(jsonData)
      // Make it a readable stream
      fetchedUrl.output = new ReadableStream({
        start(controller) {
          if(outputBytes.length > 0)
            controller.enqueue(outputBytes);
          controller.close();
        }
      });

      fetchedUrl.httpHeaders['Content-Type'] = 'application/json'
    }
    else if(parsedUrl.contractReturnProcessing == 'jsonEncodeValues') {
      // Do the ABI decoding, get the vars
      fetchedUrl.decodedContractReturn = decodeAbiParameters(parsedUrl.contractReturnProcessingOptions.jsonEncodedValueTypes, contractReturn.data)
      // JSON-encode them
      // (If we have some bigInts, convert them into hex string)
      let jsonEncodedValues = JSON.stringify(fetchedUrl.decodedContractReturn, 
        (key, value) => typeof value === "bigint" ? "0x" + value.toString(16) : value)
      // Convert it into a Uint8Array byte buffer
      let outputBytes = stringToBytes(jsonEncodedValues)
      // Make it a readable stream
      fetchedUrl.output = new ReadableStream({
        start(controller) {
          if(outputBytes.length > 0)
            controller.enqueue(outputBytes);
          controller.close();
        }
      });

      fetchedUrl.httpHeaders['Content-Type'] = 'application/json'
    }
    else if(parsedUrl.contractReturnProcessing == 'decodeErc5219Request') {
      processResourceRequestContractReturn(this, fetchedUrl, contractReturn.data)
    } 

    return fetchedUrl;
  }


}

export { Client };
