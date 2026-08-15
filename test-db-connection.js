import mysql from 'mysql2';

console.log("=== Teste de Conexão MySQL com Node.js ===\n");

const config = {
  host: 'bcsflows.mysql.dbaas.com.br',
  user: 'bcsflows',
  password: 'And@99188280',
  database: 'bcsflows'
};

console.log("Tentando conectar em:");
console.log(`Host: ${config.host}`);
console.log(`Usuario: ${config.user}`);
console.log(`Banco: ${config.database}\n`);

const connection = mysql.createConnection(config);

connection.connect((err) => {
  if (err) {
    console.log("❌ ERRO NA CONEXÃO:");
    console.log(err.message);
    process.exit(1);
  }

  console.log("✅ CONECTADO COM SUCESSO!\n");

  // Verificar tabelas
  console.log("Verificando tabelas...\n");
  
  connection.query("SHOW TABLES", (error, results) => {
    if (error) {
      console.log("❌ Erro ao listar tabelas:", error.message);
      connection.end();
      process.exit(1);
    }

    console.log("Tabelas encontradas:");
    results.forEach(row => {
      const tableName = Object.values(row)[0];
      console.log(`  - ${tableName}`);
    });

    connection.end();
    console.log("\n✅ Teste finalizado com sucesso!");
  });
});
