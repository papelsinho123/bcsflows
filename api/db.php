<?php
// db.php
// Conexão do banco do BCS Flows.

$db_host = getenv('BCS_DB_HOST') ?: getenv('DB_HOST') ?: 'localhost';
$db_user = getenv('BCS_DB_USER') ?: getenv('DB_USER') ?: '';
$db_pass = getenv('BCS_DB_PASS') ?: getenv('DB_PASS') ?: '';
$db_name = getenv('BCS_DB_NAME') ?: getenv('DB_NAME') ?: '';
$db_error = null;
$conn = null;

if (!extension_loaded('mysqli')) {
  $db_error = 'Extensão mysqli não está habilitada no PHP.';
} elseif (empty($db_host) || empty($db_user) || empty($db_name)) {
  $db_error = 'Variáveis do banco ausentes. Defina BCS_DB_HOST, BCS_DB_USER, BCS_DB_PASS e BCS_DB_NAME.';
} else {
  $conn = @new mysqli($db_host, $db_user, $db_pass, $db_name);
  if ($conn && $conn->connect_error) {
    $db_error = $conn->connect_error;
    $conn = null;
  }
}

if ($conn) {
  $conn->set_charset('utf8mb4');
}
