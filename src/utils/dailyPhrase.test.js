import { describe, expect, it } from 'vitest';
import { getDailyPhrase } from './dailyPhrase.js';

describe('getDailyPhrase', () => {
  it('keeps the same phrase for the same date', () => {
    const rows = [
      { frase: 'Primeira frase', autor: 'BCS' },
      { frase: 'Segunda frase', autor: 'BCS' },
      { frase: 'Terceira frase', autor: 'BCS' },
    ];

    const date = new Date('2026-08-13T12:00:00');

    expect(getDailyPhrase(rows, date)).toEqual(getDailyPhrase(rows, date));
  });

  it('changes phrase when the day changes', () => {
    const rows = [
      { frase: 'Primeira frase', autor: 'BCS' },
      { frase: 'Segunda frase', autor: 'BCS' },
      { frase: 'Terceira frase', autor: 'BCS' },
    ];

    const dayOne = new Date('2026-08-13T12:00:00');
    const dayTwo = new Date('2026-08-14T12:00:00');

    expect(getDailyPhrase(rows, dayOne)).not.toEqual(getDailyPhrase(rows, dayTwo));
  });
});
