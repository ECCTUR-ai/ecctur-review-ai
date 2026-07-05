// scratch/search_action_blocks.cjs
const fs = require('fs');
const content = fs.readFileSync('api/reviews.ts', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes("action === 'import-tripadvisor'") || line.includes("action === 'import-holidaycheck'") || line.includes("action === 'import-hotelscom'")) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
