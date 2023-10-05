const cs = require('../src/CodeService');
const { Code, ValueSet } = require('cql-execution');
const path = require('path');
const fs = require('fs-extra');
const process = require('process');
const os = require('os');
const nock = require('nock');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const should = chai.should();

describe('CodeService', function () {
  before(function () {
    // These tests should never reach out to the network.  If they do, we've done something wrong!
    nock.disableNetConnect();
  });

  after(function () {
    nock.restore();
    nock.enableNetConnect();
  });

  describe('SVS API', function () {
    let service, tmpCache;
    const apiKey = process.env['UMLS_API_KEY'] || 'testkey';

    beforeEach(function (done) {
      // Create a temporary cache folder and construct the code service using it
      const [sec, nsec] = process.hrtime();
      tmpCache = path.join(os.tmpdir(), `test_${sec}_${nsec}-vsac_cache`);
      fs.mkdirs(tmpCache, err => {
        if (!err) {
          service = new cs.CodeService(tmpCache);
          service.loadValueSetsFromFile(path.join(__dirname, 'fixtures', 'valueset-db.json'));
        }
        done(err);
      });
    });

    afterEach(function (done) {
      // Clean up vars, check and clean nock, delete tmp folder
      service = null;
      nock.isDone();
      nock.cleanAll();
      fs.remove(tmpCache, err => {
        tmpCache = null;
        done(err);
      });
    });

    describe('#constructor', function () {
      it('should have empty value sets when there is no pre-existing data', function () {
        service = new cs.CodeService();
        service.valueSets.should.be.empty;
      });

      it('should have empty value sets when constructed with cache but loadCache flag is false', function () {
        service = new cs.CodeService(path.join(__dirname, 'fixtures'), false);
        service.valueSets.should.be.empty;
      });

      it('should have value sets when constructed with cache and loadCache flag is true', function () {
        service = new cs.CodeService(path.join(__dirname, 'fixtures'), true);
        service.valueSets.should.not.be.empty;
      });

      it('should default to SVS API', function () {
        service = new cs.CodeService(path.join(__dirname, 'fixtures'), true);
        service.api.name.should.equal('SVS');
      });
    });

    describe('#findValueSetsByOid', function () {
      it('should find loaded value set', function () {
        const oid = '2.16.840.1.113883.3.464.1003.104.12.1013';
        const results = service.findValueSetsByOid(oid);
        results.should.have.length(2);
        results[0].should.eql(
          new ValueSet(oid, '20170320', [
            new Code('2093-3', 'http://loinc.org', '2.58'),
            new Code('48620-9', 'http://loinc.org', '2.58')
          ])
        );
        results[1].should.eql(
          new ValueSet(oid, '20200401', [new Code('48620-9', 'http://loinc.org', '2.58')])
        );
      });

      it('should not find invalid value set', function () {
        const results = service.findValueSetsByOid('FOO');
        results.should.be.empty;
      });
    });

    describe('#findValueSets', function () {
      it('should find loaded value sets by OID', function () {
        const oid = '2.16.840.1.113883.3.464.1003.104.12.1013';
        const results = service.findValueSets(oid);
        results.should.have.length(2);
        results[0].should.eql(
          new ValueSet(oid, '20170320', [
            new Code('2093-3', 'http://loinc.org', '2.58'),
            new Code('48620-9', 'http://loinc.org', '2.58')
          ])
        );
        results[1].should.eql(
          new ValueSet(oid, '20200401', [new Code('48620-9', 'http://loinc.org', '2.58')])
        );
      });

      it('should find loaded value set by OID and version', function () {
        const oid = '2.16.840.1.113883.3.464.1003.104.12.1013';
        const version = '20170320';
        const results = service.findValueSets(oid, version);
        results.should.have.length(1);
        results[0].should.eql(
          new ValueSet('2.16.840.1.113883.3.464.1003.104.12.1013', '20170320', [
            new Code('2093-3', 'http://loinc.org', '2.58'),
            new Code('48620-9', 'http://loinc.org', '2.58')
          ])
        );
      });

      it('should find loaded value sets by URN', function () {
        const urn = 'urn:oid:2.16.840.1.113883.3.464.1003.104.12.1013';
        const results = service.findValueSets(urn);
        results.should.have.length(2);
        results[0].should.eql(
          new ValueSet('2.16.840.1.113883.3.464.1003.104.12.1013', '20170320', [
            new Code('2093-3', 'http://loinc.org', '2.58'),
            new Code('48620-9', 'http://loinc.org', '2.58')
          ])
        );
        results[1].should.eql(
          new ValueSet('2.16.840.1.113883.3.464.1003.104.12.1013', '20200401', [
            new Code('48620-9', 'http://loinc.org', '2.58')
          ])
        );
      });

      it('should find loaded value sets by URN and version', function () {
        const urn = 'urn:oid:2.16.840.1.113883.3.464.1003.104.12.1013';
        const results = service.findValueSets(urn, '20200401');
        results.should.have.length(1);
        results[0].should.eql(
          new ValueSet('2.16.840.1.113883.3.464.1003.104.12.1013', '20200401', [
            new Code('48620-9', 'http://loinc.org', '2.58')
          ])
        );
      });

      it('should find loaded value sets by https URL', function () {
        const url =
          'https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013';
        const results = service.findValueSets(url);
        results.should.have.length(2);
        results[0].should.eql(
          new ValueSet('2.16.840.1.113883.3.464.1003.104.12.1013', '20170320', [
            new Code('2093-3', 'http://loinc.org', '2.58'),
            new Code('48620-9', 'http://loinc.org', '2.58')
          ])
        );
        results[1].should.eql(
          new ValueSet('2.16.840.1.113883.3.464.1003.104.12.1013', '20200401', [
            new Code('48620-9', 'http://loinc.org', '2.58')
          ])
        );
      });

      it('should find loaded value sets by https URL and version', function () {
        const url =
          'https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013';
        const results = service.findValueSets(url, '20170320');
        results.should.have.length(1);
        results[0].should.eql(
          new ValueSet('2.16.840.1.113883.3.464.1003.104.12.1013', '20170320', [
            new Code('2093-3', 'http://loinc.org', '2.58'),
            new Code('48620-9', 'http://loinc.org', '2.58')
          ])
        );
      });

      it('should find loaded values sets by http URL', function () {
        const url = 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013';
        const results = service.findValueSets(url);
        results.should.have.length(2);
        results[0].should.eql(
          new ValueSet('2.16.840.1.113883.3.464.1003.104.12.1013', '20170320', [
            new Code('2093-3', 'http://loinc.org', '2.58'),
            new Code('48620-9', 'http://loinc.org', '2.58')
          ])
        );
        results[1].should.eql(
          new ValueSet('2.16.840.1.113883.3.464.1003.104.12.1013', '20200401', [
            new Code('48620-9', 'http://loinc.org', '2.58')
          ])
        );
      });

      it('should find loaded values sets by http URL and version', function () {
        const url = 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013';
        const results = service.findValueSets(url, '20200401');
        results.should.have.length(1);
        results[0].should.eql(
          new ValueSet('2.16.840.1.113883.3.464.1003.104.12.1013', '20200401', [
            new Code('48620-9', 'http://loinc.org', '2.58')
          ])
        );
      });

      it('should find loaded value set by https URL with embedded version', function () {
        const url =
          'https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013|20170320';
        const results = service.findValueSets(url);
        results.should.have.length(1);
        results[0].should.eql(
          new ValueSet('2.16.840.1.113883.3.464.1003.104.12.1013', '20170320', [
            new Code('2093-3', 'http://loinc.org', '2.58'),
            new Code('48620-9', 'http://loinc.org', '2.58')
          ])
        );
      });

      it('should prefer explicit version over embedded version in https URL', function () {
        const url =
          'https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013|20200401';
        const results = service.findValueSets(url, '20170320');
        results.should.have.length(1);
        results[0].should.eql(
          new ValueSet('2.16.840.1.113883.3.464.1003.104.12.1013', '20170320', [
            new Code('2093-3', 'http://loinc.org', '2.58'),
            new Code('48620-9', 'http://loinc.org', '2.58')
          ])
        );
      });

      it('should find loaded value set by http URL with embedded version', function () {
        const url =
          'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013|20170320';
        const results = service.findValueSets(url);
        results.should.have.length(1);
        results[0].should.eql(
          new ValueSet('2.16.840.1.113883.3.464.1003.104.12.1013', '20170320', [
            new Code('2093-3', 'http://loinc.org', '2.58'),
            new Code('48620-9', 'http://loinc.org', '2.58')
          ])
        );
      });

      it('should prefer explicit version over embedded version in http URL', function () {
        const url =
          'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013|20200401';
        const results = service.findValueSets(url, '20170320');
        results.should.have.length(1);
        results[0].should.eql(
          new ValueSet('2.16.840.1.113883.3.464.1003.104.12.1013', '20170320', [
            new Code('2093-3', 'http://loinc.org', '2.58'),
            new Code('48620-9', 'http://loinc.org', '2.58')
          ])
        );
      });

      it('should not find invalid value set by OID', function () {
        const results = service.findValueSets('FOO');
        results.should.be.empty;
      });

      it('should not find invalid value set version by OID', function () {
        const results = service.findValueSets(
          '2.16.840.1.113883.3.464.1003.104.12.1013',
          '20180320'
        );
        results.should.be.empty;
      });

      it('should not find invalid value set by URN', function () {
        const results = service.findValueSets('urn:oid:FOO');
        results.should.be.empty;
      });

      it('should not find invalid value set version by URN', function () {
        const results = service.findValueSets(
          'urn:oid:2.16.840.1.113883.3.464.1003.104.12.1013',
          '20180320'
        );
        results.should.be.empty;
      });

      it('should not find invalid value set by https URL', function () {
        const results = service.findValueSets('https://cts.nlm.nih.gov/fhir/ValueSet/FOO');
        results.should.be.empty;
      });

      it('should not find invalid value set version by https URL', function () {
        const results = service.findValueSets(
          'https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013',
          '20180320'
        );
        results.should.be.empty;
      });

      it('should not find value set by https URL with invalid embedded version', function () {
        const results = service.findValueSets(
          'https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013|20180320'
        );
        results.should.be.empty;
      });

      it('should not find invalid value set by http URL', function () {
        const results = service.findValueSets('http://cts.nlm.nih.gov/fhir/ValueSet/FOO');
        results.should.be.empty;
      });

      it('should not find invalid value set version by http URL', function () {
        const results = service.findValueSets(
          'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013',
          '20180320'
        );
        results.should.be.empty;
      });

      it('should not find value set by http URL with invalid embedded version', function () {
        const results = service.findValueSets(
          'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013|20180320'
        );
        results.should.be.empty;
      });
    });

    describe('#findValueSet', function () {
      it('should find loaded value set by OID only', function () {
        const oid = '2.16.840.1.113883.3.464.1003.104.12.1013';
        const result = service.findValueSet(oid);
        result.should.eql(
          new ValueSet(oid, '20200401', [new Code('48620-9', 'http://loinc.org', '2.58')])
        );
      });

      it('should find loaded value set by URN only', function () {
        const urn = 'urn:oid:2.16.840.1.113883.3.464.1003.104.12.1013';
        const result = service.findValueSet(urn);
        result.should.eql(
          new ValueSet('2.16.840.1.113883.3.464.1003.104.12.1013', '20200401', [
            new Code('48620-9', 'http://loinc.org', '2.58')
          ])
        );
      });

      it('should find loaded value set by https URL only', function () {
        const urn =
          'https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013';
        const result = service.findValueSet(urn);
        result.should.eql(
          new ValueSet('2.16.840.1.113883.3.464.1003.104.12.1013', '20200401', [
            new Code('48620-9', 'http://loinc.org', '2.58')
          ])
        );
      });

      it('should find loaded value set by http URL only', function () {
        const urn = 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013';
        const result = service.findValueSet(urn);
        result.should.eql(
          new ValueSet('2.16.840.1.113883.3.464.1003.104.12.1013', '20200401', [
            new Code('48620-9', 'http://loinc.org', '2.58')
          ])
        );
      });

      it('should find loaded value set by OID and version', function () {
        const oid = '2.16.840.1.113883.3.464.1003.104.12.1013';
        const version = '20170320';
        const result = service.findValueSet(oid, version);
        result.should.eql(
          new ValueSet(oid, version, [
            new Code('2093-3', 'http://loinc.org', '2.58'),
            new Code('48620-9', 'http://loinc.org', '2.58')
          ])
        );
      });

      it('should find loaded value set by URN and version', function () {
        const urn = 'urn:oid:2.16.840.1.113883.3.464.1003.104.12.1013';
        const version = '20170320';
        const result = service.findValueSet(urn, version);
        result.should.eql(
          new ValueSet('2.16.840.1.113883.3.464.1003.104.12.1013', version, [
            new Code('2093-3', 'http://loinc.org', '2.58'),
            new Code('48620-9', 'http://loinc.org', '2.58')
          ])
        );
      });

      it('should find loaded value set by https URL and version', function () {
        const url =
          'https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013';
        const version = '20170320';
        const result = service.findValueSet(url, version);
        result.should.eql(
          new ValueSet('2.16.840.1.113883.3.464.1003.104.12.1013', version, [
            new Code('2093-3', 'http://loinc.org', '2.58'),
            new Code('48620-9', 'http://loinc.org', '2.58')
          ])
        );
      });

      it('should find loaded value set by http URL and version', function () {
        const url =
          'https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013';
        const version = '20170320';
        const result = service.findValueSet(url, version);
        result.should.eql(
          new ValueSet('2.16.840.1.113883.3.464.1003.104.12.1013', version, [
            new Code('2093-3', 'http://loinc.org', '2.58'),
            new Code('48620-9', 'http://loinc.org', '2.58')
          ])
        );
      });

      it('should find loaded value set by https URL and embedded version', function () {
        const url =
          'https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013|20170320';
        const result = service.findValueSet(url);
        result.should.eql(
          new ValueSet('2.16.840.1.113883.3.464.1003.104.12.1013', '20170320', [
            new Code('2093-3', 'http://loinc.org', '2.58'),
            new Code('48620-9', 'http://loinc.org', '2.58')
          ])
        );
      });

      it('should find loaded value set by http URL and embedded version', function () {
        const url =
          'https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013|20170320';
        const result = service.findValueSet(url);
        result.should.eql(
          new ValueSet('2.16.840.1.113883.3.464.1003.104.12.1013', '20170320', [
            new Code('2093-3', 'http://loinc.org', '2.58'),
            new Code('48620-9', 'http://loinc.org', '2.58')
          ])
        );
      });

      it('should prefer passed in version over url-embedded version', function () {
        const url =
          'https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013|20200401';
        const version = '20170320';
        const result = service.findValueSet(url, version);
        result.should.eql(
          new ValueSet('2.16.840.1.113883.3.464.1003.104.12.1013', version, [
            new Code('2093-3', 'http://loinc.org', '2.58'),
            new Code('48620-9', 'http://loinc.org', '2.58')
          ])
        );

        const url2 =
          'https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013|20170320';
        const version2 = '20200401';
        const result2 = service.findValueSet(url2, version2);
        result2.should.eql(
          new ValueSet('2.16.840.1.113883.3.464.1003.104.12.1013', version2, [
            new Code('48620-9', 'http://loinc.org', '2.58')
          ])
        );
      });

      it('should not find value set with invalid OID', function () {
        const result = service.findValueSet('FOO');
        should.not.exist(result);
      });

      it('should not find value set with invalid version', function () {
        const result = service.findValueSet('2.16.840.1.113883.3.464.1003.104.12.1013', '20170321');
        should.not.exist(result);
      });
    });

    describe('#ensureValueSetsWithAPIKey', function () {
      it('should not attempt downloads for value sets it already has (by OID)', function () {
        const vsList = [
          {
            name: 'HDL Cholesterol',
            id: '2.16.840.1.113883.3.464.1003.104.12.1013'
          }
        ];
        return service.ensureValueSetsWithAPIKey(vsList).should.be.fulfilled;
      });

      it('should not attempt downloads for value sets it already has (by OID and version)', function () {
        const vsList = [
          {
            name: 'HDL Cholesterol',
            id: '2.16.840.1.113883.3.464.1003.104.12.1013',
            version: '20170320'
          }
        ];
        return service.ensureValueSetsWithAPIKey(vsList).should.be.fulfilled;
      });

      it('should not attempt downloads for value sets it already has (by URN)', function () {
        const vsList = [
          {
            name: 'HDL Cholesterol',
            id: 'urn:oid:2.16.840.1.113883.3.464.1003.104.12.1013'
          }
        ];
        return service.ensureValueSetsWithAPIKey(vsList).should.be.fulfilled;
      });

      it('should not attempt downloads for value sets it already has (by URN and version)', function () {
        const vsList = [
          {
            name: 'HDL Cholesterol',
            id: 'urn:oid:2.16.840.1.113883.3.464.1003.104.12.1013',
            version: '20170320'
          }
        ];
        return service.ensureValueSetsWithAPIKey(vsList).should.be.fulfilled;
      });

      it('should not attempt downloads for value sets it already has (by https URL)', function () {
        const vsList = [
          {
            name: 'HDL Cholesterol',
            id: 'https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013'
          }
        ];
        return service.ensureValueSetsWithAPIKey(vsList).should.be.fulfilled;
      });

      it('should not attempt downloads for value sets it already has (by https URL and version)', function () {
        const vsList = [
          {
            name: 'HDL Cholesterol',
            id: 'https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013',
            version: '20170320'
          }
        ];
        return service.ensureValueSetsWithAPIKey(vsList).should.be.fulfilled;
      });

      it('should not attempt downloads for value sets it already has (by http URL)', function () {
        const vsList = [
          {
            name: 'HDL Cholesterol',
            id: 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013'
          }
        ];
        return service.ensureValueSetsWithAPIKey(vsList).should.be.fulfilled;
      });

      it('should not attempt downloads for value sets it already has (by http URL and version)', function () {
        const vsList = [
          {
            name: 'HDL Cholesterol',
            id: 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013',
            version: '20170320'
          }
        ];
        return service.ensureValueSetsWithAPIKey(vsList).should.be.fulfilled;
      });

      it('should not attempt downloads for value sets it already has (by https URL with embedded version)', function () {
        const vsList = [
          {
            name: 'HDL Cholesterol',
            id: 'https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013|20170320'
          }
        ];
        return service.ensureValueSetsWithAPIKey(vsList).should.be.fulfilled;
      });

      it('should not attempt downloads for value sets it already has (by http URL with embedded version)', function () {
        const vsList = [
          {
            name: 'HDL Cholesterol',
            id: 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013|20170320'
          }
        ];
        return service.ensureValueSetsWithAPIKey(vsList).should.be.fulfilled;
      });

      it('should download value sets it does not have (by OID)', function () {
        return doDownloadTestWithAPIKey([
          {
            name: 'Systolic Blood Pressure',
            id: '2.16.840.1.113883.3.526.3.1032'
          },
          { name: 'Current Tobacco Smoker', id: '2.16.840.1.113883.3.600.2390' }
        ]);
      });

      it('should download value sets it does not have (by OID and version)', function () {
        return doDownloadTestWithAPIKey(
          [
            {
              name: 'Systolic Blood Pressure',
              id: '2.16.840.1.113883.3.526.3.1032',
              version: '20170320'
            },
            {
              name: 'Current Tobacco Smoker',
              id: '2.16.840.1.113883.3.600.2390',
              version: '20170320'
            }
          ],
          true
        );
      });

      it('should download value sets it does not have when no version is supplied (by URN)', function () {
        return doDownloadTestWithAPIKey([
          {
            name: 'Systolic Blood Pressure',
            id: 'urn:oid:2.16.840.1.113883.3.526.3.1032'
          },
          {
            name: 'Current Tobacco Smoker',
            id: 'urn:oid:2.16.840.1.113883.3.600.2390'
          }
        ]);
      });

      it('should download value sets it does not have (by URN and version)', function () {
        return doDownloadTestWithAPIKey(
          [
            {
              name: 'Systolic Blood Pressure',
              id: 'urn:oid:2.16.840.1.113883.3.526.3.1032',
              version: '20170320'
            },
            {
              name: 'Current Tobacco Smoker',
              id: 'urn:oid:2.16.840.1.113883.3.600.2390',
              version: '20170320'
            }
          ],
          true
        );
      });

      it('should download value sets it does not have when no version is supplied (by https URL)', function () {
        return doDownloadTestWithAPIKey([
          {
            name: 'Systolic Blood Pressure',
            id: 'https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.526.3.1032'
          },
          {
            name: 'Current Tobacco Smoker',
            id: 'https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.600.2390'
          }
        ]);
      });

      it('should download value sets it does not have (by https URL and version)', function () {
        return doDownloadTestWithAPIKey(
          [
            {
              name: 'Systolic Blood Pressure',
              id: 'https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.526.3.1032',
              version: '20170320'
            },
            {
              name: 'Current Tobacco Smoker',
              id: 'https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.600.2390',
              version: '20170320'
            }
          ],
          true
        );
      });

      it('should download value sets it does not have (by https URL with embedded version)', function () {
        return doDownloadTestWithAPIKey(
          [
            {
              name: 'Systolic Blood Pressure',
              id: 'https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.526.3.1032|20170320'
            },
            {
              name: 'Current Tobacco Smoker',
              id: 'https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.600.2390|20170320'
            }
          ],
          true
        );
      });

      it('should download value sets it does not have when no version is supplied (by http URL)', function () {
        return doDownloadTestWithAPIKey([
          {
            name: 'Systolic Blood Pressure',
            id: 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.526.3.1032'
          },
          {
            name: 'Current Tobacco Smoker',
            id: 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.600.2390'
          }
        ]);
      });

      it('should download value sets it does not have (by http URL and version)', function () {
        return doDownloadTestWithAPIKey(
          [
            {
              name: 'Systolic Blood Pressure',
              id: 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.526.3.1032',
              version: '20170320'
            },
            {
              name: 'Current Tobacco Smoker',
              id: 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.600.2390',
              version: '20170320'
            }
          ],
          true
        );
      });

      it('should download value sets it does not have (by http URL with embedded version)', function () {
        return doDownloadTestWithAPIKey(
          [
            {
              name: 'Systolic Blood Pressure',
              id: 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.526.3.1032|20170320'
            },
            {
              name: 'Current Tobacco Smoker',
              id: 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.600.2390|20170320'
            }
          ],
          true
        );
      });

      const doDownloadTestWithAPIKey = (vsList, withVersion = false) => {
        // Just to be sure, check length is only 2 (as expected)
        Object.keys(service.valueSets).should.have.length(2);

        const query1 = {
          id: '2.16.840.1.113883.3.526.3.1032'
        };
        const query2 = {
          id: '2.16.840.1.113883.3.600.2390'
        };
        if (withVersion) {
          query1.version = '20170320';
          query2.version = '20170320';
        }
        nock('https://vsac.nlm.nih.gov')
          // VS retrieval #1
          .get('/vsac/svs/RetrieveValueSet')
          .basicAuth({ user: 'apikey', pass: apiKey })
          .query(query1)
          .replyWithFile(
            200,
            path.join(__dirname, 'fixtures', '2.16.840.1.113883.3.526.3.1032.xml')
          )
          // VS retrieval #2
          .get('/vsac/svs/RetrieveValueSet')
          .basicAuth({ user: 'apikey', pass: apiKey })
          .query(query2)
          .replyWithFile(200, path.join(__dirname, 'fixtures', '2.16.840.1.113883.3.600.2390.xml'));

        return service.ensureValueSetsWithAPIKey(vsList, apiKey).then(function () {
          // Test that the value sets were properly loaded into memory
          service.valueSets.should.not.be.empty;
          Object.keys(service.valueSets).should.have.length(4);
          const vs1 = service.findValueSet('2.16.840.1.113883.3.526.3.1032', '20170320');
          vs1.codes.should.have.length(1);
          const vs2 = service.findValueSet('2.16.840.1.113883.3.600.2390', '20170418');
          vs2.codes.should.have.length(24);
          // Test that the value sets were properly written to the cache
          const cached = require(path.join(tmpCache, 'valueset-db.json'));
          JSON.parse(JSON.stringify(service.valueSets)).should.eql(cached);
        }); //.catch((err) => console.log(err));
      };

      it('should download and cache successful value sets before throwing error', function () {
        // Just to be sure, check length is only 2 (as expected)
        Object.keys(service.valueSets).should.have.length(2);

        nock('https://vsac.nlm.nih.gov')
          // VS retrieval #1
          .get('/vsac/svs/RetrieveValueSet')
          .basicAuth({ user: 'apikey', pass: apiKey })
          .query({
            id: '1.2.3.4.5.6.7.8.9.10',
            version: '20170320'
          })
          .reply(404) // Not Found
          // VS retrieval #2
          .get('/vsac/svs/RetrieveValueSet')
          .basicAuth({ user: 'apikey', pass: apiKey })
          .query({
            id: '2.16.840.1.113883.3.600.2390',
            version: '20170320'
          })
          .replyWithFile(200, path.join(__dirname, 'fixtures', '2.16.840.1.113883.3.600.2390.xml'));

        const vsList = [
          {
            name: 'Fake Value Set',
            id: '1.2.3.4.5.6.7.8.9.10',
            version: '20170320'
          },
          {
            name: 'Current Tobacco Smoker',
            id: '2.16.840.1.113883.3.600.2390',
            version: '20170320'
          }
        ];

        return service
          .ensureValueSetsWithAPIKey(vsList, apiKey)
          .then(function () {
            should.fail(0, 1, 'This code should never be executed since there were errors');
          })
          .catch(function (error) {
            // Test that the value sets were properly loaded into memory
            service.valueSets.should.not.be.empty;
            Object.keys(service.valueSets).should.have.length(3);
            const vs1 = service.findValueSet('1.2.3.4.5.6.7.8.9.10');
            should.not.exist(vs1);
            const vs2 = service.findValueSet('2.16.840.1.113883.3.600.2390', '20170418');
            vs2.codes.should.have.length(24);
            // Test that the value sets were properly written to the cache
            const cached = require(path.join(tmpCache, 'valueset-db.json'));
            JSON.parse(JSON.stringify(service.valueSets)).should.eql(cached);
            // Test that the error was thrown
            error.should.have.length(1);
            error[0].should.be.an('error');
            error[0].message.should.contain('1.2.3.4.5.6.7.8.9.10');
          });
      });

      it('should error if no API Key is supplied', function () {
        const oldAPIKey = process.env['UMLS_API_KEY'];
        try {
          // Make sure env is clear so no API key creeps through!
          delete process.env['UMLS_API_KEY'];

          nock('https://vsac.nlm.nih.gov');

          const vsList = [
            {
              name: 'Systolic Blood Pressure',
              id: '2.16.840.1.113883.3.526.3.1032',
              version: '20170320'
            }
          ];
          return service
            .ensureValueSetsWithAPIKey(vsList, null)
            .then(function () {
              should.fail(0, 1, 'This code should never be executed');
            })
            .catch(function (error) {
              error.should.eql('Failed to download value sets since UMLS_API_KEY is not set.');
            });
        } finally {
          process.env['UMLS_API_KEY'] = oldAPIKey;
        }
      });

      it('should error if invalid API Key is supplied', function () {
        // Technically this should only happen if there is an issue w/ VSAC, but let's be sure we handle it
        nock('https://vsac.nlm.nih.gov')
          // VS retrieval #1
          .get('/vsac/svs/RetrieveValueSet')
          .basicAuth({ user: 'apikey', pass: 'wrongkey' })
          .query({
            id: '2.16.840.1.113883.3.526.3.1032',
            version: '20170320'
          })
          .reply(401, 'Unauthorized');

        const vsList = [
          {
            name: 'Systolic Blood Pressure',
            id: '2.16.840.1.113883.3.526.3.1032',
            version: '20170320'
          }
        ];
        return service
          .ensureValueSetsWithAPIKey(vsList, 'wrongkey')
          .then(function () {
            should.fail(0, 1, 'This code should never be executed');
          })
          .catch(function (error) {
            error.should.have.length(1);
            error[0].should.be.an('error');
            error[0].message.should.contain('2.16.840.1.113883.3.526.3.1032');
          });
      });

      it('should error if value set is not found', function () {
        // Technically this should only happen if there is an issue w/ VSAC, but let's be sure we handle it
        nock('https://vsac.nlm.nih.gov')
          // VS retrieval #1
          .get('/vsac/svs/RetrieveValueSet')
          .basicAuth({ user: 'apikey', pass: apiKey })
          .query({
            id: '1.2.3.4.5.6.7.8.9.10',
            version: '20170320'
          })
          .reply(404); // Not Found

        const vsList = [
          {
            name: 'Fake Value Set',
            id: '1.2.3.4.5.6.7.8.9.10',
            version: '20170320'
          }
        ];
        return service
          .ensureValueSetsWithAPIKey(vsList, apiKey)
          .then(function () {
            should.fail(0, 1, 'This code should never be executed');
          })
          .catch(function (error) {
            error.should.have.length(1);
            error[0].should.be.an('error');
            error[0].message.should.contain('1.2.3.4.5.6.7.8.9.10');
          });
      });
    });
  });

  describe('FHIR API', function () {
    let service, tmpCache;
    const apiKey = process.env['UMLS_API_KEY'] || 'testkey';

    beforeEach(function (done) {
      // Create a temporary cache folder and construct the code service using it
      const [sec, nsec] = process.hrtime();
      tmpCache = path.join(os.tmpdir(), `test_${sec}_${nsec}-vsac_cache`);
      fs.mkdirs(tmpCache, err => {
        if (!err) {
          service = new cs.CodeService(tmpCache, false, true);
          service.loadValueSetsFromFile(path.join(__dirname, 'fixtures', 'valueset-db.json'));
        }
        done(err);
      });
    });

    afterEach(function (done) {
      // Clean up vars, check and clean nock, delete tmp folder
      service = null;
      nock.isDone();
      nock.cleanAll();
      fs.remove(tmpCache, err => {
        tmpCache = null;
        done(err);
      });
    });

    describe('#constructor', function () {
      // Only test what's different from SVS
      it('should use FHIR API', function () {
        service = new cs.CodeService(path.join(__dirname, 'fixtures'), true, true);
        service.api.name.should.equal('FHIR');
      });
    });

    describe('#findValueSetsByOid', function () {
      it('should find loaded value set', function () {
        const oid = '2.16.840.1.113883.3.464.1003.104.12.1013';
        const results = service.findValueSetsByOid(oid);
        results.should.have.length(2);
        results[0].should.eql(
          new ValueSet(oid, '20170320', [
            new Code('2093-3', 'http://loinc.org', '2.58'),
            new Code('48620-9', 'http://loinc.org', '2.58')
          ])
        );
        results[1].should.eql(
          new ValueSet(oid, '20200401', [new Code('48620-9', 'http://loinc.org', '2.58')])
        );
      });

      // Skip the rest, as findValueSetsByOid is the same code for SVS and FHIR
    });

    describe('#findValueSets', function () {
      it('should find loaded value sets by OID', function () {
        const oid = '2.16.840.1.113883.3.464.1003.104.12.1013';
        const results = service.findValueSets(oid);
        results.should.have.length(2);
        results[0].should.eql(
          new ValueSet(oid, '20170320', [
            new Code('2093-3', 'http://loinc.org', '2.58'),
            new Code('48620-9', 'http://loinc.org', '2.58')
          ])
        );
        results[1].should.eql(
          new ValueSet(oid, '20200401', [new Code('48620-9', 'http://loinc.org', '2.58')])
        );
      });

      // Skip the rest, as findValueSets is the same code for SVS and FHIR
    });

    describe('#findValueSet', function () {
      it('should find loaded value set by OID only', function () {
        const oid = '2.16.840.1.113883.3.464.1003.104.12.1013';
        const result = service.findValueSet(oid);
        result.should.eql(
          new ValueSet(oid, '20200401', [new Code('48620-9', 'http://loinc.org', '2.58')])
        );
      });

      // Skip the rest, as findValueSet is the same code for SVS and FHIR
    });

    describe('#ensureValueSetsWithAPIKey', function () {
      it('should not attempt downloads for value sets it already has (by OID)', function () {
        const vsList = [
          {
            name: 'HDL Cholesterol',
            id: '2.16.840.1.113883.3.464.1003.104.12.1013'
          }
        ];
        return service.ensureValueSetsWithAPIKey(vsList).should.be.fulfilled;
      });

      // Skip the other "should not attempt" tests, as that code is the same for SVS and FHIR

      it('should download value sets it does not have (by OID)', function () {
        return doDownloadTestWithAPIKey([
          {
            name: 'Systolic Blood Pressure',
            id: '2.16.840.1.113883.3.526.3.1032'
          },
          { name: 'Current Tobacco Smoker', id: '2.16.840.1.113883.3.600.2390' }
        ]);
      });

      it('should download value sets it does not have (by OID and version)', function () {
        return doDownloadTestWithAPIKey(
          [
            {
              name: 'Systolic Blood Pressure',
              id: '2.16.840.1.113883.3.526.3.1032',
              version: '20170504'
            },
            {
              name: 'Current Tobacco Smoker',
              id: '2.16.840.1.113883.3.600.2390',
              version: '20210304'
            }
          ],
          true
        );
      });

      it('should download value sets it does not have when no version is supplied (by URN)', function () {
        return doDownloadTestWithAPIKey([
          {
            name: 'Systolic Blood Pressure',
            id: 'urn:oid:2.16.840.1.113883.3.526.3.1032'
          },
          {
            name: 'Current Tobacco Smoker',
            id: 'urn:oid:2.16.840.1.113883.3.600.2390'
          }
        ]);
      });

      it('should download value sets it does not have (by URN and version)', function () {
        return doDownloadTestWithAPIKey(
          [
            {
              name: 'Systolic Blood Pressure',
              id: 'urn:oid:2.16.840.1.113883.3.526.3.1032',
              version: '20170504'
            },
            {
              name: 'Current Tobacco Smoker',
              id: 'urn:oid:2.16.840.1.113883.3.600.2390',
              version: '20210304'
            }
          ],
          true
        );
      });

      it('should download value sets it does not have when no version is supplied (by https URL)', function () {
        return doDownloadTestWithAPIKey([
          {
            name: 'Systolic Blood Pressure',
            id: 'https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.526.3.1032'
          },
          {
            name: 'Current Tobacco Smoker',
            id: 'https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.600.2390'
          }
        ]);
      });

      it('should download value sets it does not have (by https URL and version)', function () {
        return doDownloadTestWithAPIKey(
          [
            {
              name: 'Systolic Blood Pressure',
              id: 'https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.526.3.1032',
              version: '20170504'
            },
            {
              name: 'Current Tobacco Smoker',
              id: 'https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.600.2390',
              version: '20210304'
            }
          ],
          true
        );
      });

      it('should download value sets it does not have (by https URL with embedded version)', function () {
        return doDownloadTestWithAPIKey(
          [
            {
              name: 'Systolic Blood Pressure',
              id: 'https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.526.3.1032|20170504'
            },
            {
              name: 'Current Tobacco Smoker',
              id: 'https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.600.2390|20210304'
            }
          ],
          true
        );
      });

      it('should download value sets it does not have when no version is supplied (by http URL)', function () {
        return doDownloadTestWithAPIKey([
          {
            name: 'Systolic Blood Pressure',
            id: 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.526.3.1032'
          },
          {
            name: 'Current Tobacco Smoker',
            id: 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.600.2390'
          }
        ]);
      });

      it('should download value sets it does not have (by http URL and version)', function () {
        return doDownloadTestWithAPIKey(
          [
            {
              name: 'Systolic Blood Pressure',
              id: 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.526.3.1032',
              version: '20170504'
            },
            {
              name: 'Current Tobacco Smoker',
              id: 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.600.2390',
              version: '20210304'
            }
          ],
          true
        );
      });

      it('should download value sets it does not have (by http URL with embedded version)', function () {
        return doDownloadTestWithAPIKey(
          [
            {
              name: 'Systolic Blood Pressure',
              id: 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.526.3.1032|20170504'
            },
            {
              name: 'Current Tobacco Smoker',
              id: 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.600.2390|20210304'
            }
          ],
          true
        );
      });

      const doDownloadTestWithAPIKey = (vsList, withVersion = false) => {
        // Just to be sure, check length is only 2 (as expected)
        Object.keys(service.valueSets).should.have.length(2);

        const query1 = { offset: 0 };
        const query2 = { offset: 0 };
        if (withVersion) {
          query1.valueSetVersion = '20170504';
          query2.valueSetVersion = '20210304';
        }
        nock('https://cts.nlm.nih.gov')
          // VS retrieval #1
          .get('/fhir/ValueSet/2.16.840.1.113883.3.526.3.1032/$expand')
          .basicAuth({ user: 'apikey', pass: apiKey })
          .query(query1)
          .replyWithFile(
            200,
            path.join(__dirname, 'fixtures', '2.16.840.1.113883.3.526.3.1032.json')
          )
          // VS retrieval #2
          .get('/fhir/ValueSet/2.16.840.1.113883.3.600.2390/$expand')
          .basicAuth({ user: 'apikey', pass: apiKey })
          .query(query2)
          .replyWithFile(
            200,
            path.join(__dirname, 'fixtures', '2.16.840.1.113883.3.600.2390.json')
          );

        return service.ensureValueSetsWithAPIKey(vsList, apiKey).then(function () {
          // Test that the value sets were properly loaded into memory
          service.valueSets.should.not.be.empty;
          Object.keys(service.valueSets).should.have.length(4);
          const vs1 = service.findValueSet('2.16.840.1.113883.3.526.3.1032', '20170504');
          vs1.codes.should.have.length(1);
          const vs2 = service.findValueSet('2.16.840.1.113883.3.600.2390', '20210304');
          vs2.codes.should.have.length(26);
          // Test that the value sets were properly written to the cache
          const cached = require(path.join(tmpCache, 'valueset-db.json'));
          JSON.parse(JSON.stringify(service.valueSets)).should.eql(cached);
        }); //.catch((err) => console.log(err));
      };

      it('should download large value sets in pages', function () {
        // Just to be sure, check length is only 2 (as expected)
        Object.keys(service.valueSets).should.have.length(2);
        const pages = fs.readJsonSync(
          path.join(__dirname, 'fixtures', '2.16.840.1.113883.3.600.2390-pages.json')
        );
        nock('https://cts.nlm.nih.gov')
          // Page 1
          .get('/fhir/ValueSet/2.16.840.1.113883.3.600.2390/$expand')
          .basicAuth({ user: 'apikey', pass: apiKey })
          .query({
            offset: 0,
            valueSetVersion: '20210304'
          })
          .reply(200, pages[0])
          // Page 2
          .get('/fhir/ValueSet/2.16.840.1.113883.3.600.2390/$expand')
          .basicAuth({ user: 'apikey', pass: apiKey })
          .query({
            offset: 10,
            valueSetVersion: '20210304'
          })
          .reply(200, pages[1])
          // Page 3
          .get('/fhir/ValueSet/2.16.840.1.113883.3.600.2390/$expand')
          .basicAuth({ user: 'apikey', pass: apiKey })
          .query({
            offset: 20,
            valueSetVersion: '20210304'
          })
          .reply(200, pages[2]);

        const vsList = [
          {
            name: 'Current Tobacco Smoker',
            id: '2.16.840.1.113883.3.600.2390',
            version: '20210304'
          }
        ];

        return service.ensureValueSetsWithAPIKey(vsList, apiKey).then(function () {
          // Test that the value sets were properly loaded into memory
          service.valueSets.should.not.be.empty;
          Object.keys(service.valueSets).should.have.length(3);
          const vs = service.findValueSet('2.16.840.1.113883.3.600.2390', '20210304');
          vs.codes.should.have.length(26);
          // Make sure they're the right codes
          const expected = [
            '160603005',
            '160604004',
            '160605003',
            '160606002',
            '160619003',
            '230059006',
            '230060001',
            '230062009',
            '230063004',
            '230064005',
            '230065006',
            '266920004',
            '365981007',
            '365982000',
            '428041000124106',
            '428061000124105',
            '428071000124103',
            '449868002',
            '450811000124104',
            '450821000124107',
            '56578002',
            '56771006',
            '59978006',
            '65568007',
            '77176002',
            '82302008'
          ];
          vs.codes.map(c => c.code).should.eql(expected);
          // Test that the value sets were properly written to the cache
          const cached = require(path.join(tmpCache, 'valueset-db.json'));
          JSON.parse(JSON.stringify(service.valueSets)).should.eql(cached);
        }); //.catch((err) => console.log(err));
      });

      it('should download and cache successful value sets before throwing error', function () {
        // Just to be sure, check length is only 2 (as expected)
        Object.keys(service.valueSets).should.have.length(2);
        nock('https://cts.nlm.nih.gov')
          // VS retrieval #1
          .get('/fhir/ValueSet/1.2.3.4.5.6.7.8.9.10/$expand')
          .basicAuth({ user: 'apikey', pass: apiKey })
          .query({
            offset: 0,
            valueSetVersion: '20170320'
          })
          .reply(404) // Not Found
          // VS retrieval #2
          .get('/fhir/ValueSet/2.16.840.1.113883.3.600.2390/$expand')
          .basicAuth({ user: 'apikey', pass: apiKey })
          .query({
            offset: 0,
            valueSetVersion: '20210304'
          })
          .replyWithFile(
            200,
            path.join(__dirname, 'fixtures', '2.16.840.1.113883.3.600.2390.json')
          );

        const vsList = [
          {
            name: 'Fake Value Set',
            id: '1.2.3.4.5.6.7.8.9.10',
            version: '20170320'
          },
          {
            name: 'Current Tobacco Smoker',
            id: '2.16.840.1.113883.3.600.2390',
            version: '20210304'
          }
        ];

        return service
          .ensureValueSetsWithAPIKey(vsList, apiKey)
          .then(function () {
            should.fail(0, 1, 'This code should never be executed since there were errors');
          })
          .catch(function (error) {
            // Test that the value sets were properly loaded into memory
            service.valueSets.should.not.be.empty;
            Object.keys(service.valueSets).should.have.length(3);
            const vs1 = service.findValueSet('1.2.3.4.5.6.7.8.9.10');
            should.not.exist(vs1);
            const vs2 = service.findValueSet('2.16.840.1.113883.3.600.2390', '20210304');
            vs2.codes.should.have.length(26);
            // Test that the value sets were properly written to the cache
            const cached = require(path.join(tmpCache, 'valueset-db.json'));
            JSON.parse(JSON.stringify(service.valueSets)).should.eql(cached);
            // Test that the error was thrown
            error.should.have.length(1);
            error[0].should.be.an('error');
            error[0].message.should.contain('1.2.3.4.5.6.7.8.9.10');
          });
      });

      it('should error if no API Key is supplied', function () {
        const oldAPIKey = process.env['UMLS_API_KEY'];
        try {
          // Make sure env is clear so no API key creeps through!
          delete process.env['UMLS_API_KEY'];

          nock('https://vsac.nlm.nih.gov');

          const vsList = [
            {
              name: 'Systolic Blood Pressure',
              id: '2.16.840.1.113883.3.526.3.1032',
              version: '20170320'
            }
          ];
          return service
            .ensureValueSetsWithAPIKey(vsList, null)
            .then(function () {
              should.fail(0, 1, 'This code should never be executed');
            })
            .catch(function (error) {
              error.should.eql('Failed to download value sets since UMLS_API_KEY is not set.');
            });
        } finally {
          process.env['UMLS_API_KEY'] = oldAPIKey;
        }
      });

      it('should error if invalid API Key is supplied', function () {
        // Technically this should only happen if there is an issue w/ VSAC, but let's be sure we handle it
        nock('https://vsac.nlm.nih.gov')
          // VS retrieval #1
          .get('/vsac/svs/RetrieveValueSet')
          .basicAuth({ user: 'apikey', pass: 'wrongkey' })
          .query({
            id: '2.16.840.1.113883.3.526.3.1032',
            version: '20170320'
          })
          .reply(401, 'Unauthorized');

        const vsList = [
          {
            name: 'Systolic Blood Pressure',
            id: '2.16.840.1.113883.3.526.3.1032',
            version: '20170320'
          }
        ];
        return service
          .ensureValueSetsWithAPIKey(vsList, 'wrongkey')
          .then(function () {
            should.fail(0, 1, 'This code should never be executed');
          })
          .catch(function (error) {
            error.should.have.length(1);
            error[0].should.be.an('error');
            error[0].message.should.contain('2.16.840.1.113883.3.526.3.1032');
          });
      });

      it('should error if value set is not found', function () {
        // Technically this should only happen if there is an issue w/ VSAC, but let's be sure we handle it
        nock('https://vsac.nlm.nih.gov')
          // VS retrieval #1
          .get('/vsac/svs/RetrieveValueSet')
          .basicAuth({ user: 'apikey', pass: apiKey })
          .query({
            id: '1.2.3.4.5.6.7.8.9.10',
            version: '20170320'
          })
          .reply(404); // Not Found

        const vsList = [
          {
            name: 'Fake Value Set',
            id: '1.2.3.4.5.6.7.8.9.10',
            version: '20170320'
          }
        ];
        return service
          .ensureValueSetsWithAPIKey(vsList, apiKey)
          .then(function () {
            should.fail(0, 1, 'This code should never be executed');
          })
          .catch(function (error) {
            error.should.have.length(1);
            error[0].should.be.an('error');
            error[0].message.should.contain('1.2.3.4.5.6.7.8.9.10');
          });
      });
    });
  });
});
