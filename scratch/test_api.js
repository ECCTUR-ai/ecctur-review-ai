import fetch from 'node-fetch';

fetch('http://localhost:5173/api/reviews')
  .then(async res => {
    console.log('Status:', res.status);
    console.log('Content-Type:', res.headers.get('content-type'));
    const text = await res.text();
    console.log('Response snippet:', text.substring(0, 300));
  })
  .catch(err => console.error('Error:', err));
