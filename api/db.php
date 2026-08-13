<?php
// db.php - NÃO comitar este arquivo no GitHub. Edite direto no servidor.
// Preencha os placeholders abaixo com os dados do painel da Locaweb.

$db_host = 'localhost';      // geralmente localhost na Locaweb
$db_user = 'SEU_USUARIO_DB';
$db_pass = 'SUA_SENHA_DB';
$db_name = 'SEU_NOME_BANCO';

$conn = new mysqli($db_host, $db_user, $db_pass, $db_name);
if ($conn->connect_error) {
  http_response_code(500);
  echo json_encode(['error' => 'DB connection failed']);
  exit;
}
$conn->set_charset('utf8mb4');
