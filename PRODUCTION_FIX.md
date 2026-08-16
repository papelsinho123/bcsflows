# Como Corrigir o Servidor de Produção - BCS Flows

## Status Atual
- App em produção retorna erro 503/500 ao tentar sincronizar
- Os endpoints `/api/sync.php` e `/api/sync-simple.php` falham intermitentemente
- Quando testado via curl direto, o servidor às vezes responde com 200 OK
- **Conclusão**: Problema de configuração (env vars) ou arquivo desatualizado

## Solução Definitiva

### Opção 1: Via FTP (Se você tem acesso FTP)

1. **Conecte ao servidor via FTP** com suas credenciais
   - Host: `nuvematomica.com.br` (ou similar)
   - Pasta: `/public_html/bcsflows/` ou similar

2. **Navegue até `/api/`**

3. **Faça upload dos arquivos corrigidos**:
   - Baixe [api/db.php](../../api/db.php) local
   - Baixe [api/sync.php](../../api/sync.php) local
   - Faça upload de ambos para `/bcsflows/api/` no servidor
   - **Cuidado**: Sobrescreva os arquivos existentes

4. **Configure as variáveis de ambiente** (3 opções a seguir)

### Opção 2: Via .htaccess (Mais Fácil)

1. Conecte ao servidor via FTP
2. Navegue até `/bcsflows/`
3. Crie um arquivo chamado `.htaccess` (ou edite se já existir)
4. Adicione no final:

```apache
# Configuração de Banco de Dados para BCS Flows
SetEnv BCS_DB_HOST "seu_host_mysql_aqui"
SetEnv BCS_DB_USER "seu_usuario_aqui"
SetEnv BCS_DB_PASS "sua_senha_aqui"
SetEnv BCS_DB_NAME "seu_banco_aqui"

# Se precisar de modo debug (opcional)
# SetEnv BCS_DEBUG "1"
```

5. Salve e teste via navegador:
   ```
   https://www.nuvematomica.com.br/bcsflows/
   ```

### Opção 3: Via SSH (Se você tem acesso terminal)

1. **Conecte via SSH**:
   ```bash
   ssh seu_usuario@nuvematomica.com.br
   cd /var/www/html/bcsflows/api
   ```

2. **Edite db.php**:
   ```bash
   nano db.php
   ```
   Modifique as linhas:
   ```php
   $db_host = 'seu_host_real';
   $db_user = 'seu_usuario_real';
   $db_pass = 'sua_senha_real';
   $db_name = 'seu_banco_real';
   ```
   Salve com `Ctrl+O`, depois `Ctrl+X`

3. **Verifique a tabela no MySQL**:
   ```bash
   mysql -h seu_host -u seu_usuario -p seu_banco << EOF
   SHOW TABLES LIKE 'app_data';
   DESC app_data;
   SELECT COUNT(*) FROM app_data;
   EOF
   ```

4. **Teste**:
   ```bash
   curl -X GET https://www.nuvematomica.com.br/bcsflows/api/sync.php
   # Deve retornar JSON, não HTML de erro
   ```

### Opção 4: Encontrar as Credenciais Salvas

Se você não lembra as credenciais do MySQL:

**No seu PC local**:
1. Abra [DEPLOY_SQL.md](./DEPLOY_SQL.md)
2. Procure por credenciais MySQL
3. Ou procure em [SQL_SETUP_GUIDE.md](./SQL_SETUP_GUIDE.md)
4. Ou verifique emails de setup do servidor

**No servidor de produção** (se tem SSH):
```bash
# Procure em arquivos de configuração
grep -r "BCS_DB_" /var/www/html/ 2>/dev/null
grep -r "DB_HOST\|DB_USER\|DB_PASS" /var/www/html/ 2>/dev/null

# Ou procure no .bashrc
cat ~/.bashrc | grep -i db

# Ou procure em .env files
find /var/www -name ".env" 2>/dev/null
```

## Teste Rápido Após Corrigi r

1. **Abra navegador**:
   ```
   https://www.nuvematomica.com.br/bcsflows/
   ```

2. **Login com**:
   - Usuário: `andersonsiebre`
   - Senha: `anderson1`

3. **Verifique o console do navegador** (F12):
   - Procure por erros 503/500
   - Se vir ✅, a sincronização está OK

4. **Teste criação de evento**:
   - Crie um novo evento simples
   - Limpe o cache do navegador (Ctrl+Shift+Delete)
   - Recarregue (F5)
   - O evento deve aparecer (não desaparecerá)

## Se ainda não funcionar

**Verifique isso no servidor**:
```bash
# Conexão MySQL funciona?
mysql -h seu_host -u seu_usuario -p seu_banco -e "SELECT 1;"

# Arquivo db.php está correto?
php /var/www/html/bcsflows/api/db.php

# Php-fpm ou apache está rodando?
systemctl status php-fpm
systemctl status apache2

# Ver logs de erro
tail -100 /var/log/apache2/error.log
tail -100 /var/log/nginx/error.log

# Ver PHP errors
php -l /var/www/html/bcsflows/api/db.php
php -l /var/www/html/bcsflows/api/sync.php
```

## Checklist Final

- [ ] Fiz upload dos arquivos PHP corrigidos via FTP
- [ ] Configurei as variáveis de ambiente (via .htaccess ou env vars)
- [ ] Verifiquei que a tabela `app_data` existe e tem dados
- [ ] Testei `/api/sync.php` via curl/navegador → HTTP 200
- [ ] Testei login na app → Não pede sincronização
- [ ] Criei um evento → Persistiu após limpar cache

## Contato para Suporte

Se tiver dúvidas:
1. Verifique este arquivo [PRODUCTION_DEBUG.md](./PRODUCTION_DEBUG.md)
2. Procure em [README_deploy.md](../README_deploy.md)
3. Verifique seu email com credenciais do servidor
