# web3protocol

[![npm version](https://badge.fury.io/js/web3protocol.svg)](https://www.npmjs.com/package/web3protocol)

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

## Implemented features

- [ERC-4804](https://eips.ethereum.org/EIPS/eip-4804) : the base web3:// protocol with auto and manual mode, basic ENS support
- [ERC-6821](https://eips.ethereum.org/EIPS/eip-6821) : ENS resolution : support for the ``contentcontract`` TXT field to point to a contract in another chain
- Not standard : Linagee .og domain names

## Partially implemented features

- [ERC-7087](https://github.com/ethereum/EIPs/pull/7087) (pending) : Auto mode : Add more flexibility to specify the MIME type. The dataurl support is not done yet.

## Upcoming features

- [ERC-6944](https://github.com/ethereum/EIPs/pull/6944) (pending) / [ERC-5219](https://eips.ethereum.org/EIPS/eip-5219) : New mode offloading some parsing processing on the browser side
