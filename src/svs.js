const fs = require('fs-extra');
const path = require('path');
const fetch = require('node-fetch');
const parseString = require('xml2js').parseString;
const debug = require('debug')('vsac'); // To turn on DEBUG: $ export DEBUG=vsac
const { Code, ValueSet } = require('cql-execution');
const vsacCS = require('./vsac-code-systems');

async function downloadValueSet(
  apiKey,
  oid,
  version,
  output,
  vsDB = {},
  caching = true,
  options = { parseCodeSystem: 'replace' }
) {
  debug(`Getting ValueSet: ${oid}${version != null ? ` version ${version}` : ''}`);
  const params = new URLSearchParams({ id: oid });
  if (version != null) {
    params.append('version', version);
  }
  const requestOptions = {
    headers: {
      Authorization: `Basic ${Buffer.from(`apikey:${apiKey}`).toString('base64')}`
    }
  };
  const response = await fetch(
    `https://vsac.nlm.nih.gov/vsac/svs/RetrieveValueSet?${params}`,
    requestOptions
  );
  if (!response.ok) {
    throw new Error(response.status);
  }
  const data = await response.text();
  parseVSACXML(data, vsDB, options);
  if (caching) {
    const file = path.join(output, `${oid}.xml`);
    await fs.writeFile(file, data);
    return file;
  }
}

function getVSACodeSystem(codeSystems, system) {
  if (
    typeof codeSystems[system] !== 'undefined' &&
    typeof codeSystems[system].uri !== 'undefined'
  ) {
    return codeSystems[system];
  }

  return null;
}

// Take in a string containing a string of the XML response from a VSAC SVS
// response and parse it into a vsDB object.  This code makes strong
// assumptions about the structure of the message.  See code below.
function parseVSACXML(xmlString, vsDB = {}, options = { parseCodeSystem: 'replace' }) {
  if (typeof xmlString === 'undefined' || xmlString == null || xmlString.trim().length == 0) {
    return;
  }
  // Parse the XML string.
  let parsedXML;
  parseString(xmlString, (err, res) => {
    parsedXML = res;
  });

  // Pull out the OID and version for this valueset.
  const vsOID = parsedXML['ns0:RetrieveValueSetResponse']['ns0:ValueSet'][0]['$']['ID'];
  const vsVersion = parsedXML['ns0:RetrieveValueSetResponse']['ns0:ValueSet'][0]['$']['version'];

  // Grab the list of codes.
  const conceptList =
    parsedXML['ns0:RetrieveValueSetResponse']['ns0:ValueSet'][0]['ns0:ConceptList'][0][
      'ns0:Concept'
    ];

  // Loop over the codes and build the JSON.
  const codeList = [];
  for (let concept in conceptList) {
    let system = conceptList[concept]['$']['codeSystem'];
    const code = conceptList[concept]['$']['code'];
    const version = conceptList[concept]['$']['codeSystemVersion'];
    const systemOid = `urn:oid:${system}`;
    const systemUri = getVSACodeSystem(vsacCS, system);

    if (options.parseCodeSystem === 'replace') {
      if (systemUri !== null) {
        system = systemUri.uri;
      } else {
        system = systemOid;
      }
    } else if (options.parseCodeSystem === 'include') {
      // Optionally include both if they exist
      if (systemUri !== null) {
        codeList.push({ code, system: systemUri.uri, version });
      }
      // Include the standard oid system
      system = systemOid;
    } else {
      system = systemOid;
    }

    codeList.push({ code, system, version });
  }

  // Format according to the current valueset db JSON.
  vsDB[vsOID] = {};
  let myCodes = codeList.map(elem => new Code(elem.code, elem.system, elem.version));
  vsDB[vsOID][vsVersion] = new ValueSet(vsOID, vsVersion, myCodes);
}

module.exports = { name: 'SVS', downloadValueSet };
