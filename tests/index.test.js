const { parseUrl } = require('../src/index');

const tests = [
  {
    name: "Random noise",
    url: "x!2dffsdk42",
    expectedException: "Failed basic parsing of the URL",
  }, 
  {
    name: "Check protocol name",
    url: "web4://xxxx",
    expectedException: "Bad protocol name",
  }, 
  {
    name: "Check ethereum address",
    url: "web3://0x5a985f13345e820aa9618826b85f74c3986e1463",
    expectedResult: {
      contractAddress: "0x5a985f13345e820aa9618826b85f74c3986e1463",
    },
  },
  {
    name: "Check ENS name",
    url: "web3://uniswap.eth",
    expectedResult: {
      contractAddress: "0x1a9C8182C09F50C8318d769245beA52c32BE35BC",
      nameResolution: {
        chainId: 1,
        resolvedName: "uniswap.eth",
      },
    },
  },
  {
    name: "Check wrong ENS name",
    url: "web3://fsdfzefszfsfsdfsdfefe.eth",
    expectedException: "Failed to resolve domain name fsdfzefszfsfsdfsdfefe.eth",
  },
  {
    name: "Determine the web3 mode (auto)",
    url: "web3://0x4e1f41613c9084fdb9e34e11fae9412427480e56",
    expectedResult: {
      mode: "auto",
    }
  },
  {
    name: "Determine the web3 mode (manual)",
    url: "web3://0x9A595bc28F1c40ab96247E8157A2b0A6762E7543",
    expectedResult: {
      mode: "manual",
    }
  },
]

for(let i = 0; i < tests.length; i++) {
  const tst = tests[i]

  test(tst.name, async () => {
    if(tst.expectedException) {
      await expect(async () => {await parseUrl(tst.url)}).rejects.toThrowError(tst.expectedException)
    }
    else {
      let parsedUrl = await parseUrl(tst.url)
      // Compare expectedResult on 2 levels
      for (const [fieldName, fieldValue] of Object.entries(tst.expectedResult)) {
        expect(parsedUrl[fieldName]).toEqual(fieldValue);
      }
    }
  });

}