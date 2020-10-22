const fs = require('fs');
const path = require('path');
const rpn = require('request-promise-native');
const mkdirp = require('mkdirp');
const parseVSACXML = require('./parse-vsac');
const extractOidAndVersion = require('./extractOidAndVersion');
const debug = require('debug')('vsac'); // To turn on DEBUG: $ export DEBUG=vsac



/*
 * @deprecated:  As of Jan 1 2021 VSAC will no longer accept accept username and password.
 * Please use downloadFromVSACWithAPIKey instead.
 */
function downloadFromVSAC(username, password, input, output, vsDB={}, caching=true) {
  const oidsAndVersions = [];
  Object.keys(input).forEach((key) => {
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
    if (caching && !fs.existsSync(output)){
      mkdirp.sync(output);
    }
    return getTicketGrantingTicket(username, password)
      .then((ticketGrantingTicket) => {
        const promises = oidsAndVersions.map(({ oid, version }) => {
        // Catch errors and convert to resolutions returning an error.  This ensures Promise.all waits for all promises.
        // See: http://stackoverflow.com/questions/31424561/wait-until-all-es6-promises-complete-even-rejected-promises
          return downloadValueSet(ticketGrantingTicket, oid, version, output, vsDB, caching)
            .catch((err) => {
              debug(`Error downloading valueset ${oid}${version || ''}`, err);
              return new Error(`Error downloading valueset: ${oid}${version || ''}`);
            });
        });
        return Promise.all(promises);
      })
      .then((results) => {
        const errors = results.filter(r => r instanceof Error);
        if (results.length - errors.length > 0) {
        // There were results, so write the file first before resolving/rejecting
          return writeFile(path.join(output, 'valueset-db.json'), JSON.stringify(vsDB, null, 2), caching)
            .then(
              (result) => errors.length == 0 ? result : Promise.reject(errors),
              (err) => { errors.push(err); return Promise.reject(errors); }
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

function downloadFromVSACWithAPIKey(apiKey, input, output, vsDB={}, caching=true){
  const oidsAndVersions = [];
  Object.keys(input).forEach((key) => {
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
    if (caching && !fs.existsSync(output)){
      mkdirp.sync(output);
    }
    return getTicketGrantingTicketWithAPIKey(apiKey)
      .then((ticketGrantingTicket) => {
        const promises = oidsAndVersions.map(({ oid, version }) => {
          // Catch errors and convert to resolutions returning an error.  This ensures Promise.all waits for all promises.
          // See: http://stackoverflow.com/questions/31424561/wait-until-all-es6-promises-complete-even-rejected-promises
          return downloadValueSet(ticketGrantingTicket, oid, version, output, vsDB, caching)
            .catch((err) => {
              debug(`Error downloading valueset ${oid}${version || ''}`, err);
              return new Error(`Error downloading valueset: ${oid}${version || ''}`);
            });
        });
        return Promise.all(promises);
      })
      .then((results) => {
        const errors = results.filter(r => r instanceof Error);
        if (results.length - errors.length > 0) {
          // There were results, so write the file first before resolving/rejecting
          return writeFile(path.join(output, 'valueset-db.json'), JSON.stringify(vsDB, null, 2), caching)
            .then(
              (result) => errors.length == 0 ? result : Promise.reject(errors),
              (err) => { errors.push(err); return Promise.reject(errors); }
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

/*
 * @deprecated: As of Jan 1 2021 VSAC will no longer accept accept username and password.
 * Please use getTicketGrantingTicketWithAPIKey instead.
 */
function getTicketGrantingTicket(username, password) {
  debug('Getting TGT');
  const options = {
    method: 'POST',
    url: 'https://vsac.nlm.nih.gov/vsac/ws/Ticket',
    form: { username, password }
  };
  return rpn(options);
}

function getTicketGrantingTicketWithAPIKey(apiKey){
  debug('Getting TGT');
  const options = {
    method: 'POST',
    url: 'https://vsac.nlm.nih.gov/vsac/ws/Ticket',
    form: { apikey: apiKey }
  };
  return rpn(options);
}

function downloadValueSet(ticketGrantingTicket, oid, version, output, vsDB={}, caching=true) {
  return  getServiceTicket(ticketGrantingTicket)
    .then((serviceTicket) => {
      return getValueSet(serviceTicket, oid, version);
    })
    .then((data) => {
      parseVSACXML(data, vsDB);
      return writeFile(path.join(output, `${oid}.xml`), data, caching);
    });
}

function getServiceTicket(ticketGrantingTicket) {
  debug('Getting ST');
  const options = {
    method: 'POST',
    url: `https://vsac.nlm.nih.gov/vsac/ws/Ticket/${ticketGrantingTicket}`,
    form: { service: 'http://umlsks.nlm.nih.gov' }
  };
  return rpn(options);
}

function getValueSet(serviceTicket, oid, version) {
  debug(`Getting ValueSet: ${oid}${version || ''}`);
  const options = {
    url: 'https://vsac.nlm.nih.gov/vsac/svs/RetrieveValueSet',
    qs: { id: oid, ticket: serviceTicket }
  };
  if (version != null) {
    options.qs.version = version;
  }
  return rpn(options);
}

function writeFile(file, data, caching=true) {
  return new Promise((resolve, reject) => {
    if (caching) {
      debug('Writing:', file);
      fs.writeFile(file, data, (err) => {
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

module.exports = {downloadFromVSAC,downloadFromVSACWithAPIKey};