import { decodeAbiParameters, hexToBytes, stringToBytes, encodeFunctionData } from 'viem';

import { parseManualUrl }  from './mode/manual.js';
import { parseAutoUrl } from './mode/auto.js';
import { parseResourceRequestUrl, processResourceRequestContractReturn } from './mode/5219.js';
import { getEligibleDomainNameResolver, resolveDomainNameInclErc6821 } from './name-service/index.js';
import { ChainClientProvider } from './chains/client.js'


class Client {
  #chainList = []
  #chainClientProvider = null
  #opts = []

  constructor(chainList, opts) {
    this.#chainList = chainList
    this.#opts = {...{
      // Enum, possibilities are
      // - fallback: One is tried after the other
      // - parallel : All RPCs are called in parralel, the first to answer is used
      multipleRpcMode: 'fallback'
    }, ...opts}

    // Manual enum check...
    if(this.#opts.multipleRpcMode != 'fallback' && this.#opts.multipleRpcMode != 'parallel') {
      throw new Error("Bad value for multipleRpcMode option. Valid values: fallback, parallel")
    }

    this.#chainClientProvider = new ChainClientProvider(chainList, {
      multipleRpcMode: this.#opts.multipleRpcMode
    })
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
      nameResolution: {
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
        resultChainId: null,
      },

      contractAddress: null,
      chainId: null,
      chainRpc: null,
      
      // Web3 resolve mode: 'auto', 'manual' or 'resourceRequest'
      mode: null,
      // The calldata sent to the contract to determine the resolve mode
      modeDeterminationCalldata: null,
      // The data returned by the contract to determine the resolve mode
      modeDeterminationReturn: null,
      
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
    // Prepare the chain client
    let chainClient = this.#chainClientProvider.getChainClient(result.chainId)

    // Contract address / Domain name
    // Is the hostname an ethereum address? 
    if(/^0x[0-9a-fA-F]{40}$/.test(urlMainParts.hostname)) {
      result.contractAddress = urlMainParts.hostname;
    } 
    // Hostname is not an ethereum address, try name resolution
    else {
      let domainNameResolver = getEligibleDomainNameResolver(urlMainParts.hostname, chainClient.chain().id);
      if(domainNameResolver) {
        // Do the name resolution
        let resolutionInfos = null
        try {
          resolutionInfos = await resolveDomainNameInclErc6821(domainNameResolver, urlMainParts.hostname, chainClient, this.#chainList)
        }
        catch(err) {
          throw new Error('Failed to resolve domain name ' + urlMainParts.hostname + ' : ' + err);
        }

        // Store infos about the name resolution
        result.nameResolution = {...result.nameResolution, ...resolutionInfos}

        // Set contractAddress address
        result.contractAddress = resolutionInfos.resultAddress
        // We got an address on another chain? Update the chainId and the chainClient
        if(resolutionInfos.resultChainId) {
          result.chainId = resolutionInfos.resultChainId

          chainClient = this.#chainClientProvider.getChainClient(result.chainId)
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

    // Detect if the contract is another mode
    let resolveModeAbi = [{
      inputs: [],
      name: 'resolveMode',
      outputs: [{type: 'bytes32'}],
      stateMutability: 'view',
      type: 'function',
    }];
    result.modeDeterminationCalldata = encodeFunctionData({
      abi: resolveModeAbi,
      functionName: 'resolveMode',
      args: [],
    })
    try {
      let rawOutput = await chainClient.call({
        to: result.contractAddress,
        data: result.modeDeterminationCalldata,
      })
      if(rawOutput.data !== undefined) {
        result.modeDeterminationReturn = rawOutput.data;
      }
    }
    catch(err) {/** If call to resolveMode fails, we default to auto */}

    let resolveModeAsString = ''
    if(result.modeDeterminationReturn) {
      resolveModeAsString = Buffer.from(result.modeDeterminationReturn.substr(2), "hex").toString().replace(/\0/g, '');
    }
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
      await parseAutoUrl(result, urlMainParts.path, chainClient)
    }
    else if(result.mode == 'resourceRequest') {
      parseResourceRequestUrl(result, urlMainParts.path)
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

    return result
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
      httpCode: 200,
      httpHeaders: {},
      output: [], // Array of uint8 (bytes array)
      // The result of processing of step 1 parseUrl()
      parsedUrl: parsedUrl,
      // The result of processing of step 2 fetchContractReturn()
      fetchedContractReturn: contractReturn,
    }

    if(parsedUrl.contractReturnProcessing == 'decodeABIEncodedBytes') {
      // Do the ABI decoding, receive the bytes in hex string format
      let decodedContractReturn = decodeAbiParameters([{ type: 'bytes' }], contractReturn.data)
      // Convert it into a Uint8Array byte buffer
      fetchedUrl.output = hexToBytes(decodedContractReturn[0])

      if(parsedUrl.contractReturnProcessingOptions.mimeType) {
        fetchedUrl.httpHeaders['Content-Type'] = parsedUrl.contractReturnProcessingOptions.mimeType
      }
    }
    else if(parsedUrl.contractReturnProcessing == 'jsonEncodeRawBytes') {
      // JSON-encode the contract return in hex string format inside an array
      let jsonData = JSON.stringify([contractReturn.data])
      // Convert it into a Uint8Array byte buffer
      fetchedUrl.output = stringToBytes(jsonData)

      fetchedUrl.httpHeaders['Content-Type'] = 'application/json'
    }
    else if(parsedUrl.contractReturnProcessing == 'jsonEncodeValues') {
      // Do the ABI decoding, get the vars
      let decodedContractReturn = decodeAbiParameters(parsedUrl.contractReturnProcessingOptions.jsonEncodedValueTypes, contractReturn.data)
      // JSON-encode them
      // (If we have some bigInts, convert them into hex string)
      let jsonEncodedValues = JSON.stringify(decodedContractReturn, 
        (key, value) => typeof value === "bigint" ? "0x" + value.toString(16) : value)
      // Convert it into a Uint8Array byte buffer
      fetchedUrl.output = stringToBytes(jsonEncodedValues)

      fetchedUrl.httpHeaders['Content-Type'] = 'application/json'
    }
    else if(parsedUrl.contractReturnProcessing == 'decodeErc5219Request') {
      processResourceRequestContractReturn(fetchedUrl, contractReturn.data)
    } 

    return fetchedUrl;
  }


}

export { Client };
