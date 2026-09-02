const fs = require('fs');
const path = require('path');

function loadDotEnvIfPresent(repoRoot) {
  const envPath = path.join(repoRoot, '.env');
  if (!fs.existsSync(envPath)) {
    return;
  }

  try {
    require('dotenv').config({ path: envPath });
  } catch (_error) {
    // Do nothing when dotenv is unavailable in CI.
  }
}

module.exports = {
  loadDotEnvIfPresent
};
