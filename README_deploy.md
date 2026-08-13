# Checklist de deploy (public_html/bcsflows)

1) No seu PC:
   - npm install
   - npm run build
   - Verifique a pasta dist/

2) Upload (FTP):
   - Conteúdo de dist/ → public_html/bcsflows/
   - api/ → public_html/bcsflows/api/
   - .htaccess → public_html/bcsflows/

3) No servidor (edição):
   - Edite api/db.php com as credenciais reais do MySQL

4) phpMyAdmin:
   - Importe create_usuarios.sql

5) Testes:
   - Acesse https://seudominio.com/bcsflows/
   - Teste endpoints /bcsflows/api/get_user.php e /create_user.php

6) Segurança:
   - Habilite HTTPS no painel Locaweb
   - Não versionar arquivos com credenciais
