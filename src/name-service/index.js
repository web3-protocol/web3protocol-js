import { ensResolveDomainName, ensResolveDomainNameInclErc6821 } from './ens.js'
import { linageeResolveDomainName, linageeResolveDomainNameInclErc6821 } from './linagee.js'

// An optionally-caching resolver for domain names.
class Resolver {
  #cache = null
  #opts = []

  constructor(opts) {
    if (opts === null) {
      opts = {};
    }
    this.#opts = {...{
      // Maximum number of entries.
      // After this, the least-recently-used entry is dropped.
      // Use zero to disable caching.
      maxEntries: 256,
      // Maximum number of seconds before a resolution result is no longer
      // considered valid.
      maxAgeSeconds: 30 * 60,
    }, ...opts}
    this.#cache = new Map();
  }

   #cacheKey(resolveMode, domainNameResolver, domainName, chainClient) {
    return `${resolveMode}:${domainNameResolver}:${chainClient.chain().id}:${domainName}`;
  }

  async #resolve(cacheKey, doResolveFn) {
    if (this.#opts.maxEntries <= 0 || this.#opts.maxAgeSeconds <= 0) {
      // Cache disabled.
      return await doResolveFn();
    }
    const nowMillis = Date.now();
    const cached = this.#cache.get(cacheKey);
    if (cached !== undefined) {
      // Unconditionally delete in order to maybe refresh later.
      this.#cache.delete(cacheKey);
      if (cached.expiresMillis > nowMillis) {
        this.#cache.set(cacheKey, cached); // Refresh entry.
        return cached.value;
      }
    }
    const result = await doResolveFn();
    const entry = {
      expiresMillis: nowMillis + 1000 * this.#opts.maxAgeSeconds,
      value: result,
    };

    // A concurrent request may have raced with this one; check.
    const raceEntry = this.#cache.get(cacheKey);
    if (raceEntry !== undefined) {
      this.#cache.delete(cacheKey);
      if (raceEntry.expiresMillis >= entry.expiresMillis) {
        // The other entry is fresher, so use it.
        this.#cache.set(cacheKey, raceEntry);
        return raceEntry.value;
      }
    }
    this.#cache.set(cacheKey, entry);
    while (this.#cache.size > this.#opts.maxEntries) {
      this.#cache.delete(this.#cache.keys().next().value);
    }
    return result;
  }

  // For a given domain and chain, return a eligible resolver (ens, ...)
  getEligibleDomainNameResolver(domainName, chainId) {
    let result = null;

    if(typeof domainName == 'string' &&
      domainName.endsWith('.eth') && [1, 5, 11155111].includes(chainId)) {
      result = "ens";
    }
    else if(typeof domainName == 'string' &&
      domainName.endsWith('.og') && [1].includes(chainId)) {
      result = "linagee";
    }

    return result;
  }

  // Attempt resolution of the domain name
  // Must return an exception if failure
  async resolveDomainName(domainNameResolver, domainName, chainClient) {
    const cacheKey = this.#cacheKey("plain", domainNameResolver, domainName, chainClient);
    return this.#resolve(cacheKey, async () => {
      let result = null;

      // ENS
      if(domainNameResolver == "ens") {
        result = ensResolveDomainName(domainName, chainClient, result)
      }
      else if(domainNameResolver == "linagee") {
        result = linageeResolveDomainName(domainName, chainClient, result)
      }
      else {
        throw new Error("Unknown resolver");
      }

      return result;
    });
  }

  // Follow erc-6821 standard : if there is a contentcontract TXT record
  // with a common or EIP-3770 address, then go there. Otherwise, go to the resolved address.
  async resolveDomainNameInclErc6821(domainNameResolver, domainName, chainClient, chainList) {
    const cacheKey = this.#cacheKey("erc6821", domainNameResolver, domainName, chainClient);
    return this.#resolve(cacheKey, async () => {
      let result = null

      // ENS
      if(domainNameResolver == "ens") {
        result = ensResolveDomainNameInclErc6821(domainName, chainClient, chainList)
      }
      // Linagee
      else if(domainNameResolver == "linagee") {
        result = linageeResolveDomainNameInclErc6821(domainName, chainClient, chainList)
      }
      else {
        throw new Error("Unknown resolver");
      }

      return result;
    });
  }

}


export { Resolver };
