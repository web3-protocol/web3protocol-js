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
function processResourceRequestContractReturn(client, fetchedUrl, contractReturn) {
  // Do the ABI decoding with the ERC5219 interface, get the vars
  // Official interface second argumetn is "string", we do "bytes" to additionally support binary data
  // Being discussed
  const returnABI = [{type: 'uint16'}, {type: 'bytes'}, {type: 'tuple[]', components: [{type: "string"}, {type: "string"}]}];
  const decodedContractReturn = decodeAbiParameters(returnABI, contractReturn)

  fetchedUrl.httpCode = decodedContractReturn[0]
  for(let i = 0; i < decodedContractReturn[2].length; i++) {
    fetchedUrl.httpHeaders[decodedContractReturn[2][i][0]] = decodedContractReturn[2][i][1];
  }
  // Convert it into a Uint8Array byte buffer
  let outputBytes = hexToBytes(decodedContractReturn[1])
  // Make it a readable stream
  fetchedUrl.output = new ReadableStream({
    type: "bytes",
    async start(controller) {
      if(outputBytes.length > 0)
        controller.enqueue(outputBytes);

      async function getNextChunk(responseHttpHeaders) {
        let nextChunkUrl = responseHttpHeaders["web3-next-chunk"];

        // End? We close the stream
        if(nextChunkUrl === undefined) {
          controller.close();
          return;
        }

        // URL: If relative, make it absolute
        if(nextChunkUrl.substring(0, 1) == "/") {
          nextChunkUrl = "web3://" + fetchedUrl.parsedUrl.contractAddress + ":" + fetchedUrl.parsedUrl.chainId + nextChunkUrl
        }

        // Fetch the next chunk
        let parsedNextChunkUrl = await client.parseUrl(nextChunkUrl)
        let nextChunkContractReturn = await client.fetchContractReturn(parsedNextChunkUrl)
        let nextChunkDecodedContractReturn = decodeAbiParameters(returnABI, nextChunkContractReturn.data)

        // Send the chunk to the stream
        let outputBytes = hexToBytes(nextChunkDecodedContractReturn[1])
        if(outputBytes.length > 0)
          controller.enqueue(outputBytes);        

        // Prepare headers and loop again
        let nextChunkResponseHttpHeaders = []
        for(let i = 0; i < nextChunkDecodedContractReturn[2].length; i++) {
          nextChunkResponseHttpHeaders[nextChunkDecodedContractReturn[2][i][0]] = nextChunkDecodedContractReturn[2][i][1];
        }

        await getNextChunk(nextChunkResponseHttpHeaders);
      }
      await getNextChunk(fetchedUrl.httpHeaders);
    }
  });
}

export { parseResourceRequestUrl, processResourceRequestContractReturn }
