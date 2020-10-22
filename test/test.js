const cs = require('../lib/CodeService');
const {Code, ValueSet} = require('cql-execution');
const path = require('path');
const fs = require('fs-extra');
const process = require('process');
const os = require('os');
const nock = require('nock');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const should = chai.should();

describe('CodeService', function() {
  let service, tmpCache;
  const username = process.env['UMLS_USER_NAME'] || 'testuser1';
  const password = process.env['UMLS_PASSWORD'] || 'testpassword23';
  const apiKey = process.env['UMLS_API_KEY'] || 'testkey';

  before(function() {
    // These tests should never reach out to the network.  If they do, we've done something wrong!
    nock.disableNetConnect();
  });

  after(function() {
    nock.restore();
    nock.enableNetConnect();
  });

  beforeEach(function(done) {
    // Create a temporary cache folder and construct the code service using it
    const [sec,nsec] = process.hrtime();
    tmpCache = path.join(os.tmpdir(), `test_${sec}_${nsec}-vsac_cache`);
    fs.mkdirs(tmpCache, (err) => {
      if (!err) {
        service = new cs.CodeService(tmpCache);
        service.loadValueSetsFromFile(path.join(__dirname, 'fixtures', 'valueset-db.json'));
      }
      done(err);
    });
  });

  afterEach(function(done) {
    // Clean up vars, check and clean nock, delete tmp folder
    service = null;
    nock.isDone();
    nock.cleanAll();
    fs.remove(tmpCache, (err) => {
      tmpCache = null;
      done(err);
    });
  });

  describe('#constructor', function() {
    it('should have empty value sets when there is no pre-existing data', function() {
      service = new cs.CodeService();
      service.valueSets.should.be.empty;
    });

    it('should have empty value sets when constructed with cache but loadCache flag is false', function() {
      service = new cs.CodeService(path.join(__dirname, 'fixtures'), false);
      service.valueSets.should.be.empty;
    });

    it('should have value sets when constructed with cache and loadCache flag is true', function() {
      service = new cs.CodeService(path.join(__dirname, 'fixtures'), true);
      service.valueSets.should.not.be.empty;
    });
  });

  describe('#findValueSetsByOid', function() {
    it('should find loaded value set', function() {
      const oid = '2.16.840.1.113883.3.464.1003.104.12.1013';
      const results = service.findValueSetsByOid(oid);
      results.should.have.length(2);
      results[0].should.eql(new ValueSet(oid, '20170320', [
        new Code('2093-3', 'http://loinc.org', '2.58'),
        new Code('48620-9', 'http://loinc.org', '2.58')
      ]));
      results[1].should.eql(new ValueSet(oid, '20200401', [
        new Code('48620-9', 'http://loinc.org', '2.58')
      ]));
    });

    it('should not find invalid value set', function() {
      const results = service.findValueSetsByOid('FOO');
      results.should.be.empty;
    });
  });

  describe('#findValueSets', function() {
    it('should find loaded value sets by OID', function() {
      const oid = '2.16.840.1.113883.3.464.1003.104.12.1013';
      const results = service.findValueSets(oid);
      results.should.have.length(2);
      results[0].should.eql(new ValueSet(oid, '20170320', [
        new Code('2093-3', 'http://loinc.org', '2.58'),
        new Code('48620-9', 'http://loinc.org', '2.58')
      ]));
      results[1].should.eql(new ValueSet(oid, '20200401', [
        new Code('48620-9', 'http://loinc.org', '2.58')
      ]));
    });

    it('should find loaded value set by OID and version', function() {
      const oid = '2.16.840.1.113883.3.464.1003.104.12.1013';
      const version = '20170320';
      const results = service.findValueSets(oid, version);
      results.should.have.length(1);
      results[0].should.eql(new ValueSet('2.16.840.1.113883.3.464.1003.104.12.1013', '20170320', [
        new Code('2093-3', 'http://loinc.org', '2.58'),
        new Code('48620-9', 'http://loinc.org', '2.58')
      ]));
    });

    it('should find loaded value sets by URN', function() {
      const urn = 'urn:oid:2.16.840.1.113883.3.464.1003.104.12.1013';
      const results = service.findValueSets(urn);
      results.should.have.length(2);
      results[0].should.eql(new ValueSet('2.16.840.1.113883.3.464.1003.104.12.1013', '20170320', [
        new Code('2093-3', 'http://loinc.org', '2.58'),
        new Code('48620-9', 'http://loinc.org', '2.58')
      ]));
      results[1].should.eql(new ValueSet('2.16.840.1.113883.3.464.1003.104.12.1013', '20200401', [
        new Code('48620-9', 'http://loinc.org', '2.58')
      ]));
    });

    it('should find loaded value sets by URN and version', function() {
      const urn = 'urn:oid:2.16.840.1.113883.3.464.1003.104.12.1013';
      const results = service.findValueSets(urn, '20200401');
      results.should.have.length(1);
      results[0].should.eql(new ValueSet('2.16.840.1.113883.3.464.1003.104.12.1013', '20200401', [
        new Code('48620-9', 'http://loinc.org', '2.58')
      ]));
    });

    it('should find loaded value sets by https URL', function() {
      const url = 'https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013';
      const results = service.findValueSets(url);
      results.should.have.length(2);
      results[0].should.eql(new ValueSet('2.16.840.1.113883.3.464.1003.104.12.1013', '20170320', [
        new Code('2093-3', 'http://loinc.org', '2.58'),
        new Code('48620-9', 'http://loinc.org', '2.58')
      ]));
      results[1].should.eql(new ValueSet('2.16.840.1.113883.3.464.1003.104.12.1013', '20200401', [
        new Code('48620-9', 'http://loinc.org', '2.58')
      ]));
    });

    it('should find loaded value sets by https URL and version', function() {
      const url = 'https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013';
      const results = service.findValueSets(url, '20170320');
      results.should.have.length(1);
      results[0].should.eql(new ValueSet('2.16.840.1.113883.3.464.1003.104.12.1013', '20170320', [
        new Code('2093-3', 'http://loinc.org', '2.58'),
        new Code('48620-9', 'http://loinc.org', '2.58')
      ]));
    });

    it('should find loaded values sets by http URL', function() {
      const url = 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013';
      const results = service.findValueSets(url);
      results.should.have.length(2);
      results[0].should.eql(new ValueSet('2.16.840.1.113883.3.464.1003.104.12.1013', '20170320', [
        new Code('2093-3', 'http://loinc.org', '2.58'),
        new Code('48620-9', 'http://loinc.org', '2.58')
      ]));
      results[1].should.eql(new ValueSet('2.16.840.1.113883.3.464.1003.104.12.1013', '20200401', [
        new Code('48620-9', 'http://loinc.org', '2.58')
      ]));
    });

    it('should find loaded values sets by http URL and version', function() {
      const url = 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013';
      const results = service.findValueSets(url, '20200401');
      results.should.have.length(1);
      results[0].should.eql(new ValueSet('2.16.840.1.113883.3.464.1003.104.12.1013', '20200401', [
        new Code('48620-9', 'http://loinc.org', '2.58')
      ]));
    });

    it('should find loaded value set by https URL with embedded version', function() {
      const url = 'https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013|20170320';
      const results = service.findValueSets(url);
      results.should.have.length(1);
      results[0].should.eql(new ValueSet('2.16.840.1.113883.3.464.1003.104.12.1013', '20170320', [
        new Code('2093-3', 'http://loinc.org', '2.58'),
        new Code('48620-9', 'http://loinc.org', '2.58')
      ]));
    });

    it('should prefer explicit version over embedded version in https URL', function() {
      const url = 'https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013|20200401';
      const results = service.findValueSets(url, '20170320');
      results.should.have.length(1);
      results[0].should.eql(new ValueSet('2.16.840.1.113883.3.464.1003.104.12.1013', '20170320', [
        new Code('2093-3', 'http://loinc.org', '2.58'),
        new Code('48620-9', 'http://loinc.org', '2.58')
      ]));
    });

    it('should find loaded value set by http URL with embedded version', function() {
      const url = 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013|20170320';
      const results = service.findValueSets(url);
      results.should.have.length(1);
      results[0].should.eql(new ValueSet('2.16.840.1.113883.3.464.1003.104.12.1013', '20170320', [
        new Code('2093-3', 'http://loinc.org', '2.58'),
        new Code('48620-9', 'http://loinc.org', '2.58')
      ]));
    });

    it('should prefer explicit version over embedded version in http URL', function() {
      const url = 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013|20200401';
      const results = service.findValueSets(url, '20170320');
      results.should.have.length(1);
      results[0].should.eql(new ValueSet('2.16.840.1.113883.3.464.1003.104.12.1013', '20170320', [
        new Code('2093-3', 'http://loinc.org', '2.58'),
        new Code('48620-9', 'http://loinc.org', '2.58')
      ]));
    });

    it('should not find invalid value set by OID', function() {
      const results = service.findValueSets('FOO');
      results.should.be.empty;
    });

    it('should not find invalid value set version by OID', function() {
      const results = service.findValueSets('2.16.840.1.113883.3.464.1003.104.12.1013', '20180320');
      results.should.be.empty;
    });

    it('should not find invalid value set by URN', function() {
      const results = service.findValueSets('urn:oid:FOO');
      results.should.be.empty;
    });

    it('should not find invalid value set version by URN', function() {
      const results = service.findValueSets('urn:oid:2.16.840.1.113883.3.464.1003.104.12.1013', '20180320');
      results.should.be.empty;
    });

    it('should not find invalid value set by https URL', function() {
      const results = service.findValueSets('https://cts.nlm.nih.gov/fhir/ValueSet/FOO');
      results.should.be.empty;
    });

    it('should not find invalid value set version by https URL', function() {
      const results = service.findValueSets('https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013', '20180320');
      results.should.be.empty;
    });

    it('should not find value set by https URL with invalid embedded version', function() {
      const results = service.findValueSets('https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013|20180320');
      results.should.be.empty;
    });

    it('should not find invalid value set by http URL', function() {
      const results = service.findValueSets('http://cts.nlm.nih.gov/fhir/ValueSet/FOO');
      results.should.be.empty;
    });

    it('should not find invalid value set version by http URL', function() {
      const results = service.findValueSets('http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013', '20180320');
      results.should.be.empty;
    });

    it('should not find value set by http URL with invalid embedded version', function() {
      const results = service.findValueSets('http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013|20180320');
      results.should.be.empty;
    });
  });

  describe('#findValueSet', function() {
    it('should find loaded value set by OID only', function() {
      const oid = '2.16.840.1.113883.3.464.1003.104.12.1013';
      const result = service.findValueSet(oid);
      result.should.eql(new ValueSet(oid, '20200401', [
        new Code('48620-9', 'http://loinc.org', '2.58')
      ]));
    });

    it('should find loaded value set by URN only', function() {
      const urn = 'urn:oid:2.16.840.1.113883.3.464.1003.104.12.1013';
      const result = service.findValueSet(urn);
      result.should.eql(new ValueSet('2.16.840.1.113883.3.464.1003.104.12.1013', '20200401', [
        new Code('48620-9', 'http://loinc.org', '2.58')
      ]));
    });

    it('should find loaded value set by https URL only', function() {
      const urn = 'https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013';
      const result = service.findValueSet(urn);
      result.should.eql(new ValueSet('2.16.840.1.113883.3.464.1003.104.12.1013', '20200401', [
        new Code('48620-9', 'http://loinc.org', '2.58')
      ]));
    });

    it('should find loaded value set by http URL only', function() {
      const urn = 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013';
      const result = service.findValueSet(urn);
      result.should.eql(new ValueSet('2.16.840.1.113883.3.464.1003.104.12.1013', '20200401', [
        new Code('48620-9', 'http://loinc.org', '2.58')
      ]));
    });

    it('should find loaded value set by OID and version', function() {
      const oid = '2.16.840.1.113883.3.464.1003.104.12.1013';
      const version = '20170320';
      const result = service.findValueSet(oid, version);
      result.should.eql(new ValueSet(oid, version, [
        new Code('2093-3', 'http://loinc.org', '2.58'),
        new Code('48620-9', 'http://loinc.org', '2.58')
      ]));
    });

    it('should find loaded value set by URN and version', function() {
      const urn = 'urn:oid:2.16.840.1.113883.3.464.1003.104.12.1013';
      const version = '20170320';
      const result = service.findValueSet(urn, version);
      result.should.eql(new ValueSet('2.16.840.1.113883.3.464.1003.104.12.1013', version, [
        new Code('2093-3', 'http://loinc.org', '2.58'),
        new Code('48620-9', 'http://loinc.org', '2.58')
      ]));
    });

    it('should find loaded value set by https URL and version', function() {
      const url = 'https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013';
      const version = '20170320';
      const result = service.findValueSet(url, version);
      result.should.eql(new ValueSet('2.16.840.1.113883.3.464.1003.104.12.1013', version, [
        new Code('2093-3', 'http://loinc.org', '2.58'),
        new Code('48620-9', 'http://loinc.org', '2.58')
      ]));
    });

    it('should find loaded value set by http URL and version', function() {
      const url = 'https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013';
      const version = '20170320';
      const result = service.findValueSet(url, version);
      result.should.eql(new ValueSet('2.16.840.1.113883.3.464.1003.104.12.1013', version, [
        new Code('2093-3', 'http://loinc.org', '2.58'),
        new Code('48620-9', 'http://loinc.org', '2.58')
      ]));
    });

    it('should find loaded value set by https URL and embedded version', function() {
      const url = 'https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013|20170320';
      const result = service.findValueSet(url);
      result.should.eql(new ValueSet('2.16.840.1.113883.3.464.1003.104.12.1013', '20170320', [
        new Code('2093-3', 'http://loinc.org', '2.58'),
        new Code('48620-9', 'http://loinc.org', '2.58')
      ]));
    });

    it('should find loaded value set by http URL and embedded version', function() {
      const url = 'https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013|20170320';
      const result = service.findValueSet(url);
      result.should.eql(new ValueSet('2.16.840.1.113883.3.464.1003.104.12.1013', '20170320', [
        new Code('2093-3', 'http://loinc.org', '2.58'),
        new Code('48620-9', 'http://loinc.org', '2.58')
      ]));
    });

    it('should prefer passed in version over url-embedded version', function() {
      const url = 'https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013|20200401';
      const version = '20170320';
      const result = service.findValueSet(url, version);
      result.should.eql(new ValueSet('2.16.840.1.113883.3.464.1003.104.12.1013', version, [
        new Code('2093-3', 'http://loinc.org', '2.58'),
        new Code('48620-9', 'http://loinc.org', '2.58')
      ]));

      const url2 = 'https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013|20170320';
      const version2 = '20200401';
      const result2 = service.findValueSet(url2, version2);
      result2.should.eql(new ValueSet('2.16.840.1.113883.3.464.1003.104.12.1013', version2, [
        new Code('48620-9', 'http://loinc.org', '2.58')
      ]));
    });

    it('should not find value set with invalid OID', function() {
      const result = service.findValueSet('FOO');
      should.not.exist(result);
    });

    it('should not find value set with invalid version', function() {
      const result = service.findValueSet('2.16.840.1.113883.3.464.1003.104.12.1013', '20170321');
      should.not.exist(result);
    });
  });


  //Tests using username/password for auth
  console.warn('WARNING! As of Jan 1 2021 VSAC will no longer accept accept username and password.  As such '
    + 'ensureValueSets has been deprecated');
  describe('#ensureValueSets', function() {
    it('should not attempt downloads for value sets it already has (by OID)', function() {
      const vsList = [
        {name: 'HDL Cholesterol', id: '2.16.840.1.113883.3.464.1003.104.12.1013'}
      ];
      return service.ensureValueSets(vsList).should.be.fulfilled;
    });

    it('should not attempt downloads for value sets it already has (by OID and version)', function() {
      const vsList = [
        {name: 'HDL Cholesterol', id: '2.16.840.1.113883.3.464.1003.104.12.1013', version: '20170320'}
      ];
      return service.ensureValueSets(vsList).should.be.fulfilled;
    });

    it('should not attempt downloads for value sets it already has (by URN)', function() {
      const vsList = [
        {name: 'HDL Cholesterol', id: 'urn:oid:2.16.840.1.113883.3.464.1003.104.12.1013'}
      ];
      return service.ensureValueSets(vsList).should.be.fulfilled;
    });

    it('should not attempt downloads for value sets it already has (by URN and version)', function() {
      const vsList = [
        {name: 'HDL Cholesterol', id: 'urn:oid:2.16.840.1.113883.3.464.1003.104.12.1013', version: '20170320'}
      ];
      return service.ensureValueSets(vsList).should.be.fulfilled;
    });

    it('should not attempt downloads for value sets it already has (by https URL)', function() {
      const vsList = [
        {name: 'HDL Cholesterol', id: 'https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013'}
      ];
      return service.ensureValueSets(vsList).should.be.fulfilled;
    });

    it('should not attempt downloads for value sets it already has (by https URL and version)', function() {
      const vsList = [
        {name: 'HDL Cholesterol', id: 'https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013', version: '20170320'}
      ];
      return service.ensureValueSets(vsList).should.be.fulfilled;
    });

    it('should not attempt downloads for value sets it already has (by http URL)', function() {
      const vsList = [
        {name: 'HDL Cholesterol', id: 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013'}
      ];
      return service.ensureValueSets(vsList).should.be.fulfilled;
    });


    it('should not attempt downloads for value sets it already has (by http URL and version)', function() {
      const vsList = [
        {name: 'HDL Cholesterol', id: 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013', version: '20170320'}
      ];
      return service.ensureValueSets(vsList).should.be.fulfilled;
    });

    it('should not attempt downloads for value sets it already has (by https URL with embedded version)', function() {
      const vsList = [
        {name: 'HDL Cholesterol', id: 'https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013|20170320'}
      ];
      return service.ensureValueSets(vsList).should.be.fulfilled;
    });

    it('should not attempt downloads for value sets it already has (by http URL with embedded version)', function() {
      const vsList = [
        {name: 'HDL Cholesterol', id: 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013|20170320'}
      ];
      return service.ensureValueSets(vsList).should.be.fulfilled;
    });

    it('should download value sets it does not have (by OID)', function() {
      return doDownloadTest([
        {name: 'Systolic Blood Pressure', id: '2.16.840.1.113883.3.526.3.1032'},
        {name: 'Current Tobacco Smoker', id: '2.16.840.1.113883.3.600.2390'}
      ]);
    });

    it('should download value sets it does not have (by OID and version)', function() {
      return doDownloadTest([
        {name: 'Systolic Blood Pressure', id: '2.16.840.1.113883.3.526.3.1032', version: '20170320'},
        {name: 'Current Tobacco Smoker', id: '2.16.840.1.113883.3.600.2390', version: '20170320'}
      ], true);
    });

    it('should download value sets it does not have when no version is supplied (by URN)', function() {
      return doDownloadTest([
        {name: 'Systolic Blood Pressure', id: 'urn:oid:2.16.840.1.113883.3.526.3.1032'},
        {name: 'Current Tobacco Smoker', id: 'urn:oid:2.16.840.1.113883.3.600.2390'}
      ]);
    });

    it('should download value sets it does not have (by URN and version)', function() {
      return doDownloadTest([
        {name: 'Systolic Blood Pressure', id: 'urn:oid:2.16.840.1.113883.3.526.3.1032', version: '20170320'},
        {name: 'Current Tobacco Smoker', id: 'urn:oid:2.16.840.1.113883.3.600.2390', version: '20170320'}
      ], true);
    });

    it('should download value sets it does not have when no version is supplied (by https URL)', function() {
      return doDownloadTest([
        {name: 'Systolic Blood Pressure', id: 'https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.526.3.1032'},
        {name: 'Current Tobacco Smoker', id: 'https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.600.2390'}
      ]);
    });

    it('should download value sets it does not have (by https URL and version)', function() {
      return doDownloadTest([
        {name: 'Systolic Blood Pressure', id: 'https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.526.3.1032', version: '20170320'},
        {name: 'Current Tobacco Smoker', id: 'https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.600.2390', version: '20170320'}
      ], true);
    });

    it('should download value sets it does not have (by https URL with embedded version)', function() {
      return doDownloadTest([
        {name: 'Systolic Blood Pressure', id: 'https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.526.3.1032|20170320'},
        {name: 'Current Tobacco Smoker', id: 'https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.600.2390|20170320'}
      ], true);
    });

    it('should download value sets it does not have when no version is supplied (by http URL)', function() {
      return doDownloadTest([
        {name: 'Systolic Blood Pressure', id: 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.526.3.1032'},
        {name: 'Current Tobacco Smoker', id: 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.600.2390'}
      ]);
    });

    it('should download value sets it does not have (by http URL and version)', function() {
      return doDownloadTest([
        {name: 'Systolic Blood Pressure', id: 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.526.3.1032', version: '20170320'},
        {name: 'Current Tobacco Smoker', id: 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.600.2390', version: '20170320'}
      ], true);
    });

    it('should download value sets it does not have (by http URL with embedded version)', function() {
      return doDownloadTest([
        {name: 'Systolic Blood Pressure', id: 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.526.3.1032|20170320'},
        {name: 'Current Tobacco Smoker', id: 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.600.2390|20170320'}
      ], true);
    });


    const doDownloadTest = (vsList, withVersion = false) => {
      // Just to be sure, check length is only 2 (as expected)
      Object.keys(service.valueSets).should.have.length(2);

      const query1 = { id: '2.16.840.1.113883.3.526.3.1032', ticket: 'ST-TEST-1' };
      const query2 = { id: '2.16.840.1.113883.3.600.2390', ticket: 'ST-TEST-2' };
      if (withVersion) {
        query1.version = '20170320';
        query2.version = '20170320';
      }
      nock('https://vsac.nlm.nih.gov')
        // Ticket granting ticket
        .post('/vsac/ws/Ticket', { username, password })
        .reply(200, 'TGT-TEST')
        // Service ticket and VS retrieval #1
        .post('/vsac/ws/Ticket/TGT-TEST', { service: 'http://umlsks.nlm.nih.gov' })
        .reply(200, 'ST-TEST-1')
        .get('/vsac/svs/RetrieveValueSet')
        .query(query1)
        .replyWithFile(200, path.join(__dirname, 'fixtures', '2.16.840.1.113883.3.526.3.1032.xml'))
        // Service ticket and VS retrieval #2
        .post('/vsac/ws/Ticket/TGT-TEST', { service: 'http://umlsks.nlm.nih.gov' })
        .reply(200, 'ST-TEST-2')
        .get('/vsac/svs/RetrieveValueSet')
        .query(query2)
        .replyWithFile(200, path.join(__dirname, 'fixtures', '2.16.840.1.113883.3.600.2390.xml'));

      return service.ensureValueSets(vsList, username, password).then(function() {
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
      });//.catch((err) => console.log(err));
    };
  });

  //Updated tests for use with API Key based auth
  describe('#ensureValueSetsWithAPIKey', function() {
    it('should not attempt downloads for value sets it already has (by OID)', function() {
      const vsList = [
        {name: 'HDL Cholesterol', id: '2.16.840.1.113883.3.464.1003.104.12.1013'}
      ];
      return service.ensureValueSetsWithAPIKey(vsList).should.be.fulfilled;
    });

    it('should not attempt downloads for value sets it already has (by OID and version)', function() {
      const vsList = [
        {name: 'HDL Cholesterol', id: '2.16.840.1.113883.3.464.1003.104.12.1013', version: '20170320'}
      ];
      return service.ensureValueSetsWithAPIKey(vsList).should.be.fulfilled;
    });

    it('should not attempt downloads for value sets it already has (by URN)', function() {
      const vsList = [
        {name: 'HDL Cholesterol', id: 'urn:oid:2.16.840.1.113883.3.464.1003.104.12.1013'}
      ];
      return service.ensureValueSetsWithAPIKey(vsList).should.be.fulfilled;
    });

    it('should not attempt downloads for value sets it already has (by URN and version)', function() {
      const vsList = [
        {name: 'HDL Cholesterol', id: 'urn:oid:2.16.840.1.113883.3.464.1003.104.12.1013', version: '20170320'}
      ];
      return service.ensureValueSetsWithAPIKey(vsList).should.be.fulfilled;
    });

    it('should not attempt downloads for value sets it already has (by https URL)', function() {
      const vsList = [
        {name: 'HDL Cholesterol', id: 'https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013'}
      ];
      return service.ensureValueSetsWithAPIKey(vsList).should.be.fulfilled;
    });

    it('should not attempt downloads for value sets it already has (by https URL and version)', function() {
      const vsList = [
        {name: 'HDL Cholesterol', id: 'https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013', version: '20170320'}
      ];
      return service.ensureValueSetsWithAPIKey(vsList).should.be.fulfilled;
    });

    it('should not attempt downloads for value sets it already has (by http URL)', function() {
      const vsList = [
        {name: 'HDL Cholesterol', id: 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013'}
      ];
      return service.ensureValueSetsWithAPIKey(vsList).should.be.fulfilled;
    });


    it('should not attempt downloads for value sets it already has (by http URL and version)', function() {
      const vsList = [
        {name: 'HDL Cholesterol', id: 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013', version: '20170320'}
      ];
      return service.ensureValueSetsWithAPIKey(vsList).should.be.fulfilled;
    });

    it('should not attempt downloads for value sets it already has (by https URL with embedded version)', function() {
      const vsList = [
        {name: 'HDL Cholesterol', id: 'https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013|20170320'}
      ];
      return service.ensureValueSetsWithAPIKey(vsList).should.be.fulfilled;
    });

    it('should not attempt downloads for value sets it already has (by http URL with embedded version)', function() {
      const vsList = [
        {name: 'HDL Cholesterol', id: 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013|20170320'}
      ];
      return service.ensureValueSetsWithAPIKey(vsList).should.be.fulfilled;
    });

    it('should download value sets it does not have (by OID)', function() {
      return doDownloadTestWithAPIKey([
        {name: 'Systolic Blood Pressure', id: '2.16.840.1.113883.3.526.3.1032'},
        {name: 'Current Tobacco Smoker', id: '2.16.840.1.113883.3.600.2390'}
      ]);
    });

    it('should download value sets it does not have (by OID and version)', function() {
      return doDownloadTestWithAPIKey([
        {name: 'Systolic Blood Pressure', id: '2.16.840.1.113883.3.526.3.1032', version: '20170320'},
        {name: 'Current Tobacco Smoker', id: '2.16.840.1.113883.3.600.2390', version: '20170320'}
      ], true);
    });

    it('should download value sets it does not have when no version is supplied (by URN)', function() {
      return doDownloadTestWithAPIKey([
        {name: 'Systolic Blood Pressure', id: 'urn:oid:2.16.840.1.113883.3.526.3.1032'},
        {name: 'Current Tobacco Smoker', id: 'urn:oid:2.16.840.1.113883.3.600.2390'}
      ]);
    });

    it('should download value sets it does not have (by URN and version)', function() {
      return doDownloadTestWithAPIKey([
        {name: 'Systolic Blood Pressure', id: 'urn:oid:2.16.840.1.113883.3.526.3.1032', version: '20170320'},
        {name: 'Current Tobacco Smoker', id: 'urn:oid:2.16.840.1.113883.3.600.2390', version: '20170320'}
      ], true);
    });

    it('should download value sets it does not have when no version is supplied (by https URL)', function() {
      return doDownloadTestWithAPIKey([
        {name: 'Systolic Blood Pressure', id: 'https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.526.3.1032'},
        {name: 'Current Tobacco Smoker', id: 'https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.600.2390'}
      ]);
    });

    it('should download value sets it does not have (by https URL and version)', function() {
      return doDownloadTestWithAPIKey([
        {name: 'Systolic Blood Pressure', id: 'https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.526.3.1032', version: '20170320'},
        {name: 'Current Tobacco Smoker', id: 'https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.600.2390', version: '20170320'}
      ], true);
    });

    it('should download value sets it does not have (by https URL with embedded version)', function() {
      return doDownloadTestWithAPIKey([
        {name: 'Systolic Blood Pressure', id: 'https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.526.3.1032|20170320'},
        {name: 'Current Tobacco Smoker', id: 'https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.600.2390|20170320'}
      ], true);
    });

    it('should download value sets it does not have when no version is supplied (by http URL)', function() {
      return doDownloadTestWithAPIKey([
        {name: 'Systolic Blood Pressure', id: 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.526.3.1032'},
        {name: 'Current Tobacco Smoker', id: 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.600.2390'}
      ]);
    });

    it('should download value sets it does not have (by http URL and version)', function() {
      return doDownloadTestWithAPIKey([
        {name: 'Systolic Blood Pressure', id: 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.526.3.1032', version: '20170320'},
        {name: 'Current Tobacco Smoker', id: 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.600.2390', version: '20170320'}
      ], true);
    });

    it('should download value sets it does not have (by http URL with embedded version)', function() {
      return doDownloadTestWithAPIKey([
        {name: 'Systolic Blood Pressure', id: 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.526.3.1032|20170320'},
        {name: 'Current Tobacco Smoker', id: 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.600.2390|20170320'}
      ], true);
    });

    const doDownloadTestWithAPIKey = (vsList, withVersion = false) => {
      // Just to be sure, check length is only 2 (as expected)
      Object.keys(service.valueSets).should.have.length(2);

      const query1 = { id: '2.16.840.1.113883.3.526.3.1032', ticket: 'ST-TEST-1' };
      const query2 = { id: '2.16.840.1.113883.3.600.2390', ticket: 'ST-TEST-2' };
      if (withVersion) {
        query1.version = '20170320';
        query2.version = '20170320';
      }
      nock('https://vsac.nlm.nih.gov')
      // Ticket granting ticket
        .post('/vsac/ws/Ticket', { apikey: apiKey })
        .reply(200, 'TGT-TEST')
        // Service ticket and VS retrieval #1
        .post('/vsac/ws/Ticket/TGT-TEST', { service: 'http://umlsks.nlm.nih.gov' })
        .reply(200, 'ST-TEST-1')
        .get('/vsac/svs/RetrieveValueSet')
        .query(query1)
        .replyWithFile(200, path.join(__dirname, 'fixtures', '2.16.840.1.113883.3.526.3.1032.xml'))
        // Service ticket and VS retrieval #2
        .post('/vsac/ws/Ticket/TGT-TEST', { service: 'http://umlsks.nlm.nih.gov' })
        .reply(200, 'ST-TEST-2')
        .get('/vsac/svs/RetrieveValueSet')
        .query(query2)
        .replyWithFile(200, path.join(__dirname, 'fixtures', '2.16.840.1.113883.3.600.2390.xml'));

      return service.ensureValueSetsWithAPIKey(vsList, apiKey).then(function() {
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
      });//.catch((err) => console.log(err));
    };

    it('should download and cache successful value sets before throwing error', function() {
      // Just to be sure, check length is only 2 (as expected)
      Object.keys(service.valueSets).should.have.length(2);

      nock('https://vsac.nlm.nih.gov')
        // Ticket granting ticket
        .post('/vsac/ws/Ticket', { username, password })
        .reply(200, 'TGT-TEST')
        // Service ticket and VS retrieval #1
        .post('/vsac/ws/Ticket/TGT-TEST', { service: 'http://umlsks.nlm.nih.gov' })
        .reply(200, 'ST-TEST-1')
        .get('/vsac/svs/RetrieveValueSet')
        .query({ id: '1.2.3.4.5.6.7.8.9.10', version: '20170320', ticket: 'ST-TEST-1' })
        .reply(404) // Not Found
        // Service ticket and VS retrieval #2
        .post('/vsac/ws/Ticket/TGT-TEST', { service: 'http://umlsks.nlm.nih.gov' })
        .reply(200, 'ST-TEST-2')
        .get('/vsac/svs/RetrieveValueSet')
        .query({ id: '2.16.840.1.113883.3.600.2390', version: '20170320', ticket: 'ST-TEST-2' })
        .replyWithFile(200, path.join(__dirname, 'fixtures', '2.16.840.1.113883.3.600.2390.xml'));

      const vsList = [
        {name: 'Fake Value Set', id: '1.2.3.4.5.6.7.8.9.10', version: '20170320'},
        {name: 'Current Tobacco Smoker', id: '2.16.840.1.113883.3.600.2390', version: '20170320'}
      ];

      return service.ensureValueSets(vsList, username, password)
        .then(function() {
          should.fail(0, 1, 'This code should never be executed since there were errors');
        })
        .catch(function(error) {
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

    it('should error if no username/password is supplied', function() {
      const [oldU, oldP] = [process.env['UMLS_USER_NAME'], process.env['UMLS_PASSWORD']];
      try {
        // Make sure env is clear so no username/password creeps through!
        delete process.env['UMLS_USER_NAME'];
        delete process.env['UMLS_PASSWORD'];

        nock('https://vsac.nlm.nih.gov');

        const vsList = [
          {name: 'Systolic Blood Pressure', id: '2.16.840.1.113883.3.526.3.1032', version: '20170320'}
        ];
        return service.ensureValueSets(vsList, null, null)
          .then(function() {
            should.fail(0, 1, 'This code should never be executed');
          })
          .catch(function(error) {
            error.should.eql('Failed to download value sets since UMLS_USER_NAME and/or UMLS_PASSWORD is not set.');
          });
      } finally {
        [process.env['UMLS_USER_NAME'], process.env['UMLS_PASSWORD']] = [oldU, oldP];
      }
    });

    it('should error if wrong username/password is supplied', function() {
      const [wrongU, wrongP] = ['foo', 'bar'];
      nock('https://vsac.nlm.nih.gov')
        // Simulate response to requesting ticket granting ticket w/ wrong username/password
        .post('/vsac/ws/Ticket', { username: wrongU, password: wrongP })
        .reply(401); // Unauthorized

      const vsList = [
        {name: 'Systolic Blood Pressure', id: '2.16.840.1.113883.3.526.3.1032', version: '20170320'}
      ];

      return service.ensureValueSets(vsList, wrongU, wrongP)
        .then(function() {
          should.fail(0, 1, 'This code should never be executed');
        })
        .catch(function(error) {
          error.statusCode.should.equal(401);
        });
    });

    it('should error if no API Key is supplied', function(){
      const oldAPIKey = process.env['UMLS_API_KEY'];
      try {
        // Make sure env is clear so no username/password creeps through!
        delete process.env['UMLS_API_KEY'];

        nock('https://vsac.nlm.nih.gov');

        const vsList = [
          {name: 'Systolic Blood Pressure', id: '2.16.840.1.113883.3.526.3.1032', version: '20170320'}
        ];
        return service.ensureValueSetsWithAPIKey(vsList, null)
          .then(function() {
            should.fail(0, 1, 'This code should never be executed');
          })
          .catch(function(error) {
            error.should.eql('Failed to download value sets since UMLS_API_KEY is not set.');
          });
      } finally {
        process.env['UMLS_API_KEY'] = oldAPIKey;
      }
    });

    it('should error if invalid ticket granting ticket is supplied', function() {
      // Technically this should only happen if there is an issue w/ VSAC, but let's be sure we handle it
      nock('https://vsac.nlm.nih.gov')
        // Ticket granting ticket (invalid)
        .post('/vsac/ws/Ticket', { username, password })
        .reply(200, 'TGT-INVALID-TEST')
        // Simulate response to requesting service granting ticket w/ invalid ticket granting ticket
        .post('/vsac/ws/Ticket/TGT-INVALID-TEST', { service: 'http://umlsks.nlm.nih.gov' })
        .reply(401); // Unauthorized

      const vsList = [
        {name: 'Systolic Blood Pressure', id: '2.16.840.1.113883.3.526.3.1032', version: '20170320'}
      ];
      return service.ensureValueSets(vsList, username, password)
        .then(function() {
          should.fail(0, 1, 'This code should never be executed');
        })
        .catch(function(error) {
          error.should.have.length(1);
          error[0].should.be.an('error');
          error[0].message.should.contain('2.16.840.1.113883.3.526.3.1032');
        });
    });

    it('should error if invalid ticket granting ticket is supplied using API key functions', function() {
      // Technically this should only happen if there is an issue w/ VSAC, but let's be sure we handle it
      nock('https://vsac.nlm.nih.gov')
      // Ticket granting ticket (invalid)
        .post('/vsac/ws/Ticket', { apikey: apiKey })
        .reply(200, 'TGT-INVALID-TEST')
        // Simulate response to requesting service granting ticket w/ invalid ticket granting ticket
        .post('/vsac/ws/Ticket/TGT-INVALID-TEST', { service: 'http://umlsks.nlm.nih.gov' })
        .reply(401); // Unauthorized

      const vsList = [
        {name: 'Systolic Blood Pressure', id: '2.16.840.1.113883.3.526.3.1032', version: '20170320'}
      ];
      return service.ensureValueSetsWithAPIKey(vsList, apiKey)
        .then(function() {
          should.fail(0, 1, 'This code should never be executed');
        })
        .catch(function(error) {
          error.should.have.length(1);
          error[0].should.be.an('error');
          error[0].message.should.contain('2.16.840.1.113883.3.526.3.1032');
        });
    });

    it('should error if invalid service granting ticket is supplied', function() {
      // Technically this should only happen if there is an issue w/ VSAC, but let's be sure we handle it
      nock('https://vsac.nlm.nih.gov')
        // Ticket granting ticket
        .post('/vsac/ws/Ticket', { username, password })
        .reply(200, 'TGT-TEST')
        // Service ticket (invalid)
        .post('/vsac/ws/Ticket/TGT-TEST', { service: 'http://umlsks.nlm.nih.gov' })
        .reply(200, 'ST-INVALID-TEST')
        // Simulate response to requesting value set w/ invalid service granting ticket
        .get('/vsac/svs/RetrieveValueSet')
        .query({ id: '2.16.840.1.113883.3.526.3.1032', version: '20170320', ticket: 'ST-INVALID-TEST' })
        .reply(401, 'Unauthorized'); // This is the only one that puts 'Unauthorized' in the body

      const vsList = [
        {name: 'Systolic Blood Pressure', id: '2.16.840.1.113883.3.526.3.1032', version: '20170320'}
      ];
      return service.ensureValueSets(vsList, username, password)
        .then(function() {
          should.fail(0, 1, 'This code should never be executed');
        })
        .catch(function(error) {
          error.should.have.length(1);
          error[0].should.be.an('error');
          error[0].message.should.contain('2.16.840.1.113883.3.526.3.1032');
        });
    });

    it('should error if value set is not found', function() {
      // Technically this should only happen if there is an issue w/ VSAC, but let's be sure we handle it
      nock('https://vsac.nlm.nih.gov')
        // Ticket granting ticket
        .post('/vsac/ws/Ticket', { username, password })
        .reply(200, 'TGT-TEST')
        // Service ticket and VS retrieval #1
        .post('/vsac/ws/Ticket/TGT-TEST', { service: 'http://umlsks.nlm.nih.gov' })
        .reply(200, 'ST-TEST')
        .get('/vsac/svs/RetrieveValueSet')
        .query({ id: '1.2.3.4.5.6.7.8.9.10', version: '20170320', ticket: 'ST-TEST' })
        .reply(404); // Not Found

      const vsList = [
        {name: 'Fake Value Set', id: '1.2.3.4.5.6.7.8.9.10', version: '20170320'}
      ];
      return service.ensureValueSets(vsList, username, password)
        .then(function() {
          should.fail(0, 1, 'This code should never be executed');
        })
        .catch(function(error) {
          error.should.have.length(1);
          error[0].should.be.an('error');
          error[0].message.should.contain('1.2.3.4.5.6.7.8.9.10');
        });
    });
  });
});