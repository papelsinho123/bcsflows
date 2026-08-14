# Deploy do BCS Flows com sincronização SQL

## 1) Preparar o banco MySQL

No phpMyAdmin ou no painel do host, execute:

```sql
CREATE TABLE IF NOT EXISTS app_data (
  id INT PRIMARY KEY DEFAULT 1,
  payload JSON NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

Se o host não aceitar `JSON`, use esta versão:

```sql
CREATE TABLE IF NOT EXISTS app_data (
  id INT PRIMARY KEY DEFAULT 1,
  payload LONGTEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

## 2) Ajustar a conexão do PHP

Edite o arquivo `api/db.php` com os dados reais do seu banco:

```php
<?php
$db_host = 'localhost';
$db_user = 'SEU_USUARIO_DB';
$db_pass = 'SUA_SENHA_DB';
$db_name = 'SEU_NOME_BANCO';

$conn = new mysqli($db_host, $db_user, $db_pass, $db_name);
if ($conn->connect_error) {
  http_response_code(500);
  echo json_encode(['error' => 'DB connection failed']);
  exit;
}
$conn->set_charset('utf8mb4');
```

## 3) Fazer upload para o FTP

Suba no diretório do site, por exemplo:

- `public_html/bcsflows/` → conteúdo de `dist/`
- `public_html/bcsflows/api/` → pasta `api/`
- `public_html/bcsflows/.htaccess` → arquivo `.htaccess` da raiz

Importante:
- não apague a pasta `api`
- não remova o `.htaccess`

## 4) Verificar a base da URL

A app usa a base `/bcsflows/api` por padrão. Se o site estiver em outro diretório, ajuste:

- `src/utils/storage.js`
- `.htaccess`
- `vite.config.js`

## 5) Testar no navegador

Acesso principal:

```text
https://SEU-DOMINIO/bcsflows/
```

Teste do backend:

```text
https://SEU-DOMINIO/bcsflows/api/sync.php
```

Se o endpoint retornar JSON, a sincronização está funcionando.

## 6) Como o sincronismo funciona

- O front salva os dados no navegador como backup local
- em seguida manda para `/api/sync.php`
- o PHP grava o payload em `app_data`
- cada dispositivo lê esse mesmo registro e sincroniza o estado

Isso faz com que qualquer alteração apareça em todos os aparelhos conectados ao mesmo banco.
