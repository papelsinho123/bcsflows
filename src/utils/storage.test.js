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

  it('preserves local records when a newer remote payload is incomplete or empty', () => {
    const local = {
      updatedAt: 100,
      users: [{ id: 1, name: 'Anderson' }],
      events: [{ id: 9, name: 'Evento local' }],
      inventory: [{ id: 4, name: 'Impressora' }],
      config: {
        itemTypes: ['IMPRESSORA TÉRMICA'],
        nfContact: { name: 'Contato local' },
      },
    };

    const remote = {
      updatedAt: 200,
      users: [],
      events: [],
      inventory: [],
      config: {
        itemTypes: [],
        nfContact: {},
      },
    };

    const result = mergeAppData(local, remote);

    expect(result.users).toEqual(local.users);
    expect(result.events).toEqual(local.events);
    expect(result.inventory).toEqual(local.inventory);
    expect(result.config.itemTypes).toEqual(local.config.itemTypes);
    expect(result.config.nfContact).toEqual(local.config.nfContact);
  });

  it('accepts a complete remote payload even when updatedAt is missing', () => {
    const local = { users: [{ id: 1, name: 'Old' }], events: [], inventory: [], config: {} };
    const remote = { users: [{ id: 1, name: 'New' }], events: [], inventory: [], config: {} };

    const result = mergeAppData(local, remote);

    expect(result.users).toEqual(remote.users);
    expect(result.events).toEqual(remote.events);
    expect(result.inventory).toEqual(remote.inventory);
    expect(result.updatedAt).toBeTypeOf('number');
  });

  it('keeps the local state when the remote payload is content-equal but timestamped later', () => {
    const local = {
      updatedAt: 100,
      users: [{ id: 1, name: 'Ana' }],
      events: [{ id: 7, name: 'Evento igual' }],
      inventory: [{ id: 2, name: 'Gerador' }],
      config: { itemTypes: ['GERADOR'] },
    };

    const remote = {
      updatedAt: 200,
      users: [{ id: 1, name: 'Ana' }],
      events: [{ id: 7, name: 'Evento igual' }],
      inventory: [{ id: 2, name: 'Gerador' }],
      config: { itemTypes: ['GERADOR'] },
    };

    const result = mergeAppData(local, remote);

    expect(result).toEqual(local);
  });
});
