<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/db.php';

$id = isset($_GET['id']) ? intval($_GET['id']) : 0;
if ($id <= 0) {
  echo json_encode([]);
  exit;
}

$stmt = $conn->prepare("SELECT id, nome, name, usuario, username, email, password, role, phone, leaveTaken, leaveRuleDays FROM usuarios WHERE id = ?");
$stmt->bind_param("i", $id);
$stmt->execute();
$result = $stmt->get_result();
$row = $result->fetch_assoc();

if ($row) {
  if (empty($row['name']) && !empty($row['nome'])) {
    $row['name'] = $row['nome'];
  }
  if (empty($row['usuario']) && !empty($row['username'])) {
    $row['usuario'] = $row['username'];
  }
}

echo json_encode($row ?: []);
$stmt->close();
$conn->close();
