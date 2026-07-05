// scratch/search_reviews_actions.cjs
const fs = require('fs');
const content = fs.readFileSync('src/pages/Reviews.tsx', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('Yanıt') || line.includes('Cevap') || line.includes('Publish') || line.includes('Gönder') || line.includes('Onayla') || line.includes('Modal') || line.includes('Drawer')) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
