# 🔄 Solução: Sincronização App ↔ Web

## 📌 O Problema

O app Android e a web app compartilham o **mesmo código React**, mas não compartilham dados:

- ❌ Evento criado na web **não aparece** no app
- ❌ Evento criado no app **não aparece** na web
- ❌ Logo diferente entre app e web
- ❌ Cada plataforma tem seus próprios dados isolados

## 🔍 Causa Raiz

1. **localStorage Isolado**: Web usa localStorage do navegador, app usa WebView isolado
2. **Servidor não configurado**: `api/db.php` não tem credenciais do banco de dados
3. **Sincronização silenciosa**: O app tentava sincronizar, mas falhava silenciosamente

## ✅ Solução Implementada

### 1️⃣ Melhorado o Código de Sincronização

**Arquivo**: `src/utils/storage.js`

```javascript
// Agora com logging de debug
const DEBUG = false; // Mude para true para ver logs

// Sincronização mais robusta com tratamento de erros
- loadRemoteData() - Carrega dados do servidor com fallback
- saveRemoteData() - Envia dados ao servidor
- mergeAppData() - Mescla dados locais + remotos usando timestamp
```

### 2️⃣ Sincronização Mais Rápida

**Arquivo**: `src/App.jsx`

```javascript
// Antes: sincronizava a cada 5 segundos
// Agora: 
- Sincroniza a cada 3 segundos
- Sincroniza quando a aba/app volta ao foco (visibilitychange)
- Mescla dados inteligentemente usando timestamp
```

### 3️⃣ Logo Unificado

**Arquivo**: `android/app/src/main/res/values/strings.xml`

```xml
<string name="app_name">BCS Flows</string>
```

Agora o nome do app é "BCS Flows" em ambas as plataformas.

### 4️⃣ Criados Guias de Setup

- ✅ **[SYNC_SETUP.md](./SYNC_SETUP.md)** - Como configurar banco de dados e sincronização
- ✅ **[TEST_SYNC.md](./TEST_SYNC.md)** - Como testar sincronização entre app e web

## 🚀 Próximos Passos (Essencial!)

### Passo 1: Configurar Banco de Dados

Edite o arquivo **`api/db.php`** com suas credenciais reais:

```php
<?php
// api/db.php
$db_host = 'seu-host.locaweb.com.br';  // Do painel Locaweb
$db_user = 'seu_usuario';              // Do painel Locaweb  
$db_pass = 'sua_senha';                // Do painel Locaweb
$db_name = 'seu_banco';                // Do painel Locaweb

// Resto do arquivo...
```

### Passo 2: Criar Tabela no Banco

Execute no phpMyAdmin ou via SSH:

```sql
CREATE TABLE IF NOT EXISTS app_data (
  id INT PRIMARY KEY DEFAULT 1,
  payload JSON NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### Passo 3: Testar a Sincronização

Siga o guia em [TEST_SYNC.md](./TEST_SYNC.md):

1. Crie evento na web
2. Verifique no app (deve aparecer em até 3 segundos)
3. Crie evento no app
4. Recarregue a web (deve aparecer)

### Passo 4: Deploy para Produção

Quando estiver funcionando em desenvolvimento:

1. Upload do `api/db.php` configurado para o servidor Locaweb
2. Reconstruir APK apontando para seu domínio de produção
3. Upload do `dist/` (build web) para o servidor Locaweb
4. Distribuir novo APK

## 📱 APK Atualizado

**Local**: [android/app/build/outputs/apk/release/app-release.apk](./android/app/build/outputs/apk/release/app-release.apk)

**Melhorias**:
- ✅ Sincronização mais rápida (3 segundos)
- ✅ Nome do app: "BCS Flows"
- ✅ Logs de debug melhorados
- ✅ Sincronização ao voltar ao foco
- ✅ Melhor tratamento de erros de conexão

## 🎯 Resultado Final Esperado

Após seguir os passos acima:

✅ Evento criado na web aparece no app em até 3 segundos  
✅ Evento criado no app aparece na web após recarregar  
✅ Usuários criados compartilham entre plataformas  
✅ Estoque sincroniza entre web e app  
✅ Dados persistem após logout/reboot  
✅ Sincronização automática em tempo real  

## 🔧 Debugging

Se algo não funcionar:

1. **Ativar logs**: No `src/utils/storage.js`, mude `DEBUG = true`
2. **Verificar banco**: `SELECT * FROM app_data WHERE id = 1;`
3. **Ver console web**: F12 → Console (procure por `[BCS Sync]`)
4. **Ver logcat app**: `adb logcat | grep Sync`

## 📞 Suporte

Se tiver dúvidas sobre:
- Como configurar banco de dados → Veja [SYNC_SETUP.md](./SYNC_SETUP.md)
- Como testar sincronização → Veja [TEST_SYNC.md](./TEST_SYNC.md)
- Credenciais Locaweb → Contate suporte Locaweb

---

**Status**: ✅ Pronto para sincronização  
**Requerido**: Configurar `api/db.php` com credenciais reais  
**Tempo estimado**: 10 minutos de setup + testes  

