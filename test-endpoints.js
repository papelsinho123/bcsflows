const endpoints = [
  'http://localhost:4174/bcsflows/api/sync-simple.php',
  'http://localhost:4174/bcsflows/api/sync.php',
  'http://localhost:4173/bcsflows/api/sync-simple.php',
  'http://localhost:4173/bcsflows/api/sync.php'
];

(async () => {
  for (const url of endpoints) {
    console.log(`\n🔍 Testando: ${url}`);
    try {
      const res = await fetch(url, { timeout: 5000 });
      console.log(`Status: ${res.status}`);
      const text = await res.text();
      console.log(`Resposta: ${text.substring(0, 300)}`);
    } catch (err) {
      console.log(`❌ Erro: ${err.message}`);
    }
  }
})();
