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

module.exports = extractOidAndVersion;