import { fetch } from 'undici'
import { encodeFunctionData, decodeFunctionResult } from 'viem'

/**
 * Handle the instances of Chain clients
 */
class ChainClientProvider {
  #chainList = []
  #chainClients = {}
  #opts = []

  constructor(chainList, opts) {
    this.#chainList = chainList
    this.#opts = {...{
      // Enum, possibilities are
      // - fallback: One is tried after the other
      // - parallel : All RPCs are called in parralel, the first to answer is used
      multipleRpcMode: 'fallback'
    }, ...opts}
  }

  destroy() {

  }

  getChainClient(chainId) {
    if(this.#chainClients['' + chainId] === undefined) {
      const chain = Object.values(this.#chainList).find(chain => chain.id == chainId)
      if(chain == undefined) {
        throw new Error("Chain not found for id " + chainId)
      }

      this.#chainClients['' + chainId] = new ChainClient(chain, {
        multipleRpcMode: this.#opts.multipleRpcMode
      })
    }

    return this.#chainClients['' + chainId]
  }
}

/**
 * A chain client for RPC calls, handling fallback.
 */
class ChainClient {
  #chain = null
  #opts = []

  constructor(chain, opts) {
    this.#chain = chain
    this.#opts = {...{
      // Enum, possibilities are
      // - fallback: One is tried after the other
      // - parallel : All RPCs are called in parralel, the first to answer is used
      multipleRpcMode: 'fallback'
    }, ...opts}
  }

  destroy() {

  }

  /**
   * Call a contract, with fallback support.
   * In case of success or failure, it will return which RPC was called, 
   * and for each, the error if any.
   */
  async callContract(args) {
    const calldata = encodeFunctionData({
      abi: args.abi,
      functionName: args.functionName,
      args: args.args,
    })

    const callResult = await this.call({
      to: args.contractAddress,
      input: calldata
    })

    const decodedResult = decodeFunctionResult({abi: args.abi, functionName: args.functionName, data: callResult.data})

    return {
      calldata,
      callResult,
      decodedResult,
    }
  }

  /**
   * Make a eth_call, using fallback or parralel mode.
   * Args are from the eth_call json call:
   * https://ethereum.org/en/developers/docs/apis/json-rpc/
   * Return the call result as well as the RPC used and the errors
   * from failed RPCs.
   */
  async call(args) {
     // Copy RPC URLs, could be reordered while we loop through them
    let rpcUrls = this.#chain.rpcUrls
    let rpcUrlUsedIndex;
    let rpcUrlsErrors = [];
    let output = null;

    // Fallback mode: One after the other
    if(this.#opts.multipleRpcMode == 'fallback') {
      for(rpcUrlUsedIndex = 0; rpcUrlUsedIndex < rpcUrls.length; rpcUrlUsedIndex++) {
        let rpcUrl = rpcUrls[rpcUrlUsedIndex]

        try {
          output = await this.#rpcCall(rpcUrl, args)
          break;
        }
        catch(err) {
          // We log the error
          rpcUrlsErrors.push(err.toString())
          // Then We try the next RPC
        }
      }

      // All RPCs calls failed? 
      if(rpcUrlUsedIndex == rpcUrls.length) {
        // Throw an error with the individual RPC errors
        throw new RPCsError("All RPC providers failed the request. First RPC provider error: " + rpcUrlsErrors[0], rpcUrls, rpcUrlsErrors)
      }
    }
    // Parralel mode: The first to answer is used
    else if(this.#opts.multipleRpcMode == 'parallel') {
      let promises = []

      for(let i = 0; i < rpcUrls.length; i++) {
        promises.push(new Promise((resolve, reject) => {
          (async () => {
            let rpcIndex = i
            let rpcUrl = rpcUrls[rpcIndex]

            try {
              let output = await this.#rpcCall(rpcUrl, args)
              return resolve({rpcUrlUsedIndex: rpcIndex, output: output});
            }
            catch(err) {
              rpcUrlsErrors[rpcIndex] = err
              return reject(err)
            }
          })()
        }))
      }

      let result = await new Promise((resolve, reject) => {
        // Use the result of the first function here
        Promise.any(promises).then(
          (result) => {
            return resolve(result);
          },
          (err) => {
            return reject(new RPCsError("All RPC providers failed the request. First RPC provider error: " + rpcUrlsErrors[0], rpcUrls, rpcUrlsErrors))
          });
      })
      output = result.output
      rpcUrlUsedIndex = result.rpcUrlUsedIndex
    }
    
    return {data: output, rpcUrls, rpcUrlUsedIndex, rpcUrlsErrors}
  }

  async #rpcCall(rpcUrl, args) {
    let postData = {
      jsonrpc: "2.0", 
      id: 1,
      method: "eth_call",
      params:[
        args,
        "latest"
      ]
    }

    const response = await fetch(rpcUrl, {
      method: 'POST', 
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(postData)
    })

    if(response.status != 200) {
      throw new Error("RPC returned an error HTTP code: " + response.status);
    }

    const json = await response.json()

    if(json.result === undefined || json.result === "" || json.result == "0x") {
      throw new Error("No data returned");
    }

    // We got some data!
    return json.result;
  }

  chain() {
    return this.#chain
  }
}

class RPCsError extends Error {
  constructor(message = "", rpcUrls, rpcUrlsErrors) {
    super(message);
    this.rpcUrls = rpcUrls;
    this.rpcUrlsErrors = rpcUrlsErrors;
  }
}

export { ChainClientProvider }