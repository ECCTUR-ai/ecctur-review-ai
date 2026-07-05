// scratch/find_sync_all_func.cjs
const fs = require('fs');
const content = fs.readFileSync('src/pages/Reviews.tsx', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('handleSyncAll') || line.includes('syncAll') || line.includes('SyncAll') || line.includes('AllPlatforms')) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
