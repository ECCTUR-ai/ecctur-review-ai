// scratch/search_reviews_map.cjs
const fs = require('fs');
const content = fs.readFileSync('src/pages/Reviews.tsx', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('paginatedReviews') || line.includes('ReviewCard') || line.includes('Yorumlar listeleniyor') || line.includes('guestName')) {
    if (idx > 1500) {
      console.log(`Line ${idx + 1}: ${line.trim()}`);
    }
  }
});
