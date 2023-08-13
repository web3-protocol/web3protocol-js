const { parseUrl } = require('../src/index');

const tests = [
  {
    name: "5219 mode: root directory",
    url: "web3://0xF9247f85E2E122e6d9bf107e49Ceb2c4cb64E555:5/",
    expectedResult: {
      mode: "5219",
      contractCallMode: 'method',
      methodName: "request",
      methodArgs: [{type: 'string[]'}, {type: 'tuple[]', components: [{type: "string"}, {type: "string"}]}],
      methodArgValues: [[], []],
      methodReturn: [{type: 'uint16'}, {type: 'string'}, {type: 'tuple[]', components: [{type: "string"}, {type: "string"}]}],
      contractReturnProcessing: 'erc5219',
      contractReturnProcessingOptions: {},
    }
  },
  {
    name: "5219 mode: path",
    url: "web3://0xF9247f85E2E122e6d9bf107e49Ceb2c4cb64E555:5/view/1234",
    expectedResult: {
      mode: "5219",
      contractCallMode: 'method',
      methodName: "request",
      methodArgs: [{type: 'string[]'}, {type: 'tuple[]', components: [{type: "string"}, {type: "string"}]}],
      methodArgValues: [["view", "1234"], []],
      methodReturn: [{type: 'uint16'}, {type: 'string'}, {type: 'tuple[]', components: [{type: "string"}, {type: "string"}]}],
      contractReturnProcessing: 'erc5219',
      contractReturnProcessingOptions: {},
    }
  },
  {
    name: "5219 mode: path with params",
    url: "web3://0xF9247f85E2E122e6d9bf107e49Ceb2c4cb64E555:5/view/1234?aa=bb",
    expectedResult: {
      mode: "5219",
      contractCallMode: 'method',
      methodName: "request",
      methodArgs: [{type: 'string[]'}, {type: 'tuple[]', components: [{type: "string"}, {type: "string"}]}],
      methodArgValues: [["view", "1234"], [["aa", "bb"]]],
      methodReturn: [{type: 'uint16'}, {type: 'string'}, {type: 'tuple[]', components: [{type: "string"}, {type: "string"}]}],
      contractReturnProcessing: 'erc5219',
      contractReturnProcessingOptions: {},
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