<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/db.php';

$input = json_decode(file_get_contents('php://input'), true) ?: [];
$nome = trim((string)($input['nome'] ?? ''));
$name = trim((string)($input['name'] ?? $nome));
$usuario = trim((string)($input['usuario'] ?? $input['username'] ?? ''));
$email = trim((string)($input['email'] ?? ''));
$password = trim((string)($input['password'] ?? ''));
$role = strtolower(trim((string)($input['role'] ?? 'user')));

if (!in_array($role, ['master', 'admin', 'user'], true)) {
  $role = 'user';
}

if (!$name || !$usuario || !$email || !$password) {
  http_response_code(400);
  echo json_encode(['error' => 'missing fields']);
  exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
  http_response_code(400);
  echo json_encode(['error' => 'invalid email']);
  exit;
}

if (!$conn) {
  http_response_code(503);
  echo json_encode(['error' => 'database unavailable', 'details' => $db_error ?? 'Database connection missing']);
  exit;
}

$stmt = $conn->prepare("INSERT INTO usuarios (nome, name, usuario, username, email, password, role) VALUES (?, ?, ?, ?, ?, ?, ?)");
$stmt->bind_param("sssssss", $nome, $name, $usuario, $usuario, $email, $password, $role);
$ok = $stmt->execute();

if ($ok) {
  echo json_encode(['success' => true, 'id' => $stmt->insert_id]);
} else {
  http_response_code(500);
  echo json_encode(['error' => 'DB insert failed', 'message' => $conn->error]);
}
$stmt->close();
$conn->close();
