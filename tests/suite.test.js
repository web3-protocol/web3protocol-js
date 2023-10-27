const toml = require('toml');
const fs = require("fs");
const { hexToBytes, bytesToString } = require('viem');

const { fetchUrl, parseUrl, processContractReturn } = require('../src/index');

const testSuiteFiles = [
  // "tests/tests/parsing-base.toml",
  // "tests/tests/parsing-mode-manual.toml",
  // "tests/tests/parsing-mode-auto.toml",
  // "tests/tests/parsing-mode-resource-request.toml",
  "tests/tests/contract-return-processing.toml",
  // "tests/tests/fetch.toml",
];

for(let k = 0; k < testSuiteFiles.length; k++) {

  let testSuiteToml = fs.readFileSync(testSuiteFiles[k])
  let testSuite = toml.parse(testSuiteToml)

  // console.dir(testSuite)
  // console.dir(testSuite.groups['argument-uint256']['tests'])

  Object.values(testSuite.groups).forEach(testGroup => {

    // We will only process some ERCs
    let isStandardSupported = false
    testGroup.standards.forEach(standard => {
      if(standard == "ERC-6860" || // Main, ERC-4804 clarified and modified
        standard == "ERC-6821" || // ENS name resolution
        standard == "ERC-6944" || // Resource request mode
        standard == "ERC-7087") { // Auto mode extensions
        isStandardSupported = true
      }
    })
    if(isStandardSupported == false) {
      return
    }

    // We skip the W3NS domain name service for now
    if(testGroup.name == "W3NS domain name service") {
      return
    }

    describe(testSuite.name + ": " + testGroup.name, () => {
      testGroup.tests.forEach(tst => {
        test(tst.name + ": " + tst.url, async () => {

          // Several types of tests
          // Test type: Parsing URL
          if(testSuite.type == 'urlParsing') {

            // Expected failure
            if(tst.error) {
              await expect(async () => {await parseUrl(tst.url)}).rejects.toThrowError()
              return
            }

            // Expected success
            let parsedUrl = await parseUrl(tst.url)

            if(tst.contractAddress) {
              expect(parsedUrl.contractAddress).toEqual(tst.contractAddress)
            }
            if(tst.chainId) {
              expect(parsedUrl.chainId).toEqual(tst.chainId)
            }

            if(tst.hostDomainNameResolver) {
              expect(parsedUrl.nameResolution.resolver).toEqual(tst.hostDomainNameResolver)
            }
            if(tst.hostDomainNameResolverChainId) {
              expect(parsedUrl.nameResolution.chainId).toEqual(tst.hostDomainNameResolverChainId)
            }

            if(tst.resolveMode) {
              expect(parsedUrl.mode).toEqual(tst.resolveMode)
            }
            if(tst.contractCallMode) {
              expect(parsedUrl.contractCallMode).toEqual(tst.contractCallMode)
            }

            if(tst.calldata) {
              expect(parsedUrl.calldata).toEqual(tst.calldata)
            }

            if(tst.methodName) {
              expect(parsedUrl.methodName).toEqual(tst.methodName)
            }
            if(tst.methodArgs && tst.methodArgs.length > 0) {
              expect(parsedUrl.methodArgs.length).toEqual(tst.methodArgs.length)
              for(let i = 0; i < tst.methodArgs.length; i++) {
                expect(parsedUrl.methodArgs[i].type).toEqual(tst.methodArgs[i].type)
              }
            }
            if(tst.methodArgValues && tst.methodArgValues.length > 0) {
              expect(parsedUrl.methodArgValues.length).toEqual(tst.methodArgValues.length)
              for(let i = 0; i < tst.methodArgValues.length; i++) {
                
                if(tst.methodArgs[i].type.substr(0, 3) == "int" || tst.methodArgs[i].type.substr(0, 4) == "uint") {
                  tst.methodArgValues[i].value = BigInt(tst.methodArgValues[i].value)
                }

                expect(parsedUrl.methodArgValues[i]).toEqual(tst.methodArgValues[i].value)
              }
            }

            if(tst.contractReturnProcessing) {
              expect(parsedUrl.contractReturnProcessing).toEqual(tst.contractReturnProcessing)
            }
            if(tst.decodedABIEncodedBytesMimeType) {
              expect(parsedUrl.contractReturnProcessingOptions.mimeType).toEqual(tst.decodedABIEncodedBytesMimeType)
            }
            if(tst.jsonEncodedValueTypes && tst.jsonEncodedValueTypes.length > 0) {
              expect(parsedUrl.methodReturn.length).toEqual(tst.jsonEncodedValueTypes.length)
              for(let i = 0; i < tst.jsonEncodedValueTypes.length; i++) {
                expect(parsedUrl.methodReturn[i].type).toEqual(tst.jsonEncodedValueTypes[i].type)
              }
            }
          }
          // Test type: Parsing URL
          else if(testSuite.type == 'contractReturnProcessing') {
            // Create and populate a parsedUrl
            parsedUrl = {
              contractReturnProcessing: tst.contractReturnProcessing,
              contractReturnProcessingOptions: {
                mimeType: tst.decodedABIEncodedBytesMimeType,
              },
              methodReturn: tst.jsonEncodedValueTypes
            }

            // Expected failure
            if(tst.error) {
              await expect(async () => {await processContractReturn(parsedUrl, tst.contractReturn)}).rejects.toThrowError()
              return
            }

            // Execute the processing
            fetchedWeb3Url = await processContractReturn(parsedUrl, tst.contractReturn)

            if(tst.output) {
              expect(fetchedWeb3Url.output).toEqual(hexToBytes(tst.output))
            }
            if(tst.outputAsString) {
              expect(bytesToString(fetchedWeb3Url.output)).toEqual(tst.outputAsString)
            }
            if(tst.httpCode) {
              expect(fetchedWeb3Url.httpCode).toEqual(tst.httpCode)
            }
            expect(fetchedWeb3Url.httpHeaders.length).toEqual(tst.httpHeaders.length)
            Object.keys(tst.httpHeaders).forEach(headerName => {
              expect(fetchedWeb3Url.httpHeaders[headerName]).toEqual(tst.httpHeaders[headerName])
            })


          }
        }, 15000 /* ms of timeout */)
      })
    })
  })
}