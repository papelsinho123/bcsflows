# Guía rápida para manter o BCS Flows conectado ao MySQL

## 1) Verifique a causa real da mensagem
A mensagem aparece quando o PHP não consegue abrir a conexão com o banco. No projeto, a verificação está em `api/db.php`.

Se a conexão falhar, a API retorna erro e a app mostra:

`Sincronização com o banco indisponível. Os dados locais ficam protegidos no cache do navegador até o servidor voltar.`

Isso significa que o problema não é o React, e sim o servidor PHP + MySQL.

## 2) Crie a tabela do banco
No phpMyAdmin, MySQL Workbench, ou console do host, rode:

```sql
CREATE TABLE IF NOT EXISTS app_data (
  id INT PRIMARY KEY DEFAULT 1,
  payload LONGTEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

Se o seu host aceitar `JSON`, pode usar:

```sql
CREATE TABLE IF NOT EXISTS app_data (
  id INT PRIMARY KEY DEFAULT 1,
  payload JSON NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

## 3) Configure as credenciais do banco no servidor
Abra o arquivo `api/db.php` e deixe assim:

```php
<?php
$db_host = getenv('BCS_DB_HOST') ?: 'localhost';
$db_user = getenv('BCS_DB_USER') ?: 'SEU_USUARIO';
$db_pass = getenv('BCS_DB_PASS') ?: 'SUA_SENHA';
$db_name = getenv('BCS_DB_NAME') ?: 'SEU_BANCO';

$conn = null;

if (!empty($db_user) && !empty($db_name) && strpos($db_user, 'SEU_') === false) {
  $conn = @new mysqli($db_host, $db_user, $db_pass, $db_name);
  if ($conn && $conn->connect_error) {
    $conn = null;
  }
}

if ($conn) {
  $conn->set_charset('utf8mb4');
}
```

Se preferir, defina as variáveis de ambiente no painel do host ou no Apache/Nginx:

```bash
BCS_DB_HOST=localhost
BCS_DB_USER=seu_usuario
BCS_DB_PASS=sua_senha
BCS_DB_NAME=seu_banco
```

## 4) Teste diretamente no PHP
Abra no navegador o seguinte endereço:

```text
https://SEU_DOMINIO/bcsflows/api/sync.php
```

Se tudo estiver correto, ele deve retornar um JSON. Se aparecer erro, o banco está fora ou as credenciais estão erradas.

Também vale testar:

```text
https://SEU_DOMINIO/bcsflows/api/sync-simple.php
```

## 5) Verifique se a URL da API está correta
No frontend, a app tenta chamar a API a partir de `src/utils/storage.js`. O valor padrão é:

- `/bcsflows/api` em produção
- `/api` em ambiente local/arquivos simples

Se o site do cliente estiver em outra pasta, ajuste o `VITE_API_BASE` ou o base path do app.

## 6) Como deixar o sistema sempre sincronizado
1. O PHP precisa conseguir conectar ao MySQL sem erro.
2. O banco precisa estar disponível na internet/host.
3. A pasta `api` precisa estar no mesmo servidor do site.
4. A app deve acessar a mesma URL do backend em todos os dispositivos.
5. O MySQL não deve estar desligado, travado, sem usuário ou sem privilégio para a base.

## 7) Checklist final
- [ ] Tabela `app_data` existe
- [ ] Usuário do MySQL tem acesso ao banco
- [ ] Senha correta
- [ ] Host correto (`localhost`, `127.0.0.1`, ou host do provedor)
- [ ] `api/db.php` usa as credenciais reais
- [ ] `api/sync.php` responde com JSON
- [ ] A app acessa o host correto

## 8) Se quiser, eu posso te ajudar com o próximo passo
Envie estes dados do seu servidor:

- host do banco
- usuário
- senha
- nome do banco
- domínio do site
- se é `localhost`, `Locaweb`, `Hostinger`, `Godaddy`, `cPanel`, `VPS`, etc.

Com isso eu te passo exatamente o ajuste que precisa ser feito no arquivo `api/db.php` e na configuração do ambiente.
