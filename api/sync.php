<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/db.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    $sql = 'SELECT payload FROM app_data WHERE id = 1 LIMIT 1';
    $result = $conn->query($sql);
    $row = $result && $result->num_rows > 0 ? $result->fetch_assoc() : null;

    if (!$row || empty($row['payload'])) {
        echo json_encode(['payload' => null]);
        $conn->close();
        exit;
    }

    $decoded = json_decode($row['payload'], true);
    echo json_encode(['payload' => $decoded ?: null]);
    $conn->close();
    exit;
}

if ($method !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    $conn->close();
    exit;
}

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON body']);
    $conn->close();
    exit;
}

$payload = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

$stmt = $conn->prepare('INSERT INTO app_data (id, payload, updated_at) VALUES (1, ?, NOW()) ON DUPLICATE KEY UPDATE payload = VALUES(payload), updated_at = NOW()');
$stmt->bind_param('s', $payload);
$ok = $stmt->execute();

if (!$ok) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to save data']);
    $stmt->close();
    $conn->close();
    exit;
}

echo json_encode(['success' => true, 'saved' => true]);
$stmt->close();
$conn->close();
