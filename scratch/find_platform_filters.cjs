// scratch/find_platform_filters.cjs
const fs = require('fs');
const content = fs.readFileSync('src/pages/Reviews.tsx', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('Booking.com') || line.includes('TripAdvisor') || line.includes('Hotels.com')) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
