import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, 'api', 'app_data.json');
const PORT = 3001;

const app = express();
app.use(express.json());

// CORS middleware
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  next();
});

// Inicializar arquivo de dados
const initializeDataFile = () => {
  if (!fs.existsSync(DATA_FILE)) {
    const initialData = {
      updatedAt: Date.now(),
      users: [
        {
          id: 1,
          usuario: 'andersonsiebre',
          username: 'andersonsiebre',
          email: 'andersonsiebre@bcs.com',
          password: 'anderson1',
          role: 'master',
          name: 'Anderson Siebre',
          leaveTaken: 0,
          leaveRuleDays: 7,
        },
        {
          id: 2,
          usuario: 'admin',
          username: 'admin',
          email: 'admin@bcs.com',
          password: 'admin',
          role: 'admin',
          name: 'Administrador BCS',
          leaveTaken: 0,
          leaveRuleDays: 7,
        },
        {
          id: 3,
          usuario: 'user',
          username: 'user',
          email: 'user@bcs.com',
          password: 'user',
          role: 'user',
          name: 'Usuário Padrão',
          leaveTaken: 0,
          leaveRuleDays: 7,
        },
      ],
      inventory: [
        {
          id: 1,
          type: 'IMPRESSORA TÉRMICA',
          name: 'Zebra TLP 2824',
          serial: 'ZBR-1234',
          quantity: 6,
          status: 'Disponível',
        },
        {
          id: 2,
          type: 'COLETOR DE DADOS',
          name: 'Honeywell Dolphin',
          serial: 'HD-1122',
          quantity: 3,
          status: 'Disponível',
        },
        {
          id: 3,
          type: 'LEITOR BARCODE',
          name: 'Motorola LS2208',
          serial: 'MTR-0021',
          quantity: 4,
          status: 'EM MANUTENÇÃO',
        },
        {
          id: 4,
          type: 'NOTEBOOK',
          name: 'Dell Inspiron 15',
          serial: 'DL-5587',
          quantity: 2,
          status: 'Disponível',
        },
      ],
      config: {
        nfContact: {
          name: 'Rafael Sales',
          email: 'nf@bcs.com',
          phone: '+55 (11) 99999-9999',
        },
        itemTypes: [
          'IMPRESSORA TÉRMICA',
          'IMPRESSORA LASER',
          'TOTEM',
          'COLETOR DE DADOS',
          'LEITOR BARCODE',
          'NOTEBOOK',
          'ETIQUETA',
          'RIBBON',
          'ALL IN ONE',
          'CELULAR',
        ],
        proposalItemTypes: [],
        expenseTypes: [],
        paymentTypes: [],
        defaultItems: [
          { id: 1, type: 'IMPRESSORA TÉRMICA', subframe: 'SECRETARIA' },
          { id: 2, type: 'NOTEBOOK', subframe: 'CAEX' },
          { id: 3, type: 'COLETOR DE DADOS', subframe: 'CONTROLE DE ACESSO' },
        ],
      },
      events: [],
    };

    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2));
    console.log('✅ app_data.json criado com dados padrão');
  }
};

// GET /bcsflows/api/sync - Carregar dados
app.get('/bcsflows/api/sync', (req, res) => {
  try {
    initializeDataFile();
    const content = fs.readFileSync(DATA_FILE, 'utf-8');
    const payload = JSON.parse(content);
    res.json({ payload });
  } catch (error) {
    console.error('❌ Erro GET:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /bcsflows/api/sync.php - Carregar dados (alias)
app.get('/bcsflows/api/sync.php', (req, res) => {
  try {
    initializeDataFile();
    const content = fs.readFileSync(DATA_FILE, 'utf-8');
    const payload = JSON.parse(content);
    res.json({ payload });
  } catch (error) {
    console.error('❌ Erro GET:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /bcsflows/api/sync-simple - Carregar dados (alternativo)
app.get('/bcsflows/api/sync-simple', (req, res) => {
  try {
    initializeDataFile();
    const content = fs.readFileSync(DATA_FILE, 'utf-8');
    const payload = JSON.parse(content);
    res.json({ payload });
  } catch (error) {
    console.error('❌ Erro GET sync-simple:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /bcsflows/api/sync-simple.php - Carregar dados (alias)
app.get('/bcsflows/api/sync-simple.php', (req, res) => {
  try {
    initializeDataFile();
    const content = fs.readFileSync(DATA_FILE, 'utf-8');
    const payload = JSON.parse(content);
    res.json({ payload });
  } catch (error) {
    console.error('❌ Erro GET sync-simple:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /bcsflows/api/sync - Salvar dados
app.post('/bcsflows/api/sync', (req, res) => {
  try {
    const data = req.body;
    if (!data.updatedAt) {
      data.updatedAt = Date.now();
    }
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    console.log(`✅ [API] Dados salvos: ${new Date().toLocaleTimeString()}`);
    res.json({ success: true, saved: true, timestamp: data.updatedAt });
  } catch (error) {
    console.error('❌ Erro POST:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /bcsflows/api/sync.php - Salvar dados (alias)
app.post('/bcsflows/api/sync.php', (req, res) => {
  try {
    const data = req.body;
    if (!data.updatedAt) {
      data.updatedAt = Date.now();
    }
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    console.log(`✅ [API] Dados salvos: ${new Date().toLocaleTimeString()}`);
    res.json({ success: true, saved: true, timestamp: data.updatedAt });
  } catch (error) {
    console.error('❌ Erro POST:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /bcsflows/api/sync-simple - Salvar dados (alternativo)
app.post('/bcsflows/api/sync-simple', (req, res) => {
  try {
    const data = req.body;
    if (!data.updatedAt) {
      data.updatedAt = Date.now();
    }
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    console.log(`✅ [API] Dados salvos (sync-simple): ${new Date().toLocaleTimeString()}`);
    res.json({ success: true, saved: true, timestamp: data.updatedAt });
  } catch (error) {
    console.error('❌ Erro POST sync-simple:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /bcsflows/api/sync-simple.php - Salvar dados (alias)
app.post('/bcsflows/api/sync-simple.php', (req, res) => {
  try {
    const data = req.body;
    if (!data.updatedAt) {
      data.updatedAt = Date.now();
    }
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    console.log(`✅ [API] Dados salvos (sync-simple.php): ${new Date().toLocaleTimeString()}`);
    res.json({ success: true, saved: true, timestamp: data.updatedAt });
  } catch (error) {
    console.error('❌ Erro POST sync-simple.php:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✅ API Server rodando em http://localhost:${PORT}`);
  console.log(`📡 Endpoints disponíveis:`);
  console.log(`   - GET/POST  http://localhost:${PORT}/bcsflows/api/sync`);
  console.log(`   - GET/POST  http://localhost:${PORT}/bcsflows/api/sync-simple`);
  console.log(`\n🔗 Configure no front-end: VITE_API_BASE=http://localhost:${PORT}\n`);
});
