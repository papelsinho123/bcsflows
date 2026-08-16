# ⚠️ URGENTE - COMO CORRIGIR O SERVIDOR AGORA

## O Problema
- Seu servidor ainda tem os arquivos PHP **antigos**
- Não consegue sincronizar eventos
- Retorna erro 503/500

## A Solução (5 MINUTOS)

### Se você tem acesso via FTP:

1. **Conecte ao servidor via FTP** (WinSCP, FileZilla, ou outro)
   - Arquivo/Pasta: `/bcsflows/api/`

2. **Baixe estes 3 arquivos do seu PC local**:
   ```
   C:\Users\Anderson Siebre\Desktop\bcs-flows\api\db.php
   C:\Users\Anderson Siebre\Desktop\bcs-flows\api\sync.php
   C:\Users\Anderson Siebre\Desktop\bcs-flows\api\app_data.json
   ```

3. **Faça upload para o servidor** na pasta `/bcsflows/api/`:
   - Substitua os arquivos existentes
   - Use modo ASCII para .php e .json

4. **Pronto!** Teste: https://www.nuvematomica.com.br/bcsflows/

### Se você tem acesso via cPanel/Plesk:

1. **Abra o gerenciador de arquivos** do painel
2. **Navegue até `/public_html/bcsflows/api/`**
3. **Delete** os arquivos antigos:
   - `db.php`
   - `sync.php`
4. **Faça upload** dos novos do seu PC:
   - `C:\Users\Anderson Siebre\Desktop\bcs-flows\api\db.php`
   - `C:\Users\Anderson Siebre\Desktop\bcs-flows\api\sync.php`
5. **Pronto!** Teste novamente

### Se você não tem acesso nenhum:

**Você PRECISA contatar seu provedor de hospedagem**:
- Envie email pedindo para fazer upload dos 3 arquivos
- Ou peça acesso FTP
- Inclua os arquivos anexados

## Arquivos Corrigidos (Para Referência)

**db.php** - Agora tem as credenciais corretas do MySQL
**sync.php** - Agora funciona com JSON fallback garantindo persistência

## Verificar se Funcionou

1. Abra em navegador:
   ```
   https://www.nuvematomica.com.br/bcsflows/
   ```

2. Faça login:
   - Usuário: `andersonsiebre`
   - Senha: `anderson1`

3. Abra o F12 (Developer Tools)
   - Vá em **Console**
   - Procure por ✅ em vez de ❌
   - Se vir "Sincronização ativa com o banco de dados" → ✅ FUNCIONOU

4. Crie um evento de teste
5. Limpe o cache (Ctrl+Shift+Delete)
6. Recarregue a página (Ctrl+F5)
7. O evento deve aparecer → ✅ PRONTO

## Se ainda não funcionar após upload

Execute este diagnóstico:

```bash
curl "https://www.nuvematomica.com.br/bcsflows/api/sync-diagnostic.php"
```

Isto vai retornar um JSON mostrando exatamente o que está errado.
