# Guia de Diagnóstico e Correção para Produção

## Problema
O app em produção (www.nuvematomica.com.br/bcsflows) retorna:
- `/api/sync-simple.php` → HTTP 503 (Service Unavailable)
- `/api/sync.php` → HTTP 500 (Internal Server Error)

Mas quando testado via curl direto, funciona (HTTP 200).

## Solução Imediata

### 1. Verificar Variáveis de Ambiente no Servidor

Conecte via SSH e execute:

```bash
# Verificar se as variáveis estão definidas
printenv | grep BCS_DB
printenv | grep DB_

# Ou verifique o arquivo .env (se existir)
cat /var/www/html/bcsflows/.env
cat ~/.bashrc | grep BCS_DB
```

Se não aparecer nada, defina as variáveis:

```bash
# 1. Edite o .bashrc ou .profile
nano ~/.bashrc

# 2. Adicione no final:
export BCS_DB_HOST="seu_host_mysql"
export BCS_DB_USER="seu_usuario"
export BCS_DB_PASS="sua_senha"
export BCS_DB_NAME="bcs_flows_db"

# 3. Recarregue
source ~/.bashrc

# 4. Verifique
printenv BCS_DB_HOST
```

### 2. Alternativa: Usar Arquivo .htaccess para Definir Variáveis

Se você não tem acesso a SSH, crie um arquivo `.htaccess` na pasta `/bcsflows/`:

```apache
# .htaccess - Adicione ao arquivo existente
SetEnv BCS_DB_HOST "seu_host_mysql"
SetEnv BCS_DB_USER "seu_usuario"
SetEnv BCS_DB_PASS "sua_senha"
SetEnv BCS_DB_NAME "bcs_flows_db"
```

### 3. Alternativa: Modificar db.php para Usar Valores Hardcoded (Temporário)

Se as env vars não funcionarem, edite `/bcsflows/api/db.php`:

```php
<?php
// AVISO: Isto é apenas temporário. Mude para env vars depois.
$db_host = getenv('BCS_DB_HOST') ?: 'seu_host_real_aqui';
$db_user = getenv('BCS_DB_USER') ?: 'seu_usuario_aqui';
$db_pass = getenv('BCS_DB_PASS') ?: 'sua_senha_aqui';
$db_name = getenv('BCS_DB_NAME') ?: 'bcs_flows_db';

// ... resto do código
```

### 4. Verificar a Tabela app_data

Conecte ao MySQL:

```bash
mysql -h seu_host -u seu_usuario -p seu_banco

# Verifique se a tabela existe
SHOW TABLES LIKE 'app_data';

# Se não existir, crie:
CREATE TABLE app_data (
    id INT PRIMARY KEY DEFAULT 1,
    payload LONGTEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

# Insira um payload válido inicial
INSERT INTO app_data (id, payload, updated_at) VALUES (1, '{"users":[],"events":[],"inventory":[],"config":{},"updatedAt":'.time()*1000.'}', NOW());
```

### 5. Testar o Endpoint Corrigido

Após aplicar qualquer solução acima, teste:

```bash
# No servidor
curl -X GET https://www.nuvematomica.com.br/bcsflows/api/sync.php -H "Content-Type: application/json"

# Ou via navegador
# https://www.nuvematomica.com.br/bcsflows/api/sync.php

# Deve retornar JSON com payload, não 503/500
```

## Checklist Final

- [ ] Variáveis de ambiente BCS_DB_* estão definidas
- [ ] Conexão MySQL funciona (testada via `mysql` CLI)
- [ ] Tabela `app_data` existe
- [ ] Arquivo `/api/db.php` está atualizado
- [ ] Arquivo `/api/sync.php` está atualizado
- [ ] Teste `/api/sync.php` via curl ou navegador = HTTP 200
- [ ] App em produção agora sincroniza corretamente

## Dúvidas Frequentes

**P: Como sei se as env vars estão sendo lidas?**
R: Teste com um arquivo PHP simples:
```php
<?php
echo getenv('BCS_DB_HOST') . PHP_EOL;
?>
```

**P: E se o MySQL não conecta?**
R: Verifique:
1. Host/porta corretos
2. Credenciais corretas
3. Firewall/rede permitindo conexão
4. MySQL está rodando: `systemctl status mysql` (Linux)

**P: Onde salvei meus dados de MySQL?**
R: Procure em arquivos de configuração anterior do projeto:
- `/bcsflows/DEPLOY_SQL.md`
- `/bcsflows/SQL_SETUP_GUIDE.md`
- Documentação enviada via email durante setup
