# ✅ Como Usar a Sincronização - BCS Flows

## 🚀 Iniciando Rapidamente (Sem Banco de Dados)

A partir de agora, **NÃO é necessário** configurar banco de dados para testar!

O novo sistema funciona assim:
- ✅ **sync-simple.php** = Sincronização sem banco (arquivo JSON)
- ✅ **sync.php** = Sincronização com banco (se configurado)

## 📝 Passo 1: Iniciar o App Web

```bash
cd c:\Users\Anderson Siebre\Desktop\bcs-flows

# Modo desenvolvimento:
npm run dev

# Ou modo produção (usar este para testes finais):
npm run build
npm run preview
```

Acesse: `http://localhost:4173/bcsflows/`

## 🧪 Passo 2: Testar Sincronização Web ↔ Web (Mesma Máquina)

### Abra DUAS ABAS do navegador

**Aba 1**: http://localhost:4173/bcsflows/  
**Aba 2**: http://localhost:4173/bcsflows/

### Login em ambas as abas

- Usuário: `admin` (não email!)
- Senha: `admin`

❌ **NÃO USE**: `admin@bcs.com`  
✅ **USE**: `admin`

### Teste de Sincronização em Tempo Real

**Na Aba 1:**
1. Vá para "Eventos"
2. Crie um novo evento: **"Teste 001"**
3. Salve

**Na Aba 2:**
1. **Sem recarregar a página**, você deve ver em até 3 segundos:
   - O novo evento "Teste 001" aparecendo
   - Se não aparecer, recarregue (F5)

## 📱 Passo 3: Testar Sincronização Web ↔ App

### Abra o App no Emulador

```bash
# Se tiver Android Studio/emulador
cd c:\Users\Anderson Siebre\Desktop\bcs-flows\android
# Installar APK no emulador
adb install -r app/build/outputs/apk/release/app-release.apk
```

### Login no App

- Usuário: `admin`
- Senha: `admin`

### Teste Cross-Platform

**Web** (http://localhost:4173/bcsflows/):
1. Crie evento: **"Teste Web Mobile 001"**

**App**:
1. Vá para "Eventos"
2. Aguarde até 3 segundos
3. **Você deve ver o evento criado na web** ✅

**App**:
1. Crie evento: **"Teste App 001"**

**Web**:
1. Recarregue (F5)
2. **Você deve ver o evento criado no app** ✅

## 🔍 Passo 4: Verificar Sincronização em Tempo Real

### Ativar Logs de Debug

Acesse: http://localhost:4173/test-sync.html

Este página mostra:
- ✅ Dados no localStorage local
- ✅ Conexão com servidor
- ✅ Status do banco de dados
- ✅ Credenciais de teste

## 📊 Teste Completo

Se todos os testes passarem:

| Teste | Status |
|-------|--------|
| Login com usuário `admin` | ✅ |
| Criar evento na web | ✅ |
| Ver evento no app em 3 segundos | ✅ |
| Criar evento no app | ✅ |
| Ver evento na web após F5 | ✅ |
| Criar usuário novo | ✅ |
| Usuário novo consegue fazer login | ✅ |

## ⚠️ Problemas Comuns

### "Erro: Usuário ou senha incorretos"

**Problema**: Usando email em vez de usuário

**Solução**: Use o campo **usuário**, não email!

| Campo | ❌ Errado | ✅ Correto |
|-------|-----------|-----------|
| Login | `admin@bcs.com` | `admin` |
| Senha | `admin` | `admin` |

### "Evento criado na web não aparece no app"

**Problema**: Sincronização não conectou ao servidor

**Solução**:
1. Verifique se `sync-simple.php` está acessível
2. Teste em: http://localhost:4173/bcsflows/api/sync-simple.php
3. Aguarde até 5 segundos (sincronização leva tempo)

### "Evento não aparece mesmo após 5 segundos"

**Solução**:
1. Recarregue o app (puxe para baixo ou reinicie)
2. Verifique o localStorage: Abra DevTools (F12)
3. Vá para Application → Local Storage
4. Procure por `bcs_flows_data_v1`

## 🔧 Modo Debug (Para Desenvolvedores)

No arquivo `src/utils/storage.js`:

```javascript
const DEBUG = false; // Mude para true
```

Depois recompile:

```bash
npm run build
```

Agora verá logs no console:
```
[BCS Sync] Tentando: /bcsflows/api/sync-simple.php...
[BCS Sync] ✅ Sucesso com /bcsflows/api/sync-simple.php
```

## 📋 Credenciais de Teste

Use estas credenciais para testar:

| Usuário | Senha | Permissão |
|---------|-------|-----------|
| `andersonsiebre` | `anderson1` | Master |
| `admin` | `admin` | Admin |
| `user` | `user` | User |

## 🎯 Próximas Etapas (Opcional)

Se quiser banco de dados real para produção:

1. Configure `api/db.php` com credenciais reais
2. Crie a tabela: veja [SYNC_SETUP.md](./SYNC_SETUP.md)
3. O sistema detectará e usará `sync.php` automaticamente

Enquanto isso, **sync-simple.php funciona perfeitamente para desenvolvimento e testes!**

