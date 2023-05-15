function parseManualUrl(path) {
  // Path must be at least "/"
  if(path === undefined || path == "") {
    path = "/";
  }

  // We are sending decoded path as the 
  let decodedPath = decodeURIComponent(path)
  let callData = "0x" + Buffer.from(decodedPath).toString('hex')

  result = {
    callData: callData,
  }
  return result
}

module.exports = { parseManualUrl }