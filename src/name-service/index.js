import { ensResolveDomainName, ensResolveDomainNameInclErc6821 } from './ens.js'
import { linageeResolveDomainName, linageeResolveDomainNameInclErc6821 } from './linagee.js'

// An optionally-caching resolver for domain names.
class Resolver {
  #contents = null
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
    this.#contents = new Map();
  }

   #cacheKey(resolveMode, domainNameResolver, domainName, chainClient) {
    return `${resolveMode}:${domainNameResolver}:${chainClient.chain().id}:${domainName}`;
  }

  async #resolve(cacheKey, doResolveFn) {
    if (this.#opts.maxEntries <= 0) {
      // Cache disabled.
      return await doResolveFn();
    }
    const nowMillis = Date.now();
    const cached = this.#contents.get(cacheKey);
    if (cached !== undefined) {
      // Unconditionally delete in order to maybe refresh later.
      this.#contents.delete(cached);
      if (cached.expiresMillis > nowMillis) {
        this.#contents.set(cacheKey, cached); // Refresh entry.
        return cached.value;
      }
    }
    const result = await doResolveFn();
    const entry = {
      expiresMillis: nowMillis + 1000 * this.#opts.maxAgeSeconds,
      value: result,
    };

    // A concurrent request may have raced with this one; check.
    const raceEntry = this.#contents.get(cacheKey);
    if (raceEntry !== undefined) {
      this.#contents.delete(raceEntry);
      if (raceEntry.expiresMillis >= entry.expiresMillis) {
        // The other entry is fresher, so use it.
        this.#contents.set(cacheKey, raceEntry);
        return raceEntry.value;
      }
    }
    this.#contents.set(cacheKey, entry);
    while (this.#contents.size > this.#opts.maxEntries) {
      this.#contents.delete(this.#contents.keys().next().value);
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
