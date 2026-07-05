// scratch/print_action_blocks.cjs
const fs = require('fs');
const content = fs.readFileSync('api/reviews.ts', 'utf8');
const lines = content.split('\n');

const actionLines = [1267, 1806, 1962];
actionLines.forEach(lineNum => {
  console.log(`\n--- Line ${lineNum} ---`);
  for (let i = 0; i < 30; i++) {
    const idx = lineNum - 1 + i;
    if (idx < lines.length) {
      console.log(`${idx + 1}: ${lines[idx]}`);
    }
  }
});
