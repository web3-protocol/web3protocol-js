const { fetchUrl } = require('../src/index');

const tests = [
  {
    name: "Manual mode: fetch a basic string",
    url: "web3://0x9A595bc28F1c40ab96247E8157A2b0A6762E7543/xoxoxo",
    expectedResult: {
      output: "404",
      mimeType: 'text/html',
    }
  },
  {
    name: "Auto mode: fetch a string",
    url: "web3://0xA5aFC9fE76a28fB12C60954Ed6e2e5f8ceF64Ff2/resourceName",
    expectedResult: {
      output: '???',
      mimeType: 'text/html',
    }
  },
  {
    name: "Auto mode: fetch 2 integers",
    url: "web3://0xA5aFC9fE76a28fB12C60954Ed6e2e5f8ceF64Ff2/levelAndTile/2/50?returns=(uint256,uint256)",
    expectedResult: {
      // Bigints : will be returned as string
      output: JSON.stringify(["1", "36"]),
      mimeType: 'application/json',
    }
  },
  {
    name: "Auto mode: On goerli, fetch 2 integers",
    url: "web3://0x76010876050387FA66E28a1883aD73d576D88Bf2:5/levelAndTile/2/50?returns=(uint256,uint256)",
    expectedResult: {
      // Bigints : will be returned as string
      output: JSON.stringify(["1", "36"]),
      mimeType: 'application/json',
    }
  },
]

for(let i = 0; i < tests.length; i++) {
  const tst = tests[i]

  test(tst.name, async () => {
    if(tst.expectedException) {
      await expect(async () => {await fetchUrl(tst.url)}).rejects.toThrowError(tst.expectedException)
    }
    else {
      let result = await fetchUrl(tst.url)

      expect(result.output.toString()).toEqual(tst.expectedResult.output);
      expect(result.mimeType).toEqual(tst.expectedResult.mimeType);
    }
  }, 15000 /* ms of timeout */);

}