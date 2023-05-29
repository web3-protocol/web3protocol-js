const { fetchUrl } = require('../src/index');

const tests = [
  // Manual mode
  {
    name: "Manual mode: fetch a basic string",
    url: "web3://0x9A595bc28F1c40ab96247E8157A2b0A6762E7543/xoxoxo",
    opts: null,
    expectedResult: {
      output: "404",
      mimeType: 'text/html',
    }
  },

  // Auto mode
  {
    name: "Auto mode: fetch a string",
    url: "web3://0xA5aFC9fE76a28fB12C60954Ed6e2e5f8ceF64Ff2/resourceName",
    opts: null,
    expectedResult: {
      output: '???',
      mimeType: null,
    }
  },
  {
    name: "Auto mode: fetch 2 integers",
    url: "web3://0xA5aFC9fE76a28fB12C60954Ed6e2e5f8ceF64Ff2/levelAndTile/2/50?returns=(uint256,uint256)",
    opts: null,
    expectedResult: {
      // Bigints : will be returned as string
      output: JSON.stringify(["1", "36"]),
      mimeType: 'application/json',
    }
  },
  {
    name: "Auto mode: On goerli, fetch 2 integers",
    url: "web3://0x76010876050387FA66E28a1883aD73d576D88Bf2:5/levelAndTile/2/50?returns=(uint256,uint256)",
    opts: null,
    expectedResult: {
      // Bigints : will be returned as string
      output: JSON.stringify(["1", "36"]),
      mimeType: 'application/json',
    }
  },
  {
    name: "Auto mode: bad method name",
    url: "web3://0xA5aFC9fE76a28fB12C60954Ed6e2e5f8ceF64Ff2/xxxxxxx",
    opts: null,
    expectedException: `The contract function "xxxxxxx" returned no data ("0x").

This could be due to any of the following:
  - The contract does not have the function "xxxxxxx",
  - The parameters passed to the contract function may be invalid, or
  - The address is not a contract.
 
Contract Call:
  address:   0xA5aFC9fE76a28fB12C60954Ed6e2e5f8ceF64Ff2
  function:  xxxxxxx()

Docs: https://viem.sh/docs/contract/readContract.html
Version: viem@0.3.18`
  },

  // Chain override
  {
    name: "Chain override: Check a fail without existing chain override",
    url: "web3://0xA5aFC9fE76a28fB12C60954Ed6e2e5f8ceF64Ff2:5/resourceName",
    opts: null,
    expectedException: `The contract function "resourceName" returned no data ("0x").

This could be due to any of the following:
  - The contract does not have the function "resourceName",
  - The parameters passed to the contract function may be invalid, or
  - The address is not a contract.
 
Contract Call:
  address:   0xA5aFC9fE76a28fB12C60954Ed6e2e5f8ceF64Ff2
  function:  resourceName()

Docs: https://viem.sh/docs/contract/readContract.html
Version: viem@0.3.18`
  },
  {
    name: "Chain override: Check an existing chain override",
    url: "web3://0xA5aFC9fE76a28fB12C60954Ed6e2e5f8ceF64Ff2:5/resourceName",
    opts: {
      chains: [{
        id: 5,
        rpcUrls: ['https://cloudflare-eth.com']
      }]
    },
    expectedResult: {
      output: '???',
      mimeType: null,
    }
  },
  {
    name: "Chain override: Check an chain override on a non-existing chain",
    url: "web3://0xA5aFC9fE76a28fB12C60954Ed6e2e5f8ceF64Ff2:5787878778/resourceName",
    opts: {
      chains: [{
        id: 5787878778,
        rpcUrls: ['https://cloudflare-eth.com']
      }]
    },
    expectedResult: {
      output: '???',
      mimeType: null,
    }
  },
]

for(let i = 0; i < tests.length; i++) {
  const tst = tests[i]

  test(tst.name, async () => {
    if(tst.expectedException) {
      await expect(async () => {await fetchUrl(tst.url, tst.opts)}).rejects.toThrowError(tst.expectedException)
    }
    else {
      let result = await fetchUrl(tst.url, tst.opts)

      expect(result.output.toString()).toEqual(tst.expectedResult.output);
      expect(result.mimeType).toEqual(tst.expectedResult.mimeType);
    }
  }, 15000 /* ms of timeout */);

}