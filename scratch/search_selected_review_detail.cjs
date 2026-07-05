// scratch/search_selected_review_detail.cjs
const fs = require('fs');
const content = fs.readFileSync('src/pages/Reviews.tsx', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('selectedReviewDetail')) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
