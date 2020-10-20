# CQL Execution VSAC Code Service

This project establishes a VSAC-enabled code service module for use with the CQL Execution Engine.  This allows the
CQL Execution Engine to execute CQL containing references to Value Sets that are published in the National Library of
Medicine's (NLM) Value Set Authority Center (VSAC).  Value Set references can be defined using a valid VSAC
identifying URL for the value set, a URN, or the oid itself.  For example:

```
valueset "Diabetes": 'https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.103.12.1001'
// or valueset "Diabetes": 'urn:oid:2.16.840.1.113883.3.464.1003.103.12.1001'
// or valueset "Diabetes": '2.16.840.1.113883.3.464.1003.103.12.1001'
```

As of 1.1.1, this library supports Value Set versions, so the following is also supported:

```
valueset "Diabetes": 'https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.103.12.1001' version '20190315'
// or valueset "Diabetes": 'urn:oid:2.16.840.1.113883.3.464.1003.103.12.1001' version '20190315'
// or valueset "Diabetes": '2.16.840.1.113883.3.464.1003.103.12.1001' version '20190315'
```

When using the canonical URL as a Value Set identifier, it is also possible to embed the version directly in the URL, using a vertical bar (`|`) to separate the identifier and version:

```
valueset "Diabetes": 'https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.103.12.1001|20190315'
```

The embedded version, however, is only supported for the canonical URL form of value sets.  It is not supported for URN or OID identifiers.

## Credentials Required

This library requires that the credentials of a valid UMLS account be provided to it.  If you do not have an UMLS
account, you can request one here: https://uts.nlm.nih.gov/license.html

# Setting Up the Environment

To use this project, you should perform the following steps:

1. Install [Node.js](https://nodejs.org/en/download/)
2. Install [Yarn](https://yarnpkg.com/en/docs/install)
3. Execute the following from this project's root directory: `yarn`

# Using the VSAC Code Service

## The Local Cache

The VSAC Code Service is constructed with a file path pointing to the location where the cache should be stored.  If
a file location is not passed into the constructor, it will default the cache to a folder called `vsac_cache` in the
working directory.  The cache is used to store value sets and their codes after retrieving them from VSAC.  This
prevents the code service from having to make multiple calls to VSAC for the same value set.

The second argument to the `CodeService` constructor is a boolean indicating if the code service should begin by
loading existing value sets from the cache.  If true, it will initialize the code service from the cache (if the
cache exists and is populated).  If false, `ensureValueSets` will re-download any value sets passed to it, overwriting
the cache.

## Using UMLS Credentials

Downloading value set definitions from VSAC requires a valid UMLS account.  The code service's `ensureValueSets`
function allows a UMLS username and password to be passed in.  Alternately, the UMLS username and password can be
provided via `UMLS_USER_NAME` and `UMLS_PASSWORD` environment variables.

**NOTE**: As of Jan 1 2021 VSAC will no longer accept accept username and password and will require an API key.  The code 
service's `ensureValueSetsWithAPIKey` allows a UMLS API key to be passed in.  Alternatively, the UMLS API key can be
provided via `UMLS_API_KEY` environment variables.

## Downloading Value Set Definitions

The `ensureValueSets` and `ensureValueSetsInLibrary` functions are the only functions that attempt to download value
sets from VSAC.  Before they make a request to VSAC, they will check the cache.  If the value set is already in the
cache, they will not make a request to VSAC.  Otherwise, they will use VSAC's SVS2 API to download the expanded codes
from the value set.

The `findValueSet` and `findValueSets` functions (including the legacy `findValueSetsByOid` function) do not reach out
to VSAC, so implementations should call `ensureValueSetsInLibrary` or `ensureValueSets` before attempting to execute
CQL.  If `ensureValueSets` is used, the implementor is responsible for passing in the OIDs / versions that will be
needed.

## Example

The following is a simple example of setting up the VSAC Code Service, calling `ensureValueSets`, and passing the
Code Service into the CQL Execution engine:

```js
const vsac = require('cql-exec-vsac');

// Code setting up the CQL library, patient source, parameters, etc
// ...

// Set up the code service, loading from the cache if it exists
const codeService = new vsac.CodeService('/path/to/vsac_cache', true);
// Ensure value sets in the library and its dependencies, downloading any missing value sets
codeService.ensureValueSetsInLibrary(library, true, 'myUMLSUserName', 'myUMLSPassword')
.then(() => {
  // Value sets are loaded, so execute!
  const executor = new cql.Executor(lib, codeService, parameters);
  const results = executor.exec(patientSource);
  // Do something with results...
})
.catch( (err) => {
  // There was an error downloading the value sets!
  console.error('Error downloading value sets', err);
});
```

# Linting the Code

To encourage quality and consistency within the code base, all code should pass eslint without any warnings.  Many text editors can be configured to automatically flag eslint violations.  We also provide an npm script for running eslint on the project.  To run eslint, execute the following command:
```
$ yarn lint
```