// scratch/search_fetch_aggregator.cjs
const fs = require('fs');
const content = fs.readFileSync('api/reviews.ts', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('fetchAggregatorReviews')) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
