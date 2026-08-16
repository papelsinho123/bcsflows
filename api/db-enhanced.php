<?php
// db.php - Conexão do banco do BCS Flows com diagnóstico melhorado

// Ler variáveis de ambiente
$db_host = getenv('BCS_DB_HOST') ?: getenv('DB_HOST') ?: 'localhost';
$db_user = getenv('BCS_DB_USER') ?: getenv('DB_USER') ?: '';
$db_pass = getenv('BCS_DB_PASS') ?: getenv('DB_PASS') ?: '';
$db_name = getenv('BCS_DB_NAME') ?: getenv('DB_NAME') ?: '';
$db_error = null;
$conn = null;

// Log de diagnóstico (apenas em desenvolvimento)
$debug_mode = getenv('BCS_DEBUG') === '1' || getenv('BCS_DEBUG') === 'true';

if ($debug_mode) {
    error_log('[BCS DB] Host: ' . $db_host . ', User: ' . $db_user . ', DB: ' . $db_name);
}

// Verificar extensão mysqli
if (!extension_loaded('mysqli')) {
    $db_error = 'Extensão mysqli não está habilitada no PHP.';
    if ($debug_mode) {
        error_log('[BCS DB ERROR] ' . $db_error);
    }
} elseif (empty($db_host) || empty($db_user) || empty($db_name)) {
    // Env vars ausentes
    $db_error = 'Variáveis do banco ausentes. Defina BCS_DB_HOST, BCS_DB_USER, BCS_DB_PASS e BCS_DB_NAME.';
    if ($debug_mode) {
        error_log('[BCS DB ERROR] ' . $db_error);
        error_log('[BCS DB] Valores recebidos: Host=' . ($db_host ? 'SET' : 'EMPTY') . ', User=' . ($db_user ? 'SET' : 'EMPTY') . ', Pass=' . ($db_pass ? 'SET' : 'EMPTY') . ', DB=' . ($db_name ? 'SET' : 'EMPTY'));
    }
} else {
    // Tentar conectar
    $conn = @new mysqli($db_host, $db_user, $db_pass, $db_name);
    
    if ($conn && $conn->connect_error) {
        $db_error = 'Erro ao conectar no MySQL: ' . $conn->connect_error;
        $conn = null;
        if ($debug_mode) {
            error_log('[BCS DB ERROR] ' . $db_error);
        }
    } elseif (!$conn) {
        $db_error = 'Erro ao criar conexão mysqli';
        if ($debug_mode) {
            error_log('[BCS DB ERROR] ' . $db_error);
        }
    }
}

// Configurar charset se conectado
if ($conn) {
    $conn->set_charset('utf8mb4');
    if ($debug_mode) {
        error_log('[BCS DB OK] Conectado com sucesso');
    }
}
