# web3protocol

[![npm version](https://badge.fury.io/js/web3protocol.svg)](https://www.npmjs.com/package/web3protocol)

Parse and execute [ERC-6860 / ERC-4804 ``web3://`` protocol](https://eips.ethereum.org/EIPS/eip-6860) URLs. Used by [EVM Browser](https://github.com/nand2/evm-browser) to browse ``web3://`` on-chain websites.

## Usage

```js
import { Client } from 'web3protocol';
import { getDefaultChainList } from 'web3protocol/chains';

// Get a prepared chain list that you can optionally alter, or provide your own
let chainList = getDefaultChainList()

// Configure a client with these chains definitions
let web3Client = new Client(chainList)

let fetchedWeb3Url = await web3Client.fetchUrl("web3://0xA5aFC9fE76a28fB12C60954Ed6e2e5f8ceF64Ff2/resourceName")
// Returns:
// fetchedWeb3Url.httpCode == 200
// fetchedWeb3Url.httpHeaders == {}
// fetchedWeb3Url.output == ReadableStream returning bytes [ 63, 63, 63 ]

```

Fetch a ``web3://`` URL, get an HTTP status code, HTTP response headers and a ReadableStream.

``getDefaultChainList()`` is provided as a quick way to launch (mix of RPC URLs provided by the [Viem.sh](https://viem.sh/) library and the [chainid.network](https://chainid.network/chains.json) website), but be aware this could sometimes get out of date.

Apps using web3protocol : [web3curl](https://github.com/web3-protocol/web3curl-js), a simple CURL-like app; [EVM Browser](https://github.com/nand2/evm-browser), a ``web3://`` electron-based web browser.

## Supported standards

### Implemented features

- [ERC-6860](https://eips.ethereum.org/EIPS/eip-6860) : the base web3:// protocol with auto and manual mode, basic ENS support. This updates [ERC-4804](https://eips.ethereum.org/EIPS/eip-4804) with clarifications, small fixes and changes.
- [ERC-6821](https://eips.ethereum.org/EIPS/eip-6821) (draft) : ENS resolution : support for the ``contentcontract`` TXT field to point to a contract in another chain
- [ERC-6944](https://eips.ethereum.org/EIPS/eip-6944) (draft) / [ERC-5219](https://eips.ethereum.org/EIPS/eip-5219) : New mode offloading some parsing processing on the browser side
- Not standard : Linagee .og domain names

### Partially implemented features

- [ERC-7087](https://github.com/ethereum/ERCs/pull/98) (pending) : Auto mode : Add new features for auto mode.

## Options

The client takes the following options:

```
let web3Client = new Client(chainList, {
  multipleRpcMode: "fallback"
})
```

- multipleRpcMode (``fallback`` or ``parallel``) : If a chain have multiple RPC configured, by default the ``fallback`` mode is used (first one is used, then if failure, the second one, and so on). In the ``parallel`` mode, a call is sent simultaneously to all RPCs, and the first one answering is used.

## Testing

Web3:// test files are located in [their own git repository](https://github.com/web3-protocol/web3protocol-tests) and are imported as a git submodule. After cloning, please run ``git submodule init`` and then ``git submodule update``.

Testing is then launched with ``yarn test``
