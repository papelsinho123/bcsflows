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
});
