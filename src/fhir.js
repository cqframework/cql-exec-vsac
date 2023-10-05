const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const mkdirp = require('mkdirp');
const debug = require('debug')('vsac'); // To turn on DEBUG: $ export DEBUG=vsac
const { Code, ValueSet } = require('cql-execution');
const extractOidAndVersion = require('./extractOidAndVersion');

function downloadFromVSACWithAPIKey(apiKey, input, output, vsDB = {}, caching = true) {
  const oidsAndVersions = [];
  Object.keys(input).forEach(key => {
    let [id, version] = [input[key].id, input[key].version];
    const [oid, embeddedVersion] = extractOidAndVersion(id);
    if (version == null && embeddedVersion != null) {
      version = embeddedVersion;
    }
    if (vsDB[oid] == null || vsDB[oid][version] == null) {
      oidsAndVersions.push({ oid, version });
    }
  });
  if (oidsAndVersions.length) {
    output = path.resolve(output);
    if (caching && !fs.existsSync(output)) {
      mkdirp.sync(output);
    }

    const promises = oidsAndVersions.map(({ oid, version }) => {
      // Catch errors and convert to resolutions returning an error.  This ensures Promise.all waits for all promises.
      // See: http://stackoverflow.com/questions/31424561/wait-until-all-es6-promises-complete-even-rejected-promises
      return downloadValueSet(apiKey, oid, version, output, vsDB, caching).catch(err => {
        debug(
          `Error downloading valueset ${oid}${version != null ? ` version ${version}` : ''}`,
          err
        );
        return new Error(
          `Error downloading valueset: ${oid}${version != null ? ` version ${version}` : ''}`
        );
      });
    });
    return Promise.all(promises).then(results => {
      const errors = results.filter(r => r instanceof Error);
      if (results.length - errors.length > 0) {
        // There were results, so write the file first before resolving/rejecting
        return writeFile(path.join(output, 'valueset-db.json'), vsDB, caching).then(
          result => (errors.length == 0 ? result : Promise.reject(errors)),
          err => {
            errors.push(err);
            return Promise.reject(errors);
          }
        );
      }
      if (errors.length > 0) {
        return Promise.reject(errors);
      }
    });
  } else {
    return Promise.resolve();
  }
}

function downloadValueSet(apiKey, oid, version, output, vsDB = {}, caching = true) {
  return getValueSetPages(apiKey, oid, version).then(pages => {
    if (pages == null || pages.length === 0) {
      return;
    }

    const { id, version } = pages[0];
    const codes = [];
    pages.forEach(page => {
      if (page.expansion && page.expansion.contains) {
        codes.push(...page.expansion.contains.map(c => new Code(c.code, c.system, c.version)));
      }
    });
    vsDB[id] = {};
    vsDB[id][version] = new ValueSet(id, version, codes);
    return writeFile(path.join(output, `${oid}.json`), pages, caching);
  });
}

function getValueSetPages(apiKey, oid, version, offset = 0) {
  return getValueSet(apiKey, oid, version, offset).then(page => {
    if (page && page.expansion) {
      const pTotal = page.expansion.total;
      const pOffset = page.expansion.offset;
      const pLength = page.expansion.contains && page.expansion.contains.length;
      if (pTotal != null && pOffset != null && pLength != null && pTotal > pOffset + pLength) {
        // Fetch and append the remaining value set pages
        return getValueSetPages(apiKey, oid, version, offset + pLength).then(pages => {
          return [page, ...pages];
        });
      } else {
        return [page];
      }
    }
  });
}

function getValueSet(apiKey, oid, version, offset = 0) {
  debug(`Getting ValueSet: ${oid}${version || ''} (offset: ${offset})`);
  const options = {
    headers: {
      Authorization: `Basic ${Buffer.from(`apikey:${apiKey}`).toString('base64')}`
    }
  };

  const params = new URLSearchParams({ offset });
  if (version != null) {
    params.set('valueSetVersion', version);
  }
  const url = `https://cts.nlm.nih.gov/fhir/ValueSet/${oid}/$expand?${params}`;
  return fetch(url, options).then(res => {
    if (!res.ok) {
      throw new Error(res.status);
    }
    return res.json();
  });
}

function writeFile(file, data, caching = true) {
  return new Promise((resolve, reject) => {
    if (caching) {
      debug('Writing:', file);
      fs.writeFile(file, JSON.stringify(data, null, 2), err => {
        if (typeof err !== 'undefined' && err != null) {
          debug('Error writing file', file);
          reject(err);
        } else {
          debug('Wrote file', file);
          resolve(file);
        }
      });
    } else {
      resolve();
    }
  });
}

module.exports = { name: 'FHIR', downloadFromVSACWithAPIKey };
