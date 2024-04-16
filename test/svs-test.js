const svs = require('../src/svs');
const { Code, ValueSet } = require('cql-execution');
const path = require('path');
const fs = require('fs-extra');
const nock = require('nock');
const chai = require('chai');
const should = chai.should();
const temp = require('temp');
const TOBACCO_VS_DB = fixVSDBFixture(require('./fixtures/2.16.840.1.113883.3.600.2390-vsdb.json'));
const TOBACCO_OID_VS_DB = fixVSDBFixture(
  require('./fixtures/2.16.840.1.113883.3.600.2390-oid-vsdb.json')
);
const TOBACCO_OID_URI_VS_DB = fixVSDBFixture(
  require('./fixtures/2.16.840.1.113883.3.600.2390-oid-uri-vsdb.json')
);
const SYSTOLIC_VS_DB = fixVSDBFixture(
  require('./fixtures/2.16.840.1.113883.3.526.3.1032-vsdb.json')
);
const SYSTOLIC_OID_VS_DB = fixVSDBFixture(
  require('./fixtures/2.16.840.1.113883.3.526.3.1032-oid-vsdb.json')
);
const SYSTOLIC_OID_URI_VS_DB = fixVSDBFixture(
  require('./fixtures/2.16.840.1.113883.3.526.3.1032-oid-uri-vsdb.json')
);

describe('SVS', () => {
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
      nock('https://vsac.nlm.nih.gov')
        .get('/vsac/svs/RetrieveValueSet')
        .basicAuth({ user: 'apikey', pass: 'testkey' })
        .query({
          id: '2.16.840.1.113883.3.600.2390'
        })
        .replyWithFile(200, path.join(__dirname, 'fixtures', '2.16.840.1.113883.3.600.2390.xml'));

      const vsDB = {};
      const result = await svs.downloadValueSet(
        'testkey',
        '2.16.840.1.113883.3.600.2390',
        undefined,
        tmpCache,
        vsDB,
        true
      );
      // Should cache the XML response
      const expectedXMLFile = path.join(tmpCache, '2.16.840.1.113883.3.600.2390.xml');
      result.should.equal(expectedXMLFile);
      const xmlContents = await fs.readFile(expectedXMLFile, 'utf-8');
      xmlContents.should.match(/<\?xml(.|\n|\r)*displayName="Current Tobacco Smoker"/m);
      // Should add the results to the VS DB
      vsDB.should.eql(TOBACCO_VS_DB);
    });

    it('should download a value set by OID and version', async () => {
      nock('https://vsac.nlm.nih.gov')
        .get('/vsac/svs/RetrieveValueSet')
        .basicAuth({ user: 'apikey', pass: 'testkey' })
        .query({
          id: '2.16.840.1.113883.3.600.2390',
          version: '20210304'
        })
        .replyWithFile(200, path.join(__dirname, 'fixtures', '2.16.840.1.113883.3.600.2390.xml'));

      const vsDB = {};
      const result = await svs.downloadValueSet(
        'testkey',
        '2.16.840.1.113883.3.600.2390',
        '20210304',
        tmpCache,
        vsDB,
        true
      );
      // Should cache the XML response
      const expectedXMLFile = path.join(tmpCache, '2.16.840.1.113883.3.600.2390.xml');
      result.should.equal(expectedXMLFile);
      const xmlContents = await fs.readFile(expectedXMLFile, 'utf-8');
      xmlContents.should.match(/<\?xml(.|\n|\r)*displayName="Current Tobacco Smoker"/m);
      // Should add the results to the VS DB
      vsDB.should.eql(TOBACCO_VS_DB);
    });

    it('should merge value sets into the value set database', async () => {
      nock('https://vsac.nlm.nih.gov')
        .get('/vsac/svs/RetrieveValueSet')
        .basicAuth({ user: 'apikey', pass: 'testkey' })
        .query({
          id: '2.16.840.1.113883.3.526.3.1032'
        })
        .replyWithFile(200, path.join(__dirname, 'fixtures', '2.16.840.1.113883.3.526.3.1032.xml'))
        .get('/vsac/svs/RetrieveValueSet')
        .basicAuth({ user: 'apikey', pass: 'testkey' })
        .query({
          id: '2.16.840.1.113883.3.600.2390'
        })
        .replyWithFile(200, path.join(__dirname, 'fixtures', '2.16.840.1.113883.3.600.2390.xml'));

      const vsDB = {};
      await Promise.all([
        svs.downloadValueSet(
          'testkey',
          '2.16.840.1.113883.3.526.3.1032',
          undefined,
          tmpCache,
          vsDB,
          true
        ),
        svs.downloadValueSet(
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

    it('should merge value sets into the value set database, using default url options when empty options is included', async () => {
      nock('https://vsac.nlm.nih.gov')
        .get('/vsac/svs/RetrieveValueSet')
        .basicAuth({ user: 'apikey', pass: 'testkey' })
        .query({
          id: '2.16.840.1.113883.3.526.3.1032'
        })
        .replyWithFile(200, path.join(__dirname, 'fixtures', '2.16.840.1.113883.3.526.3.1032.xml'))
        .get('/vsac/svs/RetrieveValueSet')
        .basicAuth({ user: 'apikey', pass: 'testkey' })
        .query({
          id: '2.16.840.1.113883.3.600.2390'
        })
        .replyWithFile(200, path.join(__dirname, 'fixtures', '2.16.840.1.113883.3.600.2390.xml'));

      const vsDB = {};
      await Promise.all([
        svs.downloadValueSet(
          'testkey',
          '2.16.840.1.113883.3.526.3.1032',
          undefined,
          tmpCache,
          vsDB,
          true,
          {}
        ),
        svs.downloadValueSet(
          'testkey',
          '2.16.840.1.113883.3.600.2390',
          undefined,
          tmpCache,
          vsDB,
          true,
          {}
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

    it('should merge value sets into the value set database while maintaining original system', async () => {
      nock('https://vsac.nlm.nih.gov')
        .get('/vsac/svs/RetrieveValueSet')
        .basicAuth({ user: 'apikey', pass: 'testkey' })
        .query({
          id: '2.16.840.1.113883.3.526.3.1032'
        })
        .replyWithFile(200, path.join(__dirname, 'fixtures', '2.16.840.1.113883.3.526.3.1032.xml'))
        .get('/vsac/svs/RetrieveValueSet')
        .basicAuth({ user: 'apikey', pass: 'testkey' })
        .query({
          id: '2.16.840.1.113883.3.600.2390'
        })
        .replyWithFile(200, path.join(__dirname, 'fixtures', '2.16.840.1.113883.3.600.2390.xml'));

      const vsDB = {};
      await Promise.all([
        svs.downloadValueSet(
          'testkey',
          '2.16.840.1.113883.3.526.3.1032',
          undefined,
          tmpCache,
          vsDB,
          true,
          { svsCodeSystemType: 'oid' }
        ),
        svs.downloadValueSet(
          'testkey',
          '2.16.840.1.113883.3.600.2390',
          undefined,
          tmpCache,
          vsDB,
          true,
          { svsCodeSystemType: 'oid' }
        )
      ]);
      // Should add the results to the VS DB
      Object.keys(vsDB).should.have.length(2);
      vsDB['2.16.840.1.113883.3.526.3.1032'].should.eql(
        SYSTOLIC_OID_VS_DB['2.16.840.1.113883.3.526.3.1032']
      );
      vsDB['2.16.840.1.113883.3.600.2390'].should.eql(
        TOBACCO_OID_VS_DB['2.16.840.1.113883.3.600.2390']
      );
    });

    it('should merge value sets into the value set database while including both uri and oid versions of codes', async () => {
      nock('https://vsac.nlm.nih.gov')
        .get('/vsac/svs/RetrieveValueSet')
        .basicAuth({ user: 'apikey', pass: 'testkey' })
        .query({
          id: '2.16.840.1.113883.3.526.3.1032'
        })
        .replyWithFile(200, path.join(__dirname, 'fixtures', '2.16.840.1.113883.3.526.3.1032.xml'))
        .get('/vsac/svs/RetrieveValueSet')
        .basicAuth({ user: 'apikey', pass: 'testkey' })
        .query({
          id: '2.16.840.1.113883.3.600.2390'
        })
        .replyWithFile(200, path.join(__dirname, 'fixtures', '2.16.840.1.113883.3.600.2390.xml'));

      const vsDB = {};
      await Promise.all([
        svs.downloadValueSet(
          'testkey',
          '2.16.840.1.113883.3.526.3.1032',
          undefined,
          tmpCache,
          vsDB,
          true,
          { svsCodeSystemType: 'both' }
        ),
        svs.downloadValueSet(
          'testkey',
          '2.16.840.1.113883.3.600.2390',
          undefined,
          tmpCache,
          vsDB,
          true,
          { svsCodeSystemType: 'both' }
        )
      ]);
      // Should add the results to the VS DB
      Object.keys(vsDB).should.have.length(2);
      vsDB['2.16.840.1.113883.3.526.3.1032'].should.eql(
        SYSTOLIC_OID_URI_VS_DB['2.16.840.1.113883.3.526.3.1032']
      );
      vsDB['2.16.840.1.113883.3.600.2390'].should.eql(
        TOBACCO_OID_URI_VS_DB['2.16.840.1.113883.3.600.2390']
      );
    });

    it('should error if value set is not found', async () => {
      nock('https://vsac.nlm.nih.gov')
        .get('/vsac/svs/RetrieveValueSet')
        .basicAuth({ user: 'apikey', pass: 'testkey' })
        .query({
          id: '1.2.3.4.5.6.7.8.9.10',
          version: '20170320'
        })
        .reply(404); // Not Found

      const vsDB = {};
      try {
        await svs.downloadValueSet(
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
        return new Code(
          code.code,
          code.system,
          code.version.replace(
            /^http:\/\/snomed\.info\/sct\/\d+\/version\/(\d{4})(\d{2})\d{2}/,
            '$1-$2'
          )
        );
      });
      fixed[oid][version] = new ValueSet(oid, version, codes);
    }
  }
  return fixed;
}
