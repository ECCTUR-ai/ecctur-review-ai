// scratch/search_unified_sync_result.cjs
const fs = require('fs');
const content = fs.readFileSync('src/pages/Reviews.tsx', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('unifiedSyncResult')) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
