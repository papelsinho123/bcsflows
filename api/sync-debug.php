<?php
/**
 * sync-debug.php - Versão de diagnóstico do sync.php
 * Use este arquivo para debugar problemas de sincronização em produção.
 * Depois que os erros forem corrigidos, use novamente o sync.php normal.
 */

header('Content-Type: application/json; charset=utf-8');

// Carregar diagnóstico de env vars
$diagnostics = [
    'timestamp' => date('Y-m-d H:i:s'),
    'php_version' => phpversion(),
    'mysqli_loaded' => extension_loaded('mysqli'),
    'env_vars' => [
        'BCS_DB_HOST' => getenv('BCS_DB_HOST') ? 'SET' : 'EMPTY',
        'BCS_DB_USER' => getenv('BCS_DB_USER') ? 'SET' : 'EMPTY',
        'BCS_DB_PASS' => getenv('BCS_DB_PASS') ? 'SET' : 'EMPTY',
        'BCS_DB_NAME' => getenv('BCS_DB_NAME') ? 'SET' : 'EMPTY',
    ],
];

$allowJsonFallback = getenv('BCS_ALLOW_JSON_FALLBACK') === '1' || getenv('BCS_ALLOW_JSON_FALLBACK') === 'true';
require_once __DIR__ . '/db.php';

$diagnostics['connection'] = [
    'connected' => $conn ? true : false,
    'error' => $db_error ?: 'Nenhum erro',
];

$dataFile = __DIR__ . '/app_data.json';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// Se REQUEST for DEBUG, retorna diagnósticos
if ($method === 'DEBUG' || (isset($_GET['debug']) && $_GET['debug'] === '1')) {
    http_response_code(200);
    echo json_encode($diagnostics, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    if ($conn) {
        $conn->close();
    }
    exit;
}

// Resto do código sync normal
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

if ($method === 'GET') {
    if ($conn) {
        $sql = 'SELECT payload FROM app_data WHERE id = 1 LIMIT 1';
        $result = $conn->query($sql);
        $row = $result && $result->num_rows > 0 ? $result->fetch_assoc() : null;

        if ($row && !empty($row['payload'])) {
            $decoded = json_decode($row['payload'], true);
            echo json_encode(['payload' => $decoded ?: null, 'source' => 'database', 'diagnostics' => $diagnostics]);
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
            'details' => $db_error ?? 'Configure BCS_DB_HOST, BCS_DB_USER, BCS_DB_PASS e BCS_DB_NAME.',
            'diagnostics' => $diagnostics
        ]);
        exit;
    }

    echo json_encode(['payload' => $readJsonSnapshot() ?: null, 'source' => 'json-fallback', 'diagnostics' => $diagnostics]);
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
    echo json_encode(['error' => 'Invalid JSON body', 'diagnostics' => $diagnostics]);
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
        echo json_encode(['error' => 'Failed to prepare update statement', 'diagnostics' => $diagnostics]);
        $conn->close();
        exit;
    }

    $stmt->bind_param('s', $payload);
    $ok = $stmt->execute();
    $stmt->close();
    $conn->close();

    if ($ok) {
        echo json_encode(['success' => true, 'saved' => true, 'source' => 'database', 'diagnostics' => $diagnostics]);
        exit;
    }
}

if (!$allowJsonFallback) {
    http_response_code(503);
    echo json_encode([
        'error' => 'Não foi possível salvar no banco.',
        'details' => $db_error ?? 'Os dados não foram aceitos como sincronizados.',
        'diagnostics' => $diagnostics
    ]);
    exit;
}

if ($writeJsonSnapshot($data)) {
    echo json_encode(['success' => true, 'saved' => true, 'fallback' => 'json', 'diagnostics' => $diagnostics]);
    exit;
}

http_response_code(500);
echo json_encode(['error' => 'Failed to save data', 'diagnostics' => $diagnostics]);
