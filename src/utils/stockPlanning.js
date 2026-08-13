export const getEffectiveConsumptionDate = ({ mountDate, departureDate, laterDelivery = false, leadDays = 1 }) => {
  if (!laterDelivery) {
    return departureDate || '';
  }

  const baseDate = mountDate || departureDate || '';
  if (!baseDate) return departureDate || '';

  const parsedDate = new Date(baseDate);
  if (Number.isNaN(parsedDate.getTime())) {
    return baseDate;
  }

  parsedDate.setDate(parsedDate.getDate() - (Number(leadDays) || 1));
  return parsedDate.toISOString().slice(0, 10);
};

const normalizeDateOnly = (value) => {
  if (!value) return null;

  if (value instanceof Date) {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  const text = String(value).trim();
  const dateOnlyMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    const parsed = new Date(Number(year), Number(month) - 1, Number(day));
    parsed.setHours(0, 0, 0, 0);
    return parsed;
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  parsed.setHours(0, 0, 0, 0);
  return parsed;
};

export const isTransferActiveOnDate = ({ transferDate, currentDate = new Date() }) => {
  if (!transferDate) return true;

  const normalizedTransferDate = normalizeDateOnly(transferDate);
  const normalizedCurrentDate = normalizeDateOnly(currentDate);
  if (!normalizedTransferDate || !normalizedCurrentDate) {
    return true;
  }

  return normalizedTransferDate <= normalizedCurrentDate;
};

export const applyScheduledSectorTransfers = ({ items = [], currentDate = new Date() } = {}) => {
  const normalizedCurrentDate = new Date(currentDate);
  normalizedCurrentDate.setHours(0, 0, 0, 0);

  const batches = (items || []).filter((item) => item?.transferScheduled && item?.transferDate && item?.transferBatchId);
  const appliedBatches = new Set();

  const nextItems = [];

  for (const item of items || []) {
    if (!item?.transferScheduled || !item?.transferDate || !item?.transferBatchId) {
      nextItems.push(item);
      continue;
    }

    const transferDate = new Date(item.transferDate);
    if (Number.isNaN(transferDate.getTime())) {
      nextItems.push(item);
      continue;
    }

    transferDate.setHours(0, 0, 0, 0);
    if (transferDate > normalizedCurrentDate) {
      nextItems.push(item);
      continue;
    }

    if (appliedBatches.has(item.transferBatchId)) {
      continue;
    }

    appliedBatches.add(item.transferBatchId);

    const batchItems = batches.filter((entry) => entry.transferBatchId === item.transferBatchId);
    const sourceItem = batchItems.find((entry) => !entry.isTransferPlaceholder);
    const placeholderItem = batchItems.find((entry) => entry.isTransferPlaceholder);

    if (sourceItem) {
      const remainingQuantity = Math.max(0, Number(sourceItem.quantity || 0) - Number(sourceItem.transferQuantity || sourceItem.quantity || 1));
      if (remainingQuantity > 0) {
        nextItems.push({
          ...sourceItem,
          quantity: remainingQuantity,
          transferApplied: true,
          transferPending: false,
          transferAppliedAt: item.transferDate,
        });
      }
    }

    if (placeholderItem) {
      nextItems.push({
        ...placeholderItem,
        quantity: Number(placeholderItem.transferQuantity || placeholderItem.quantity || 1),
        transferApplied: true,
        transferPending: false,
        transferAppliedAt: item.transferDate,
      });
    }
  }

  return nextItems;
};
