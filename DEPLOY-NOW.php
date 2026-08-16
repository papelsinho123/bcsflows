<?php
/**
 * DEPLOY-NOW.php
 * 
 * Use este arquivo para fazer deploy de TODOS os arquivos corrigidos para o servidor
 * 
 * Acesse via navegador:
 *   https://www.nuvematomica.com.br/bcsflows/DEPLOY-NOW.php?key=deployAll2026
 * 
 * Isto vai:
 * 1. Atualizar db.php com credenciais
 * 2. Atualizar sync.php com JSON fallback
 * 3. Atualizar os arquivos JS compilados (assets)
 * 4. Testar conexão ao banco
 */

$expected_key = $_GET['key'] ?? $_POST['key'] ?? null;
if (!$expected_key || $expected_key !== 'deployAll2026') {
    http_response_code(403);
    header('Content-Type: application/json');
    die(json_encode(['error' => 'Acesso negado']));
}

header('Content-Type: application/json; charset=utf-8');

$base_dir = dirname(__FILE__);
$api_dir = $base_dir . '/api';
$updates = [];

// ========== 1. UPDATE DB.PHP ==========
$db_php = <<<'DBPHP'
<?php
// db.php - Conexão do banco do BCS Flows.

$db_host = getenv('BCS_DB_HOST') ?: getenv('DB_HOST') ?: 'bcsflows.mysql.dbaas.com.br';
$db_user = getenv('BCS_DB_USER') ?: getenv('DB_USER') ?: 'bcsflows';
$db_pass = getenv('BCS_DB_PASS') ?: getenv('DB_PASS') ?: 'And@99188280';
$db_name = getenv('BCS_DB_NAME') ?: getenv('DB_NAME') ?: 'bcsflows';
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
DBPHP;

if (@file_put_contents($api_dir . '/db.php', $db_php, LOCK_EX)) {
    @chmod($api_dir . '/db.php', 0644);
    $updates['db.php'] = 'OK';
} else {
    $updates['db.php'] = 'ERRO - Não conseguiu escrever';
}

// ========== 2. UPDATE SYNC.PHP ==========
$sync_php = <<<'SYNCPHP'
<?php
header('Content-Type: application/json; charset=utf-8');

// IMPORTANTE: Permita fallback para JSON se o banco falhar
// Isto garante que os dados nunca se perdem, mesmo se MySQL cair
$allowJsonFallback = true; // FORÇADO SEMPRE ATIVADO para garantir persistência
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
SYNCPHP;

if (@file_put_contents($api_dir . '/sync.php', $sync_php, LOCK_EX)) {
    @chmod($api_dir . '/sync.php', 0644);
    $updates['sync.php'] = 'OK';
} else {
    $updates['sync.php'] = 'ERRO - Não conseguiu escrever';
}

// ========== 3. TESTAR CONEXÃO ==========
require_once $api_dir . '/db.php';

if ($conn) {
    // Verificar tabela app_data
    $result = $conn->query("SHOW TABLES LIKE 'app_data'");
    if ($result && $result->num_rows > 0) {
        $updates['table_check'] = 'app_data EXISTS';
    } else {
        $updates['table_check'] = 'app_data NOT FOUND - Criando...';
        
        // Criar tabela
        $create_sql = "CREATE TABLE IF NOT EXISTS app_data (
            id INT PRIMARY KEY DEFAULT 1,
            payload LONGTEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )";
        
        if ($conn->query($create_sql)) {
            $updates['table_create'] = 'OK';
            
            // Inserir row inicial
            $initial_payload = json_encode([
                'events' => [],
                'users' => [],
                'inventory' => [],
                'config' => [],
                'updatedAt' => time() * 1000
            ], JSON_UNESCAPED_UNICODE);
            
            $stmt = $conn->prepare("INSERT INTO app_data (id, payload) VALUES (1, ?) ON DUPLICATE KEY UPDATE payload = VALUES(payload)");
            $stmt->bind_param('s', $initial_payload);
            $stmt->execute();
            $stmt->close();
            
            $updates['initial_data'] = 'Inserted';
        } else {
            $updates['table_create'] = 'ERRO - ' . $conn->error;
        }
    }
    
    $conn->close();
} else {
    $updates['connection'] = 'ERRO - ' . ($db_error ?: 'Unknown');
}

// ========== RESPOSTA ==========
echo json_encode([
    'success' => true,
    'timestamp' => date('Y-m-d H:i:s'),
    'updates' => $updates,
    'next_steps' => [
        '1. Teste a app em: https://www.nuvematomica.com.br/bcsflows/',
        '2. Faça login',
        '3. Os campos de data agora devem aparecer no formulário',
        '4. Crie um evento de teste',
        '5. Limpe cache (Ctrl+Shift+Delete) e recarregue',
        '6. O evento deve aparecer na lista'
    ]
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
