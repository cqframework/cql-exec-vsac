const { Code, ValueSet } = require('cql-execution');
const fs = require('fs-extra');
const proc = require('process');
const env = proc.env;
const path = require('path');
const debug = require('debug')('vsac'); // To turn on DEBUG: $ export DEBUG=vsac
const svs = require('./svs');
const fhir = require('./fhir');

/**
 * Constructs a code service with functions for downloading codes from the National Library of Medicine's
 * Value Set Authority Center.
 * @param {string} vsacCache - path to a folder in which to cache VSAC XML responses and the JSON value set DB
 * @param {boolean=false} loadFromCache - if true, and the cache exists, will initialize itself with the JSON DB
 */
class CodeService {
  constructor(vsacCache, loadFromCache = false, useFHIR = false) {
    this.api = useFHIR ? fhir : svs;

    // Initialize the local in-memory "database"
    this.valueSets = {}; // This will just be an object of objects.

    // Local folder for storing valuesets we get from VSAC.
    if (typeof vsacCache !== 'undefined') {
      this.cache = vsacCache;
    } else {
      this.cache = 'vsac_cache';
    }

    const cacheDBFile = path.join(this.cache, 'valueset-db.json');
    if (loadFromCache && fs.existsSync(cacheDBFile)) {
      this.loadValueSetsFromFile(cacheDBFile);
    }
  }

  /**
   * Add value sets to the code service from a JSON file.  The JSON should be a
   * nested set of objects. At the first level the key is the 'oid' of a
   * particular valueset. At the second level the key specifies the 'version'
   * of the valueset; there could be multiple versions included here. The
   * contents of valueSetsObj[oid][version] is an array of 'Code' objects. See
   * cql.Code for more information, but Code objects consist of three keys:
   * 1) 'code', 2) 'system', and 3) 'version'. The last is optional.
   * If the file does not exist, nothing is added.
   * @param {string} filePath - the path to the file containing valueset JSON
   * @throws {SyntaxException} File is not valid JSON
   */
  loadValueSetsFromFile(filePath) {
    filePath = path.resolve(filePath);
    if (!fs.existsSync(filePath)) {
      return;
    }
    const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    for (let oid in json) {
      let myOid = json[oid];
      for (let version in myOid) {
        let myCodes = myOid[version].codes.map(
          elem => new Code(elem.code, elem.system, elem.version)
        );
        if (typeof this.valueSets[oid] === 'undefined') {
          this.valueSets[oid] = {};
        }
        this.valueSets[oid][version] = new ValueSet(oid, version, myCodes);
      }
    }
  }

  /**
   * Given a list of value set references, will ensure that each has a local
   * definition.  If a local definition does not exist, the value set will
   * be downloaded using the VSAC API.
   * @param {Object} valueSetList - an array of objects, each containing "name"
   *   and "id" properties, with an optional "version" property
   * @returns {Promise.<undefined,Error>} A promise that returns nothing when
   *   resolved and returns an error when rejected.
   */
  async ensureValueSetsWithAPIKey(
    valueSetList = [],
    umlsAPIKey = env['UMLS_API_KEY'],
    caching = true,
    options = { parseCodeSystem: 'replace' }
  ) {
    // First, filter out the value sets we already have
    const filteredVSList = valueSetList.filter(vs => {
      const result = this.findValueSet(vs.id, vs.version);
      return typeof result === 'undefined';
    });
    // Now download from VSAC if necessary
    if (filteredVSList.length == 0) {
      return;
    } else if (typeof umlsAPIKey === 'undefined' || umlsAPIKey == null) {
      // TODO: Throw error instead
      throw 'Failed to download value sets since UMLS_API_KEY is not set.';
    }
    const oidsAndVersions = [];
    Object.keys(filteredVSList).forEach(key => {
      let [id, version] = [filteredVSList[key].id, filteredVSList[key].version];
      const [oid, embeddedVersion] = extractOidAndVersion(id);
      if (version == null && embeddedVersion != null) {
        version = embeddedVersion;
      }
      if (this.valueSets[oid] == null || this.valueSets[oid][version] == null) {
        oidsAndVersions.push({ oid, version });
      }
    });
    if (oidsAndVersions.length) {
      const output = path.resolve(this.cache);
      if (caching && !(await fs.exists(output))) {
        await fs.mkdirp(output);
      }

      const promises = oidsAndVersions.map(({ oid, version }) => {
        // Catch errors and convert to resolutions returning an error.  This ensures Promise.all waits for all promises.
        // See: http://stackoverflow.com/questions/31424561/wait-until-all-es6-promises-complete-even-rejected-promises
        return this.api
          .downloadValueSet(umlsAPIKey, oid, version, output, this.valueSets, caching, options)
          .catch(err => {
            debug(
              `Error downloading valueset ${oid}${version != null ? ` version ${version}` : ''}`,
              err
            );
            return new Error(
              `Error downloading valueset: ${oid}${version != null ? ` version ${version}` : ''}`
            );
          });
      });
      const results = await Promise.all(promises);
      const errors = results.filter(r => r instanceof Error);
      if (caching && results.length - errors.length > 0) {
        // There were results, so write the file first before resolving/rejecting
        try {
          await fs.writeJson(path.join(output, 'valueset-db.json'), this.valueSets);
        } catch (err) {
          errors.push(err);
        }
      }
      if (errors.length > 0) {
        throw errors;
      }
    }
  }

  /**
   * Given a library, will detect referenced value sets and ensure that each has a local definition.  If a local definition
   * does not exist, the value set will be downloaded using the VSAC API.
   * @param {Object} library - the CQL Library object to look for referenced value sets in
   * @param {boolean} checkIncluded - indicates if "included" libraries should also be checked
   * @param {string} umlsAPIKey - the UMLS API Key to use when downloading value sets
   * @returns {Promise.<undefined,Error>} A promise that returns nothing when resolved and returns an error when rejected.
   */
  ensureValueSetsInLibraryWithAPIKey(
    library,
    checkIncluded = true,
    umlsAPIKey = env['UMLS_API_KEY'],
    caching = true,
    options = { parseCodeSystem: 'replace' }
  ) {
    const valueSets = extractSetOfValueSetsFromLibrary(library, checkIncluded);
    return this.ensureValueSetsWithAPIKey(Array.from(valueSets), umlsAPIKey, caching, options);
  }

  /**
   * The findValueSetsByOid function is kept for backwards compatibility (and since cql-execution
   * calls it), but now it just calls the more appropriately named findValuesets.
   * @param {string} oid - the OID to lookup the VS by (note: this now also support URN and URL)
   * @returns {Array<Object>} a list of the matching value sets
   */
  findValueSetsByOid(oid) {
    return this.findValueSets(oid);
  }

  /**
   * Returns a list of value sets matching the passed in identifier.  If version is passed in, it will also filter
   * by version (resulting in a list of, at most, 1 item). If no version is passed in, all versions are returned.
   * Note that this does not do any network calls -- it operated only on the cached value sets.
   * @param {string} id - the identifier for the value set (may be OID, URN, or VSAC FHIR URL)
   * @param {string} version - the optional version; if blank, returns all versions
   * @returns {Array<Object>} a list of the matching value sets
   */
  findValueSets(id, version) {
    const result = [];
    const [oid, embeddedVersion] = extractOidAndVersion(id);
    if (version == null && embeddedVersion != null) {
      version = embeddedVersion;
    }
    const vs = this.valueSets[oid];
    if (vs) {
      for (let foundVersion in vs) {
        if (version == null || foundVersion === version) {
          result.push(vs[foundVersion]);
        }
      }
    }
    return result;
  }

  /**
   * Returns the value set matching the passed in identifier and version (if applicable).  If no version is
   * passed in, and multiple versions are found, it will attempt to return the most recent version using a
   * simple string comparison of versions. Note that this does not do any network calls -- it operates only
   * on the cached value sets.
   * @param {string} id - the identifier for the value set (may be OID, URN, or VSAC FHIR URL)
   * @param {string} version - the optional version; if blank, attempts to return the most recent version
   * @returns {Object} the matching value set or undefined (if no match is found)
   */
  findValueSet(id, version) {
    const results = this.findValueSets(id, version);
    if (results.length === 0) {
      return;
    } else if (results.length === 1) {
      return results[0];
    } else {
      return results.reduce(function (a, b) {
        if (a.version > b.version) {
          return a;
        } else {
          return b;
        }
      });
    }
  }
}

/**
 * Extracts the referenced value sets from a CQL Library and (optionally) its included libraries
 * @param {Object} library - the CQL Library to extract the referenced value sets from
 * @param {boolean} extractFromIncluded - indicates if "included" libraries should be searched for referenced value sets
 * @param {Set} valueSets - the Set of valueSets extracted so far (defaults to empty set)
 * @returns {Set} the set of value sets referenced by the library
 */
function extractSetOfValueSetsFromLibrary(
  library,
  extractFromIncluded = true,
  valueSets = new Set()
) {
  // First add all the value sets from this library into the set
  Object.values(library.valuesets).forEach(vs => valueSets.add(vs));
  // Then, if requested, loop through the included libraries and add value sets from each of them
  if (extractFromIncluded && library.includes) {
    Object.values(library.includes).forEach(included =>
      extractSetOfValueSetsFromLibrary(included, extractFromIncluded, valueSets)
    );
  }
  return valueSets;
}

/**
 * Extracts the oid and version from a url, urn, or oid. Only url supports an embedded version
 * (separately by |); urn and oid will never return a version. If the input value is not a valid
 * urn or VSAC URL, it is assumed to be an oid and returned as-is.
 * @param {string} id - the urn, url, or oid
 * @returns {[string,string]} the oid and optional version as a pair
 */
function extractOidAndVersion(id) {
  if (id == null) return [];

  // first check for VSAC FHIR URL (ideally https is preferred but support http just in case)
  // if there is a | at the end, it indicates that a version string follows
  let m = id.match(/^https?:\/\/cts\.nlm\.nih\.gov\/fhir\/ValueSet\/([^|]+)(\|(.+))?$/);
  if (m) return m[3] == null ? [m[1]] : [m[1], m[3]];

  // then check for urn:oid
  m = id.match(/^urn:oid:(.+)$/);
  if (m) return [m[1]];

  // finally just return as-is
  return [id];
}

module.exports = { CodeService };
