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

When using the canonical URL as a Value Set identifier, it is also possible to embed the version directly in the URL,
using a vertical bar (`|`) to separate the identifier and version:

```
valueset "Diabetes": 'https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.103.12.1001|20190315'
```

The embedded version, however, is only supported for the canonical URL form of value sets.  It is not supported for URN
or OID identifiers.

## Credentials Required

This library requires that the credentials of a valid UMLS account be provided to it.  If you do not have an UMLS
account, you can request one here: https://uts.nlm.nih.gov/license.html

# Setting Up the Environment

To use this project, you should perform the following steps:

1. Install [Node.js](https://nodejs.org/en/download/)
2. Execute the following from this project's root directory: `npm install`

# Using the VSAC Code Service

## The Local Cache

The VSAC Code Service is constructed with a file path pointing to the location where the cache should be stored.  If
a file location is not passed into the constructor, it will default the cache to a folder called `vsac_cache` in the
working directory.  The cache is used to store value sets and their codes after retrieving them from VSAC.  This
prevents the code service from having to make multiple calls to VSAC for the same value set.

The second argument to the `CodeService` constructor is a boolean indicating if the code service should begin by
loading existing value sets from the cache.  If true, it will initialize the code service from the cache (if the
cache exists and is populated).  If false, `ensureValueSetsWithAPIKey` will re-download any value sets passed to it,
overwriting the cache.

## Using UMLS Credentials

Downloading value set definitions from VSAC requires a valid UMLS account.  The code service's
`ensureValueSetsWithAPIKey` function allows a UMLS API key to be passed in.  Alternately, the UMLS API key can be
provided via the `UMLS_API_KEY` environment variable.

## Downloading Value Set Definitions

The `ensureValueSetsWithAPIKey` and `ensureValueSetsInLibraryWithAPIKey` functions are the only functions that attempt
to download value sets from VSAC.  Before they make a request to VSAC, they will check the cache.  If the value set is
already in the cache, they will not make a request to VSAC.  Otherwise, they will use VSAC's SVS2 API to download the
expanded codes from the value set.

The `findValueSet` and `findValueSets` functions (including the legacy `findValueSetsByOid` function) do not reach out
to VSAC, so implementations should call `ensureValueSetsInLibraryWithAPIKey` or `ensureValueSetsWithAPIKey` before
attempting to execute CQL.  If `ensureValueSetsWithAPIKey` is used, the implementor is responsible for passing in the
OIDs / versions that will be needed.

## Breaking Changes in Version 2.0.0

Version 2.0.0 of the code service removes the old `ensureValueSets` and `ensureValueSetsInLibrary` methods that
accepted a UMLS user name and password. As of Jan 1, 2021, VSAC no longer allows API authentication using username and
password. Instead, implementations should now use `ensureValueSetsWithAPIKey` and `ensureValueSetsInLibraryWithApiKey`,
each of which allows an API key to be passed in (or to be specified via the `UMLS_API_KEY` environment variables).

In addition, version 2.0.0 switched its communication library from [request](https://www.npmjs.com/package/request)
to [node-fetch](https://www.npmjs.com/package/node-fetch). This should be transparent in most cases, but some thrown
errors may have a different format since they are thrown by _node-fetch_ rather than _request_.

## Example

The following is a simple example of setting up the VSAC Code Service, calling `ensureValueSetsInLibraryWithApiKey`,
and passing the Code Service into the CQL Execution engine:

```js
const vsac = require('cql-exec-vsac');

// Code setting up the CQL library, patient source, parameters, etc
// ...

// Set up the code service, loading from the cache if it exists
const codeService = new vsac.CodeService('/path/to/vsac_cache', true);
// Ensure value sets in the library and its dependencies, downloading any missing value sets
codeService.ensureValueSetsInLibraryWithApiKey(library, true, 'myUmlsApiKey')
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

To encourage quality and consistency within the code base, all code should pass eslint without any warnings.  Many text editors can be configured to automatically flag eslint violations.  We also provide an npm script for running eslint on the project.  To check your code against eslint's rules, execute the following command:
```
$ npm run lint
```

To fix any code that violates eslint's rules:
```
$ npm run lint:fix
```

# Prettier

To encourage quality and consistency within the code base, all code should also be formatted using [Prettier](https://prettier.io/).  Many text editors can be configured to automatically reformat code using Prettier on save.  We also provide an npm script for running prettier on the project.  To check your code against Prettier's rules, execute the following command:
```
$ npm run prettier
```

To fix any code that violates Prettier's rules:
```
$ npm run prettier:fix
```