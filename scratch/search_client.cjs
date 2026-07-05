// scratch/search_client.cjs
const fs = require('fs');
const content = fs.readFileSync('src/pages/Reviews.tsx', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes("from('reviews')") || line.includes(".select(")) {
    if (idx < 500) { // Just the top sections
      console.log(`Line ${idx + 1}: ${line.trim()}`);
    }
  }
});
