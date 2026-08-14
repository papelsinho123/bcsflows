import { describe, expect, it } from 'vitest';
import { findUserByCredentials } from './auth.js';

describe('findUserByCredentials', () => {
  it('authenticates using username and password', () => {
    const users = [
      { id: 1, username: 'andersonsiebre', password: 'anderson1', role: 'master', name: 'Anderson Siebre' },
      { id: 2, username: 'admin', password: 'admin', role: 'admin', name: 'Administrador' },
    ];

    expect(findUserByCredentials(users, 'andersonsiebre', 'anderson1')).toEqual(users[0]);
  });
});
