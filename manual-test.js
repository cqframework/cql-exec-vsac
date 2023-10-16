/* eslint-disable no-console */
const { CodeService } = require('./src/CodeService');
const proc = require('process');
const env = proc.env;

const VALUESET = {
  name: 'HDL Cholesterol',
  id: '2.16.840.1.113883.3.464.1003.104.12.1013'
};
// Use this value set if you want something > 1000 codes
// const VALUESET = {
//   name: 'Diabetes mellitus',
//   id: '2.16.840.1.113762.1.4.1078.405'
// };

async function main() {
  if (env['UMLS_API_KEY'] == null) {
    console.error('This test requires you to set the UMLS_API_KEY environment variable');
    process.exit(1);
  }
  await run(false); // SVS
  console.log();
  await run(true); // FHIR
}

async function run(useFHIR) {
  const api = useFHIR ? 'FHIR' : 'SVS';
  const start = new Date();
  const codeService = new CodeService('manual-test-vsac-cache', false, useFHIR);
  console.log(`${api} CALL: codeService.findValueSet(${VALUESET.id})`);
  console.log('EXPECT: undefined');
  let found = codeService.findValueSet(VALUESET.id);
  console.log(`RESULT: ${found}`);
  console.log();
  console.log(
    `${api} CALL: codeService.ensureValueSetsWithAPIKey(['${JSON.stringify(
      VALUESET
    )}'], env['UMLS_API_KEY'], false);`
  );
  await codeService.ensureValueSetsWithAPIKey([VALUESET], env['UMLS_API_KEY'], false);
  console.log('EXPECT: <void>');
  console.log(`RESULT: <void>`);
  console.log();
  console.log(`${api} CALL: codeService.findValueSet(${VALUESET.id})`);
  found = codeService.findValueSet(VALUESET.id);
  console.log('EXPECT: <valueSet w/ two codes>');
  console.log(`RESULT: ${JSON.stringify(found, null, 2)}\n(${found.codes.length} codes)`);
  console.log();
  console.log(`${api} TOTAL TIME: ${new Date() - start} ms`);
}

main().catch(e => console.error(e));
