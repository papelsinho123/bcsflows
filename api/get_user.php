<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/db.php';

$id = isset($_GET['id']) ? intval($_GET['id']) : 0;
if ($id <= 0) {
  echo json_encode([]);
  exit;
}

$stmt = $conn->prepare("SELECT id, nome, email FROM usuarios WHERE id = ?");
$stmt->bind_param("i", $id);
$stmt->execute();
$result = $stmt->get_result();
$row = $result->fetch_assoc();

echo json_encode($row ?: []);
$stmt->close();
$conn->close();
