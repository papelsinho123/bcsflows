<?php
header('Content-Type: application/json; charset=utf-8');

$allowJsonFallback = getenv('BCS_ALLOW_JSON_FALLBACK') === '1' || getenv('BCS_ALLOW_JSON_FALLBACK') === 'true';
require_once __DIR__ . '/db.php';

$dataFile = __DIR__ . '/app_data.json';

$readJsonSnapshot = function () use ($dataFile) {
    if (!file_exists($dataFile) || filesize($dataFile) <= 0) {
        return null;
    }

    $content = file_get_contents($dataFile);
    if ($content === false || trim($content) === '') {
        return null;
    }

    $decoded = json_decode($content, true);
    return is_array($decoded) ? $decoded : null;
};

$writeJsonSnapshot = function ($data) use ($dataFile) {
    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $backupFile = $dataFile . '.backup';

    if (file_exists($dataFile)) {
        copy($dataFile, $backupFile);
    }

    $bytesWritten = file_put_contents($dataFile, $json, LOCK_EX);
    if ($bytesWritten === false) {
        return false;
    }

    chmod($dataFile, 0666);
    return true;
};

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    if ($conn) {
        $sql = 'SELECT payload FROM app_data WHERE id = 1 LIMIT 1';
        $result = $conn->query($sql);
        $row = $result && $result->num_rows > 0 ? $result->fetch_assoc() : null;

        if ($row && !empty($row['payload'])) {
            $decoded = json_decode($row['payload'], true);
            echo json_encode(['payload' => $decoded ?: null, 'source' => 'database']);
            $conn->close();
            exit;
        }

        if ($conn) {
            $conn->close();
        }
    }

    if (!$allowJsonFallback) {
        http_response_code(503);
        echo json_encode([
            'error' => 'Banco de dados indisponível para leitura.',
            'details' => $db_error ?? 'Configure BCS_DB_HOST, BCS_DB_USER, BCS_DB_PASS e BCS_DB_NAME.'
        ]);
        exit;
    }

    echo json_encode(['payload' => $readJsonSnapshot() ?: null, 'source' => 'json-fallback']);
    exit;
}

if ($method !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    if ($conn) {
        $conn->close();
    }
    exit;
}

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);

if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON body']);
    if ($conn) {
        $conn->close();
    }
    exit;
}

if ($conn) {
    $payload = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $stmt = $conn->prepare('INSERT INTO app_data (id, payload, updated_at) VALUES (1, ?, NOW()) ON DUPLICATE KEY UPDATE payload = VALUES(payload), updated_at = NOW()');

    if (!$stmt) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to prepare update statement']);
        $conn->close();
        exit;
    }

    $stmt->bind_param('s', $payload);
    $ok = $stmt->execute();
    $stmt->close();
    $conn->close();

    if ($ok) {
        echo json_encode(['success' => true, 'saved' => true, 'source' => 'database']);
        exit;
    }
}

if (!$allowJsonFallback) {
    http_response_code(503);
    echo json_encode([
        'error' => 'Não foi possível salvar no banco.',
        'details' => $db_error ?? 'Os dados não foram aceitos como sincronizados.'
    ]);
    exit;
}

if ($writeJsonSnapshot($data)) {
    echo json_encode(['success' => true, 'saved' => true, 'fallback' => 'json']);
    exit;
}

http_response_code(500);
echo json_encode(['error' => 'Failed to save data']);