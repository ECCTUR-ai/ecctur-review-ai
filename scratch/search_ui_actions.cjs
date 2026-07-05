// scratch/search_ui_actions.cjs
const fs = require('fs');
const content = fs.readFileSync('src/pages/Reviews.tsx', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes("action:") || line.includes("action :")) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
