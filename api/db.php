<?php
// db.php
// Mantém compatibilidade com banco real, mas não quebra a aplicação quando
// as credenciais ainda não foram informadas no ambiente local/servidor.

$db_host = getenv('BCS_DB_HOST') ?: 'localhost';
$db_user = getenv('BCS_DB_USER') ?: 'root';
$db_pass = getenv('BCS_DB_PASS') ?: '';
$db_name = getenv('BCS_DB_NAME') ?: 'bcs_flows';

$conn = null;

// Se o arquivo ainda estiver com os placeholders do exemplo, não derruba a API.
$hasPlaceholderConfig = strpos($db_user, 'SEU_') !== false || strpos($db_name, 'SEU_') !== false || strpos($db_pass, 'SUA_') !== false;

if (!$hasPlaceholderConfig) {
  $conn = @new mysqli($db_host, $db_user, $db_pass, $db_name);

  if ($conn && $conn->connect_error) {
    $conn = null;
  }
}

if ($conn) {
  $conn->set_charset('utf8mb4');
}
