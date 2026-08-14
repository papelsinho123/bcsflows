const STORAGE_KEY = 'bcs_flows_data_v1';
const DEBUG = false; // Mude para true para ver logs

const getApiBase = () => {
  const fromWindow = typeof window !== 'undefined' ? window.__BCS_API_BASE__ : undefined;
  return import.meta.env.VITE_API_BASE || fromWindow || '/bcsflows/api';
};

const withTimestamp = (data) => ({
  ...(data && typeof data === 'object' ? data : {}),
  updatedAt: Number(data?.updatedAt || Date.now()),
});

const log = (...args) => {
  if (DEBUG) {
    console.log('[BCS Sync]', ...args);
  }
};

// Sincronização SEMPRE com servidor, não confia em localStorage
export const loadServerData = async () => {
  const base = getApiBase();
  const endpoints = [`${base}/sync-simple.php`, `${base}/sync.php`];

  for (const endpoint of endpoints) {
    try {
      log(`📡 Carregando de ${endpoint}...`);
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
      });

      if (!response.ok) {
        log(`❌ ${endpoint} retornou ${response.status}`);
        continue;
      }

      const payload = await response.json();
      const remotePayload = payload?.payload || payload;

      if (!remotePayload || typeof remotePayload !== 'object') {
        log(`❌ ${endpoint} payload vazio`);
        continue;
      }

      log(`✅ ${endpoint} carregou com sucesso`, {
        users: remotePayload?.users?.length,
        events: remotePayload?.events?.length,
      });

      return remotePayload;
    } catch (error) {
      log(`❌ Erro em ${endpoint}: ${error.message}`);
      continue;
    }
  }

  log('⚠️ Nenhum servidor respondeu');
  return null;
};

// Salvar no servidor (SÍNCRONO, não falha silenciosamente)
export const saveToServer = async (data) => {
  const base = getApiBase();
  const endpoints = [`${base}/sync-simple.php`, `${base}/sync.php`];

  const snapshot = withTimestamp(data);

  for (const endpoint of endpoints) {
    try {
      log(`📤 Salvando em ${endpoint}...`);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(snapshot),
      });

      if (!response.ok) {
        log(`❌ ${endpoint} retornou ${response.status}`);
        continue;
      }

      const result = await response.json();
      log(`✅ ${endpoint} salvou com sucesso`);
      return true;
    } catch (error) {
      log(`❌ Erro ao salvar em ${endpoint}: ${error.message}`);
      continue;
    }
  }

  console.error('⚠️ Não foi possível salvar no servidor! Dados podem estar desincronizados.');
  return false;
};

// Sincronizar com servidor (trazer dados mais novos)
export const syncWithServer = async (currentData) => {
  const serverData = await loadServerData();
  if (!serverData) return currentData;

  const localStamp = Number(currentData?.updatedAt || 0);
  const serverStamp = Number(serverData?.updatedAt || 0);

  // Se servidor tem dados mais novos, usar servidor
  if (serverStamp > localStamp) {
    log(`🔄 Servidor tem dados mais novos (${serverStamp} > ${localStamp})`);
    return { ...currentData, ...serverData, updatedAt: serverStamp };
  }

  return currentData;
};

// Usar apenas para migração, não para estado inicial
export const readLocalData = (fallback) => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return fallback;
    const parsed = JSON.parse(stored);
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch (error) {
    return fallback;
  }
};

export const writeLocalData = (data) => {
  try {
    const snapshot = withTimestamp(data);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch (error) {
    log('Erro ao escrever localStorage:', error.message);
  }
};

export const isSameData = (left, right) => JSON.stringify(left) === JSON.stringify(right);
