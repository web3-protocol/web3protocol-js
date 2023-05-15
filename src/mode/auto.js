const mime = require('mime-types')

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
        throw new Error("Number not made of [0-9.]")
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
      if(x.length != 34) {
        throw new Error("Bad length (must include 0x in front)")
      }
      if(x.substr(0, 2) != '0x') {
        throw new Error("Must start with 0x")
      }
      return x
    }
  }, 
  {
    type: 'address',
    autoDetectable: true,
    parse: async (x, web3Client) => {
      if(x.length == 22 && x.substr(0, 2) == '0x') {
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

      return x;
    },
  },
  {
    type: 'string',
    autoDetectable: false,
    parse: async (x, web3Client) => decodeURIComponent(x),
  },
];



async function parseAutoUrl(path, web3Client) {
  let modeArguments = {
    methodName: '',
    methodArgTypes: [],
    methodArgValues: [],
    methodReturnTypes: ['string'],
    methodReturnJsonEncode: false,
  }
  // Default: We return as plain text
  let mimeType = 'text/plain';

  // Path must be at least "/"
  if(path === undefined || path == "") {
    path = "/";
  }

  // Separate path from search params
  let matchResult = path.match(/^(?<pathname>[^?]*)([?](?<searchParams>.*))?$/)
  if(matchResult == null) {
    throw new Error("Failed basic parsing of the path");
  }
  pathname = matchResult.groups.pathname
  let pathnameParts = path.split('/')  
  searchParams = new URLSearchParams(matchResult.groups.searchParams);

  // Determine mime, if set
  let argValueParts = pathnameParts[pathnameParts.length - 1].split('.')
  if(argValueParts.length > 1) {
    let specifiedMimeType = mime.lookup(argValueParts[argValueParts.length - 1])
    if(specifiedMimeType != false) {
      mimeType = specifiedMimeType
    }
  }  

  // Determine method name
  modeArguments.methodName = pathnameParts[1];

  // Determine args
  pathnameParts = pathnameParts.slice(2)
  for(let i = 0; i < pathnameParts.length; i++) {
    let argValue = pathnameParts[i]
    let detectedType = null;

    // First we look for an explicit cast
    for(j = 0; j < supportedTypes.length; j++) {
      if(argValue.startsWith(supportedTypes[j].type + '!')) {
        argValue = argValue.split('!').slice(1).join('!')
        try {
          argValue = await supportedTypes[j].parse(argValue, web3Client)
        }
        catch(e) {
          throw new Error('Argument ' + i + ' was explicitely requested to be casted to ' + supportedTypes[j].type + ', but : ' + e);
        }
        detectedType = supportedTypes[j].type
        break;
      }
    }

    // Next, if no explicit cast, try to detect
    if(detectedType == null) {
      for(j = 0; j < supportedTypes.length; j++) {
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
    modeArguments.methodArgTypes.push(detectedType ? detectedType : "bytes")
    modeArguments.methodArgValues.push(argValue)
  }

  // Handle the return definition
  let returnsParam = searchParams.get('returns')
  if(returnsParam && returnsParam.length >= 2) {
    // When we have a return definition, we returns everything as JSON
    modeArguments.methodReturnJsonEncode = true;

    returnsParamParts = returnsParam.substr(1, returnsParam.length - 2).split(',').map(returnType => returnType.trim()).filter(x => x != '')

    if(returnsParamParts == 0) {
      modeArguments.methodReturnTypes = ['bytes']
    }
    else {
      modeArguments.methodReturnTypes = []
      for(let i = 0; i < returnsParamParts.length; i++) {
        modeArguments.methodReturnTypes.push(returnsParamParts[i])
      }
    }
  }


  return [modeArguments, mimeType]
}

module.exports = { parseAutoUrl }