const { getChainIdByShortName, createChainForViem } = require('../src/chains/index');

const tests = [
  {
    name: "createChainForViem: Network 1 default RPC",
    chainId: 1,
    chainOverrides: [],
    expectedResult: {
      chainId: 1,
      rpcUrls: ["https://cloudflare-eth.com"],
    }
  },
  {
    name: "createChainForViem: Network 1 default RPC overriden",
    chainId: 1,
    chainOverrides: [{
      id: 1,
      rpcUrls: ['http://127.0.0.1:8545', 'https://boo2.com']
    }],
    expectedResult: {
      chainId: 1,
      rpcUrls: ['http://127.0.0.1:8545', 'https://boo2.com'],
    }
  },
  {
    name: "createChainForViem: Custom network with custom RPCs",
    chainId: 48465413515,
    chainOverrides: [{
      id: 48465413515,
      rpcUrls: ['https://boo.com', 'https://boo2.com']
    }],
    expectedResult: {
      chainId: 48465413515,
      rpcUrls: ['https://boo.com', 'https://boo2.com'],
    }
  },
]

for(let i = 0; i < tests.length; i++) {
  const tst = tests[i]

  test(tst.name, async () => {
    if(tst.expectedException) {
      await expect(async () => {await fetchUrl(tst.chainId, tst.chainOverrides)}).rejects.toThrowError(tst.expectedException)
    }
    else {
      let result = await createChainForViem(tst.chainId, tst.chainOverrides)

      expect(result.id).toEqual(tst.expectedResult.chainId);
      expect(result.rpcUrls.public.http).toEqual(tst.expectedResult.rpcUrls);
    }
  }, 15000 /* ms of timeout */);

}