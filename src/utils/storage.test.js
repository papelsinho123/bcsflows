import { describe, expect, it } from 'vitest';
import { mergeAppData } from './storage.js';

describe('mergeAppData', () => {
  it('keeps the newest state when local and remote versions differ', () => {
    const local = {
      updatedAt: 100,
      users: [{ id: 1, name: 'Local' }],
      events: [],
      inventory: [],
      config: { nfContact: { name: 'Local' } },
    };

    const remote = {
      updatedAt: 200,
      users: [{ id: 1, name: 'Remote' }],
      events: [{ id: 2, name: 'Evento remoto' }],
      inventory: [{ id: 3, name: 'Item remoto' }],
      config: { nfContact: { name: 'Remote' } },
    };

    expect(mergeAppData(local, remote)).toMatchObject({
      users: [{ id: 1, name: 'Remote' }],
      events: [{ id: 2, name: 'Evento remoto' }],
      inventory: [{ id: 3, name: 'Item remoto' }],
      config: { nfContact: { name: 'Remote' } },
    });
  });

  it('preserves newest data when updatedAt is missing', () => {
    const local = { users: [{ id: 1, name: 'Old' }], events: [], inventory: [], config: {} };
    const remote = { users: [{ id: 1, name: 'New' }], events: [], inventory: [], config: {} };

    expect(mergeAppData(local, remote)).toEqual(remote);
  });
});
