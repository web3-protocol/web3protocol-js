const mime = require('mime-types')
const { parseAbiParameter } = require('viem');

const { getEligibleDomainNameResolver, resolveDomainName } = require('../name-service/index')


async function parseAutoUrl(result, path, web3Client) {
  // If "/" is called, call the contract with empty calldata
  if(path === undefined || path == "" || path == "/") {
    result.contractCallMode = 'calldata'
    result.calldata = '0x'
    return
  }

  result.contractCallMode = 'method';

  // Separate path from search params
  let matchResult = path.match(/^(?<pathname>[^?]*)([?](?<searchParams>.*))?$/)
  if(matchResult == null) {
    throw new Error("Failed basic parsing of the path");
  }
  let pathname = matchResult.groups.pathname
  let pathnameParts = pathname.split('/')  
  let searchParams = new URLSearchParams(matchResult.groups.searchParams);

  // Determine mime, if set
  let argValueParts = pathnameParts[pathnameParts.length - 1].split('.')
  if(argValueParts.length > 1) {
    let specifiedMimeType = mime.lookup(argValueParts[argValueParts.length - 1])
    if(specifiedMimeType != false) {
      result.contractReturnProcessingOptions.mimeType = specifiedMimeType
    }
  }

  // Determine method name
  let methodName = pathnameParts[1];
  if(methodName.match(/^[a-zA-Z$_][a-zA-Z0-9$_]*$/) == null) {
    throw new Error("Invalid method name");
  }
  result.methodName = methodName;

  // Determine args
  pathnameParts = pathnameParts.slice(2)
  for(let i = 0; i < pathnameParts.length; i++) {
    let parsedArgument = await parseAutoUrlArgument(pathnameParts[i], web3Client)
    result.methodArgs.push({type: parsedArgument.type})
    result.methodArgValues.push(parsedArgument.value)
  }

  // Handle the return definition
  // We take the last of "returns" or "returnTypes"
  let returnsParam = ""
  for (const [key, value] of searchParams.entries()) {
    if(key == "returns" || key == "returnTypes") {
      returnsParam = value
    }
  }
  if(returnsParam && returnsParam.length >= 2) {
    // When we have a return definition, we returns everything as JSON

    // First and last char must be "(" and ")"
    if(returnsParam.substr(0, 1) != "(" || returnsParam.substr(returnsParam.length - 1) != ")") {
      throw new Error("Invalid returns argument");
    }

    // Decode the return value recursively (tuples)
    let recReturnDecodeFn = function(recReturnDecodeFn, textToDecode) {
      let result = []
  
      // Separate parts
      let parts = []
      if(textToDecode.length > 0) {
        let tupleDeepness = 0
        let lastCommaPos = -1
        for(let i = 0; i < textToDecode.length; i++) {
          if(textToDecode[i] == "(") {
            tupleDeepness++
          }
          else if(textToDecode[i] == ")") {
            tupleDeepness--
          }
          else if(textToDecode[i] == "," && tupleDeepness == 0) {
            parts.push(textToDecode.substr(lastCommaPos + 1, i - lastCommaPos - 1))
            lastCommaPos = i
          }
        }
        parts.push(textToDecode.substr(lastCommaPos + 1))
      }

      // Process parts
      for(let i = 0; i < parts.length; i++) {
        // Look for tuple
        let tupleMatch = parts[i].match(/^\((?<tupleComponents>.+)\)(?<arrayDef>[\[\]0-9]*)$/)
        if(tupleMatch) {
          let tupleComponents = recReturnDecodeFn(recReturnDecodeFn, tupleMatch.groups.tupleComponents)
          result.push({type: "tuple" + tupleMatch.groups.arrayDef, components: tupleComponents})
        }
        // Basic type
        else {
          // Check if type is valid. Will throw an error is type is invalid.
          parseAbiParameter(parts[i] + " xx") // " xx" is necessary (name of var)
          result.push({type: parts[i]})
        }
      }

      return result
    }
    returnsParamTypes = recReturnDecodeFn(recReturnDecodeFn, returnsParam.substr(1, returnsParam.length - 2));

    if(returnsParamTypes == 0) {
      // ?returns=() => We returns the raw bytes json-encoded
      result.contractReturnProcessing = 'jsonEncodeRawBytes';
    }
    else {
      // ?returns=(aa,bb) => We json-encode the abi-decoded values
      result.contractReturnProcessing = 'jsonEncodeValues';
      result.contractReturnProcessingOptions.jsonEncodedValueTypes = returnsParamTypes
    }
  }

  // ERC-7087 : Handle the mime override
  // Only if ?returns= was not present
  if(result.contractReturnProcessing == 'decodeABIEncodedBytes') {
    // Several of these could be there, we use the last one
    let mimeFieldName = null;
    let mimeFieldValue = null;

    for (const [fieldName, fieldValue] of searchParams.entries()) {
      if(['mime.content', 'mime.type'/*, 'mime.dataurl'*/].indexOf(fieldName) != -1) {
        mimeFieldName = fieldName
        mimeFieldValue = fieldValue
      }
    }

    // Standard MIME
    if(mimeFieldName == "mime.content") {
      if(/^[^\/]+\/[^\/]+(,[^=]+=[^=]+)?$/.test(mimeFieldValue) == false) {
        throw new Error("Invalid MIME type: " + mimeFieldValue)
      }
      result.contractReturnProcessingOptions.mimeType = mimeFieldValue
    }
    // Filename extension
    else if(mimeFieldName == "mime.type") {
      if(/^[a-zA-Z0-9]+$/.test(mimeFieldValue) == false) {
        throw new Error("Invalid filename extension: " + mimeFieldValue)
      }
      let matchingMimeType = mime.lookup(mimeFieldValue)
      if(matchingMimeType != false) {
        result.contractReturnProcessingOptions.mimeType = matchingMimeType
      }
    }
    // Dataurl support to be added later
    // // The result is a data url, we will extract the mime type from there
    // else if(mimeFieldName == "mime.dataurl") {
    //   result.methodReturnIsDataUrl = true
    // }
  }
}

async function parseAutoUrlArgument(argument, web3Client) {
  let result = {
    type: null,
    value: null
  }

  // URI-percent-encoding decoding
  let decodedArgument = decodeURIComponent(argument)
  // Lets see if <type>!<value> or just <value>
  let ss = decodedArgument.split("!")

  // Type was provided
  if(ss.length >= 2) {
    result.type = ss[0]
    let argValueStr = ss.slice(1).join("!")

    // If there is a number at the right of the type, extract it
    let typeWithoutSize = ""
    let typeSize = 0
    let matchResult = result.type.match(/^(?<typeWithoutSize>[^0-9]+)(?<typeSize>[1-9][0-9]*)$/)
    if(matchResult) {
      typeWithoutSize = matchResult.groups.typeWithoutSize
      typeSize = parseInt(matchResult.groups.typeSize)
    }
    else {
      typeWithoutSize = result.type
    }

    // int, uint, int<x> and uint<x>
    if(typeWithoutSize == "uint" || typeWithoutSize == "int") {
      // uint/int are aliases of uint256/int256
      if(typeSize == 0) {
        typeSize = 256
        result.type = typeWithoutSize + typeSize
      }
      // Type size must be from 8 to 256, by steps of 8
      if(typeSize < 8 || typeSize > 256 || typeSize % 8 != 0) {
        throw new Error("Invalid argument type: " + result.type);
      }

      // Arg value must be numbers only
      if(/^-?[0-9]+$/.test(argValueStr) == false) {
        throw new Error("Argument is not a number: " + argValueStr);
      }
      result.value = BigInt(argValueStr)
      if(typeWithoutSize == "uint" && result.value < 0) {
        throw new Error("Number is negative: " + argValueStr);
      }
    }
    // Bytes and bytes<X>
    else if(typeWithoutSize == "bytes") {
      if(/^0x([0-9a-fA-F][0-9a-fA-F])+$/.test(argValueStr) == false) {
        throw new Error("Argument is not a valid hex string: " + argValueStr)
      }
      // "bytes", no type size
      if(typeSize == 0) {
        result.value = argValueStr
      }
      // "bytesXX", with a type size
      else {
        if(typeSize > 32) {
          throw new Error("Invalid argument type: " + result.type);
        }
        if(argValueStr.substr(2).length != 2 * typeSize) {
          throw new Error("Argument has not the correct size: " + argValueStr);
        }
        result.value = argValueStr
      }
    }
    else if(typeWithoutSize == "address") {
      // Hex address
      if(/^0x[0-9a-fA-F]{40}$/.test(argValueStr)) {
        result.value = argValueStr
      }
      // Domain name
      else {
        let domainNameResolver = getEligibleDomainNameResolver(argValueStr, web3Client.chain)
        if(domainNameResolver) {
          // Will throw an error if failure
          let nameResolution = await resolveDomainName(domainNameResolver, argValueStr, web3Client);
          result.value = nameResolution.resultAddress
        }
        else {
          throw new Error("Unrecognized domain name")
        }
      }
    }
    else if(typeWithoutSize == "string") {
      result.value = argValueStr
    }
    else if(typeWithoutSize == "bool") {
      if(argValueStr != "false" && argValueStr != "true") {
        throw new Error("Argument must be 'true' or 'false'")
      }
      result.value = argValueStr == "true"
    }
    else {
      throw new Error("Unknown type: " + result.type);
    }
  }
  // No type specified : we autodetect
  else {
    let argValueStr = argument

    // Autodetect uint256
    if(/^[0-9]+$/.test(argValueStr)) {
      result.type = "uint256"
      result.value = BigInt(argValueStr)
    }
    // Autodetect addreess, bytes32, bytes
    else if(/^0x([0-9a-fA-F][0-9a-fA-F])+$/.test(argValueStr)) {
      result.value = argValueStr
      // Determine type
      if(argValueStr.length == 2 + 40) {
        result.type = "address"
      }
      else if(argValueStr.length == 2 + 64) {
        result.type = "bytes32"
      }
      else {
        result.type = "bytes"
      }
    }
    // Fallback autodetection: It must be a domain name
    else {
      let domainNameResolver = getEligibleDomainNameResolver(argValueStr, web3Client.chain)
      if(domainNameResolver) {
        result.type = "address"
        // Will throw an error if failure
        let nameResolution = await resolveDomainName(domainNameResolver, argValueStr, web3Client);
        result.value = nameResolution.resultAddress
      }
      else {
        throw new Error("Unrecognized domain name")
      }
    }
  }

  return result;
}

module.exports = { parseAutoUrl }
