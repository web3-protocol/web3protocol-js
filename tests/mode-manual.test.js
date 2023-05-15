const { parseUrl } = require('../src/index');

const tests = [
  {
    name: "Manual mode: calldata of base path (no '/' specified)",
    url: "web3://0x9A595bc28F1c40ab96247E8157A2b0A6762E7543",
    expectedResult: {
      mode: "manual",
      contractCallMode: 'calldata',
      calldata: "0x2f",
      mimeType: 'text/html',
    }
  },
  {
    name: "Manual mode: calldata of base path ('/' specified)",
    url: "web3://0x9A595bc28F1c40ab96247E8157A2b0A6762E7543/",
    expectedResult: {
      mode: "manual",
      contractCallMode: 'calldata',
      calldata: "0x2f",
      mimeType: 'text/html',
    }
  },
  {
    name: "Manual mode: calldata of path",
    url: "web3://0x9A595bc28F1c40ab96247E8157A2b0A6762E7543/view/1",
    expectedResult: {
      mode: "manual",
      contractCallMode: 'calldata',
      calldata: "0x2f766965772f31",
      mimeType: 'text/html',
    }
  },
  {
    name: "Manual mode: calldata of path with extension plus mimeType",
    url: "web3://0x9A595bc28F1c40ab96247E8157A2b0A6762E7543/view/1.svg",
    expectedResult: {
      mode: "manual",
      contractCallMode: 'calldata',
      calldata: "0x2f766965772f312e737667",
      mimeType: 'image/svg+xml',
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