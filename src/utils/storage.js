const STORAGE_KEY = 'bcs_flows_data_v1';

const getApiBase = () => {
  const fromWindow = typeof window !== 'undefined' ? window.__BCS_API_BASE__ : undefined;
  return import.meta.env.VITE_API_BASE || fromWindow || '/bcsflows/api';
};

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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    // ignore storage errors in restricted environments
  }
};

export const isSameData = (left, right) => JSON.stringify(left) === JSON.stringify(right);

export const loadRemoteData = async (fallback) => {
  const base = getApiBase();

  try {
    const response = await fetch(`${base}/sync.php`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      return readLocalData(fallback);
    }

    const payload = await response.json();
    if (!payload || typeof payload !== 'object') {
      return readLocalData(fallback);
    }

    return payload.payload ?? payload;
  } catch (error) {
    return readLocalData(fallback);
  }
};

export const saveRemoteData = async (data) => {
  const base = getApiBase();

  try {
    const response = await fetch(`${base}/sync.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error('sync_failed');
    }
  } catch (error) {
    // ignore remote write failures and keep local persistence
  }
};

export const persistAppData = async (data) => {
  writeLocalData(data);
  await saveRemoteData(data);
};
