# ✅ App e Web AGORA Compartilham a Mesma Base!

## 🔧 O Que Mudou (Solução Real)

A partir de agora, **App e Web usam os mesmos dados**, não localStorage isolado.

### Antes ❌
```
App: usa localStorage do WebView
Web: usa localStorage do navegador
Resultado: DADOS DIFERENTES!
```

### Agora ✅
```
App: sincroniza COM SERVIDOR
Web: sincroniza COM SERVIDOR
Servidor: `/bcsflows/api/sync-simple.php` (arquivo JSON compartilhado)
Resultado: DADOS IGUAIS EM TUDO!
```

## 🚀 Como Usar

### 1. Inicie o Web App

```bash
cd c:\Users\Anderson Siebre\Desktop\bcs-flows
npm run dev
```

Abra: http://localhost:4173/bcsflows/

### 2. Login

- **Usuário**: `admin` (não email!)
- **Senha**: `admin`

### 3. Teste: Criar Evento na Web

1. Va para "Eventos"
2. Crie: "Teste Sincronização 001"
3. **Salve**

### 4. Abra SEGUNDA ABA do navegador

http://localhost:4173/bcsflows/

Login novamente.

### 5. **Sem recarregar**, em até 2 segundos

O evento "Teste Sincronização 001" **APARECE AUTOMATICAMENTE** ✅

## 📱 Testar com App Android

```bash
# Instalar no emulador
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

### Na Web: Crie novo evento "Teste Mobile"
### No App: Aguarde 2 segundos
### **Evento aparece no app!** ✅

## 📊 O Que Sincroniza

✅ **Eventos** - Criados em app aparecem na web  
✅ **Usuários** - Novo usuário em web funciona no app  
✅ **Estoque** - Mudanças sincronizam instantaneamente  
✅ **Configurações** - Alterações refletem em todos os locais  

## 🔍 Como Funciona

1. **Ao abrir** a aba/app → Carrega dados do servidor
2. **Ao fazer mudança** → Salva IMEDIATAMENTE no servidor
3. **A cada 2 segundos** → Sincroniza com servidor
4. **Se outra aba/app muda** → Você vê em até 2 segundos

## ⚠️ Importante

❌ **NÃO USE**: `admin@bcs.com`  
✅ **USE**: `admin`

## 📁 Arquivo Compartilhado

Todos os dados estão em:  
`api/app_data.json`

Você pode ver/editar diretamente se quiser testar!

## ✨ Resultado Final

- ✅ Web cria evento → App vê em 2 segundos
- ✅ App cria evento → Web vê em 2 segundos  
- ✅ Novo usuário na web → Pode fazer login no app
- ✅ Estoque alterado → Sincroniza em todos os lugares
- ✅ **TUDO SINCRONIZA AUTOMATICAMENTE!**

Agora você tem um sistema REAL de compartilhamento de dados! 🎉

