<?php
// db.php
// Conexão do banco real do BCS Flows.

$db_host = getenv('BCS_DB_HOST') ?: 'bcsflows.mysql.dbaas.com.br';
$db_user = getenv('BCS_DB_USER') ?: 'bcsflows';
$db_pass = getenv('BCS_DB_PASS') ?: 'And@99188280';
$db_name = getenv('BCS_DB_NAME') ?: 'bcsflows';

$conn = null;

if (!empty($db_user) && !empty($db_name)) {
  $conn = @new mysqli($db_host, $db_user, $db_pass, $db_name);

  if ($conn && $conn->connect_error) {
    $conn = null;
  }
}

if ($conn) {
  $conn->set_charset('utf8mb4');
}
