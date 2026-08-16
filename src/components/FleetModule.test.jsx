import { describe, expect, it } from 'vitest';
import { buildFleetReport, normalizeFleetVehicle } from './FleetModule.jsx';

describe('FleetModule', () => {
  it('normalizes vehicle data and preserves maintenance history', () => {
    const vehicle = normalizeFleetVehicle({
      id: 'fleet-1',
      name: 'Caminhão 01',
      plate: 'ABC-1234',
      brand: 'Mercedes',
      model: 'Actros',
      year: 2022,
      currentOdometer: 120000,
      status: 'Ativo',
      maintenanceHistory: [{ id: 'm-1', date: '2026-08-01', type: 'Troca de óleo', description: 'Óleo trocado' }],
    });

    expect(vehicle).toMatchObject({
      name: 'Caminhão 01',
      plate: 'ABC-1234',
      status: 'Ativo',
      maintenanceHistory: [{ type: 'Troca de óleo', description: 'Óleo trocado' }],
    });
  });

  it('builds a printable maintenance report for a vehicle', () => {
    const report = buildFleetReport({
      name: 'Caminhão 01',
      plate: 'ABC-1234',
      maintenanceHistory: [
        { date: '2026-08-01', type: 'Troca de óleo', description: 'Troca de óleo e filtro', cost: 450 },
        { date: '2026-08-15', type: 'Revisão', description: 'Revisão geral', cost: 980 },
      ],
    });

    expect(report).toContain('Caminhão 01');
    expect(report).toContain('Troca de óleo');
    expect(report).toContain('Revisão');
  });
});
