const { parseUrl } = require('../src/index');

const tests = [
  {
    name: "root directory",
    url: "web3://0x4e1f41613c9084fdb9e34e11fae9412427480e56/",
    expectedResult: {
      mode: "auto",
      contractCallMode: 'calldata',
      calldata: '0x'
    }
  },

  // uint256 arg
  {
    name: "uint256 arg: specified",
    url: "web3://0x4e1f41613c9084fdb9e34e11fae9412427480e56/tokenHTML/uint256!1",
    expectedResult: {
      mode: "auto",
      contractCallMode: 'method',
      methodName: "tokenHTML",
      methodArgTypes: ['uint256'],
      methodArgValues: [1],
      methodReturnTypes: ['string'],
      methodReturnJsonEncode: false,
      mimeType: 'text/html',
    }
  },
  {
    name: "uint256 arg: bad value (invalid number)",
    url: "web3://0x4e1f41613c9084fdb9e34e11fae9412427480e56/tokenHTML/uint256!1n",
    expectedException: "Argument 0 was explicitely requested to be casted to uint256, but : Number not made of numbers and dot",
  },
  {
    name: "uint256 arg: bad value (negative number)",
    url: "web3://0x4e1f41613c9084fdb9e34e11fae9412427480e56/tokenHTML/uint256!-1",
    expectedException: "Argument 0 was explicitely requested to be casted to uint256, but : Number not made of numbers and dot",
  },
  {
    name: "uint256 arg: autodetection",
    url: "web3://0x4e1f41613c9084fdb9e34e11fae9412427480e56/tokenHTML/1",
    expectedResult: {
      mode: "auto",
      contractCallMode: 'method',
      methodName: "tokenHTML",
      methodArgTypes: ['uint256'],
      methodArgValues: [1],
      methodReturnTypes: ['string'],
      methodReturnJsonEncode: false,
      mimeType: 'text/html',
    }
  },

  // bytes32 arg
  {
    name: "bytes32 arg: specified",
    url: "web3://0x4e1f41613c9084fdb9e34e11fae9412427480e56/tokenHTML/bytes32!0x59f71cd7bbfece3b03f2545253083c3c4da78a52913390a9c05c13ccc013f481",
    expectedResult: {
      mode: "auto",
      contractCallMode: 'method',
      methodName: "tokenHTML",
      methodArgTypes: ['bytes32'],
      methodArgValues: ["0x59f71cd7bbfece3b03f2545253083c3c4da78a52913390a9c05c13ccc013f481"],
      methodReturnTypes: ['string'],
      methodReturnJsonEncode: false,
      mimeType: 'text/html',
    }
  },
  {
    name: "bytes32 arg: bad value",
    url: "web3://0x4e1f41613c9084fdb9e34e11fae9412427480e56/tokenHTML/bytes32!0x59f7",
    expectedException: "Argument 0 was explicitely requested to be casted to bytes32, but : Bad length (must include 0x in front)",
  },
  {
    name: "bytes32 arg: bad hexadecimal",
    url: "web3://0x4e1f41613c9084fdb9e34e11fae9412427480e56/tokenHTML/bytes32!0x59f71cd7bbfece3b03f2545253083c3c4da78a52913390a9c05c13ccc013f48g",
    expectedException: "Argument 0 was explicitely requested to be casted to bytes32, but : Invalid hexadecimal",
  },
  {
    name: "bytes32 arg: autodetection",
    url: "web3://0x4e1f41613c9084fdb9e34e11fae9412427480e56/tokenHTML/0x59f71cd7bbfece3b03f2545253083c3c4da78a52913390a9c05c13ccc013f481",
    expectedResult: {
      mode: "auto",
      contractCallMode: 'method',
      methodName: "tokenHTML",
      methodArgTypes: ['bytes32'],
      methodArgValues: ["0x59f71cd7bbfece3b03f2545253083c3c4da78a52913390a9c05c13ccc013f481"],
      methodReturnTypes: ['string'],
      methodReturnJsonEncode: false,
      mimeType: 'text/html',
    }
  },

  // address arg
  {
    name: "address arg: specified",
    url: "web3://0x4e1f41613c9084fdb9e34e11fae9412427480e56/tokenHTML/address!0xa958da541819f4058c583fc23f1b8cea8182f85e",
    expectedResult: {
      mode: "auto",
      contractCallMode: 'method',
      methodName: "tokenHTML",
      methodArgTypes: ['address'],
      methodArgValues: ["0xa958da541819f4058c583fc23f1b8cea8182f85e"],
      methodReturnTypes: ['string'],
      methodReturnJsonEncode: false,
      mimeType: 'text/html',
    }
  },
  {
    name: "address arg: ENS address",
    url: "web3://0x4e1f41613c9084fdb9e34e11fae9412427480e56/tokenHTML/address!uniswap.eth",
    expectedResult: {
      mode: "auto",
      contractCallMode: 'method',
      methodName: "tokenHTML",
      methodArgTypes: ['address'],
      methodArgValues: ["0x1a9C8182C09F50C8318d769245beA52c32BE35BC"],
      methodReturnTypes: ['string'],
      methodReturnJsonEncode: false,
      mimeType: 'text/html',
    }
  },
  {
    name: "address arg: bad value (invalid address length)",
    url: "web3://0x4e1f41613c9084fdb9e34e11fae9412427480e56/tokenHTML/address!0xa958da541819f4058c583fc23f1b8cea8182f85g",
    expectedException: "Argument 0 was explicitely requested to be casted to address, but : Unrecognized address",
  },
  {
    name: "address arg: bad value (bad hexadecimal)",
    url: "web3://0x4e1f41613c9084fdb9e34e11fae9412427480e56/tokenHTML/address!0xa958da541819f4058c58",
    expectedException: "Argument 0 was explicitely requested to be casted to address, but : Unrecognized address",
  },
  {
    name: "address arg: bad value (unknown name service)",
    url: "web3://0x4e1f41613c9084fdb9e34e11fae9412427480e56/tokenHTML/address!xoxo.xaxa",
    expectedException: "Argument 0 was explicitely requested to be casted to address, but : Unrecognized address",
  },
  {
    name: "address arg: bad value (ENS name not resolving)",
    url: "web3://0x4e1f41613c9084fdb9e34e11fae9412427480e56/tokenHTML/address!fzepezjfpezjfkepz.eth",
    expectedException: "Argument 0 was explicitely requested to be casted to address, but : Unable to resolve the argument as an ethereum .eth address",
  },
  {
    name: "address arg: autodetection",
    url: "web3://0x4e1f41613c9084fdb9e34e11fae9412427480e56/tokenHTML/0xa958da541819f4058c583fc23f1b8cea8182f85e",
    expectedResult: {
      mode: "auto",
      contractCallMode: 'method',
      methodName: "tokenHTML",
      methodArgTypes: ['address'],
      methodArgValues: ["0xa958da541819f4058c583fc23f1b8cea8182f85e"],
      methodReturnTypes: ['string'],
      methodReturnJsonEncode: false,
      mimeType: 'text/html',
    }
  },
  {
    name: "address arg: autodetection of ENS address",
    url: "web3://0x4e1f41613c9084fdb9e34e11fae9412427480e56/tokenHTML/address!uniswap.eth",
    expectedResult: {
      mode: "auto",
      contractCallMode: 'method',
      methodName: "tokenHTML",
      methodArgTypes: ['address'],
      methodArgValues: ["0x1a9C8182C09F50C8318d769245beA52c32BE35BC"],
      methodReturnTypes: ['string'],
      methodReturnJsonEncode: false,
      mimeType: 'text/html',
    }
  },

  // bytes arg
  {
    name: "bytes arg: specified",
    url: "web3://0x4e1f41613c9084fdb9e34e11fae9412427480e56/tokenHTML/bytes!0x45784578",
    expectedResult: {
      mode: "auto",
      contractCallMode: 'method',
      methodName: "tokenHTML",
      methodArgTypes: ['bytes'],
      methodArgValues: ["0x45784578"],
      methodReturnTypes: ['string'],
      methodReturnJsonEncode: false,
      mimeType: 'text/html',
    }
  },
  {
    name: "bytes arg: bad value (not starting by 0x)",
    url: "web3://0x4e1f41613c9084fdb9e34e11fae9412427480e56/tokenHTML/bytes!45784578",
    expectedException: "Argument 0 was explicitely requested to be casted to bytes, but : Must start with 0x",
  },
  {
    name: "bytes arg: bad value (invalid hexadecimal)",
    url: "web3://0x4e1f41613c9084fdb9e34e11fae9412427480e56/tokenHTML/bytes!0x45ze",
    expectedException: "Argument 0 was explicitely requested to be casted to bytes, but : Invalid hexadecimal",
  },

  // string arg
  {
    name: "string arg: specified",
    url: "web3://0x4e1f41613c9084fdb9e34e11fae9412427480e56/tokenHTML/string!1",
    expectedResult: {
      mode: "auto",
      contractCallMode: 'method',
      methodName: "tokenHTML",
      methodArgTypes: ['string'],
      methodArgValues: ["1"],
      methodReturnTypes: ['string'],
      methodReturnJsonEncode: false,
      mimeType: 'text/html',
    }
  },

  // Multiple args
  {
    name: "Multiple args: specified types",
    url: "web3://0x4e1f41613c9084fdb9e34e11fae9412427480e56/tokenHTML/string!1/uint256!2",
    expectedResult: {
      mode: "auto",
      contractCallMode: 'method',
      methodName: "tokenHTML",
      methodArgTypes: ['string', 'uint256'],
      methodArgValues: ["1", 2],
      methodReturnTypes: ['string'],
      methodReturnJsonEncode: false,
      mimeType: 'text/html',
    }
  },
  {
    name: "Multiple args: specified types and autodetection",
    url: "web3://0x4e1f41613c9084fdb9e34e11fae9412427480e56/tokenHTML/string!1a/2/uniswap.eth",
    expectedResult: {
      mode: "auto",
      contractCallMode: 'method',
      methodName: "tokenHTML",
      methodArgTypes: ['string', 'uint256', 'address'],
      methodArgValues: ["1a", 2, "0x1a9C8182C09F50C8318d769245beA52c32BE35BC"],
      methodReturnTypes: ['string'],
      methodReturnJsonEncode: false,
      mimeType: 'text/html',
    }
  },

  // MIME
  {
    name: "MIME: extension specified",
    url: "web3://0x4e1f41613c9084fdb9e34e11fae9412427480e56/tokenSVG/1.svg",
    expectedResult: {
      mode: "auto",
      contractCallMode: 'method',
      methodName: "tokenSVG",
      methodArgTypes: ['bytes'],
      methodArgValues: ["1.svg"],
      methodReturnTypes: ['string'],
      methodReturnJsonEncode: false, 
      mimeType: 'image/svg+xml',
    }
  },
  {
    name: "MIME: unknown extension specified",
    url: "web3://0x4e1f41613c9084fdb9e34e11fae9412427480e56/tokenSVG/1.ploua",
    expectedResult: {
      mode: "auto",
      contractCallMode: 'method',
      methodName: "tokenSVG",
      methodArgTypes: ['bytes'],
      methodArgValues: ["1.ploua"],
      methodReturnTypes: ['string'],
      methodReturnJsonEncode: false, 
      mimeType: 'text/html',
    }
  },
  {
    name: "MIME: Combine with multiple args",
    url: "web3://0x4e1f41613c9084fdb9e34e11fae9412427480e56/tokenHTML/1/string!2.svg",
    expectedResult: {
      mode: "auto",
      contractCallMode: 'method',
      methodName: "tokenHTML",
      methodArgTypes: ['uint256', 'string'],
      methodArgValues: [1, "2.svg"],
      methodReturnTypes: ['string'],
      methodReturnJsonEncode: false,
      mimeType: 'image/svg+xml',
    }
  },



  // JSON return
  {
    name: "JSON return: no types",
    url: "web3://0x4e1f41613c9084fdb9e34e11fae9412427480e56/tokenHTML/1?returns=()",
    expectedResult: {
      mode: "auto",
      contractCallMode: 'method',
      methodName: "tokenHTML",
      methodArgTypes: ['uint256'],
      methodArgValues: [1],
      methodReturnTypes: ['bytes'],
      methodReturnJsonEncode: true,
      mimeType: 'application/json',
    }
  },
  {
    name: "JSON return: types specified",
    url: "web3://0xA5aFC9fE76a28fB12C60954Ed6e2e5f8ceF64Ff2/levelAndTile/2/50?returns=(uint256,uint256)",
    expectedResult: {
      mode: "auto",
      contractCallMode: 'method',
      methodName: "levelAndTile",
      methodArgTypes: ['uint256', 'uint256'],
      methodArgValues: [2, 50],
      methodReturnTypes: ['uint256', 'uint256'],
      methodReturnJsonEncode: true,
      mimeType: 'application/json',
    }
  },
  // TODO:
  // {
  //   name: "JSON return: invalid types specified",
  //   url: "web3://0xA5aFC9fE76a28fB12C60954Ed6e2e5f8ceF64Ff2/levelAndTile/2/50?returns=(uint42)",
  //   expectedException: "xxx",
  // },
  {
    name: "JSON return: Combine with multiple args and MIME",
    url: "web3://0xA5aFC9fE76a28fB12C60954Ed6e2e5f8ceF64Ff2/levelAndTile/2/string!50.svg?returns=(uint256,uint256)",
    expectedResult: {
      mode: "auto",
      contractCallMode: 'method',
      methodName: "levelAndTile",
      methodArgTypes: ['uint256', 'string'],
      methodArgValues: [2, "50.svg"],
      methodReturnTypes: ['uint256', 'uint256'],
      methodReturnJsonEncode: true,
      mimeType: 'application/json',
    }
  },

  // To be resolved on protocol side:
  // - /tokenSVG/1.svg : Send "1" and mime=SVG (pending ?mime=)
]

for(let i = 0; i < tests.length; i++) {
  const tst = tests[i]

  test(tst.name + " : " + tst.url, async () => {
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