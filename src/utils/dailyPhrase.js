const DAY_IN_MS = 24 * 60 * 60 * 1000;

export const getBucketDate = (date = new Date()) => {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized.getTime();
};

export const getDailyPhrase = (rows = [], date = new Date()) => {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { frase: '', autor: 'BCS Flows' };
  }

  const bucket = getBucketDate(date);
  const index = Math.abs(Math.floor(bucket / DAY_IN_MS)) % rows.length;
  return {
    frase: rows[index]?.frase || '',
    autor: rows[index]?.autor || 'BCS Flows',
  };
};
