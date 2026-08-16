import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import EventBoard from './EventBoard.jsx';

describe('EventBoard', () => {
  it('renders the event selector without crashing when there are no events', () => {
    expect(() => renderToStaticMarkup(
      <EventBoard
        events={[]}
        inventory={[]}
        config={{ itemTypes: [], proposalItemTypes: [], defaultItems: [] }}
        users={[]}
        user={{ id: 1, role: 'admin', name: 'Admin' }}
        onEventsChange={() => {}}
      />
    )).not.toThrow();
  });

  it('ignores malformed legacy events that do not have a valid boards structure', () => {
    expect(() => renderToStaticMarkup(
      <EventBoard
        events={[null, undefined, { id: 1, name: 'Evento Legacy', status: 'A Iniciar', departureDate: '2026-08-10', returnDate: '2026-08-15' }, 'bad-entry']}
        inventory={[]}
        config={{ itemTypes: [], proposalItemTypes: [], defaultItems: [] }}
        users={[]}
        user={{ id: 1, role: 'admin', name: 'Admin' }}
        onEventsChange={() => {}}
      />
    )).not.toThrow();
  });

  it('renders a valid event even when board arrays are missing or empty', () => {
    expect(() => renderToStaticMarkup(
      <EventBoard
        events={[{
          id: 42,
          name: 'Evento sem boards',
          status: 'A Iniciar',
          departureDate: '2026-08-10',
          returnDate: '2026-08-15',
          users: [],
          userAssignments: [],
          boards: {},
        }]}
        inventory={[]}
        config={{ itemTypes: ['NOTEBOOK'], proposalItemTypes: [], defaultItems: [] }}
        users={[]}
        user={{ id: 1, role: 'admin', name: 'Admin' }}
        onEventsChange={() => {}}
      />
    )).not.toThrow();
  });

  it('renders event names in the selector from the synced payload', () => {
    const markup = renderToStaticMarkup(
      <EventBoard
        events={[{
          id: 101,
          name: 'ExpoShop 2026',
          status: 'A Iniciar',
          departureDate: '2026-08-20',
          returnDate: '2026-08-24',
          users: [],
          userAssignments: [],
          boards: {
            info: {},
            montagem: [],
            desmontagem: [],
            hospedagem: [],
            deslocamento: [],
            separar: [],
          },
        }]}
        inventory={[]}
        config={{ itemTypes: [], proposalItemTypes: [], defaultItems: [] }}
        users={[]}
        user={{ id: 1, role: 'master', name: 'Admin' }}
        onEventsChange={() => {}}
      />
    );

    expect(markup).toContain('ExpoShop 2026');
  });
});
