// scratch/search_trend_data.cjs
const fs = require('fs');
const content = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('PieChart') || line.includes('Pie') || line.includes('LineChart') || line.includes('distribution') || line.includes('trend')) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
