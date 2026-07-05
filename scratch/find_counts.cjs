// scratch/find_counts.cjs
const fs = require('fs');
const content = fs.readFileSync('src/pages/Reviews.tsx', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('Count') && (line.includes('const') || line.includes('let'))) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
