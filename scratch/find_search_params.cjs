// scratch/find_search_params.cjs
const fs = require('fs');
const content = fs.readFileSync('src/pages/Reviews.tsx', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('searchParams') || line.includes('useSearchParams')) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
