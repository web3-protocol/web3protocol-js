import { encodeFunctionData } from 'viem';

class Determinator {
  #cache = new Map();
  #opts = []

  constructor(opts) {
    if (opts === null) {
      opts = {};
    }
    this.#opts = {...{
      // Maximum number of entries.
      // After this, the least-recently-used entry is dropped.
      // Use zero to disable caching.
      maxEntries: 1,
      // Maximum number of seconds before a resolution result is no longer
      // considered valid.
      maxAgeSeconds: 30 * 60,
    }, ...opts}
    this.#cache = new Map();
  }

  async determineResolveMode(chainClient, contractAddress) {
    const cacheKey = `${chainClient.chain().id}:${contractAddress}`;
    const nowMillis = Date.now();

    // Check if the resolve mode is already cached
    if (this.#cache.has(cacheKey)) {
      const cachedResult =  this.#cache.get(cacheKey);
      // Unconditionally delete in order to maybe refresh later.
      this.#cache.delete(cacheKey);
      if (cachedResult.expiresMillis > nowMillis) {
        this.#cache.set(cacheKey, cachedResult); // Put back entry at the end of the cache
        return cachedResult.value;
      }
    }

    let result = {
      // Default mode is auto
      mode: 'auto',
      calldata: null,
      return: null,
    }
    
    // Detect if the contract is another mode
    let resolveModeAbi = [{
      inputs: [],
      name: 'resolveMode',
      outputs: [{type: 'bytes32'}],
      stateMutability: 'view',
      type: 'function',
    }];
    result.calldata = encodeFunctionData({
      abi: resolveModeAbi,
      functionName: 'resolveMode',
      args: [],
    })
    try {
      let rawOutput = await chainClient.call({
        to: contractAddress,
        data: result.calldata,
      })
      if(rawOutput.data !== undefined) {
        result.return = rawOutput.data;
      }
    }
    catch(err) {/** If call to resolveMode fails, we default to auto */}

    let resolveModeAsString = ''
    if(result.return) {
      resolveModeAsString = Buffer.from(result.return.substr(2), "hex").toString().replace(/\0/g, '');
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

    // Store the resolve mode in the cache
    if (this.#opts.maxEntries > 0 && this.#opts.maxAgeSeconds > 0) {
      const cachedResult = {
        expiresMillis: nowMillis + 1000 * this.#opts.maxAgeSeconds,
        value: result,
      }
      this.#cache.set(cacheKey, cachedResult);
      // Ensure the cache follow its size limit
      while (this.#cache.size > this.#opts.maxEntries) {
        this.#cache.delete(this.#cache.keys().next().value);
      }
    }

    // Return the resolve mode
    return result;
  }
}

export { Determinator };
