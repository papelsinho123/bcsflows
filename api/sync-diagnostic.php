<?php
/**
 * sync-diagnostic.php
 * Use este arquivo para descobrir EXATAMENTE qual é o erro
 * Upload para /bcsflows/api/sync-diagnostic.php
 */

header('Content-Type: application/json; charset=utf-8');

$debug = [
    'timestamp' => date('Y-m-d H:i:s'),
    'php_version' => phpversion(),
    'mysqli_enabled' => extension_loaded('mysqli'),
    'file_check' => [],
    'env_vars' => [],
    'db_connection' => [],
    'table_check' => [],
];

// 1. Verificar se db.php existe e pode ser incluído
$db_file = __DIR__ . '/db.php';
if (!file_exists($db_file)) {
    $debug['file_check']['db.php'] = 'FILE NOT FOUND';
} else {
    $debug['file_check']['db.php'] = 'EXISTS';
    $debug['file_check']['db.php_size'] = filesize($db_file);
    $debug['file_check']['db.php_readable'] = is_readable($db_file);
    
    // Ler primeira linha do arquivo para ver se tem credenciais
    $first_lines = file($db_file, FILE_IGNORE_NEW_LINES);
    $has_credentials = false;
    foreach ($first_lines as $line) {
        if (strpos($line, 'bcsflows.mysql.dbaas.com.br') !== false) {
            $has_credentials = true;
            break;
        }
    }
    $debug['file_check']['has_hardcoded_credentials'] = $has_credentials;
}

// 2. Verificar variáveis de ambiente
$env_vars_to_check = ['BCS_DB_HOST', 'BCS_DB_USER', 'BCS_DB_PASS', 'BCS_DB_NAME', 'DB_HOST', 'DB_USER', 'DB_PASS', 'DB_NAME'];
foreach ($env_vars_to_check as $var) {
    $value = getenv($var);
    $debug['env_vars'][$var] = $value ? 'SET (***masked***)' : 'EMPTY';
}

// 3. Tentar conectar ao banco
if (extension_loaded('mysqli')) {
    // Ler db.php
    include_once __DIR__ . '/db.php';
    
    if ($conn) {
        $debug['db_connection']['connected'] = true;
        $debug['db_connection']['error'] = null;
        $debug['db_connection']['charset'] = $conn->character_set_name();
        
        // 4. Verificar se tabela app_data existe
        $result = $conn->query("SHOW TABLES LIKE 'app_data'");
        if ($result && $result->num_rows > 0) {
            $debug['table_check']['app_data_exists'] = true;
            
            // Ver estrutura
            $desc = $conn->query("DESC app_data");
            $columns = [];
            while ($row = $desc->fetch_assoc()) {
                $columns[] = $row['Field'];
            }
            $debug['table_check']['columns'] = $columns;
            
            // Contar registros
            $count_result = $conn->query("SELECT COUNT(*) as cnt FROM app_data");
            $count_row = $count_result->fetch_assoc();
            $debug['table_check']['record_count'] = $count_row['cnt'];
            
            // Ver se payload existe
            $payload_result = $conn->query("SELECT id, LENGTH(payload) as payload_size FROM app_data WHERE id = 1");
            if ($payload_result && $payload_result->num_rows > 0) {
                $payload_row = $payload_result->fetch_assoc();
                $debug['table_check']['payload_size_bytes'] = $payload_row['payload_size'];
            } else {
                $debug['table_check']['payload_note'] = 'No row with id=1';
            }
        } else {
            $debug['table_check']['app_data_exists'] = false;
            $debug['table_check']['note'] = 'Tabela app_data não existe! Precisa ser criada.';
        }
        
        $conn->close();
    } else {
        $debug['db_connection']['connected'] = false;
        $debug['db_connection']['error'] = $db_error ?? 'Unknown error';
        $debug['db_connection']['mysqli_loaded'] = true;
    }
} else {
    $debug['db_connection']['connected'] = false;
    $debug['db_connection']['error'] = 'mysqli not loaded';
    $debug['db_connection']['mysqli_loaded'] = false;
}

// 5. Verificar arquivo JSON fallback
$json_file = __DIR__ . '/app_data.json';
$debug['json_fallback'] = [
    'file_exists' => file_exists($json_file),
    'file_readable' => is_readable($json_file),
    'file_writable' => is_writable($json_file),
    'file_size' => file_exists($json_file) ? filesize($json_file) : 0,
];

// 6. Recomendação
$debug['recommendation'] = [];
if (!$debug['db_connection']['connected'] && !extension_loaded('mysqli')) {
    $debug['recommendation'][] = '⚠️ PROBLEMA: mysqli não está habilitada. Contate seu host.';
}
if (!$debug['db_connection']['connected'] && extension_loaded('mysqli')) {
    $debug['recommendation'][] = '⚠️ PROBLEMA: Não consegue conectar ao MySQL. Verifique:';
    $debug['recommendation'][] = '   1. db.php tem as credenciais corretas?';
    $debug['recommendation'][] = '   2. MySQL está rodando?';
    $debug['recommendation'][] = '   3. Credenciais (host/user/pass) estão certas?';
}
if (!$debug['table_check'] || !isset($debug['table_check']['app_data_exists']) || !$debug['table_check']['app_data_exists']) {
    $debug['recommendation'][] = '⚠️ PROBLEMA: Tabela app_data não existe. Execute o SQL_SETUP_GUIDE.md';
}
if ($debug['json_fallback']['file_exists'] && !$debug['json_fallback']['file_writable']) {
    $debug['recommendation'][] = '⚠️ AVISO: app_data.json existe mas não é gravável. Mude permissões para 0666';
}
if (!$debug['json_fallback']['file_exists'] && !$debug['db_connection']['connected']) {
    $debug['recommendation'][] = '🔴 CRÍTICO: Sem banco MySQL E sem JSON fallback. Nada funciona!';
}
if ($debug['db_connection']['connected'] && (!isset($debug['table_check']['app_data_exists']) || !$debug['table_check']['app_data_exists'])) {
    $debug['recommendation'][] = '📝 SOLUÇÃO: Execute no MySQL:';
    $debug['recommendation'][] = 'CREATE TABLE app_data (id INT PRIMARY KEY, payload LONGTEXT, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP);';
    $debug['recommendation'][] = 'INSERT INTO app_data (id, payload) VALUES (1, \'{"events":[],"users":[],"inventory":[],"config":{}}\');';
}

echo json_encode($debug, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
