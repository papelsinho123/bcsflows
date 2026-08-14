const STORAGE_KEY = 'bcs_flows_data_v1';

const getApiBase = () => {
  const fromWindow = typeof window !== 'undefined' ? window.__BCS_API_BASE__ : undefined;
  return import.meta.env.VITE_API_BASE || fromWindow || '/bcsflows/api';
};

const withTimestamp = (data) => ({
  ...(data && typeof data === 'object' ? data : {}),
  updatedAt: Number(data?.updatedAt || Date.now()),
});

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
    // ignore storage errors in restricted environments
  }
};

export const isSameData = (left, right) => JSON.stringify(left) === JSON.stringify(right);

export const mergeAppData = (localData, remoteData) => {
  const localState = localData && typeof localData === 'object' ? localData : {};
  const remoteState = remoteData && typeof remoteData === 'object' ? remoteData : {};

  const localStamp = Number(localState.updatedAt || 0);
  const remoteStamp = Number(remoteState.updatedAt || 0);

  if (!localStamp && !remoteStamp) {
    return { ...localState, ...remoteState };
  }

  if (!remoteStamp || remoteStamp <= localStamp) {
    return { ...localState, ...remoteState, updatedAt: localStamp || remoteStamp || Date.now() };
  }

  return { ...localState, ...remoteState, updatedAt: remoteStamp };
};

export const loadRemoteData = async (fallback) => {
  const base = getApiBase();

  try {
    const response = await fetch(`${base}/sync.php`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      return mergeAppData(readLocalData(fallback), null);
    }

    const payload = await response.json();
    const remotePayload = payload && typeof payload === 'object' ? (payload.payload ?? payload) : null;
    if (!remotePayload || typeof remotePayload !== 'object') {
      return mergeAppData(readLocalData(fallback), null);
    }

    return mergeAppData(readLocalData(fallback), remotePayload);
  } catch (error) {
    return mergeAppData(readLocalData(fallback), null);
  }
};

export const saveRemoteData = async (data) => {
  const base = getApiBase();

  try {
    const snapshot = withTimestamp(data);
    const response = await fetch(`${base}/sync.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snapshot),
    });

    if (!response.ok) {
      throw new Error('sync_failed');
    }
  } catch (error) {
    // ignore remote write failures and keep local persistence
  }
};

export const persistAppData = async (data) => {
  const snapshot = withTimestamp(data);
  writeLocalData(snapshot);
  await saveRemoteData(snapshot);
  return snapshot;
};
