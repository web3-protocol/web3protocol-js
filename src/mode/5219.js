import { decodeAbiParameters, hexToBytes } from 'viem'

/**
 * ERC-5219 mode, as introduced via ERC-6944
 * https://eips.ethereum.org/EIPS/eip-5219
 * https://eips.ethereum.org/EIPS/eip-6944
 */

function parseResourceRequestUrl(result, path) {
  // ERC-5219 call a specific request method
  result.contractCallMode = 'method';
  result.methodName = 'request';
  result.methodArgs = [{type: 'string[]'}, {type: 'tuple[]', components: [{type: "string"}, {type: "string"}]}]
  result.contractReturnProcessing = 'decodeErc5219Request'

  if(path === undefined || path == "") {
    path = "/";
  }

  // Separate path from search params
  let matchResult = path.match(/^(?<pathname>[^?]*)?([?](?<searchParams>.*))?$/)
  if(matchResult == null) {
    throw new Error("Failed basic parsing of the path");
  }
  let pathname = matchResult.groups.pathname !== undefined ? matchResult.groups.pathname : ""
  let pathnameParts = pathname.split('/')  
  let searchParams = new URLSearchParams(matchResult.groups.searchParams);


  // Determine args
  pathnameParts = pathnameParts.slice(1).filter(x => x != '').map(x => decodeURIComponent(x))
  result.methodArgValues.push(pathnameParts)

  // Determine params
  let paramValues = []
  for (const [fieldName, fieldValue] of searchParams.entries()) {
    paramValues.push([fieldName, fieldValue]);
  }
  result.methodArgValues.push(paramValues)
}

// For a given contract return, extract the http code, headers and body
function processResourceRequestContractReturn(fetchedUrl, contractReturn) {
  // Do the ABI decoding with the ERC5219 interface, get the vars
  // Official interface second argumetn is "string", we do "bytes" to additionally support binary data
  // Being discussed
  const returnABI = [{type: 'uint16'}, {type: 'bytes'}, {type: 'tuple[]', components: [{type: "string"}, {type: "string"}]}];
  const decodedContractReturn = decodeAbiParameters(returnABI, contractReturn)

  fetchedUrl.httpCode = decodedContractReturn[0]
  for(let i = 0; i < decodedContractReturn[2].length; i++) {
    fetchedUrl.httpHeaders[decodedContractReturn[2][i][0]] = decodedContractReturn[2][i][1];
  }
  fetchedUrl.output = hexToBytes(decodedContractReturn[1])
}

export { parseResourceRequestUrl, processResourceRequestContractReturn }
