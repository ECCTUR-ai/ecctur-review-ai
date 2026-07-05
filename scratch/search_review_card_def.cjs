// scratch/search_review_card_def.cjs
const fs = require('fs');
const content = fs.readFileSync('src/pages/Reviews.tsx', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('const ReviewCard') || line.includes('function ReviewCard')) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
