# 📡 Configuração de Sincronização Entre App e Web

## 🔴 Problema Atual
- **App Android** e **Web App** compartilham o mesmo código React
- Mas usam `localStorage` **isolado** (web usa navegador, app usa WebView)
- Servidor de sincronização (`api/sync.php`) não tem **credenciais do banco de dados**
- Resultado: Dados não sincronizam entre plataformas

## ✅ Solução

### 1️⃣ Configurar Banco de Dados

Você PRECISA preencher as credenciais do banco no arquivo `api/db.php`:

```php
// api/db.php
$db_host = 'seu-host.com.br';      // Ex: mysql123.locaweb.com.br
$db_user = 'seu_usuario';          // Usuário do painel Locaweb
$db_pass = 'sua_senha';            // Senha do painel Locaweb
$db_name = 'seu_banco';            // Nome do banco de dados
```

### 2️⃣ Criar Tabela no Banco (se não existir)

Execute o SQL no seu banco de dados:

```sql
CREATE TABLE IF NOT EXISTS app_data (
  id INT PRIMARY KEY DEFAULT 1,
  payload JSON NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 3️⃣ Variáveis de Ambiente (Opcional)

Crie um arquivo `.env` na raiz do projeto:

```
VITE_API_BASE=https://seu-dominio.com.br/bcsflows/api
```

### 4️⃣ Ajustar URL da API no App Android

No arquivo `android/app/src/main/assets/capacitor.config.json`, adicione:

```json
{
  "appId": "com.bcsflows.app",
  "appName": "BCS Flows",
  "webDir": "dist",
  "server": {
    "url": "https://seu-dominio.com.br/bcsflows/"
  }
}
```

## 📋 Como Funciona a Sincronização

1. **Salvar dados**: Quando usuário cria evento, edita usuário, etc.
   - Dados são salvos em `localStorage` local (imediato)
   - Dados são enviados ao servidor via `POST /bcsflows/api/sync.php`
   - Servidor salva no banco de dados

2. **Carregar dados**: Ao abrir app ou web
   - Carrega dados do `localStorage` local
   - Faz `GET /bcsflows/api/sync.php` para sincronizar com servidor
   - Mescla dados (usa timestamp mais recente para resolver conflitos)

3. **Sincronização contínua**: A cada 5 segundos (no app e web)
   - Verifica se há dados novos no servidor
   - Atualiza a tela se houver alterações

## 🧪 Teste de Sincronização

1. **Web App**: Acesse http://localhost:4173 e crie um evento
2. **Verificar no banco**: 
   ```sql
   SELECT * FROM app_data WHERE id = 1;
   ```
3. **App Android**: Abra o app e veja se o evento aparece
4. **Criar no app**: Crie outro evento no app
5. **Verificar na web**: Atualize a página web e veja o novo evento

## ⚠️ Importante

- Não comite o arquivo `api/db.php` com as credenciais reais (está no `.gitignore`)
- A sincronização depende da **conexão com o servidor**
- Se o servidor não responder, os dados continuam salvos localmente
- A cada 5 segundos, o app/web tenta sincronizar novamente

## 🔗 URLs Utilizadas

- **Web Local**: http://localhost:4173/bcsflows/
- **API Local**: http://localhost:4173/bcsflows/api/sync.php
- **API Produção**: https://seu-dominio.com.br/bcsflows/api/sync.php

## 📞 Debugging

Se a sincronização não funcionar:

1. Verifique o `console.log` da web (F12 → Console)
2. Verifique se o banco de dados está acessível
3. Verifique o `api/db.php` - as credenciais devem estar corretas
4. Verifique os logs do servidor (SSH/FTP)

