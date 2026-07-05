// scratch/search_reviews_layout.cjs
const fs = require('fs');
const content = fs.readFileSync('src/pages/Reviews.tsx', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('selectedReview') || line.includes('Yapay Zeka Yanıt') || line.includes('Cevap Yaz') || line.includes('Translate') || line.includes('Çeviri')) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
