<?php
/**
 * test-events-save.php
 * Teste para verificar se eventos estão salvando corretamente
 * 
 * Acesse: https://www.nuvematomica.com.br/bcsflows/api/test-events-save.php
 */

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/db.php';

$result = [
    'timestamp' => date('Y-m-d H:i:s'),
    'database_connected' => $conn ? true : false,
    'database_error' => $db_error,
];

// 1. Tentar ler eventos do banco
if ($conn) {
    $sql = 'SELECT payload FROM app_data WHERE id = 1 LIMIT 1';
    $query_result = $conn->query($sql);
    
    if ($query_result && $query_result->num_rows > 0) {
        $row = $query_result->fetch_assoc();
        $payload = json_decode($row['payload'], true);
        
        $result['database_read'] = [
            'success' => true,
            'payload_size' => strlen($row['payload']),
            'events_count' => count($payload['events'] ?? []),
            'events_sample' => array_slice($payload['events'] ?? [], 0, 2),
        ];
    } else {
        $result['database_read'] = [
            'success' => false,
            'message' => 'No app_data row found with id=1',
        ];
    }
    
    $conn->close();
} else {
    $result['database_read'] = [
        'success' => false,
        'message' => 'Cannot connect to database',
    ];
}

// 2. Tentar ler JSON fallback
$jsonFile = __DIR__ . '/app_data.json';
if (file_exists($jsonFile)) {
    $content = file_get_contents($jsonFile);
    $data = json_decode($content, true);
    
    $result['json_fallback'] = [
        'exists' => true,
        'file_size' => filesize($jsonFile),
        'events_count' => count($data['events'] ?? []),
        'events_sample' => array_slice($data['events'] ?? [], 0, 2),
    ];
} else {
    $result['json_fallback'] = [
        'exists' => false,
        'message' => 'app_data.json not found',
    ];
}

// 3. Testa POST (criação de evento de teste)
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $raw = file_get_contents('php://input');
    $testData = json_decode($raw, true);
    
    if ($testData && isset($testData['test_event'])) {
        // Ler dados atuais
        $currentPayload = $result['database_read']['success'] 
            ? $testData['current_payload'] 
            : json_decode(file_get_contents($jsonFile), true);
        
        // Adicionar evento de teste
        $newEvent = [
            'id' => time() * 1000,
            'name' => 'EVENTO TESTE ' . date('H:i:s'),
            'address' => 'Endereço Teste',
            'locationName' => 'Local Teste',
            'clientName' => 'Cliente Teste',
            'contact' => '+55 11 99999-9999',
            'eventDate' => date('Y-m-d'),
            'status' => 'A Iniciar',
            'users' => [],
            'boards' => ['info' => [], 'montagem' => [], 'desmontagem' => [], 'hospedagem' => [], 'deslocamento' => [], 'separar' => []],
        ];
        
        $currentPayload['events'][] = $newEvent;
        
        // Salvar
        if ($conn) {
            $payload_json = json_encode($currentPayload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            $stmt = $conn->prepare('INSERT INTO app_data (id, payload) VALUES (1, ?) ON DUPLICATE KEY UPDATE payload = VALUES(payload), updated_at = NOW()');
            $stmt->bind_param('s', $payload_json);
            $ok = $stmt->execute();
            $stmt->close();
            
            $result['test_post'] = [
                'method' => 'database',
                'success' => $ok,
            ];
            $conn->close();
        } else {
            $json = json_encode($currentPayload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            $ok = file_put_contents($jsonFile, $json, LOCK_EX);
            chmod($jsonFile, 0666);
            
            $result['test_post'] = [
                'method' => 'json_fallback',
                'success' => $ok ? true : false,
            ];
        }
    }
}

echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
