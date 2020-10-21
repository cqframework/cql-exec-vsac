/* eslint-disable no-console */
const { CodeService } = require('./lib/CodeService');
const proc = require('process');
const env = proc.env;

const VALUESET = { name: 'HDL Cholesterol', id: '2.16.840.1.113883.3.464.1003.104.12.1013' };

async function main() {
  if (env['UMLS_USER_NAME'] == null && env['UMLS_PASSWORD'] == null && env['UMLS_API_KEY'] == null) {
    console.error('This test requires you to set the UMLS_API_KEY environment variable');
    process.exit(1);
  }

  const codeService = new CodeService('manual-test-vsac-cache', false);
  console.log(`CALL: codeService.findValueSet(${VALUESET.id})`);
  console.log('EXPECT: undefined');
  let found = codeService.findValueSet(VALUESET.id);
  console.log(`RESULT: ${found}`);
  console.log();
  console.log(`CALL: codeService.ensureValueSetsWithAPIKey(['${JSON.stringify(VALUESET)}'], env['UMLS_API_KEY'], false);`);
  await codeService.ensureValueSetsWithAPIKey([VALUESET], env['UMLS_API_KEY'], false);
  console.log('EXPECT: <void>');
  console.log(`RESULT: <void>`);
  console.log();
  console.log(`CALL: codeService.findValueSet(${VALUESET.id})`);
  found = codeService.findValueSet(VALUESET.id);
  console.log('EXPECT: <valueSet w/ two codes>');
  console.log(`RESULT: ${JSON.stringify(found, null, 2)}`);
}

main().catch(e => console.error(e));

