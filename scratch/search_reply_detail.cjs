// scratch/search_reply_detail.cjs
const fs = require('fs');
const content = fs.readFileSync('src/pages/Reviews.tsx', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('reply') || line.includes('Reply') || line.includes('Cevap') || line.includes('modal') || line.includes('Modal') || line.includes('drawer') || line.includes('Drawer') || line.includes('incele') || line.includes('İncele')) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
