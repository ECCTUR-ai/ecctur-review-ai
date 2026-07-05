// scratch/search_selected_review_id.cjs
const fs = require('fs');
const content = fs.readFileSync('src/pages/Reviews.tsx', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('selectedReviewId') || line.includes('selectedReviewDetail')) {
    if (idx > 1500) {
      console.log(`Line ${idx + 1}: ${line.trim()}`);
    }
  }
});
