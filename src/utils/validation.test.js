import { describe, expect, it } from 'vitest';
import { validateEventForm, validateInventoryForm } from './validation.js';

describe('validateEventForm', () => {
  it('returns missing field errors for incomplete event data', () => {
    const errors = validateEventForm({
      name: '',
      address: '',
      locationName: '',
      clientName: '',
      organizerName: '',
      contact: '',
      departureDate: '',
      startDate: '',
      endDate: '',
      returnDate: ''
    }, []);

    expect(errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'name' }),
    ]));
  });

  it('accepts a complete event payload', () => {
    const errors = validateEventForm({
      name: 'Evento',
      address: 'Rua A',
      locationName: 'Local',
      clientName: 'Cliente',
      organizerName: 'Organizador',
      contact: '11999999999',
      departureDate: '2026-01-01',
      startDate: '2026-01-02',
      endDate: '2026-01-03',
      returnDate: '2026-01-04'
    }, [1]);

    expect(errors).toHaveLength(0);
  });

  it('rejects event dates that are inconsistent', () => {
    const errors = validateEventForm({
      name: 'Evento',
      address: 'Rua A',
      locationName: 'Local',
      clientName: 'Cliente',
      organizerName: 'Organizador',
      contact: '11999999999',
      departureDate: '2026-01-05',
      startDate: '2026-01-03',
      endDate: '2026-01-02',
      returnDate: '2026-01-01'
    }, []);

    expect(errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'departureDate' }),
      expect.objectContaining({ field: 'startDate' }),
      expect.objectContaining({ field: 'returnDate' }),
    ]));
  });

  it('accepts professional arrival before the event start', () => {
    const errors = validateEventForm({
      name: 'Evento',
      address: 'Rua A',
      locationName: 'Local',
      clientName: 'Cliente',
      organizerName: 'Organizador',
      contact: '11999999999',
      departureDate: '2026-01-01',
      startDate: '2026-01-05',
      endDate: '2026-01-06',
      returnDate: '2026-01-07'
    }, [
      { userId: 1, startDate: '2026-01-04' }
    ]);

    expect(errors).toHaveLength(0);
  });
});

describe('validateInventoryForm', () => {
  it('requires type, name and a positive quantity', () => {
    const errors = validateInventoryForm({ type: '', name: '', serial: '', quantity: 0, status: 'Disponível' });

    expect(errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'type' }),
      expect.objectContaining({ field: 'name' }),
      expect.objectContaining({ field: 'quantity' }),
    ]));
  });
});
