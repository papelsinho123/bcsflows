<?php
/**
 * API de Sincronização Simplificada - BCS Flows
 * 
 * Esta versão funciona SEM banco de dados
 * Salva dados em um arquivo JSON local
 * Perfeito para testes e desenvolvimento
 * 
 * Para produção, use a versão com db.php
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Arquivo onde os dados serão salvos
$dataFile = __DIR__ . '/app_data.json';

// Inicializar arquivo se não existir
if (!file_exists($dataFile)) {
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
    
    file_put_contents($dataFile, json_encode($initialData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    // Retornar dados salvos
    if (file_exists($dataFile)) {
        $payload = json_decode(file_get_contents($dataFile), true);
        echo json_encode(['payload' => $payload ?: null]);
    } else {
        echo json_encode(['payload' => null]);
    }
    exit;
}

if ($method === 'POST') {
    // Receber e salvar dados
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);

    if (!is_array($data)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid JSON body']);
        exit;
    }

    // Salvar no arquivo
    $success = file_put_contents(
        $dataFile,
        json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
    );

    if ($success === false) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to save data']);
        exit;
    }

    echo json_encode(['success' => true, 'saved' => true]);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
