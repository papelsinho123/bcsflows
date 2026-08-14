<?php
/**
 * API de Sincronização - BCS Flows
 * 
 * Sincroniza dados entre App e Web usando arquivo JSON
 * Garante que App e Web SEMPRE usam os mesmos dados
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Arquivo compartilhado entre App e Web
$dataDir = __DIR__;
$dataFile = $dataDir . '/app_data.json';

// Garantir que diretório existe e é gravável
if (!is_dir($dataDir)) {
    mkdir($dataDir, 0755, true);
}
if (!is_writable($dataDir)) {
    chmod($dataDir, 0755);
}

// Inicializar arquivo com dados padrão se não existir
if (!file_exists($dataFile) || filesize($dataFile) < 100) {
    $initialData = [
        'updatedAt' => time() * 1000,
        'users' => [
            [
                'id' => 1,
                'usuario' => 'andersonsiebre',
                'username' => 'andersonsiebre',
                'email' => 'andersonsiebre@bcs.com',
                'password' => 'anderson1',
                'role' => 'master',
                'name' => 'Anderson Siebre',
                'leaveTaken' => 0,
                'leaveRuleDays' => 7
            ],
            [
                'id' => 2,
                'usuario' => 'admin',
                'username' => 'admin',
                'email' => 'admin@bcs.com',
                'password' => 'admin',
                'role' => 'admin',
                'name' => 'Administrador BCS',
                'leaveTaken' => 0,
                'leaveRuleDays' => 7
            ],
            [
                'id' => 3,
                'usuario' => 'user',
                'username' => 'user',
                'email' => 'user@bcs.com',
                'password' => 'user',
                'role' => 'user',
                'name' => 'Usuário Padrão',
                'leaveTaken' => 0,
                'leaveRuleDays' => 7
            ]
        ],
        'inventory' => [
            [
                'id' => 1,
                'type' => 'IMPRESSORA TÉRMICA',
                'name' => 'Zebra TLP 2824',
                'serial' => 'ZBR-1234',
                'quantity' => 6,
                'status' => 'Disponível'
            ],
            [
                'id' => 2,
                'type' => 'COLETOR DE DADOS',
                'name' => 'Honeywell Dolphin',
                'serial' => 'HD-1122',
                'quantity' => 3,
                'status' => 'Disponível'
            ],
            [
                'id' => 3,
                'type' => 'LEITOR BARCODE',
                'name' => 'Motorola LS2208',
                'serial' => 'MTR-0021',
                'quantity' => 4,
                'status' => 'EM MANUTENÇÃO'
            ],
            [
                'id' => 4,
                'type' => 'NOTEBOOK',
                'name' => 'Dell Inspiron 15',
                'serial' => 'DL-5587',
                'quantity' => 2,
                'status' => 'Disponível'
            ]
        ],
        'config' => [
            'nfContact' => [
                'name' => 'Rafael Sales',
                'email' => 'nf@bcs.com',
                'phone' => '+55 (11) 99999-9999'
            ],
            'itemTypes' => [
                'IMPRESSORA TÉRMICA',
                'IMPRESSORA LASER',
                'TOTEM',
                'COLETOR DE DADOS',
                'LEITOR BARCODE',
                'NOTEBOOK',
                'ETIQUETA',
                'RIBBON',
                'ALL IN ONE',
                'CELULAR'
            ],
            'proposalItemTypes' => [],
            'expenseTypes' => [],
            'paymentTypes' => [],
            'defaultItems' => [
                [
                    'id' => 1,
                    'type' => 'IMPRESSORA TÉRMICA',
                    'subframe' => 'SECRETARIA'
                ],
                [
                    'id' => 2,
                    'type' => 'NOTEBOOK',
                    'subframe' => 'CAEX'
                ],
                [
                    'id' => 3,
                    'type' => 'COLETOR DE DADOS',
                    'subframe' => 'CONTROLE DE ACESSO'
                ]
            ]
        ],
        'events' => []
    ];
    
    $json = json_encode($initialData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    file_put_contents($dataFile, $json);
    chmod($dataFile, 0666);
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    // Retornar dados compartilhados
    if (file_exists($dataFile) && filesize($dataFile) > 0) {
        $content = file_get_contents($dataFile);
        $payload = json_decode($content, true);
        
        // Se JSON está corrompido, retornar dados iniciais
        if (!is_array($payload)) {
            $payload = null;
        }
        
        http_response_code(200);
        echo json_encode(['payload' => $payload]);
    } else {
        http_response_code(200);
        echo json_encode(['payload' => null]);
    }
    exit;
}

if ($method === 'POST') {
    // Receber e salvar dados (SINCRONIZADO ENTRE APP E WEB)
    $raw = file_get_contents('php://input');
    
    if (empty($raw)) {
        http_response_code(400);
        echo json_encode(['error' => 'Empty body']);
        exit;
    }
    
    $data = json_decode($raw, true);

    if (!is_array($data)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid JSON']);
        exit;
    }

    // Garantir que updatedAt existe
    if (!isset($data['updatedAt'])) {
        $data['updatedAt'] = time() * 1000;
    }

    // Salvar ATOMICAMENTE (backup + escreve novo)
    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    
    // Criar backup
    $backupFile = $dataFile . '.backup';
    if (file_exists($dataFile)) {
        copy($dataFile, $backupFile);
    }
    
    // Escrever novo arquivo
    $bytesWritten = file_put_contents($dataFile, $json, LOCK_EX);
    
    if ($bytesWritten === false) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to write file']);
        exit;
    }

    chmod($dataFile, 0666);

    http_response_code(200);
    echo json_encode(['success' => true, 'saved' => true, 'timestamp' => $data['updatedAt']]);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);

