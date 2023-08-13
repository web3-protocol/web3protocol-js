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
      methodArgs: [{type: 'uint256'}],
      methodArgValues: [1],
      methodReturn: [{type: 'string'}],
      contractReturnProcessing: 'firstValue',
      contractReturnProcessingOptions: {mimeType: null},
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
      methodArgs: [{type: 'uint256'}],
      methodArgValues: [1],
      methodReturn: [{type: 'string'}],
      contractReturnProcessing: 'firstValue',
      contractReturnProcessingOptions: {mimeType: null},
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
      methodArgs: [{type: 'bytes32'}],
      methodArgValues: ["0x59f71cd7bbfece3b03f2545253083c3c4da78a52913390a9c05c13ccc013f481"],
      methodReturn: [{type: 'string'}],
      contractReturnProcessing: 'firstValue',
      contractReturnProcessingOptions: {mimeType: null},
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
      methodArgs: [{type: 'bytes32'}],
      methodArgValues: ["0x59f71cd7bbfece3b03f2545253083c3c4da78a52913390a9c05c13ccc013f481"],
      methodReturn: [{type: 'string'}],
      contractReturnProcessing: 'firstValue',
      contractReturnProcessingOptions: {mimeType: null},
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
      methodArgs: [{type: 'address'}],
      methodArgValues: ["0xa958da541819f4058c583fc23f1b8cea8182f85e"],
      methodReturn: [{type: 'string'}],
      contractReturnProcessing: 'firstValue',
      contractReturnProcessingOptions: {mimeType: null},
    }
  },
  {
    name: "address arg: ENS address",
    url: "web3://0x4e1f41613c9084fdb9e34e11fae9412427480e56/tokenHTML/address!uniswap.eth",
    expectedResult: {
      mode: "auto",
      contractCallMode: 'method',
      methodName: "tokenHTML",
      methodArgs: [{type: 'address'}],
      methodArgValues: ["0x1a9C8182C09F50C8318d769245beA52c32BE35BC"],
      methodReturn: [{type: 'string'}],
      contractReturnProcessing: 'firstValue',
      contractReturnProcessingOptions: {mimeType: null},
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
      methodArgs: [{type: 'address'}],
      methodArgValues: ["0xa958da541819f4058c583fc23f1b8cea8182f85e"],
      methodReturn: [{type: 'string'}],
      contractReturnProcessing: 'firstValue',
      contractReturnProcessingOptions: {mimeType: null},
    }
  },
  {
    name: "address arg: autodetection of ENS address",
    url: "web3://0x4e1f41613c9084fdb9e34e11fae9412427480e56/tokenHTML/address!uniswap.eth",
    expectedResult: {
      mode: "auto",
      contractCallMode: 'method',
      methodName: "tokenHTML",
      methodArgs: [{type: 'address'}],
      methodArgValues: ["0x1a9C8182C09F50C8318d769245beA52c32BE35BC"],
      methodReturn: [{type: 'string'}],
      contractReturnProcessing: 'firstValue',
      contractReturnProcessingOptions: {mimeType: null},
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
      methodArgs: [{type: 'bytes'}],
      methodArgValues: ["0x45784578"],
      methodReturn: [{type: 'string'}],
      contractReturnProcessing: 'firstValue',
      contractReturnProcessingOptions: {mimeType: null},
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
      methodArgs: [{type: 'string'}],
      methodArgValues: ["1"],
      methodReturn: [{type: 'string'}],
      contractReturnProcessing: 'firstValue',
      contractReturnProcessingOptions: {mimeType: null},
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
      methodArgs: [{type: 'string'}, {type: 'uint256'}],
      methodArgValues: ["1", 2],
      methodReturn: [{type: 'string'}],
      contractReturnProcessing: 'firstValue',
      contractReturnProcessingOptions: {mimeType: null},
    }
  },
  {
    name: "Multiple args: specified types and autodetection",
    url: "web3://0x4e1f41613c9084fdb9e34e11fae9412427480e56/tokenHTML/string!1a/2/uniswap.eth",
    expectedResult: {
      mode: "auto",
      contractCallMode: 'method',
      methodName: "tokenHTML",
      methodArgs: [{type: 'string'}, {type: 'uint256'}, {type: 'address'}],
      methodArgValues: ["1a", 2, "0x1a9C8182C09F50C8318d769245beA52c32BE35BC"],
      methodReturn: [{type: 'string'}],
      contractReturnProcessing: 'firstValue',
      contractReturnProcessingOptions: {mimeType: null},
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
      methodArgs: [{type: 'bytes'}],
      methodArgValues: ["1.svg"],
      methodReturn: [{type: 'string'}],
      contractReturnProcessing: 'firstValue', 
      contractReturnProcessingOptions: {mimeType: 'image/svg+xml'},
    }
  },
  {
    name: "MIME: unknown extension specified",
    url: "web3://0x4e1f41613c9084fdb9e34e11fae9412427480e56/tokenSVG/1.ploua",
    expectedResult: {
      mode: "auto",
      contractCallMode: 'method',
      methodName: "tokenSVG",
      methodArgs: [{type: 'bytes'}],
      methodArgValues: ["1.ploua"],
      methodReturn: [{type: 'string'}],
      contractReturnProcessing: 'firstValue', 
      contractReturnProcessingOptions: {mimeType: null},
    }
  },
  {
    name: "MIME: Combine with multiple args",
    url: "web3://0x4e1f41613c9084fdb9e34e11fae9412427480e56/tokenHTML/1/string!2.svg",
    expectedResult: {
      mode: "auto",
      contractCallMode: 'method',
      methodName: "tokenHTML",
      methodArgs: [{type: 'uint256'}, {type: 'string'}],
      methodArgValues: [1, "2.svg"],
      methodReturn: [{type: 'string'}],
      contractReturnProcessing: 'firstValue',
      contractReturnProcessingOptions: {mimeType: 'image/svg+xml'},
    }
  },

  // MIME : ERC-7087 extension
  {
    name: "MIME (ERC-7087): mime type specified",
    url: "web3://0x4e1f41613c9084fdb9e34e11fae9412427480e56/tokenSVG/1?mime.content=image%2Fsvg%2Bxml",
    expectedResult: {
      mode: "auto",
      contractCallMode: 'method',
      methodName: "tokenSVG",
      methodArgs: [{type: 'uint256'}],
      methodArgValues: [1],
      methodReturn: [{type: 'string'}],
      contractReturnProcessing: 'firstValue', 
      contractReturnProcessingOptions: {mimeType: 'image/svg+xml'},
    }
  },
  {
    name: "MIME (ERC-7087): Invalid mime type specified",
    url: "web3://0x4e1f41613c9084fdb9e34e11fae9412427480e56/tokenSVG/1?mime.content=xoxo",
    expectedException: "Invalid MIME type: xoxo",
  },
  {
    name: "MIME (ERC-7087): filename extension specified",
    url: "web3://0x4e1f41613c9084fdb9e34e11fae9412427480e56/tokenSVG/1?mime.type=svg",
    expectedResult: {
      mode: "auto",
      contractCallMode: 'method',
      methodName: "tokenSVG",
      methodArgs: [{type: 'uint256'}],
      methodArgValues: [1],
      methodReturn: [{type: 'string'}],
      contractReturnProcessing: 'firstValue', 
      contractReturnProcessingOptions: {mimeType: 'image/svg+xml'},
    }
  },
  {
    name: "MIME (ERC-7087): Invalid filename extension specified",
    url: "web3://0x4e1f41613c9084fdb9e34e11fae9412427480e56/tokenSVG/1?mime.type=%2F%2F",
    expectedException: "Invalid filename extension: //",
  },
  {
    name: "MIME (ERC-7087): Non-existing filename extension specified",
    url: "web3://0x4e1f41613c9084fdb9e34e11fae9412427480e56/tokenSVG/1?mime.type=abcdefg",
    expectedException: "No MIME type found for filename extension: abcdefg",
  },


  // JSON return
  {
    name: "JSON return: no types",
    url: "web3://0x4e1f41613c9084fdb9e34e11fae9412427480e56/tokenHTML/1?returns=()",
    expectedResult: {
      mode: "auto",
      contractCallMode: 'method',
      methodName: "tokenHTML",
      methodArgs: [{type: 'uint256'}],
      methodArgValues: [1],
      methodReturn: [{type: 'bytes'}],
      contractReturnProcessing: 'jsonEncode',
      contractReturnProcessingOptions: {},
    }
  },
  {
    name: "JSON return: types specified",
    url: "web3://0xA5aFC9fE76a28fB12C60954Ed6e2e5f8ceF64Ff2/levelAndTile/2/50?returns=(uint256,uint256)",
    expectedResult: {
      mode: "auto",
      contractCallMode: 'method',
      methodName: "levelAndTile",
      methodArgs: [{type: 'uint256'}, {type: 'uint256'}],
      methodArgValues: [2, 50],
      methodReturn: [{type: 'uint256'}, {type: 'uint256'}],
      contractReturnProcessing: 'jsonEncode',
      contractReturnProcessingOptions: {},
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
      methodArgs: [{type: 'uint256'}, {type: 'string'}],
      methodArgValues: [2, "50.svg"],
      methodReturn: [{type: 'uint256'}, {type: 'uint256'}],
      contractReturnProcessing: 'jsonEncode',
      contractReturnProcessingOptions: {},
    }
  },

  // URI decoding
  {
    name: "URI encoding: Decoding of basic encoding",
    url: "web3://0x4e1f41613c9084fdb9e34e11fae9412427480e56/tokenHTML/string!%201%3F",
    expectedResult: {
      mode: "auto",
      contractCallMode: 'method',
      methodName: "tokenHTML",
      methodArgs: [{type: 'string'}],
      methodArgValues: [" 1?"],
      methodReturn: [{type: 'string'}],
      contractReturnProcessing: 'firstValue',
      contractReturnProcessingOptions: {mimeType: null},
    }
  },
  {
    name: "URI encoding: Decoding of utf8 encoding",
    url: "web3://0x4e1f41613c9084fdb9e34e11fae9412427480e56/tokenHTML/string!%E2%86%92",
    expectedResult: {
      mode: "auto",
      contractCallMode: 'method',
      methodName: "tokenHTML",
      methodArgs: [{type: 'string'}],
      methodArgValues: ["→"],
      methodReturn: [{type: 'string'}],
      contractReturnProcessing: 'firstValue',
      contractReturnProcessingOptions: {mimeType: null},
    }
  },
]

for(let i = 0; i < tests.length; i++) {
  const tst = tests[i]

  test(tst.name + " : " + tst.url, async () => {
    if(tst.expectedException) {
      await expect(async () => {await parseUrl(tst.url)}).rejects.toThrowError(tst.expectedException)
    }
    else {
      let parsedUrl = await parseUrl(tst.url)
      for (const [fieldName, fieldValue] of Object.entries(tst.expectedResult)) {
        expect(parsedUrl[fieldName]).toEqual(fieldValue);
      }
    }
  }, 15000 /* ms of timeout */);

}