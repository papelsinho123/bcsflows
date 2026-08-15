<?php
echo "=== Teste de Conexão MySQL ===\n\n";

$db_host = 'bcsflows.mysql.dbaas.com.br';
$db_user = 'bcsflows';
$db_pass = 'And@99188280';
$db_name = 'bcsflows';

echo "Tentando conectar em:\n";
echo "Host: $db_host\n";
echo "Usuario: $db_user\n";
echo "Banco: $db_name\n\n";

$conn = new mysqli($db_host, $db_user, $db_pass, $db_name);

if ($conn->connect_error) {
    echo "❌ ERRO NA CONEXÃO:\n";
    echo $conn->connect_error . "\n";
    exit(1);
}

echo "✅ CONECTADO COM SUCESSO!\n\n";

// Testa se as tabelas existem
echo "Verificando tabelas...\n";

$result = $conn->query("SHOW TABLES");
if (!$result) {
    echo "❌ Erro ao listar tabelas: " . $conn->error . "\n";
    exit(1);
}

echo "Tabelas encontradas:\n";
while ($row = $result->fetch_row()) {
    echo "  - " . $row[0] . "\n";
}

$conn->close();
echo "\n✅ Teste finalizado com sucesso!\n";
?>
