// scratch/search_client.cjs
const fs = require('fs');
const content = fs.readFileSync('api/reviews.ts', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('supabase') || line.includes('createClient')) {
    if (idx < 150 || line.includes('createClient') || line.includes('supabaseAdmin =')) {
      console.log(`Line ${idx + 1}: ${line.trim()}`);
    }
  }
});
