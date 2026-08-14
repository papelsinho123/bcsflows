# 🧪 Teste de Sincronização App-Web

## 📋 Pré-requisitos

1. ✅ Arquivo `api/db.php` configurado com credenciais do banco
2. ✅ Tabela `app_data` criada no banco de dados
3. ✅ Web app rodando em http://localhost:4173
4. ✅ API acessível em http://localhost:4173/bcsflows/api

## 🔍 Teste 1: Verificar Conexão com Banco

### Na Web (F12 → Console)

```javascript
// Ativar logs de sincronização
localStorage.setItem('DEBUG_BCS_SYNC', 'true');
location.reload();
```

Você verá logs como:
```
[BCS Sync] Fetching from /bcsflows/api/sync.php...
[BCS Sync] Remote data loaded successfully...
```

Se ver erro de conexão, o `db.php` não está configurado corretamente.

## 🧪 Teste 2: Criar Evento na Web

1. Abra http://localhost:4173/bcsflows
2. Login com: `andersonsiebre` / `anderson1`
3. Clique em "Eventos"
4. Crie um novo evento chamado **"Teste Web 001"**
5. Salve o evento
6. Abra DevTools (F12) → Network e procure por `/sync.php` com método POST
7. Verifique no banco:

```sql
SELECT JSON_EXTRACT(payload, '$.events[*].name') FROM app_data WHERE id = 1;
```

Você verá: `["Teste Web 001", ...]`

## 📱 Teste 3: Visualizar no App Android

1. Abra o APK no emulador/dispositivo
2. Login com: `andersonsiebre` / `anderson1`
3. Vá para "Eventos"
4. **O evento "Teste Web 001" deve aparecer** ✅
5. Se não aparecer, aguarde até 3 segundos para sincronizar

## ✅ Teste 4: Criar Evento no App

1. No app, crie um novo evento chamado **"Teste App 001"**
2. Salve
3. Volte para a web (localhost:4173)
4. Recarregue a página (F5)
5. **O evento "Teste App 001" deve aparecer** ✅

## 🔄 Teste 5: Sincronização em Tempo Real

1. Abra a web em uma aba
2. Abra o app em outro dispositivo/emulador
3. Na web, crie um evento **"Teste Sincronização"**
4. **No app, em até 3 segundos, o evento deve aparecer** ✅

## ⚠️ Troubleshooting

### Evento não aparece no App
- [ ] Verifique se o `db.php` tem credenciais corretas
- [ ] Verifique se a tabela `app_data` existe (execute SQL acima)
- [ ] Verifique o Console do app (Android Logcat)
- [ ] Aumente o tempo de espera para até 5 segundos

### Evento não aparece na Web
- [ ] Limpe o cache (Ctrl+Shift+Del)
- [ ] Verifique se o localStorage está habilitado (F12 → Application → Local Storage)
- [ ] Verifique se `/bcsflows/api/sync.php` está retornando dados

### Erro "payload is empty or invalid"
- [ ] O banco de dados está vazio
- [ ] Execute: `INSERT INTO app_data VALUES (1, JSON_OBJECT('users', JSON_ARRAY()), NOW());`

## 🎯 Teste 6: Usuários

1. Na web, crie um novo usuário em "Configurações"
   - Usuário: `teste123`
   - Senha: `123456`
   - Role: `admin`

2. No app, faça logout
3. Faça login com `teste123` / `123456`
4. **O login deve funcionar** ✅ (dados sincronizaram)

## 📊 Teste 7: Estoque

1. Na web, crie um item de estoque
2. No app, vá para "Estoque"
3. **O item deve aparecer** ✅

## ✨ Teste Completo

Se todos os testes passarem ✅:

1. ✅ Eventos criados na web aparecem no app
2. ✅ Eventos criados no app aparecem na web
3. ✅ Usuários criados na web funcionam no app
4. ✅ Estoque sincroniza entre plataformas
5. ✅ Sincronização é automática (a cada 3 segundos)
6. ✅ Dados persistem após logout/reboot

**Parabéns!** 🎉 Seu sistema está 100% sincronizado!

## 🔧 Debugging Avançado

### Ativar logs completos no App

No `src/utils/storage.js`, mude `const DEBUG = false;` para `const DEBUG = true;` e reconstrua o APK.

### Ver dados brutos do banco

```sql
SELECT payload FROM app_data WHERE id = 1;
```

### Limpar dados e começar do zero

```sql
DELETE FROM app_data WHERE id = 1;
INSERT INTO app_data VALUES (1, '{}', NOW());
```

