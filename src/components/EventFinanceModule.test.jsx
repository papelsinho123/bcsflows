import { describe, expect, it } from 'vitest';
import { matchesEventId } from './EventFinanceModule.jsx';

describe('EventFinanceModule matching', () => {
  it('matches numeric and string event ids consistently', () => {
    expect(matchesEventId(101, '101')).toBe(true);
    expect(matchesEventId('101', 101)).toBe(true);
    expect(matchesEventId(101, 999)).toBe(false);
  });
});
