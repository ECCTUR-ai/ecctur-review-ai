// scratch/search_all_reviews_for_stats.cjs
const fs = require('fs');
const content = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('allReviewsFor') || line.includes('allReviews') || line.includes('ReviewsForStats')) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
