import { describe, expect, it } from 'vitest';
import { canRemovePaymentType } from './SettingsModule.jsx';

describe('canRemovePaymentType', () => {
  it('blocks removal when the payment type is used by an existing expense', () => {
    const events = [{
      id: 1,
      name: 'Evento 1',
      finances: [{ id: 'f-1', paymentType: 'PIX' }],
    }];

    expect(canRemovePaymentType('PIX', events)).toBe(false);
  });

  it('allows removal when the payment type is not used by any expense', () => {
    const events = [{
      id: 1,
      name: 'Evento 1',
      finances: [{ id: 'f-1', paymentType: 'CARTÃO' }],
    }];

    expect(canRemovePaymentType('PIX', events)).toBe(true);
  });
});
