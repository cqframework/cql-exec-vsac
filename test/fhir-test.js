const fhir = require('../src/fhir');
const { Code, ValueSet } = require('cql-execution');
const path = require('path');
const fs = require('fs-extra');
const nock = require('nock');
const chai = require('chai');
const should = chai.should();
const temp = require('temp');
const TOBACCO_VS_DB = fixVSDBFixture(require('./fixtures/2.16.840.1.113883.3.600.2390-vsdb.json'));
const SYSTOLIC_VS_DB = fixVSDBFixture(
  require('./fixtures/2.16.840.1.113883.3.526.3.1032-vsdb.json')
);

describe('FHIR', () => {
  let tmpCache;

  beforeEach(() => {
    tmpCache = temp.mkdirSync('cql-exec-vsac-test');
  });

  afterEach(function () {
    // Clean up vars, check and clean nock, delete tmp folder
    nock.isDone();
    nock.cleanAll();
  });

  describe('#downloadValueSet', () => {
    it('should download a value set by OID', async () => {
      nock('https://cts.nlm.nih.gov')
        .get('/fhir/ValueSet/2.16.840.1.113883.3.600.2390/$expand')
        .basicAuth({ user: 'apikey', pass: 'testkey' })
        .query({ offset: 0 })
        .replyWithFile(200, path.join(__dirname, 'fixtures', '2.16.840.1.113883.3.600.2390.json'));

      const vsDB = {};
      const result = await fhir.downloadValueSet(
        'testkey',
        '2.16.840.1.113883.3.600.2390',
        undefined,
        tmpCache,
        vsDB,
        true
      );
      // Should cache the JSON response
      const expectedJSONFile = path.join(tmpCache, '2.16.840.1.113883.3.600.2390.json');
      result.should.equal(expectedJSONFile);
      const jsonContents = await fs.readJson(expectedJSONFile);
      jsonContents.should.have.length(1);
      jsonContents[0].title.should.equal('Current Tobacco Smoker');
      // Should add the results to the VS DB
      vsDB.should.eql(TOBACCO_VS_DB);
    });

    it('should download a value set by OID and version', async () => {
      nock('https://cts.nlm.nih.gov')
        .get('/fhir/ValueSet/2.16.840.1.113883.3.600.2390/$expand')
        .basicAuth({ user: 'apikey', pass: 'testkey' })
        .query({ offset: 0, valueSetVersion: '20210304' })
        .replyWithFile(200, path.join(__dirname, 'fixtures', '2.16.840.1.113883.3.600.2390.json'));

      const vsDB = {};
      const result = await fhir.downloadValueSet(
        'testkey',
        '2.16.840.1.113883.3.600.2390',
        '20210304',
        tmpCache,
        vsDB,
        true
      );
      // Should cache the JSON response
      const expectedJSONFile = path.join(tmpCache, '2.16.840.1.113883.3.600.2390.json');
      result.should.equal(expectedJSONFile);
      const jsonContents = await fs.readJson(expectedJSONFile);
      jsonContents.should.have.length(1);
      jsonContents[0].title.should.equal('Current Tobacco Smoker');
      // Should add the results to the VS DB
      vsDB.should.eql(TOBACCO_VS_DB);
    });

    it('should merge value sets into the value set database', async () => {
      nock('https://cts.nlm.nih.gov')
        .get('/fhir/ValueSet/2.16.840.1.113883.3.526.3.1032/$expand')
        .basicAuth({ user: 'apikey', pass: 'testkey' })
        .query({ offset: 0 })
        .replyWithFile(200, path.join(__dirname, 'fixtures', '2.16.840.1.113883.3.526.3.1032.json'))
        .get('/fhir/ValueSet/2.16.840.1.113883.3.600.2390/$expand')
        .basicAuth({ user: 'apikey', pass: 'testkey' })
        .query({ offset: 0 })
        .replyWithFile(200, path.join(__dirname, 'fixtures', '2.16.840.1.113883.3.600.2390.json'));

      const vsDB = {};
      await Promise.all([
        fhir.downloadValueSet(
          'testkey',
          '2.16.840.1.113883.3.526.3.1032',
          undefined,
          tmpCache,
          vsDB,
          true
        ),
        fhir.downloadValueSet(
          'testkey',
          '2.16.840.1.113883.3.600.2390',
          undefined,
          tmpCache,
          vsDB,
          true
        )
      ]);
      // Should add the results to the VS DB
      Object.keys(vsDB).should.have.length(2);
      vsDB['2.16.840.1.113883.3.526.3.1032'].should.eql(
        SYSTOLIC_VS_DB['2.16.840.1.113883.3.526.3.1032']
      );
      vsDB['2.16.840.1.113883.3.600.2390'].should.eql(
        TOBACCO_VS_DB['2.16.840.1.113883.3.600.2390']
      );
    });

    it('should download large value sets in pages', async () => {
      const pages = fs.readJsonSync(
        path.join(__dirname, 'fixtures', '2.16.840.1.113883.3.600.2390-pages.json')
      );
      nock('https://cts.nlm.nih.gov')
        // Page 1
        .get('/fhir/ValueSet/2.16.840.1.113883.3.600.2390/$expand')
        .basicAuth({ user: 'apikey', pass: 'testkey' })
        .query({
          offset: 0,
          valueSetVersion: '20210304'
        })
        .reply(200, pages[0])
        // Page 2
        .get('/fhir/ValueSet/2.16.840.1.113883.3.600.2390/$expand')
        .basicAuth({ user: 'apikey', pass: 'testkey' })
        .query({
          offset: 10,
          valueSetVersion: '20210304'
        })
        .reply(200, pages[1])
        // Page 3
        .get('/fhir/ValueSet/2.16.840.1.113883.3.600.2390/$expand')
        .basicAuth({ user: 'apikey', pass: 'testkey' })
        .query({
          offset: 20,
          valueSetVersion: '20210304'
        })
        .reply(200, pages[2]);

      const vsDB = {};
      const result = await fhir.downloadValueSet(
        'testkey',
        '2.16.840.1.113883.3.600.2390',
        '20210304',
        tmpCache,
        vsDB,
        true
      );
      // Should cache the JSON response
      const expectedJSONFile = path.join(tmpCache, '2.16.840.1.113883.3.600.2390.json');
      result.should.equal(expectedJSONFile);
      const jsonContents = await fs.readJson(expectedJSONFile);
      jsonContents.should.have.length(3);
      jsonContents[0].title.should.equal('Current Tobacco Smoker');
      // Should add the results to the VS DB
      vsDB.should.eql(TOBACCO_VS_DB);
    });

    it('should error if value set is not found', async () => {
      nock('https://cts.nlm.nih.gov')
        .get('/fhir/ValueSet/1.2.3.4.5.6.7.8.9.10/$expand')
        .basicAuth({ user: 'apikey', pass: 'testkey' })
        .query({ offset: 0, valueSetVersion: '20170320' })
        .reply(404); // Not Found

      const vsDB = {};
      try {
        await fhir.downloadValueSet(
          'testkey',
          '1.2.3.4.5.6.7.8.9.10',
          '20170320',
          tmpCache,
          vsDB,
          true
        );
        should.fail(0, 1, 'This code should never be executed');
      } catch (error) {
        vsDB.should.be.empty;
        fs.existsSync(path.join(tmpCache, '1.2.3.4.5.6.7.8.9.10.xml')).should.be.false;
        error.should.be.an('error');
        error.message.should.equal('404');
      }
    });
  });
});

function fixVSDBFixture(vsDB) {
  const fixed = {};
  for (const oid of Object.keys(vsDB)) {
    fixed[oid] = {};
    for (const version of Object.keys(vsDB[oid])) {
      const codes = vsDB[oid][version].codes.map(code => {
        return new Code(code.code, code.system, code.version);
      });
      fixed[oid][version] = new ValueSet(oid, version, codes);
    }
  }
  return fixed;
}
