const STORAGE_KEY = 'bcs_flows_data_v1';

const getRemoteConfig = () => {
  const fromWindow = typeof window !== 'undefined' ? window.__BCS_DB__ : undefined;
  const envUrl = import.meta.env.VITE_SUPABASE_URL || fromWindow?.url;
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY || fromWindow?.anonKey;
  const table = import.meta.env.VITE_BCS_TABLE_NAME || fromWindow?.table || 'bcs_flows_data';

  if (!envUrl || !envKey) return null;

  return {
    url: String(envUrl).replace(/\/$/, ''),
    anonKey: String(envKey),
    table: String(table),
  };
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

export const loadRemoteData = async (fallback) => {
  const config = getRemoteConfig();

  if (!config) {
    return readLocalData(fallback);
  }

  try {
    const response = await fetch(`${config.url}/rest/v1/${config.table}?select=id,payload&limit=1`, {
      method: 'GET',
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return readLocalData(fallback);
    }

    const rows = await response.json();
    const payload = rows?.[0]?.payload;
    if (!payload) {
      return readLocalData(fallback);
    }

    return JSON.parse(payload);
  } catch (error) {
    return readLocalData(fallback);
  }
};

export const saveRemoteData = async (data) => {
  const config = getRemoteConfig();

  if (!config) {
    return;
  }

  try {
    const response = await fetch(`${config.url}/rest/v1/${config.table}?select=id&limit=1`, {
      method: 'GET',
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return;
    }

    const rows = await response.json();
    const payload = JSON.stringify(data);

    const method = rows?.[0]?.id ? 'PATCH' : 'POST';
    const endpoint = rows?.[0]?.id
      ? `${config.url}/rest/v1/${config.table}?id=eq.${rows[0].id}`
      : `${config.url}/rest/v1/${config.table}`;

    await fetch(endpoint, {
      method,
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({ payload }),
    });
  } catch (error) {
    // ignore remote write failures and keep local persistence
  }
};

export const persistAppData = async (data) => {
  writeLocalData(data);
  await saveRemoteData(data);
};
