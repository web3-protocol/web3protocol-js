const { parseUrl } = require('../src/index');

const tests = [
  // Basic parsing
  // {
  //   name: "Random noise",
  //   url: "x!2dffsdk42",
  //   expectedException: "Failed basic parsing of the URL",
  // }, 
  // {
  //   name: "Check protocol name",
  //   url: "web4://xxxx",
  //   expectedException: "Bad protocol name",
  // }, 
  // {
  //   name: "Check ethereum address",
  //   url: "web3://0x5a985f13345e820aa9618826b85f74c3986e1463",
  //   expectedResult: {
  //     contractAddress: "0x5a985f13345e820aa9618826b85f74c3986e1463",
  //   },
  // },
  // {
  //   name: "Check ENS name",
  //   url: "web3://uniswap.eth",
  //   expectedResult: {
  //     contractAddress: "0x1a9C8182C09F50C8318d769245beA52c32BE35BC",
  //     nameResolution: {
  //       chainId: 1,
  //       resolvedName: "uniswap.eth",
  //     },
  //   },
  // },
  // {
  //   name: "Check wrong ENS name",
  //   url: "web3://fsdfzefszfsfsdfsdfefe.eth",
  //   expectedException: "Failed to resolve domain name fsdfzefszfsfsdfsdfefe.eth",
  // },
  // {
  //   name: "Determine the web3 mode (auto)",
  //   url: "web3://0x4e1f41613c9084fdb9e34e11fae9412427480e56",
  //   expectedResult: {
  //     mode: "auto",
  //   }
  // },
  // {
  //   name: "Determine the web3 mode (manual)",
  //   url: "web3://0x9A595bc28F1c40ab96247E8157A2b0A6762E7543",
  //   expectedResult: {
  //     mode: "manual",
  //   }
  // },
  // {
  //   name: "Manual mode: calldata of base path (no '/' specified)",
  //   url: "web3://0x9A595bc28F1c40ab96247E8157A2b0A6762E7543",
  //   expectedResult: {
  //     mode: "manual",
  //     contractCallMode: 'calldata',
  //     calldata: "0x2f",
  //   }
  // },
  // {
  //   name: "Manual mode: calldata of base path ('/' specified)",
  //   url: "web3://0x9A595bc28F1c40ab96247E8157A2b0A6762E7543/",
  //   expectedResult: {
  //     mode: "manual",
  //     contractCallMode: 'calldata',
  //     calldata: "0x2f",
  //   }
  // },
  // {
  //   name: "Manual mode: calldata",
  //   url: "web3://0x9A595bc28F1c40ab96247E8157A2b0A6762E7543/view/1",
  //   expectedResult: {
  //     mode: "manual",
  //     contractCallMode: 'calldata',
  //     calldata: "0x2f766965772f31",
  //   }
  // },
  {
    name: "Auto mode: root directory",
    url: "web3://0x4e1f41613c9084fdb9e34e11fae9412427480e56/",
    expectedResult: {
      mode: "auto",
      contractCallMode: 'calldata',
      calldata: '0x'
    }
  },
  {
    name: "Auto mode: arg set: integer",
    url: "web3://0x4e1f41613c9084fdb9e34e11fae9412427480e56/tokenHTML/uint256!1",
    expectedResult: {
      mode: "auto",
      contractCallMode: 'method',
      methodName: "tokenHTML",
      methodArgTypes: ['uint256'],
      methodArgValues: [1],
      methodReturnTypes: ['string'],
      methodReturnJsonEncode: false,
    }
  },
  {
    name: "Auto mode: arg set: string",
    url: "web3://0x4e1f41613c9084fdb9e34e11fae9412427480e56/tokenHTML/string!1",
    expectedResult: {
      mode: "auto",
      contractCallMode: 'method',
      methodName: "tokenHTML",
      methodArgTypes: ['string'],
      methodArgValues: ["1"],
      methodReturnTypes: ['string'],
      methodReturnJsonEncode: false,
    }
  },
  {
    name: "Auto mode: arg autodetection: integer",
    url: "web3://0x4e1f41613c9084fdb9e34e11fae9412427480e56/tokenHTML/1",
    expectedResult: {
      mode: "auto",
      contractCallMode: 'method',
      methodName: "tokenHTML",
      methodArgTypes: ['uint256'],
      methodArgValues: [1],
      methodReturnTypes: ['string'],
      methodReturnJsonEncode: false,
    }
  },
  {
    name: "Auto mode: MIME specification",
    url: "web3://0x4e1f41613c9084fdb9e34e11fae9412427480e56/tokenSVG/1.svg",
    expectedResult: {
      mode: "auto",
      contractCallMode: 'method',
      methodName: "tokenSVG",
      methodArgTypes: ['bytes'],
      methodArgValues: ["1.svg"],
      methodReturnTypes: ['string'],
      methodReturnJsonEncode: false, 
      mimeType: 'image/svg+xml'
    }
  },
  {
    name: "Auto mode: returns bytes as JSON",
    url: "web3://0x4e1f41613c9084fdb9e34e11fae9412427480e56/tokenHTML/1?returns=()",
    expectedResult: {
      mode: "auto",
      contractCallMode: 'method',
      methodName: "tokenHTML",
      methodArgTypes: ['uint256'],
      methodArgValues: [1],
      methodReturnTypes: ['bytes'],
      methodReturnJsonEncode: true,
    }
  },
  {
    name: "Auto mode: returns multiple arguments as JSON",
    url: "web3://0xA5aFC9fE76a28fB12C60954Ed6e2e5f8ceF64Ff2/levelAndTile/2/50?returns=(uint256,uint256)",
    expectedResult: {
      mode: "auto",
      contractCallMode: 'method',
      methodName: "levelAndTile",
      methodArgTypes: ['uint256', 'uint256'],
      methodArgValues: [2, 50],
      methodReturnTypes: ['uint256', 'uint256'],
      methodReturnJsonEncode: true,
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
        if(typeof fieldValue == "object") {
          for (const [fieldName2, fieldValue2] of Object.entries(tst.expectedResult[fieldName])) {
            expect(parsedUrl[fieldName][fieldName2]).toEqual(fieldValue2);
          }
        }
        else {
          expect(parsedUrl[fieldName]).toEqual(fieldValue);
        }
      }
    }
  });

}