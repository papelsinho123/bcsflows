import React, { useMemo, useState } from 'react';
import { Calendar, Users, Box, Package, MapPin } from 'lucide-react';

function toDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function toKey(date) {
  if (!date) return '';
  const copy = new Date(date);
  return `${copy.getFullYear()}-${String(copy.getMonth() + 1).padStart(2, '0')}-${String(copy.getDate()).padStart(2, '0')}`;
}

function workdayCount(start, end) {
  if (!start || !end) return 0;
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return 0;
  const diff = Math.round((endDate - startDate) / 86400000);
  return Math.max(diff + 1, 0);
}

function isSameDay(dateA, dateB) {
  if (!dateA || !dateB) return false;
  return dateA.getFullYear() === dateB.getFullYear()
    && dateA.getMonth() === dateB.getMonth()
    && dateA.getDate() === dateB.getDate();
}

function getAssignmentRange(assignment, event) {
  const departure = toDate(assignment.departureDate || assignment.startDate || event.departureDate || event.startDate || event.eventDate);
  const returnDate = toDate(assignment.returnDate || event.returnDate || event.endDate || event.returnDate || event.startDate);
  return { departure, returnDate };
}

function buildProfessionalAssignments(events, users) {
  const dateMap = new Map();
  const userAssignmentsMap = new Map();
  const transportAnnotations = new Map();

  (events || []).forEach((event) => {
    const transportItems = (event.boards?.deslocamento || []).filter((item) => item.transportMode);

    transportItems.forEach((item) => {
      const mode = String(item.transportMode || '').trim();
      const professionalIds = item.professionalIds || [];
      const annotate = (dateValue, kind) => {
        const date = toDate(dateValue);
        if (!date) return;
        const key = toKey(date);
        const existing = transportAnnotations.get(key) || [];
        professionalIds.forEach((userId) => {
          if (!userId) return;
          existing.push({ userId, transportType: mode, transportKind: kind });
        });
        transportAnnotations.set(key, existing);
      };
      annotate(item.departureDate, 'partida');
      annotate(item.returnDate, 'retorno');
    });
  });

  (events || []).forEach((event) => {
    const eventUsers = event.userAssignments && event.userAssignments.length
      ? event.userAssignments
      : (event.users || []).map((userId) => ({ userId }));

    const eventPresenceStart = toDate(event.startDate || event.departureDate || event.eventDate);
    const eventPresenceEnd = toDate(event.endDate || event.returnDate || event.startDate || event.departureDate);

    eventUsers.forEach((assignment) => {
      const { departure, returnDate } = getAssignmentRange(assignment, event);
      const presenceStart = departure || eventPresenceStart;
      const presenceEnd = returnDate || eventPresenceEnd || presenceStart;
      if (!presenceStart || !presenceEnd) return;

      const userId = assignment.userId;
      const user = (users || []).find((u) => String(u.id) === String(userId));
      const userName = user?.name || `Profissional ${userId}`;
      const eventName = event.name || 'Evento sem nome';
      const eventId = event.id;
      const eventType = event.type || 'EVENTO';

      const days = workdayCount(presenceStart, presenceEnd);
      for (let step = 0; step < days; step += 1) {
        const date = new Date(presenceStart);
        date.setDate(presenceStart.getDate() + step);
        const key = toKey(date);
        const transportForDate = (transportAnnotations.get(key) || []).filter((annotation) => String(annotation.userId) === String(userId));
        const transportTypes = Array.from(new Set(transportForDate.map((entry) => entry.transportType)));
        const transportKinds = Array.from(new Set(transportForDate.map((entry) => entry.transportKind)));
        const transportLabels = Array.from(new Set(transportForDate.map((entry) => {
          const kindLabel = entry.transportKind === 'partida' ? 'ida' : entry.transportKind === 'retorno' ? 'volta' : entry.transportKind;
          const transportName = entry.transportType || 'Deslocamento';
          return kindLabel ? `${transportName} (${kindLabel})` : transportName;
        })));

        const existing = dateMap.get(key) || [];
        dateMap.set(key, [...existing, {
          userId,
          userName,
          eventId,
          eventName,
          eventType,
          departure,
          returnDate,
          transportTypes,
          transportKinds,
          transportLabels,
        }]);
      }

      const existingAssignments = userAssignmentsMap.get(userId) || [];
      existingAssignments.push({
        userId,
        userName,
        eventId,
        eventName,
        eventType,
        departure,
        returnDate,
      });
      userAssignmentsMap.set(userId, existingAssignments);
    });
  });

  return { dateMap, userAssignmentsMap };
}

function buildMonthOptions(events) {
  const dateValues = [];
  (events || []).forEach((event) => {
    ['startDate', 'endDate', 'departureDate', 'returnDate', 'eventDate'].forEach((field) => {
      if (event[field]) dateValues.push(event[field]);
    });
  });

  const parsedDates = dateValues
    .map(toDate)
    .filter((date) => date && !Number.isNaN(date.getTime()));

  const today = new Date();
  const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  if (parsedDates.length === 0) {
    return Array.from({ length: 6 }, (_, index) => {
      const month = new Date(currentMonth);
      month.setMonth(currentMonth.getMonth() + index);
      return {
        value: `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`,
        label: month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
      };
    });
  }

  let minMonth = parsedDates[0];
  let maxMonth = parsedDates[0];
  parsedDates.forEach((date) => {
    if (date < minMonth) minMonth = date;
    if (date > maxMonth) maxMonth = date;
  });

  minMonth = new Date(minMonth.getFullYear(), minMonth.getMonth(), 1);
  maxMonth = new Date(maxMonth.getFullYear(), maxMonth.getMonth(), 1);
  if (currentMonth < minMonth) minMonth = currentMonth;
  if (currentMonth > maxMonth) maxMonth = currentMonth;

  const months = [];
  const monthCursor = new Date(minMonth);
  while (monthCursor <= maxMonth) {
    months.push({
      value: `${monthCursor.getFullYear()}-${String(monthCursor.getMonth() + 1).padStart(2, '0')}`,
      label: monthCursor.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
    });
    monthCursor.setMonth(monthCursor.getMonth() + 1);
  }

  return months;
}

function detectProfessionalConflicts(userAssignmentsMap) {
  const conflicts = [];
  const conflictDates = new Set();

  userAssignmentsMap.forEach((assignments, userId) => {
    const sorted = [...assignments].sort((a, b) => a.departure - b.departure);

    for (let i = 0; i < sorted.length; i += 1) {
      for (let j = i + 1; j < sorted.length; j += 1) {
        const first = sorted[i];
        const second = sorted[j];
        if (!first.departure || !first.returnDate || !second.departure || !second.returnDate) continue;

        const overlap = first.departure <= second.returnDate && second.departure <= first.returnDate;
        const boundaryIgnore = isSameDay(first.departure, second.returnDate) || isSameDay(second.departure, first.returnDate);
        if (overlap && !boundaryIgnore) {
          const start = first.departure > second.departure ? first.departure : second.departure;
          const end = first.returnDate < second.returnDate ? first.returnDate : second.returnDate;
          const dayCount = workdayCount(start, end);
          for (let step = 0; step < dayCount; step += 1) {
            const date = new Date(start);
            date.setDate(start.getDate() + step);
            conflictDates.add(toKey(date));
          }
          conflicts.push({
            userId,
            userName: first.userName || second.userName,
            firstEvent: { eventId: first.eventId, eventName: first.eventName, departure: first.departure, returnDate: first.returnDate },
            secondEvent: { eventId: second.eventId, eventName: second.eventName, departure: second.departure, returnDate: second.returnDate },
            overlapStart: start,
            overlapEnd: end,
          });
        }
      }
    }
  });

  return { conflicts, conflictDates };
}

export default function EventCalendarModule({ events = [], users = [], inventory = [] }) {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedDateKey, setSelectedDateKey] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  });

  const monthDate = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    return new Date(year, month - 1, 1);
  }, [selectedMonth]);

  const dayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const { dateMap: eventDates, professionalDateMap, userAssignmentsMap, conflictData } = useMemo(() => {
    const map = new Map();

    (events || []).forEach((event) => {
      const start = toDate(event.startDate || event.departureDate || event.eventDate || event.returnDate);
      const end = toDate(event.endDate || event.returnDate || event.startDate || event.departureDate);
      const departure = toDate(event.departureDate || event.startDate);
      const returnDate = toDate(event.returnDate || event.endDate);

      if (start && end) {
        const diff = workdayCount(start, end);
        const dateCursor = new Date(start);
        for (let step = 0; step < diff; step += 1) {
          const key = toKey(dateCursor);
          const existing = map.get(key) || [];
          map.set(key, [...existing, {
            id: event.id,
            name: event.name,
            eventDateRange: { start, end },
            users: event.users || [],
            userAssignments: event.userAssignments || event.userDetails || [],
            boards: event.boards || {},
            startDate: event.startDate || event.departureDate,
            endDate: event.endDate || event.returnDate,
            departureDate: event.departureDate,
            returnDate: event.returnDate,
            clientName: event.clientName,
            locationName: event.locationName,
            address: event.address,
            type: 'EVENTO',
          }]);
          dateCursor.setDate(dateCursor.getDate() + 1);
        }
      }

      if (departure) {
        const key = toKey(departure);
        const existing = map.get(key) || [];
        map.set(key, [...existing, {
          id: event.id,
          name: event.name,
          type: 'DESLOCAMENTO',
          users: event.users || [],
          userAssignments: event.userAssignments || event.userDetails || [],
          boards: event.boards || {},
          startDate: event.startDate || event.departureDate,
          endDate: event.endDate || event.returnDate,
          departureDate: event.departureDate,
          returnDate: event.returnDate,
          clientName: event.clientName,
          locationName: event.locationName,
          address: event.address,
        }]);
      }

      if (returnDate) {
        const key = toKey(returnDate);
        const existing = map.get(key) || [];
        map.set(key, [...existing, {
          id: event.id,
          name: event.name,
          type: 'DESLOCAMENTO',
          users: event.users || [],
          userAssignments: event.userAssignments || event.userDetails || [],
          boards: event.boards || {},
          startDate: event.startDate || event.departureDate,
          endDate: event.endDate || event.returnDate,
          departureDate: event.departureDate,
          returnDate: event.returnDate,
          clientName: event.clientName,
          locationName: event.locationName,
          address: event.address,
        }]);
      }

      const caexDate = toDate(event.caexMontageDate);
      if (caexDate) {
        const key = toKey(caexDate);
        const existing = map.get(key) || [];
        map.set(key, [...existing, {
          id: event.id,
          name: event.name,
          type: 'MONTAGEM_CAEX',
          users: event.users || [],
          userAssignments: event.userAssignments || event.userDetails || [],
          boards: event.boards || {},
          startDate: event.startDate || event.departureDate,
          endDate: event.endDate || event.returnDate,
          departureDate: event.departureDate,
          returnDate: event.returnDate,
          clientName: event.clientName,
          locationName: event.locationName,
          address: event.address,
        }]);
      }

      const secretariaDate = toDate(event.secretariaMontageDate);
      if (secretariaDate) {
        const key = toKey(secretariaDate);
        const existing = map.get(key) || [];
        map.set(key, [...existing, {
          id: event.id,
          name: event.name,
          type: 'MONTAGEM_SECRETARIA',
          users: event.users || [],
          userAssignments: event.userAssignments || event.userDetails || [],
          boards: event.boards || {},
          startDate: event.startDate || event.departureDate,
          endDate: event.endDate || event.returnDate,
          departureDate: event.departureDate,
          returnDate: event.returnDate,
          clientName: event.clientName,
          locationName: event.locationName,
          address: event.address,
        }]);
      }
    });

    const { dateMap, userAssignmentsMap } = buildProfessionalAssignments(events, users);
    const conflictData = detectProfessionalConflicts(userAssignmentsMap);

    return { dateMap: map, professionalDateMap: dateMap, userAssignmentsMap, conflictData };
  }, [events, users]);

  const monthDays = useMemo(() => {
    const start = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const firstWeekday = start.getDay();
    const calendarStart = new Date(start);
    calendarStart.setDate(start.getDate() - firstWeekday);

    const cells = [];
    for (let i = 0; i < 42; i += 1) {
      const date = new Date(calendarStart);
      date.setDate(calendarStart.getDate() + i);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const dayEvents = eventDates.get(key) || [];
      const dayAssignments = professionalDateMap.get(key) || [];
      cells.push({ date, key, events: dayEvents, assignments: dayAssignments });
    }
    return cells;
  }, [monthDate, eventDates, professionalDateMap]);

  const monthOptions = useMemo(() => buildMonthOptions(events), [events]);

  const monthLabel = monthDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const formatSelectedDate = (key) => {
    if (!key) return '';
    const [year, month, day] = key.split('-').map(Number);
    const parsed = new Date(year, month - 1, day);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  const selectedDateEvents = useMemo(() => {
    return eventDates.get(selectedDateKey) || [];
  }, [eventDates, selectedDateKey]);

  const selectedDateAssignments = useMemo(() => {
    return (professionalDateMap?.get(selectedDateKey) || [])
      .map((entry) => ({
        ...entry,
        userName: entry.userName,
      }));
  }, [professionalDateMap, selectedDateKey]);

  const selectedDateConflictEntries = useMemo(() => {
    if (!conflictData) return [];
    return conflictData.conflicts.filter((conflict) => {
      return conflict.overlapStart && conflict.overlapEnd &&
        (selectedDateKey >= toKey(conflict.overlapStart) && selectedDateKey <= toKey(conflict.overlapEnd));
    });
  }, [conflictData, selectedDateKey]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-slate-800">Calendário de Eventos</h2>
          <p className="text-sm text-slate-500">Eventos, profissionais e demanda por data</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="neumorphic-button" onClick={() => {
            const [year, month] = selectedMonth.split('-').map(Number);
            const previous = new Date(year, month - 2, 1);
            setSelectedMonth(`${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, '0')}`);
          }}>‹</button>
          <select
            value={selectedMonth}
            onChange={(event) => setSelectedMonth(event.target.value)}
            className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 outline-none"
          >
            {monthOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <button className="neumorphic-button" onClick={() => {
            const [year, month] = selectedMonth.split('-').map(Number);
            const next = new Date(year, month, 1);
            setSelectedMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`);
          }}>›</button>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="neumorphic-card p-4">
          <div className="flex items-center gap-2 text-slate-500">
            <Calendar className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-[0.2em]">Eventos</span>
          </div>
          <div className="mt-3 text-3xl font-semibold text-slate-900">{events.length}</div>
          <div className="text-xs text-slate-500">cadastrados</div>
        </div>

        <div className="neumorphic-card p-4">
          <div className="flex items-center gap-2 text-slate-500">
            <Box className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-[0.2em]">Equipamentos</span>
          </div>
          <div className="mt-3 text-3xl font-semibold text-slate-900">{inventory.length}</div>
          <div className="text-xs text-slate-500">tipos no estoque</div>
        </div>

        <div className="neumorphic-card p-4 md:col-span-2">
          <div className="flex items-center gap-2 text-slate-500">
            <Users className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-[0.2em]">Equipe</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(users || []).map((user) => (
              <span key={user.id} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{user.name}</span>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <div className="grid grid-cols-7 gap-2">
            {dayLabels.map((day) => (
              <div key={day} className="text-center text-xs font-bold uppercase tracking-[0.2em] text-slate-500 py-2">{day}</div>
            ))}
            {monthDays.map((cell) => {
              const isCurrentMonth = cell.date.getMonth() === monthDate.getMonth();
              const isSelectedDate = selectedDateKey === cell.key;
              const cellEventTypes = new Set((cell.events || []).map((event) => event.type));
              const isEventDay = cellEventTypes.has('EVENTO');
              const isTransportDay = cellEventTypes.has('DESLOCAMENTO');
              const isCaexDay = cellEventTypes.has('MONTAGEM_CAEX');
              const isSecretariaDay = cellEventTypes.has('MONTAGEM_SECRETARIA');

              let gridClass = 'bg-white/80 border-slate-200';
              if (!isCurrentMonth) gridClass = 'bg-slate-50/60 border-slate-100 text-slate-400';
              if (isCaexDay && !isEventDay && !isTransportDay && !isSecretariaDay) gridClass = 'border-teal-300 bg-teal-50/90';
              if (isSecretariaDay && !isEventDay && !isTransportDay && !isCaexDay) gridClass = 'border-rose-300 bg-rose-50/90';
              if (isEventDay && !isTransportDay && !isCaexDay && !isSecretariaDay) gridClass = 'border-amber-300 bg-amber-50/90';
              if (isTransportDay && !isEventDay && !isCaexDay && !isSecretariaDay) gridClass = 'border-sky-300 bg-sky-50/90';
              if ((isEventDay || isTransportDay || isCaexDay || isSecretariaDay) && isSelectedDate) gridClass = 'ring-2 ring-slate-900 border-slate-900 bg-slate-100';
              if (isSelectedDate && !isEventDay && !isTransportDay && !isCaexDay && !isSecretariaDay) gridClass = 'ring-2 ring-slate-900 border-slate-900 bg-slate-50';

              return (
                <button key={cell.key} type="button" onClick={() => setSelectedDateKey(cell.key)} className={`min-h-[120px] rounded-2xl border p-2 text-left ${gridClass}`}>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500">{cell.date.getDate()}</span>
                    {cell.events.length > 0 && <span className="rounded-full bg-slate-900 px-2 py-1 text-[10px] font-bold text-white">{cell.events.length}</span>}
                  </div>
                  <div className="space-y-1 text-[10px] leading-4">
                    {(cell.events || []).slice(0, 2).map((event) => {
                      // Fallback para obter usuários do evento
                      let eventUsers = [];
                      if (users.length > 0) {
                        eventUsers = (users || []).filter((user) => (event.users || []).some(userId => String(user.id) === String(userId)));
                      } else if ((event.userAssignments || []).length > 0) {
                        eventUsers = (event.userAssignments || []).map((assignment) => ({
                          id: assignment.userId,
                          name: `Prof ${assignment.userId}`
                        }));
                      } else if ((event.users || []).length > 0) {
                        eventUsers = (event.users || []).map((userId) => ({
                          id: userId,
                          name: `Prof ${userId}`
                        }));
                      }
                      let eventClass = 'border-amber-300 bg-amber-100 text-amber-900';
                      if (event.type === 'DESLOCAMENTO') eventClass = 'border-sky-300 bg-sky-100 text-sky-900';
                      if (event.type === 'MONTAGEM_CAEX') eventClass = 'border-teal-300 bg-teal-100 text-teal-900';
                      if (event.type === 'MONTAGEM_SECRETARIA') eventClass = 'border-rose-300 bg-rose-100 text-rose-900';
                      
                      return (
                        <div key={`${cell.key}-${event.id}-${event.type}`} className={`rounded-2xl border px-2 py-1 ${eventClass}`}>
                          <div className="truncate font-semibold text-xs">{event.type === 'MONTAGEM_CAEX' ? '🔧 CAEX' : event.type === 'MONTAGEM_SECRETARIA' ? '📋 SECRETARIA' : event.name}</div>
                          <div className="mt-1 flex flex-wrap gap-1 text-[9px]">
                            {eventUsers.slice(0, 2).map((user) => (
                              <span key={user.id} className="rounded-full bg-slate-900 px-2 py-0.5 text-white">{user.name}</span>
                            ))}
                            {eventUsers.length > 2 && <span className="text-slate-600">+{eventUsers.length - 2}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-sm lg:max-h-[75vh] lg:overflow-y-auto">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Detalhes do dia</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">{formatSelectedDate(selectedDateKey)}</div>
            </div>
            <div className="flex gap-2 text-xs font-semibold">
              <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-amber-900">Evento</span>
              <span className="rounded-full border border-sky-300 bg-sky-50 px-3 py-1 text-sky-900">Deslocamento</span>
              <span className="rounded-full border border-teal-300 bg-teal-50 px-3 py-1 text-teal-900">CAEX</span>
              <span className="rounded-full border border-rose-300 bg-rose-50 px-3 py-1 text-rose-900">Secretaria</span>
              <span className="rounded-full border border-rose-300 bg-rose-50 px-3 py-1 text-rose-900">Conflito</span>
            </div>
          </div>

          {selectedDateEvents.length === 0 ? (
            <div className="mt-4 rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
              Nenhum evento ou deslocamento cadastrado para esta data.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {selectedDateEvents.map((event) => {
                // Fallback para obter usuários do evento
                let eventUsers = [];
                if (users.length > 0) {
                  eventUsers = (users || []).filter((user) => (event.users || []).some(userId => String(user.id) === String(userId)));
                } else if ((event.userAssignments || []).length > 0) {
                  eventUsers = (event.userAssignments || []).map((assignment) => ({
                    id: assignment.userId,
                    name: `Prof ${assignment.userId}`
                  }));
                } else if ((event.users || []).length > 0) {
                  eventUsers = (event.users || []).map((userId) => ({
                    id: userId,
                    name: `Prof ${userId}`
                  }));
                }
                
                const assignmentUsers = event.userAssignments || [];
                const assignedUserNames = (users || []).filter((user) => (event.userAssignments || []).some((assignment) => assignment.userId === user.id));
                
                // Determinar o status do evento
                let eventStatus = 'Agendado';
                let eventStatusColor = 'bg-blue-50 text-blue-800 border-blue-300';
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const selectedDate = new Date(selectedDateKey.split('-').map(Number));
                selectedDate.setHours(0, 0, 0, 0);
                
                if (event.type === 'DESLOCAMENTO') {
                  if (selectedDate < today) {
                    eventStatus = 'Retornou';
                    eventStatusColor = 'bg-green-50 text-green-800 border-green-300';
                  } else if (selectedDate.getTime() === today.getTime()) {
                    eventStatus = 'Em deslocamento';
                    eventStatusColor = 'bg-amber-50 text-amber-800 border-amber-300';
                  } else {
                    eventStatus = 'Ida/Volta prevista';
                    eventStatusColor = 'bg-sky-50 text-sky-800 border-sky-300';
                  }
                } else if (event.type === 'EVENTO') {
                  if (selectedDate < today) {
                    eventStatus = 'Finalizado';
                    eventStatusColor = 'bg-green-50 text-green-800 border-green-300';
                  } else if (selectedDate.getTime() === today.getTime()) {
                    eventStatus = 'Em andamento';
                    eventStatusColor = 'bg-red-50 text-red-800 border-red-300';
                  } else {
                    eventStatus = 'A iniciar';
                    eventStatusColor = 'bg-amber-50 text-amber-800 border-amber-300';
                  }
                } else if (event.type === 'MONTAGEM_CAEX') {
                  eventStatus = 'Montagem CAEX';
                  eventStatusColor = 'bg-teal-50 text-teal-800 border-teal-300';
                } else if (event.type === 'MONTAGEM_SECRETARIA') {
                  eventStatus = 'Montagem Secretaria';
                  eventStatusColor = 'bg-rose-50 text-rose-800 border-rose-300';
                }
                
                return (
                  <article key={`${selectedDateKey}-${event.id}-${event.type}`} className="rounded-3xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{event.type}</div>
                        <div className="mt-1 text-base font-semibold text-slate-900">{event.name}</div>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-[10px] font-bold border ${eventStatusColor}`}>{eventStatus}</span>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <div className="rounded-2xl bg-white p-3 text-xs text-slate-700">
                        <div className="font-semibold text-slate-900">Local</div>
                        <div>{event.locationName || event.address || 'Não informado'}</div>
                      </div>
                      <div className="rounded-2xl bg-white p-3 text-xs text-slate-700">
                        <div className="font-semibold text-slate-900">Cliente</div>
                        <div>{event.clientName || 'Não informado'}</div>
                      </div>
                    </div>
                    <div className="mt-3 rounded-2xl bg-white p-3 text-xs">
                      <div className="font-semibold text-slate-900">Pessoas Envolvidas</div>
                      <div className="mt-2 text-slate-700">
                        {eventUsers.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {eventUsers.map((user) => (
                              <span key={user.id} className="inline-block rounded-full bg-slate-100 px-2 py-1 border border-slate-300">{user.name}</span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-500">Nenhum profissional registrado</span>
                        )}
                      </div>
                    </div>
                    {event.boards?.deslocamento && event.boards.deslocamento.length > 0 && (
                      <div className="mt-3 rounded-2xl bg-white p-3 text-xs">
                        <div className="font-semibold text-slate-900">Deslocamentos</div>
                        <div className="mt-2 space-y-1 text-slate-700">
                          {event.boards.deslocamento.slice(0, 3).map((item, idx) => (
                            <div key={idx} className="text-xs text-slate-600">
                              • {item.transportMode || 'Deslocamento'} {item.departureDate && `(${new Date(item.departureDate).toLocaleDateString('pt-BR')})`}
                            </div>
                          ))}
                          {event.boards.deslocamento.length > 3 && (
                            <div className="text-xs text-slate-500">+{event.boards.deslocamento.length - 3} deslocamento(s)</div>
                          )}
                        </div>
                      </div>
                    )}
                    {event.boards?.separar && event.boards.separar.length > 0 && (
                      <div className="mt-3 rounded-2xl bg-white p-3 text-xs">
                        <div className="font-semibold text-slate-900">Transferências</div>
                        <div className="mt-2 space-y-2 text-slate-700">
                          {event.boards.separar.filter((item) => item.transferReference).slice(0, 3).map((item, idx) => {
                            const sourceName = String(item.sourceEventId) === String(event.id)
                              ? event.name
                              : item.sourceEventName || item.transferSourceEventName || 'Evento não identificado';
                            const targetName = String(item.transferTargetEventId) === String(event.id)
                              || String(item.targetEventId) === String(event.id)
                              ? event.name
                              : item.transferTargetEventName || item.targetEventName || 'Evento não identificado';

                            return (
                              <div key={idx} className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs">
                                <div className="font-semibold text-slate-900">
                                  {item.name || item.type} <span className="font-normal text-slate-500">(qtd: {item.transferQuantity || item.quantity})</span>
                                </div>
                                <div className="mt-1 text-slate-600">
                                  📦 De: <strong>{sourceName}</strong>
                                </div>
                                <div className="mt-1 text-slate-600">
                                  ➜ Para: <strong>{targetName}</strong>
                                </div>
                                {item.transferDate && (
                                  <div className="mt-1 text-slate-500 text-[11px]">
                                    📅 {new Date(item.transferDate).toLocaleDateString('pt-BR')}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          {event.boards.separar.filter((item) => item.transferReference).length > 3 && (
                            <div className="text-xs text-slate-500">+{event.boards.separar.filter((item) => item.transferReference).length - 3} transferência(s)</div>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-slate-700">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 border border-emerald-200">
                        📤 {event.departureDate ? new Date(event.departureDate).toLocaleDateString('pt-BR') : 'Sem ida'}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-1 border border-rose-200">
                        📥 {event.returnDate ? new Date(event.returnDate).toLocaleDateString('pt-BR') : 'Sem retorno'}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          <div className="mt-4 grid gap-3">
            <div className="rounded-3xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
              <div className="font-semibold text-slate-900">Profissionais neste dia</div>
              {selectedDateAssignments.length === 0 ? (
                <div className="mt-2 text-sm text-slate-500">Nenhuma atribuição de profissional encontrada para esta data.</div>
              ) : (
                <div className="mt-2 space-y-2">
                  {selectedDateAssignments.map((assignment) => (
                    <div key={`${selectedDateKey}-${assignment.userId}-${assignment.eventId}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-center justify-between gap-2 text-sm font-semibold text-slate-900">
                        <span>{assignment.userName}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-700">{assignment.eventName}</span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">{`Período: ${assignment.departure.toLocaleDateString('pt-BR')} → ${assignment.returnDate.toLocaleDateString('pt-BR')}`}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
              <div className="flex items-center justify-between gap-3">
                <div className="font-semibold text-slate-900">Avisos de conflito</div>
                <span className="inline-flex h-7 items-center justify-center rounded-full bg-rose-100 px-2 text-sm font-bold text-rose-700">!</span>
              </div>
              {selectedDateConflictEntries.length === 0 ? (
                <div className="mt-2 text-sm text-slate-500">Nenhum conflito de alocação identificado para esta data.</div>
              ) : (
                <div className="mt-2 space-y-2 text-xs text-slate-700">
                  {selectedDateConflictEntries.map((conflict, index) => (
                    <div key={`conflict-${selectedDateKey}-${index}`} className="rounded-2xl border border-rose-200 bg-rose-50 p-3">
                      <div className="font-semibold text-rose-900">{conflict.userName}</div>
                      <div className="mt-1">Cruzamento entre <strong>{conflict.firstEvent.eventName}</strong> e <strong>{conflict.secondEvent.eventName}</strong></div>
                      <div className="mt-1 text-slate-700">{`Período: ${conflict.overlapStart.toLocaleDateString('pt-BR')} → ${conflict.overlapEnd.toLocaleDateString('pt-BR')}`}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
