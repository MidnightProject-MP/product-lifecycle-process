function isGraphMemoryEnabled_() {
  return false;
}

function setupGraphSheets_() {
  return;
}

function exportGraphMemoryToDrive() {
  return {
    ok: true,
    skipped: true,
    message: 'Graph memory is omitted from Control Center v1.'
  };
}

function getGraphObjects_() {
  return [];
}

function graphBuildEntityId_(flowId) {
  return flowId ? 'entity:' + flowId : '';
}

function graphFindObjectByKey_() {
  return null;
}

function graphExtractWValues_() {
  return {};
}

function graphHashString_(value) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value || ''), Utilities.Charset.UTF_8);
  return bytes.map(byte => {
    const normalized = byte < 0 ? byte + 256 : byte;
    return ('0' + normalized.toString(16)).slice(-2);
  }).join('');
}

const GRAPH_W_DIMENSIONS = [];
