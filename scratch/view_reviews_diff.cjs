// scratch/view_reviews_diff.cjs
const fs = require('fs');
const content = fs.readFileSync('api/reviews.ts', 'utf8');
const lines = content.split('\n');

for (let i = 2000; i < 2070; i++) {
  if (lines[i]) {
    console.log(`${i + 1}: ${lines[i]}`);
  }
}
