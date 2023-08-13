const mime = require('mime-types')
const { isSupportedDomainName, resolveDomainName } = require('../name-service/index')

//
// The supported types in arguments
//

let supportedTypes = [
  {
    type: 'uint256',
    autoDetectable: true,
    parse: async (x, web3Client) => {
      // Prevent parsing of hexadecimal numbers
      if(x.length >= 2 && x.substr(0, 2) == '0x') {
        throw new Error("Number must not be in hexadecimal format")
      }

      if(/^[0-9.]+$/.test(x) == false) {
        throw new Error("Number not made of numbers and dot")
      }

      x = parseInt(x)
      if(isNaN(x)) {
        throw new Error("Number is not parseable")
      }
      if(x < 0) {
        throw new Error("Number must be positive")
      }

      return x
    },
  },
  {
    type: 'bytes32',
    autoDetectable: true,
    parse: async (x, web3Client) => {
      if(x.length != 66) {
        throw new Error("Bad length (must include 0x in front)")
      }
      if(x.substr(0, 2) != '0x') {
        throw new Error("Must start with 0x")
      }
      if(/^[0-9a-f]+$/.test(x.substr(2)) == false) {
        throw new Error("Invalid hexadecimal")
      }

      return x
    }
  }, 
  {
    type: 'address',
    autoDetectable: true,
    parse: async (x, web3Client) => {
      if(x.length == 42 && x.substr(0, 2) == '0x' && /^[0-9a-fA-F]+$/.test(x.substr(2))) {
        return x;
      }
      if(isSupportedDomainName(x, web3Client.chain)) {
        // Will throw an error if failure
        let xAddress = await resolveDomainName(x, web3Client);
        return xAddress;
      }

      throw new Error("Unrecognized address")
    }
  },
  {
    type: 'bytes',
    autoDetectable: true,
    parse: async (x, web3Client) => {
      if(x.length < 2 || x.substr(0, 2) != '0x') {
        throw new Error("Must start with 0x");
      }
      if(/^[0-9a-f]+$/.test(x.substr(2)) == false) {
        throw new Error("Invalid hexadecimal")
      }

      return x;
    },
  },
  {
    type: 'string',
    autoDetectable: false,
    parse: async (x, web3Client) => decodeURIComponent(x),
  },
];



async function parseAutoUrl(result, path, web3Client) {
  // If "/" is called, call the contract with empty calldata
  if(path === undefined || path == "" || path == "/") {
    result.contractCallMode = 'calldata'
    result.calldata = '0x'
    return
  }

  result.contractCallMode = 'method';
  // Default return type
  result.methodReturn = [{type: 'string'}]

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
  result.methodName = pathnameParts[1];

  // Determine args
  pathnameParts = pathnameParts.slice(2)
  for(let i = 0; i < pathnameParts.length; i++) {
    let argValue = pathnameParts[i]
    let detectedType = null;

    // First we look for an explicit cast
    for(let j = 0; j < supportedTypes.length; j++) {
      if(argValue.startsWith(supportedTypes[j].type + '!')) {
        argValue = argValue.split('!').slice(1).join('!')
        try {
          argValue = await supportedTypes[j].parse(argValue, web3Client)
        }
        catch(e) {
          throw new Error('Argument ' + i + ' was explicitely requested to be casted to ' + supportedTypes[j].type + ', but : ' + e.message);
        }
        detectedType = supportedTypes[j].type
        break;
      }
    }

    // Next, if no explicit cast, try to detect
    if(detectedType == null) {
      for(let j = 0; j < supportedTypes.length; j++) {
        if(supportedTypes[j].autoDetectable) {
          try {
            argValue = await supportedTypes[j].parse(argValue, web3Client)
            detectedType = supportedTypes[j].type

            break
          }
          catch(e) {}
        }
      }
    }

    // Finally, save the args and its type
    result.methodArgs.push(detectedType ? {type: detectedType} : {type: "bytes"})
    result.methodArgValues.push(argValue)
  }

  // Handle the return definition
  let returnsParam = searchParams.get('returns')
  if(returnsParam && returnsParam.length >= 2) {
    // When we have a return definition, we returns everything as JSON
    result.contractReturnProcessing = 'jsonEncode';
    result.contractReturnProcessingOptions = {}

    returnsParamParts = returnsParam.substr(1, returnsParam.length - 2).split(',').map(returnType => returnType.trim()).filter(x => x != '')

    if(returnsParamParts == 0) {
      result.methodReturn = [{type: 'bytes'}]
    }
    else {
      result.methodReturn = []
      for(let i = 0; i < returnsParamParts.length; i++) {
        result.methodReturn.push({type: returnsParamParts[i]})
      }
    }
  }

  // ERC-7087 : Handle the mime override
  // Only if ?returns= was not present
  // if(result.contractReturnProcessing == 'firstValue') {
  //   // Several of these could be there, we use the last one
  //   let mimeFieldName = null;
  //   let mimeFieldValue = null;

  //   for (const [fieldName, fieldValue] of searchParams.entries()) {
  //     if(['mime.content', 'mime.type'/*, 'mime.dataurl'*/].indexOf(fieldName) != -1) {
  //       mimeFieldName = fieldName
  //       mimeFieldValue = fieldValue
  //     }
  //   }

  //   // Standard MIME
  //   if(mimeFieldName == "mime.content") {
  //     if(/^[^\/]+\/[^\/]+(,[^=]+=[^=]+)?$/.test(mimeFieldValue) == false) {
  //       throw new Error("Invalid MIME type: " + mimeFieldValue)
  //     }
  //     result.contractReturnProcessingOptions.mimeType = mimeFieldValue
  //   }
  //   // Filename extension
  //   else if(mimeFieldName == "mime.type") {
  //     if(/^[a-zA-Z0-9]+$/.test(mimeFieldValue) == false) {
  //       throw new Error("Invalid filename extension: " + mimeFieldValue)
  //     }
  //     let matchingMimeType = mime.lookup(mimeFieldValue)
  //     if(matchingMimeType == false) {
  //       throw new Error("No MIME type found for filename extension: " + mimeFieldValue)
  //     }
  //     result.contractReturnProcessingOptions.mimeType = matchingMimeType
  //   }
  //   // Dataurl support to be added later
  //   // // The result is a data url, we will extract the mime type from there
  //   // else if(mimeFieldName == "mime.dataurl") {
  //   //   result.methodReturnIsDataUrl = true
  //   // }
  // }
}

module.exports = { parseAutoUrl }
