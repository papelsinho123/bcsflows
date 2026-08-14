const STORAGE_KEY = 'bcs_flows_data_v1';
const DEBUG = false; // Mude para true para ver logs de sincronização

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

export const readLocalData = (fallback) => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      log('Local storage empty, using fallback');
      return fallback;
    }
    const parsed = JSON.parse(stored);
    log('Loaded from localStorage:', { updatedAt: parsed?.updatedAt, hasUsers: !!parsed?.users?.length });
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch (error) {
    log('Error reading localStorage:', error.message);
    return fallback;
  }
};

export const writeLocalData = (data) => {
  try {
    const snapshot = withTimestamp(data);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    log('Saved to localStorage:', { updatedAt: snapshot.updatedAt, hasUsers: !!snapshot?.users?.length });
  } catch (error) {
    log('Error writing localStorage:', error.message);
  }
};

export const isSameData = (left, right) => JSON.stringify(left) === JSON.stringify(right);

export const mergeAppData = (localData, remoteData) => {
  const localState = localData && typeof localData === 'object' ? localData : {};
  const remoteState = remoteData && typeof remoteData === 'object' ? remoteData : {};

  const localStamp = Number(localState.updatedAt || 0);
  const remoteStamp = Number(remoteState.updatedAt || 0);

  if (!localStamp && !remoteStamp) {
    log('No timestamps, merging both sources');
    return { ...localState, ...remoteState };
  }

  if (!remoteStamp || remoteStamp <= localStamp) {
    log('Using local data (local is newer or remote missing)', { localStamp, remoteStamp });
    return { ...localState, ...remoteState, updatedAt: localStamp || remoteStamp || Date.now() };
  }

  log('Using remote data (remote is newer)', { localStamp, remoteStamp });
  return { ...localState, ...remoteState, updatedAt: remoteStamp };
};

export const loadRemoteData = async (fallback) => {
  const base = getApiBase();

  try {
    log(`Fetching from ${base}/sync.php...`);
    const response = await fetch(`${base}/sync.php`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-cache',
    });

    if (!response.ok) {
      log(`Remote fetch failed with status ${response.status}`);
      return mergeAppData(readLocalData(fallback), null);
    }

    const payload = await response.json();
    const remotePayload = payload && typeof payload === 'object' ? (payload.payload ?? payload) : null;
    
    if (!remotePayload || typeof remotePayload !== 'object') {
      log('Remote payload is empty or invalid');
      return mergeAppData(readLocalData(fallback), null);
    }

    log('Remote data loaded successfully:', { updatedAt: remotePayload?.updatedAt, hasUsers: !!remotePayload?.users?.length });
    return mergeAppData(readLocalData(fallback), remotePayload);
  } catch (error) {
    log('Remote sync error:', error.message);
    return mergeAppData(readLocalData(fallback), null);
  }
};

export const saveRemoteData = async (data) => {
  const base = getApiBase();

  try {
    const snapshot = withTimestamp(data);
    log(`Sending data to ${base}/sync.php...`);
    
    const response = await fetch(`${base}/sync.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snapshot),
    });

    if (!response.ok) {
      log(`Remote save failed with status ${response.status}`);
      const errorText = await response.text();
      log('Error response:', errorText);
      throw new Error('sync_failed');
    }

    const result = await response.json();
    log('Remote save successful:', result);
  } catch (error) {
    log('Remote save error (will retry later):', error.message);
    // Não lance erro - dados continuam salvos localmente e sincronizarão novamente
  }
};

export const persistAppData = async (data) => {
  const snapshot = withTimestamp(data);
  writeLocalData(snapshot);
  await saveRemoteData(snapshot);
  return snapshot;
};
