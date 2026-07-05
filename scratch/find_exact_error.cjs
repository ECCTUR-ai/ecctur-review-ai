// scratch/find_exact_error.cjs
const fs = require('fs');
const content = fs.readFileSync('api/reviews.ts', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('no Google Business') || line.includes('mapping configured') || line.includes('google_location_id')) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
