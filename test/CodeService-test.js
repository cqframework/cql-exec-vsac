const cs = require('../src/CodeService');
const { Code, ValueSet } = require('cql-execution');
const path = require('path');
const process = require('process');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const should = chai.should();
const sandbox = require('sinon').createSandbox();
const temp = require('temp');
const TOBACCO_VS_DB = require('./fixtures/2.16.840.1.113883.3.600.2390-vsdb.json');

// Automatically track and cleanup files at exit
temp.track();

describe('CodeService', () => {
  let service, tmpCache;

  beforeEach(() => {
    // Create a temporary cache folder and construct the code service using it
    tmpCache = temp.mkdirSync('cql-exec-vsac-test');
    service = new cs.CodeService(tmpCache);
    service.loadValueSetsFromFile(path.join(__dirname, 'fixtures', 'valueset-db.json'));
    // Replace the CodeService API with a mock
    service.api = {
      downloadValueSet: sandbox.stub()
    };
  });

  afterEach(() => {
    // Clean up mocks
    sandbox.restore();
  });

  describe('#constructor', () => {
    it('should have empty value sets when there is no pre-existing data', () => {
      service = new cs.CodeService();
      service.valueSets.should.be.empty;
    });

    it('should have empty value sets when constructed with cache but loadCache flag is false', () => {
      service = new cs.CodeService(path.join(__dirname, 'fixtures'), false);
      service.valueSets.should.be.empty;
    });

    it('should have value sets when constructed with cache and loadCache flag is true', () => {
      service = new cs.CodeService(path.join(__dirname, 'fixtures'), true);
      service.valueSets.should.not.be.empty;
    });

    it('should default to SVS API', () => {
      service = new cs.CodeService(path.join(__dirname, 'fixtures'), true);
      service.api.name.should.equal('SVS');
    });

    it('should use SVS API when useFHIR is false', () => {
      service = new cs.CodeService(path.join(__dirname, 'fixtures'), true, false);
      service.api.name.should.equal('SVS');
    });

    it('should use FHIR API when useFHIR is true', () => {
      service = new cs.CodeService(path.join(__dirname, 'fixtures'), true, true);
      service.api.name.should.equal('FHIR');
    });
  });

  describe('#findValueSetsByOid', () => {
    it('should find loaded value set', () => {
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

    it('should not find invalid value set', () => {
      const results = service.findValueSetsByOid('FOO');
      results.should.be.empty;
    });
  });

  describe('#findValueSets', () => {
    it('should find loaded value sets by OID', () => {
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

    it('should find loaded value set by OID and version', () => {
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

    it('should find loaded value sets by URN', () => {
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

    it('should find loaded value sets by URN and version', () => {
      const urn = 'urn:oid:2.16.840.1.113883.3.464.1003.104.12.1013';
      const results = service.findValueSets(urn, '20200401');
      results.should.have.length(1);
      results[0].should.eql(
        new ValueSet('2.16.840.1.113883.3.464.1003.104.12.1013', '20200401', [
          new Code('48620-9', 'http://loinc.org', '2.58')
        ])
      );
    });

    it('should find loaded value sets by https URL', () => {
      const url = 'https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013';
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

    it('should find loaded value sets by https URL and version', () => {
      const url = 'https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013';
      const results = service.findValueSets(url, '20170320');
      results.should.have.length(1);
      results[0].should.eql(
        new ValueSet('2.16.840.1.113883.3.464.1003.104.12.1013', '20170320', [
          new Code('2093-3', 'http://loinc.org', '2.58'),
          new Code('48620-9', 'http://loinc.org', '2.58')
        ])
      );
    });

    it('should find loaded values sets by http URL', () => {
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

    it('should find loaded values sets by http URL and version', () => {
      const url = 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013';
      const results = service.findValueSets(url, '20200401');
      results.should.have.length(1);
      results[0].should.eql(
        new ValueSet('2.16.840.1.113883.3.464.1003.104.12.1013', '20200401', [
          new Code('48620-9', 'http://loinc.org', '2.58')
        ])
      );
    });

    it('should find loaded value set by https URL with embedded version', () => {
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

    it('should prefer explicit version over embedded version in https URL', () => {
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

    it('should find loaded value set by http URL with embedded version', () => {
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

    it('should prefer explicit version over embedded version in http URL', () => {
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

    it('should not find invalid value set by OID', () => {
      const results = service.findValueSets('FOO');
      results.should.be.empty;
    });

    it('should not find invalid value set version by OID', () => {
      const results = service.findValueSets('2.16.840.1.113883.3.464.1003.104.12.1013', '20180320');
      results.should.be.empty;
    });

    it('should not find invalid value set by URN', () => {
      const results = service.findValueSets('urn:oid:FOO');
      results.should.be.empty;
    });

    it('should not find invalid value set version by URN', () => {
      const results = service.findValueSets(
        'urn:oid:2.16.840.1.113883.3.464.1003.104.12.1013',
        '20180320'
      );
      results.should.be.empty;
    });

    it('should not find invalid value set by https URL', () => {
      const results = service.findValueSets('https://cts.nlm.nih.gov/fhir/ValueSet/FOO');
      results.should.be.empty;
    });

    it('should not find invalid value set version by https URL', () => {
      const results = service.findValueSets(
        'https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013',
        '20180320'
      );
      results.should.be.empty;
    });

    it('should not find value set by https URL with invalid embedded version', () => {
      const results = service.findValueSets(
        'https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013|20180320'
      );
      results.should.be.empty;
    });

    it('should not find invalid value set by http URL', () => {
      const results = service.findValueSets('http://cts.nlm.nih.gov/fhir/ValueSet/FOO');
      results.should.be.empty;
    });

    it('should not find invalid value set version by http URL', () => {
      const results = service.findValueSets(
        'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013',
        '20180320'
      );
      results.should.be.empty;
    });

    it('should not find value set by http URL with invalid embedded version', () => {
      const results = service.findValueSets(
        'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013|20180320'
      );
      results.should.be.empty;
    });
  });

  describe('#findValueSet', () => {
    it('should find loaded value set by OID only', () => {
      const oid = '2.16.840.1.113883.3.464.1003.104.12.1013';
      const result = service.findValueSet(oid);
      result.should.eql(
        new ValueSet(oid, '20200401', [new Code('48620-9', 'http://loinc.org', '2.58')])
      );
    });

    it('should find loaded value set by URN only', () => {
      const urn = 'urn:oid:2.16.840.1.113883.3.464.1003.104.12.1013';
      const result = service.findValueSet(urn);
      result.should.eql(
        new ValueSet('2.16.840.1.113883.3.464.1003.104.12.1013', '20200401', [
          new Code('48620-9', 'http://loinc.org', '2.58')
        ])
      );
    });

    it('should find loaded value set by https URL only', () => {
      const urn = 'https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013';
      const result = service.findValueSet(urn);
      result.should.eql(
        new ValueSet('2.16.840.1.113883.3.464.1003.104.12.1013', '20200401', [
          new Code('48620-9', 'http://loinc.org', '2.58')
        ])
      );
    });

    it('should find loaded value set by http URL only', () => {
      const urn = 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013';
      const result = service.findValueSet(urn);
      result.should.eql(
        new ValueSet('2.16.840.1.113883.3.464.1003.104.12.1013', '20200401', [
          new Code('48620-9', 'http://loinc.org', '2.58')
        ])
      );
    });

    it('should find loaded value set by OID and version', () => {
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

    it('should find loaded value set by URN and version', () => {
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

    it('should find loaded value set by https URL and version', () => {
      const url = 'https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013';
      const version = '20170320';
      const result = service.findValueSet(url, version);
      result.should.eql(
        new ValueSet('2.16.840.1.113883.3.464.1003.104.12.1013', version, [
          new Code('2093-3', 'http://loinc.org', '2.58'),
          new Code('48620-9', 'http://loinc.org', '2.58')
        ])
      );
    });

    it('should find loaded value set by http URL and version', () => {
      const url = 'https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013';
      const version = '20170320';
      const result = service.findValueSet(url, version);
      result.should.eql(
        new ValueSet('2.16.840.1.113883.3.464.1003.104.12.1013', version, [
          new Code('2093-3', 'http://loinc.org', '2.58'),
          new Code('48620-9', 'http://loinc.org', '2.58')
        ])
      );
    });

    it('should find loaded value set by https URL and embedded version', () => {
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

    it('should find loaded value set by http URL and embedded version', () => {
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

    it('should prefer passed in version over url-embedded version', () => {
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

    it('should not find value set with invalid OID', () => {
      const result = service.findValueSet('FOO');
      should.not.exist(result);
    });

    it('should not find value set with invalid version', () => {
      const result = service.findValueSet('2.16.840.1.113883.3.464.1003.104.12.1013', '20170321');
      should.not.exist(result);
    });
  });

  describe('#ensureValueSetsWithAPIKey', () => {
    it('should not attempt downloads for value sets it already has (by OID)', async () => {
      const vsList = [
        {
          name: 'HDL Cholesterol',
          id: '2.16.840.1.113883.3.464.1003.104.12.1013'
        }
      ];
      await service.ensureValueSetsWithAPIKey(vsList).should.be.fulfilled;
      sandbox.assert.notCalled(service.api.downloadValueSet);
    });

    it('should not attempt downloads for value sets it already has (by OID and version)', async () => {
      const vsList = [
        {
          name: 'HDL Cholesterol',
          id: '2.16.840.1.113883.3.464.1003.104.12.1013',
          version: '20170320'
        }
      ];
      await service.ensureValueSetsWithAPIKey(vsList).should.be.fulfilled;
      sandbox.assert.notCalled(service.api.downloadValueSet);
    });

    it('should not attempt downloads for value sets it already has (by URN)', async () => {
      const vsList = [
        {
          name: 'HDL Cholesterol',
          id: 'urn:oid:2.16.840.1.113883.3.464.1003.104.12.1013'
        }
      ];
      await service.ensureValueSetsWithAPIKey(vsList).should.be.fulfilled;
      sandbox.assert.notCalled(service.api.downloadValueSet);
    });

    it('should not attempt downloads for value sets it already has (by URN and version)', async () => {
      const vsList = [
        {
          name: 'HDL Cholesterol',
          id: 'urn:oid:2.16.840.1.113883.3.464.1003.104.12.1013',
          version: '20170320'
        }
      ];
      await service.ensureValueSetsWithAPIKey(vsList).should.be.fulfilled;
      sandbox.assert.notCalled(service.api.downloadValueSet);
    });

    it('should not attempt downloads for value sets it already has (by https URL)', async () => {
      const vsList = [
        {
          name: 'HDL Cholesterol',
          id: 'https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013'
        }
      ];
      await service.ensureValueSetsWithAPIKey(vsList).should.be.fulfilled;
      sandbox.assert.notCalled(service.api.downloadValueSet);
    });

    it('should not attempt downloads for value sets it already has (by https URL and version)', async () => {
      const vsList = [
        {
          name: 'HDL Cholesterol',
          id: 'https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013',
          version: '20170320'
        }
      ];
      await service.ensureValueSetsWithAPIKey(vsList).should.be.fulfilled;
      sandbox.assert.notCalled(service.api.downloadValueSet);
    });

    it('should not attempt downloads for value sets it already has (by http URL)', async () => {
      const vsList = [
        {
          name: 'HDL Cholesterol',
          id: 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013'
        }
      ];
      await service.ensureValueSetsWithAPIKey(vsList).should.be.fulfilled;
      sandbox.assert.notCalled(service.api.downloadValueSet);
    });

    it('should not attempt downloads for value sets it already has (by http URL and version)', async () => {
      const vsList = [
        {
          name: 'HDL Cholesterol',
          id: 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013',
          version: '20170320'
        }
      ];
      await service.ensureValueSetsWithAPIKey(vsList).should.be.fulfilled;
      sandbox.assert.notCalled(service.api.downloadValueSet);
    });

    it('should not attempt downloads for value sets it already has (by https URL with embedded version)', async () => {
      const vsList = [
        {
          name: 'HDL Cholesterol',
          id: 'https://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013|20170320'
        }
      ];
      await service.ensureValueSetsWithAPIKey(vsList).should.be.fulfilled;
      sandbox.assert.notCalled(service.api.downloadValueSet);
    });

    it('should not attempt downloads for value sets it already has (by http URL with embedded version)', async () => {
      const vsList = [
        {
          name: 'HDL Cholesterol',
          id: 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.104.12.1013|20170320'
        }
      ];
      await service.ensureValueSetsWithAPIKey(vsList).should.be.fulfilled;
      sandbox.assert.notCalled(service.api.downloadValueSet);
    });

    it('should download value sets it does not have (by OID)', () => {
      return doDownloadTestWithAPIKey([
        {
          name: 'Systolic Blood Pressure',
          id: '2.16.840.1.113883.3.526.3.1032'
        },
        { name: 'Current Tobacco Smoker', id: '2.16.840.1.113883.3.600.2390' }
      ]);
    });

    it('should download value sets it does not have (by OID and version)', () => {
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

    it('should download value sets it does not have when no version is supplied (by URN)', () => {
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

    it('should download value sets it does not have (by URN and version)', () => {
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

    it('should download value sets it does not have when no version is supplied (by https URL)', () => {
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

    it('should download value sets it does not have (by https URL and version)', () => {
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

    it('should download value sets it does not have (by https URL with embedded version)', () => {
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

    it('should download value sets it does not have when no version is supplied (by http URL)', () => {
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

    it('should download value sets it does not have (by http URL and version)', () => {
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

    it('should download value sets it does not have (by http URL with embedded version)', () => {
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

    const doDownloadTestWithAPIKey = async (vsList, withVersion = false) => {
      service.api.downloadValueSet.callsFake(
        async (apiKey, oid, version, output, vsDB = {}, caching = true) => {
          return path.join(service.cache, `${oid}.xml`);
        }
      );
      await service.ensureValueSetsWithAPIKey(vsList, 'testkey');
      sandbox.assert.calledWith(
        service.api.downloadValueSet,
        'testkey',
        '2.16.840.1.113883.3.526.3.1032',
        withVersion ? '20170504' : undefined
      );
      sandbox.assert.calledWith(
        service.api.downloadValueSet,
        'testkey',
        '2.16.840.1.113883.3.600.2390',
        withVersion ? '20210304' : undefined
      );
    };

    it('should download and cache successful value sets before throwing error', async () => {
      service.api.downloadValueSet.callsFake(
        async (apiKey, oid, version, output, vsDB = {}, caching = true) => {
          if (oid === '1.2.3.4.5.6.7.8.9.10') {
            throw new Error(404); // Not Found
          } else if (oid === '2.16.840.1.113883.3.600.2390') {
            Object.assign(vsDB, TOBACCO_VS_DB);
          }
          return path.join(service.cache, `${oid}.xml`);
        }
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

      try {
        await service.ensureValueSetsWithAPIKey(vsList, 'testkey');
        should.fail(0, 1, 'This code should never be executed since there were errors');
      } catch (error) {
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
      }
    });

    it('should error if no API Key is supplied', async () => {
      const oldAPIKey = process.env['UMLS_API_KEY'];
      try {
        // Make sure env is clear so no API key creeps through!
        delete process.env['UMLS_API_KEY'];
        const vsList = [
          {
            name: 'Systolic Blood Pressure',
            id: '2.16.840.1.113883.3.526.3.1032',
            version: '20170320'
          }
        ];

        try {
          await service.ensureValueSetsWithAPIKey(vsList, null);
          should.fail(0, 1, 'This code should never be executed');
        } catch (error) {
          error.should.eql('Failed to download value sets since UMLS_API_KEY is not set.');
        }
      } finally {
        process.env['UMLS_API_KEY'] = oldAPIKey;
      }
    });

    it('should error if invalid API Key is supplied', async () => {
      service.api.downloadValueSet.callsFake(
        async (apiKey, oid, version, output, vsDB = {}, caching = true) => {
          throw new Error(401); // Unauthorized
        }
      );

      const vsList = [
        {
          name: 'Systolic Blood Pressure',
          id: '2.16.840.1.113883.3.526.3.1032',
          version: '20170320'
        }
      ];

      try {
        await service.ensureValueSetsWithAPIKey(vsList, 'wrongkey');
        should.fail(0, 1, 'This code should never be executed');
      } catch (error) {
        error.should.have.length(1);
        error[0].should.be.an('error');
        error[0].message.should.contain('2.16.840.1.113883.3.526.3.1032');
      }
    });

    it('should error if value set is not found', async () => {
      service.api.downloadValueSet.callsFake(
        async (apiKey, oid, version, output, vsDB = {}, caching = true) => {
          throw new Error(404); // Not Found
        }
      );

      const vsList = [
        {
          name: 'Fake Value Set',
          id: '1.2.3.4.5.6.7.8.9.10',
          version: '20170320'
        }
      ];

      try {
        await service.ensureValueSetsWithAPIKey(vsList, 'testkey');
        should.fail(0, 1, 'This code should never be executed since there were errors');
      } catch (error) {
        error.should.have.length(1);
        error[0].should.be.an('error');
        error[0].message.should.contain('1.2.3.4.5.6.7.8.9.10');
      }
    });
  });
});
