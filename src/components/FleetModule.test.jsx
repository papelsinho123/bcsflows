import { describe, expect, it } from 'vitest';
import { buildFleetReport, formatDatePtBR, getFleetMaintenanceAlerts, normalizeFleetVehicle } from './FleetModule.jsx';

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

  it('formats dates with day-month-year Brazilian order', () => {
    expect(formatDatePtBR('2026-08-16')).toBe('16/08/2026');
    expect(formatDatePtBR('')).toBe('');
  });

  it('reports overdue scheduled maintenance with vehicle details', () => {
    const alerts = getFleetMaintenanceAlerts([
      {
        id: 'vehicle-1',
        name: 'Van 02',
        plate: 'XYZ-9988',
        status: 'Em manutenção',
        scheduledMaintenance: {
          type: 'Troca de óleo',
          dueDate: '2026-08-01',
          location: 'Oficina Central',
        },
      },
    ], '2026-08-16');

    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toContain('Van 02');
    expect(alerts[0]).toContain('Troca de óleo');
    expect(alerts[0]).toContain('Oficina Central');
  });
});
