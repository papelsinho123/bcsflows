<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/db.php';

$input = json_decode(file_get_contents('php://input'), true);
$nome = trim($input['nome'] ?? '');
$email = trim($input['email'] ?? '');

if (!$nome || !$email) {
  http_response_code(400);
  echo json_encode(['error' => 'missing fields']);
  exit;
}

// Validação simples
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
  http_response_code(400);
  echo json_encode(['error' => 'invalid email']);
  exit;
}

$stmt = $conn->prepare("INSERT INTO usuarios (nome, email) VALUES (?, ?)");
$stmt->bind_param("ss", $nome, $email);
$ok = $stmt->execute();

if ($ok) {
  echo json_encode(['success' => true, 'id' => $stmt->insert_id]);
} else {
  http_response_code(500);
  echo json_encode(['error' => 'DB insert failed']);
}
$stmt->close();
$conn->close();
