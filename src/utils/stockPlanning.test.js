import { describe, expect, it } from 'vitest';
import { applyScheduledSectorTransfers, getEffectiveConsumptionDate } from './stockPlanning.js';

describe('getEffectiveConsumptionDate', () => {
  it('uses the mount date minus the configured lead days when the item is marked for mounting', () => {
    const result = getEffectiveConsumptionDate({
      mountDate: '2026-08-22',
      departureDate: '2026-08-20',
      isMounted: true,
      leadDays: 2,
    });

    expect(result).toBe('2026-08-20');
  });

  it('falls back to departure date when the item is not marked', () => {
    const result = getEffectiveConsumptionDate({
      mountDate: '2026-08-22',
      departureDate: '2026-08-20',
      isMounted: false,
      leadDays: 2,
    });

    expect(result).toBe('2026-08-20');
  });
});

describe('applyScheduledSectorTransfers', () => {
  it('moves a pending transfer to the target sector when the transfer date has arrived', () => {
    const items = [
      {
        id: 'source-item',
        name: 'Mesa',
        quantity: 4,
        sector: 'SECRETARIA',
        transferScheduled: true,
        transferDate: '2026-08-09',
        transferTargetSector: 'CAEX',
        transferQuantity: 2,
        transferBatchId: 'batch-1',
      },
      {
        id: 'placeholder-item',
        name: 'Mesa',
        quantity: 2,
        sector: 'CAEX',
        isTransferPlaceholder: true,
        transferScheduled: true,
        transferDate: '2026-08-09',
        transferTargetSector: 'CAEX',
        transferQuantity: 2,
        transferBatchId: 'batch-1',
      },
    ];

    const result = applyScheduledSectorTransfers({ items }, new Date('2026-08-09'));

    expect(result).toHaveLength(2);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'source-item',
          sector: 'SECRETARIA',
          quantity: 2,
          transferApplied: true,
        }),
        expect.objectContaining({
          id: 'placeholder-item',
          sector: 'CAEX',
          quantity: 2,
          transferApplied: true,
        }),
      ]),
    );
  });
});
