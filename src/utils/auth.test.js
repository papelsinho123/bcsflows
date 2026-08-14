import { describe, expect, it } from 'vitest';
import { findUserByCredentials } from './auth.js';

describe('findUserByCredentials', () => {
  it('authenticates using the usuario field and password', () => {
    const users = [
      { id: 1, usuario: 'andersonsiebre', password: 'anderson1', role: 'master', name: 'Anderson Siebre' },
      { id: 2, usuario: 'admin', password: 'admin', role: 'admin', name: 'Administrador' },
    ];

    expect(findUserByCredentials(users, 'andersonsiebre', 'anderson1')).toEqual(users[0]);
  });

  it('does not authenticate by email when usuario is required', () => {
    const users = [
      { id: 1, usuario: 'andersonsiebre', email: 'andersonsiebre@bcs.com', password: 'anderson1', role: 'master', name: 'Anderson Siebre' },
    ];

    expect(findUserByCredentials(users, 'andersonsiebre@bcs.com', 'anderson1')).toBeUndefined();
  });
});
