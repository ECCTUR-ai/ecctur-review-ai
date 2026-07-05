// scratch/search_ai_replies.cjs
const fs = require('fs');
const content = fs.readFileSync('src/pages/AiReplies.tsx', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('İncele') || line.includes('AI Yanıt') || line.includes('Reply') || line.includes('Button') || line.includes('yayinla')) {
    if (idx > 1200) {
      console.log(`Line ${idx + 1}: ${line.trim()}`);
    }
  }
});
