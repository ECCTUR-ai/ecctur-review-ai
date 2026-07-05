// scratch/search_ui_fetches.cjs
const fs = require('fs');
const content = fs.readFileSync('src/pages/Reviews.tsx', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes("fetch('/api/reviews") || line.includes("fetch(\"/api/reviews")) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
    // Print next 5 lines
    for (let i = 1; i <= 8; i++) {
      console.log(`   +${i}: ${lines[idx + i]}`);
    }
  }
});
