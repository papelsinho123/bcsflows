import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, 'api', 'app_data.json');

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

// Middleware de sincronização
const syncMiddleware = (req, res, next) => {
  if (req.url === '/bcsflows/api/sync-simple.php') {
    if (req.method === 'GET') {
      try {
        initializeDataFile();
        const content = fs.readFileSync(DATA_FILE, 'utf-8');
        const payload = JSON.parse(content);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ payload }));
      } catch (error) {
        console.error('❌ Erro ao ler dados:', error.message);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ payload: null }));
      }
    } else if (req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (!data.updatedAt) {
            data.updatedAt = Date.now();
          }
          fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
          fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
          console.log(`✅ Dados salvos (${new Date().toLocaleTimeString()})`);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, saved: true, timestamp: data.updatedAt }));
        } catch (error) {
          console.error('❌ Erro ao salvar dados:', error.message);
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'Failed to save data' }));
        }
      });
    } else if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.end();
    }
    return;
  }
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
};

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 4173,
    host: '0.0.0.0',
    middleware: [syncMiddleware],
  },
  preview: {
    port: 4173,
    host: '0.0.0.0',
  },
});
