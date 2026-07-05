// scratch/search_layout_grid.cjs
const fs = require('fs');
const content = fs.readFileSync('src/pages/Reviews.tsx', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('grid-cols') || line.includes('flex-row') || line.includes('col-span') || line.includes('flex justify-')) {
    if (idx > 1800) {
      console.log(`Line ${idx + 1}: ${line.trim()}`);
    }
  }
});
