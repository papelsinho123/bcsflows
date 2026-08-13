# Instruções rápidas para build e upload

1) No seu computador (clone do repositório):

- git pull origin master
- npm install
- npm run build

A pasta de saída será `dist/`.

2) Preparar a hospedagem (public_html/bcsflows):

- No painel Locaweb, crie o banco MySQL e usuário.
- Anote host (normalmente `localhost`), nome do banco, usuário e senha.

3) Upload via FTP (FileZilla):

- Conecte via FTP usando as credenciais da Locaweb.
- Crie a pasta `public_html/bcsflows` caso não exista.
- Faça upload do conteúdo de `dist/` (os arquivos dentro dela) para `public_html/bcsflows/`.
- Faça upload da pasta `api/` (com os arquivos PHP) para `public_html/bcsflows/api/`.
- Faça upload do arquivo `.htaccess` para `public_html/bcsflows/`.

4) No servidor: edite `api/db.php` para preencher `SEU_USUARIO_DB`, `SUA_SENHA_DB` e `SEU_NOME_BANCO`.

5) No painel da Locaweb (phpMyAdmin): importe `create_usuarios.sql` para criar a tabela `usuarios`.

6) Testes:

- Acesse https://seudominio.com/bcsflows/ — o frontend deve carregar.
- Teste a API: https://seudominio.com/bcsflows/api/get_user.php?id=1

Segurança:
- Não comite `api/db.php` com credenciais reais.
- Ative HTTPS no painel Locaweb.
