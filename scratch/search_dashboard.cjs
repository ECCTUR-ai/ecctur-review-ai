// scratch/search_dashboard.cjs
const fs = require('fs');
const content = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('sync_health') || line.includes('localStorage') || line.includes('getHealthInfo') || line.includes('platform bazlı')) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
