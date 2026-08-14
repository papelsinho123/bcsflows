import fs from 'node:fs';
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

  it('does not crash when the user payload is malformed', () => {
    expect(() => findUserByCredentials({ users: null }, 'andersonsiebre', 'anderson1')).not.toThrow();
    expect(findUserByCredentials({ users: null }, 'andersonsiebre', 'anderson1')).toBeUndefined();
  });

  it('normalizes mixed-case roles so master/admin permissions are not lost', () => {
    const users = [
      { id: 1, usuario: 'andersonsiebre', password: 'anderson1', role: 'MASTER', name: 'Anderson Siebre' },
      { id: 2, usuario: 'admin', password: 'admin', role: 'Admin', name: 'Administrador' },
    ];

    const master = findUserByCredentials(users, 'andersonsiebre', 'anderson1');
    const admin = findUserByCredentials(users, 'admin', 'admin');

    expect(master?.role).toBe('master');
    expect(admin?.role).toBe('admin');
  });

  it('maps the database bootstrap to login columns expected by the app', () => {
    const sql = fs.readFileSync(new URL('../../create_usuarios.sql', import.meta.url), 'utf8');

    expect(sql.toLowerCase()).toContain('usuario');
    expect(sql.toLowerCase()).toContain('password');
    expect(sql.toLowerCase()).toContain('role');
    expect(sql.toLowerCase()).toContain('andersonsiebre');
    expect(sql.toLowerCase()).toContain('admin');
  });
});
