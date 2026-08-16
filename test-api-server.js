(async () => {
  const url = 'http://localhost:3001/bcsflows/api/sync-simple';
  console.log('GET', url);
  try {
    const res = await fetch(url);
    const data = await res.json();
    console.log('Status:', res.status);
    console.log('Response:', JSON.stringify(data, null, 2).substring(0, 500));
  } catch (err) {
    console.log('ERROR:', err.message);
  }
})();
