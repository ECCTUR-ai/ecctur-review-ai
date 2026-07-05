// scratch/find_lucide_imports.cjs
const fs = require('fs');
const content = fs.readFileSync('src/pages/Reviews.tsx', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('from \'lucide-react\'') || line.includes('from "lucide-react"')) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
