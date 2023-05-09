const { parseUrl } = require('../src/index');

test('xxx', () => {
  let parsedUrl = parseUrl("web3://xxx")
  
  expect(parsedUrl.host).toBe(null);
});