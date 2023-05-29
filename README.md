# web3protocol
Parse and execute [ERC-4804](https://eips.ethereum.org/EIPS/eip-4804) web3:// URLs. Used by [EVM Browser](https://github.com/nand2/evm-browser) to browse web3:// on-chain websites.

### fetchUrl(url, opts)

Fetch a web3:// URL, such as 

```web3://0xA5aFC9fE76a28fB12C60954Ed6e2e5f8ceF64Ff2/resourceName```

This calls ``parseUrl()`` then ``fetchParsedUrl()``

``opts`` is an object of options. Only one option for now : 

- chains: Contains an array of chain objects (``id``, ``rpcUrls`` members), which override existing chains, or add non-existing chains. Example:

```
{
  chains: [{
    id: 1,
    rpcUrls: ['https://cloudflare-eth.com']
  }]
}
```

### parseUrl(url, opts)

Parse an web3:// URL into its components.

### fetchParsedUrl(parsedUrl, opts)

Taking into argument the output of ``parseUrl()``, it will execute it and fetch the result. The result is the actual output, and the MIME type to use.
