import React, { useMemo, useState } from 'react';
import { Activity, Calendar, Box, ArrowRight, Users, FileText, MessageCircle, ChevronDown, ChevronUp, Truck } from 'lucide-react';
import { generateProfessionalSchedulesPdf, generateExternalRentalsPdf } from '../utils/pdfGenerator.js';

function toDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function addDays(base, days) {
  const copy = new Date(base);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function diffDaysInclusive(startDate, endDate) {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  const msPerDay = 24 * 60 * 60 * 1000;
  const diff = Math.round((end - start) / msPerDay);
  return Math.max(diff + 1, 0);
}

function formatPhoneUrl(phone) {
  const digits = String(phone || '').replace(/[^0-9]/g, '');
  if (!digits) return '';
  if (digits.length === 13 && digits.startsWith('55')) return digits;
  if (digits.length === 11 || digits.length === 10) return `55${digits}`;
  return digits;
}

function buildDailyRatesMessage(rows, month) {
  const monthLabel = month ? new Date(`${month}-01`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : '';
  const lines = ['Segue as diárias de cada técnico:'];
  if (monthLabel) lines.push(`Período: ${monthLabel}`);

  let totalGeneral = 0;

  rows.forEach((row) => {
    const name = row.user?.name || 'Profissional sem nome';
    lines.push('');
    lines.push(`Profissional: ${name}`);

    if (!row.assignments || row.assignments.length === 0) {
      lines.push('- Sem eventos atribuídos');
      return;
    }

    let totalUser = 0;
    row.assignments.forEach((assignment) => {
      const days = Number(assignment.days || 0);
      lines.push(`- ${assignment.eventName} - ${days} diária${days === 1 ? '' : 's'}`);
      totalUser += days;
    });

    totalGeneral += totalUser;
    lines.push(`Total: ${totalUser} diária${totalUser === 1 ? '' : 's'}`);
  });

  lines.push('');
  lines.push(`Total geral de diárias: ${totalGeneral} diária${totalGeneral === 1 ? '' : 's'}`);
  return lines.join('\n');
}

function sendDailyRatesToNF(config, rows, month) {
  const phone = formatPhoneUrl(config?.nfContact?.phone || '');
  const text = buildDailyRatesMessage(rows, month);
  const encodedText = encodeURIComponent(text);

  if (phone) {
    window.open(`https://wa.me/${phone}?text=${encodedText}`, '_blank');
    return;
  }

  const email = config?.nfContact?.email || '';
  if (email) {
    const subject = encodeURIComponent('Diárias dos técnicos');
    window.open(`mailto:${email}?subject=${subject}&body=${encodedText}`, '_blank');
    return;
  }

  window.alert('Não há contato de NF configurado para envio.');
}

export default function DashboardModule({ events, inventory, users, config, onUsersChange, currentUser }) {
  const [dashboardMonth, setDashboardMonth] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  });

  const [leaveDrafts, setLeaveDrafts] = useState(() => {
    return (users || []).reduce((acc, user) => {
      acc[user.id] = Number(user.leaveTaken || 0);
      return acc;
    }, {});
  });

  const [editingLeaveRuleUserId, setEditingLeaveRuleUserId] = useState(null);
  const [leaveRuleDrafts, setLeaveRuleDrafts] = useState(() => {
    return (users || []).reduce((acc, user) => {
      acc[user.id] = Number(user.leaveRuleDays || 7);
      return acc;
    }, {});
  });
  const [rentalMonth, setRentalMonth] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  });
  const [rentalCompanyFilter, setRentalCompanyFilter] = useState('');
  const [showSchedulePanel, setShowSchedulePanel] = useState(true);
  const [showExternalRentalPanel, setShowExternalRentalPanel] = useState(true);
  const [showLeavePanel, setShowLeavePanel] = useState(true);
  const [showTransferPanel, setShowTransferPanel] = useState(true);

  const monthOptions = useMemo(() => {
    const months = new Set();
    (events || []).forEach((event) => {
      const start = toDate(event.departureDate || event.startDate || event.eventDate);
      const end = toDate(event.returnDate || event.endDate || event.returnDate);
      if (start) {
        const startKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
        months.add(startKey);
      }
      if (end) {
        const endKey = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}`;
        months.add(endKey);
      }
    });

    if (months.size === 0) {
      const today = new Date();
      months.add(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`);
    }

    return Array.from(months).sort();
  }, [events]);

  const eventRangeMap = useMemo(() => {
    return new Map((events || []).map((event) => {
      const start = toDate(event.departureDate || event.startDate || event.eventDate);
      const end = toDate(event.returnDate || event.endDate || event.endDate || event.returnDate);
      return [event.id, { start, end }];
    }));
  }, [events]);

  const inventoryByType = useMemo(() => {
    return (inventory || []).reduce((acc, item) => {
      if (item.status === 'EM MANUTENÇÃO') return acc;
      const type = String(item.type || 'ITEM GERAL').trim().toUpperCase();
      const quantity = Number(item.quantity || 0);
      if (!Number.isFinite(quantity) || quantity <= 0) return acc;
      acc[type] = (acc[type] || 0) + quantity;
      return acc;
    }, {});
  }, [inventory]);

  const externalRentals = useMemo(() => {
    const rentals = [];

    (events || []).forEach((event) => {
      (event.boards?.separar || []).forEach((item) => {
        if (!Array.isArray(item.externalRentals)) return;
        item.externalRentals.forEach((rental) => {
          const start = rental.startDate || event.eventDate || event.startDate || event.departureDate || '';
          const end = rental.endDate || event.returnDate || event.endDate || '';
          const startDate = toDate(start);
          const endDate = toDate(end);
          let days = 0;
          if (startDate && endDate) {
            days = diffDaysInclusive(startDate, endDate);
          } else if (event.departureDate && event.returnDate) {
            const eventStart = toDate(event.departureDate || event.startDate || event.eventDate);
            const eventEnd = toDate(event.returnDate || event.endDate);
            if (eventStart && eventEnd) {
              days = diffDaysInclusive(eventStart, eventEnd);
            }
          }

          rentals.push({
            eventName: event.name,
            equipmentType: item.type || item.name,
            company: rental.company,
            quantity: Number(rental.quantity) || 0,
            startDate: start || '',
            endDate: end || '',
            days,
          });
        });
      });
    });

    return rentals;
  }, [events]);

  const filteredExternalRentals = useMemo(() => {
    return externalRentals.filter((rental) => {
      if (rentalCompanyFilter && String(rental.company || '').toLowerCase() !== String(rentalCompanyFilter || '').toLowerCase()) {
        return false;
      }
      if (!rentalMonth) return true;
      const rentalDate = toDate(rental.startDate || rental.endDate || '');
      if (!rentalDate) return false;
      const monthKey = `${rentalDate.getFullYear()}-${String(rentalDate.getMonth() + 1).padStart(2, '0')}`;
      return monthKey === rentalMonth;
    });
  }, [externalRentals, rentalCompanyFilter, rentalMonth]);

  const groupedExternalRentals = useMemo(() => {
    return filteredExternalRentals.reduce((acc, rental) => {
      const key = `${rental.eventName}||${rental.company}||${rental.equipmentType}||${rental.startDate}||${rental.endDate}||${rental.days}`;
      if (!acc[key]) {
        acc[key] = { ...rental };
      } else {
        acc[key].quantity += rental.quantity;
      }
      return acc;
    }, {});
  }, [filteredExternalRentals]);

  const rentalCompanies = useMemo(() => {
    const companies = new Set();
    externalRentals.forEach((rental) => {
      if (rental.company) companies.add(rental.company);
    });
    return Array.from(companies).sort();
  }, [externalRentals]);

  const exportRentalPdf = () => {
    generateExternalRentalsPdf(filteredExternalRentals, rentalMonth, rentalCompanyFilter);
  };

  const professionalDashboard = useMemo(() => {
    const [year, month] = dashboardMonth.split('-').map(Number);
    const monthStart = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

    const rows = (users || []).map((user) => {
      const userIdString = String(user.id);
      const assignments = (events || []).filter((event) => {
        const eventUsers = event.users || [];
        const userAssignments = event.userAssignments || event.userDetails || [];
        return eventUsers.some((eventUserId) => String(eventUserId) === userIdString)
          || userAssignments.some((entry) => String(entry.userId) === userIdString);
      });

      const rangeStats = assignments.map((event) => {
        const range = eventRangeMap.get(event.id) || { start: null, end: null };
        const eventStart = toDate(event.departureDate || event.startDate || event.eventDate || range.start);
        const eventEnd = toDate(event.returnDate || event.endDate || event.eventDate || range.end);
        const userAssignments = event.userAssignments || event.userDetails || [];
        const assignment = userAssignments.find((entry) => String(entry.userId) === userIdString) || null;
        const assignmentStart = toDate(
          assignment?.departureDate || assignment?.startDate || assignment?.eventDate || event.departureDate || event.startDate || event.eventDate || range.start
        );
        const assignmentEnd = toDate(
          assignment?.returnDate || assignment?.endDate || event.returnDate || event.endDate || event.eventDate || range.end
        );

        const rangeStart = assignmentStart || eventStart || range.start;
        const rangeEnd = assignmentEnd || eventEnd || range.end;

        if (!rangeStart || !rangeEnd) return null;

        const effectiveStart = new Date(Math.max(rangeStart.getTime(), monthStart.getTime()));
        const effectiveEnd = new Date(Math.min(rangeEnd.getTime(), monthEnd.getTime()));

        if (effectiveEnd < effectiveStart) return null;

        const days = diffDaysInclusive(effectiveStart, effectiveEnd);
        return {
          eventId: event.id,
          eventName: event.name,
          start: effectiveStart,
          end: effectiveEnd,
          days,
        };
      }).filter(Boolean);

      return {
        user,
        totalDays: rangeStats.reduce((sum, item) => sum + item.days, 0),
        assignments: rangeStats,
      };
    });

    return { rows };
  }, [events, users, eventRangeMap, dashboardMonth]);

  const leaveDashboard = useMemo(() => {
    const daysWorkedByUser = new Map();

    (events || []).forEach((event) => {
      const eventUsers = event.users || [];
      const eventRange = eventRangeMap.get(event.id) || { start: null, end: null };
      const eventStart = toDate(event.departureDate || event.startDate || event.eventDate || eventRange.start);
      const eventEnd = toDate(event.returnDate || event.endDate || eventRange.end);

      if (!eventStart || !eventEnd) return;

      const totalDays = diffDaysInclusive(eventStart, eventEnd);
      if (totalDays <= 0) return;

      eventUsers.forEach((userId) => {
        const user = (users || []).find((candidate) => String(candidate.id) === String(userId));
        if (!user) return;

        const existing = daysWorkedByUser.get(user.id) || 0;
        const userAssignments = event.userAssignments || [];
        const assignment = userAssignments.find((entry) => String(entry.userId) === String(user.id)) || null;
        const assignmentDate = toDate(assignment?.startDate || assignment?.eventDate || event.departureDate || event.startDate || event.eventDate);

        const actualStart = assignmentDate || eventStart;
        const actualEnd = eventEnd;
        const assignmentDays = diffDaysInclusive(actualStart, actualEnd);

        daysWorkedByUser.set(user.id, existing + Math.max(assignmentDays, 0));
      });
    });

    return (users || []).map((user) => {
      const leaveRuleDays = Number(user.leaveRuleDays || leaveRuleDrafts[user.id] || 7);
      const workedDays = daysWorkedByUser.get(user.id) || 0;
      const generated = Math.floor(workedDays / leaveRuleDays);
      const taken = Number(user.leaveTaken || leaveDrafts[user.id] || 0);
      const balance = generated - taken;
      return {
        user,
        workedDays,
        generated,
        taken,
        balance,
        leaveRuleDays,
      };
    });
  }, [events, eventRangeMap, users, leaveDrafts, leaveRuleDrafts]);

  const equipmentDashboard = useMemo(() => {
    const stockByType = new Map();
    const stockByDate = new Map();

    (events || []).forEach((event) => {
      const range = eventRangeMap.get(event.id) || { start: null, end: null };
      if (!range.start || !range.end) return;

      const boards = event.boards || {};
      const sourceItems = [...(boards.separar || []), ...(boards.montagem || [])];

      sourceItems.forEach((item) => {
        const type = item.type || item.name || 'ITEM GERAL';
        const quantity = Number(item.quantity || 0) || 1;
        stockByType.set(type, (stockByType.get(type) || 0) + quantity);

        const start = range.start;
        const end = range.end;
        const diff = Math.max(0, Math.round((end - start) / 86400000));

        for (let i = 0; i <= diff; i += 1) {
          const current = addDays(start, i);
          const key = dateKey(current);
          const bucket = stockByDate.get(key) || new Map();
          bucket.set(type, (bucket.get(type) || 0) + quantity);
          stockByDate.set(key, bucket);
        }
      });
    });

    return {
      byType: Array.from(stockByType.entries()),
      byDate: Array.from(stockByDate.entries()).sort(([a], [b]) => (a > b ? 1 : -1)),
    };
  }, [events, eventRangeMap]);

  const canManageLeave = currentUser?.role === 'master' || currentUser?.role === 'admin';

  const transferDashboard = useMemo(() => {
    const transfers = new Map();
    (events || []).forEach((event) => {
      const eventTransfers = event.transfers || [];
      eventTransfers.forEach((transfer) => {
        const sourceId = transfer.sourceEventId || event.id;
        const targetId = transfer.targetEventId;
        const flowKey = `${sourceId}-${targetId}`;
        const sourceName = transfer.sourceEventName || event.name || 'Evento origem';
        const targetName = transfer.targetEventName || (events || []).find((candidate) => String(candidate.id) === String(targetId))?.name || 'Evento destino';
        const equipmentType = transfer.equipmentType || transfer.type || 'Equipamento';
        const quantity = Number(transfer.quantity || 0) || 1;

        if (!transfers.has(flowKey)) {
          transfers.set(flowKey, {
            id: flowKey,
            sourceEventId: sourceId,
            targetEventId: targetId,
            sourceEventName: sourceName,
            targetEventName: targetName,
            items: [{ equipmentType, quantity, transferDates: [transfer.transferDate] }],
            totalQuantity: quantity,
          });
        } else {
          const existing = transfers.get(flowKey);
          const existingItem = existing.items.find((item) => item.equipmentType === equipmentType);
          if (existingItem) {
            existingItem.quantity += quantity;
            existingItem.transferDates.push(transfer.transferDate);
          } else {
            existing.items.push({ equipmentType, quantity, transferDates: [transfer.transferDate] });
          }
          existing.totalQuantity += quantity;
        }
      });
    });

    return Array.from(transfers.values());
  }, [events]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-800">Dashboard Operacional</h2>
          <p className="text-sm text-slate-500">Controle de profissionais, equipamentos e transferências</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
          {events?.length || 0} eventos ativos
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="neumorphic-card p-4">
          <div className="mb-2 flex items-center gap-2 text-slate-500">
            <Users className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-[0.2em]">Profissionais</span>
          </div>
          <div className="text-3xl font-semibold text-slate-900">{users?.length || 0}</div>
          <div className="text-sm text-slate-500">envolvidos no calendário</div>
        </div>

        <div className="neumorphic-card p-4">
          <div className="mb-2 flex items-center gap-2 text-slate-500">
            <Box className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-[0.2em]">Equipamentos</span>
          </div>
          <div className="text-3xl font-semibold text-slate-900">{inventory?.length || 0}</div>
          <div className="text-sm text-slate-500">tipos no estoque</div>
        </div>

        <div className="neumorphic-card p-4">
          <div className="mb-2 flex items-center gap-2 text-slate-500">
            <Activity className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-[0.2em]">Transferências</span>
          </div>
          <div className="text-3xl font-semibold text-slate-900">{transferDashboard.length}</div>
          <div className="text-sm text-slate-500">movimentações registradas</div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="neumorphic-card p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-slate-500" />
              <h3 className="text-lg font-semibold text-slate-800">Agenda por profissional</h3>
            </div>
            <button className={`neumorphic-button ${showSchedulePanel ? 'primary' : 'secondary'} inline-flex items-center gap-2 px-3 py-2 text-xs`} onClick={() => setShowSchedulePanel((prev) => !prev)}>
              {showSchedulePanel ? <><ChevronUp className="h-4 w-4" />Recolher</> : <><ChevronDown className="h-4 w-4" />Expandir</>}
            </button>
          </div>
          {showSchedulePanel && (
            <>
              <div className="mb-4 grid w-full gap-2 sm:grid-cols-[auto_1fr_auto] sm:items-center">
                <button className="neumorphic-button secondary px-3 py-2 min-w-[42px]" onClick={() => {
                  const [year, month] = dashboardMonth.split('-').map(Number);
                  const previous = new Date(year, month - 2, 1);
                  setDashboardMonth(`${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, '0')}`);
                }}>‹</button>
                <input type="month" value={dashboardMonth} onChange={(event) => setDashboardMonth(event.target.value)} className="neumorphic-input h-12 w-full px-3 text-sm" />
                <button className="neumorphic-button secondary px-3 py-2 min-w-[42px]" onClick={() => {
                  const [year, month] = dashboardMonth.split('-').map(Number);
                  const next = new Date(year, month, 1);
                  setDashboardMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`);
                }}>›</button>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 justify-end">
                <button
                  className="neumorphic-button primary inline-flex items-center gap-2 px-3 py-2 text-xs"
                  onClick={() => generateProfessionalSchedulesPdf(users, professionalDashboard.rows, dashboardMonth)}
                >
                  <FileText className="h-4 w-4" />Gerar relatório
                </button>
                <button
                  className="neumorphic-button secondary inline-flex items-center gap-2 px-3 py-2 text-xs"
                  onClick={() => sendDailyRatesToNF(config, professionalDashboard.rows, dashboardMonth)}
                >
                  <MessageCircle className="h-4 w-4" />Enviar diárias para NF
                </button>
              </div>

              <div className="space-y-3">
                {professionalDashboard.rows.map((row) => (
                  <div key={row.user.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-900">{row.user.name}</div>
                        <div className="text-xs text-slate-500">{row.user.role === 'admin' ? 'Administrador' : 'Usuário'}</div>
                      </div>
                      <div className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                        {row.totalDays} dias no mês
                      </div>
                    </div>

                    {row.assignments.length > 0 ? (
                      <div className="mt-3 space-y-2">
                        {row.assignments.map((assignment) => (
                          <div key={assignment.eventId} className="rounded-2xl bg-white/80 p-2 text-sm">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-semibold text-slate-700">{assignment.eventName}</span>
                              <span className="text-xs text-slate-500">
                                {assignment.start ? assignment.start.toLocaleDateString('pt-BR') : '-'}
                                {' '}até{' '}
                                {assignment.end ? assignment.end.toLocaleDateString('pt-BR') : '-'}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 mt-1">{assignment.days} dia(s) envolvidos</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-2 text-xs text-slate-500">Sem eventos atribuídos</div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="neumorphic-card p-4">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Box className="h-5 w-5 text-slate-500" />
              <h3 className="text-lg font-semibold text-slate-800">Locação externa</h3>
            </div>
            <button className={`neumorphic-button ${showExternalRentalPanel ? 'primary' : 'secondary'} inline-flex items-center gap-2 px-3 py-2 text-xs`} onClick={() => setShowExternalRentalPanel((prev) => !prev)}>
              {showExternalRentalPanel ? <><ChevronUp className="h-4 w-4" />Recolher</> : <><ChevronDown className="h-4 w-4" />Expandir</>}
            </button>
          </div>

          {showExternalRentalPanel && (
            <>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <label className="space-y-1 text-xs text-slate-500">
                  <span>Mês</span>
                  <input type="month" className="neumorphic-input h-10 px-3 py-2 text-sm" value={rentalMonth} onChange={(event) => setRentalMonth(event.target.value)} />
                </label>
                <label className="space-y-1 text-xs text-slate-500">
                  <span>Empresa</span>
                  <select className="neumorphic-select h-10 px-3 py-2 text-sm" value={rentalCompanyFilter} onChange={(event) => setRentalCompanyFilter(event.target.value)}>
                    <option value="">Todas as empresas</option>
                    {rentalCompanies.map((company) => (
                      <option key={company} value={company}>{company}</option>
                    ))}
                  </select>
                </label>
                <button className="neumorphic-button primary inline-flex items-center gap-2 px-3 py-2 text-xs" onClick={exportRentalPdf} disabled={filteredExternalRentals.length === 0}>
                  <FileText className="h-4 w-4" />Exportar PDF
                </button>
              </div>

              <div className="space-y-4">
                {Object.keys(groupedExternalRentals).length === 0 ? (
                  <div className="text-sm text-slate-500">Nenhuma locação externa registrada para o filtro.</div>
                ) : (
                  Object.values(groupedExternalRentals).map((rental, index) => (
                    <div key={index} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                      <div className="font-semibold text-slate-800">{rental.equipmentType}</div>
                      <div>Empresa: {rental.company || 'Não informada'}</div>
                      <div>Evento: {rental.eventName || 'Não informado'}</div>
                      <div>Quantidade: {rental.quantity}</div>
                      <div>Data de recebimento: {rental.startDate || 'Não informada'}</div>
                      <div>Data de devolução: {rental.endDate || 'Não informada'}</div>
                      <div>Dias alugados: {rental.days || 'Sem período definido'}</div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </section>

      {canManageLeave && (
        <section className="leave-dashboard-panel neumorphic-card p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-800">Folgas por profissional</h3>
              <div className="text-xs text-slate-500">Regra: a cada 7 dias trabalhados gera 1 dia de folga</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button className={`neumorphic-button ${showLeavePanel ? 'primary' : 'secondary'} inline-flex items-center gap-2 px-3 py-2 text-xs`} onClick={() => setShowLeavePanel((prev) => !prev)}>
                {showLeavePanel ? (<><ChevronUp className="h-4 w-4" />Recolher</>) : (<><ChevronDown className="h-4 w-4" />Expandir</>)}
              </button>
              <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">Período: {dashboardMonth}</div>
            </div>
          </div>

          {showLeavePanel && (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {leaveDashboard.map((row) => {
                return (
                  <div key={row.user.id} className="leave-dashboard-card rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="leave-user-name font-semibold text-slate-900">{row.user.name}</div>
                        <div className="leave-role text-[11px] uppercase tracking-[0.12em] text-slate-500">{row.user.role === 'admin' ? 'Administrador' : 'Usuário'}</div>
                      </div>
                      <span className="leave-balance-badge rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-bold text-emerald-800">Saldo {row.balance}</span>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                      <div className="leave-number-block rounded-2xl bg-white/80 p-2">
                        <div className="leave-label text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Geradas</div>
                        <div className="leave-value mt-1 text-lg font-bold text-slate-900">{row.generated}</div>
                      </div>
                      <div className="leave-number-block rounded-2xl bg-white/80 p-2">
                        <div className="leave-label text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Utilizadas</div>
                        <div className="leave-value mt-1 text-lg font-bold text-slate-900">{row.taken}</div>
                      </div>
                      <div className="leave-number-block rounded-2xl bg-white/80 p-2">
                        <div className="leave-label text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Saldo</div>
                        <div className="leave-value mt-1 text-lg font-bold text-slate-900">{row.balance}</div>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center gap-2">
                      <label className="leave-label text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Folgas Utilizadas</label>
                      <input
                        type="number"
                        min="0"
                        value={leaveDrafts[row.user.id] ?? Number(row.user.leaveTaken || 0)}
                        onChange={(event) => {
                          const value = Number(event.target.value || 0);
                          setLeaveDrafts((prev) => ({ ...prev, [row.user.id]: Number.isFinite(value) ? value : 0 }));
                        }}
                        className="neumorphic-input h-9 w-24 px-3 py-1 text-sm"
                      />
                      <button className="neumorphic-button primary px-3 py-2 text-xs" onClick={() => {
                        const current = Number(leaveDrafts[row.user.id] || 0);
                        const normalized = Number.isFinite(current) ? Math.max(0, Math.round(current)) : 0;
                        const nextUsers = (users || []).map((u) => u.id === row.user.id ? { ...u, leaveTaken: normalized } : u);
                        if (onUsersChange) onUsersChange(nextUsers);
                        setLeaveDrafts((prev) => ({ ...prev, [row.user.id]: normalized }));
                      }}>Salvar</button>
                      <button className="neumorphic-button secondary px-3 py-2 text-xs" onClick={() => {
                        setEditingLeaveRuleUserId(row.user.id);
                        setLeaveRuleDrafts((prev) => ({ ...prev, [row.user.id]: Number(row.user.leaveRuleDays || 7) }));
                      }}>Editar regra</button>
                    </div>

                    {editingLeaveRuleUserId === row.user.id && (
                      <div className="mt-3 rounded-2xl border border-slate-300 bg-white/70 p-3">
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Dias trabalhados para 1 folga</label>
                          <input
                            type="number"
                            min="1"
                            value={leaveRuleDrafts[row.user.id] ?? row.leaveRuleDays ?? 7}
                            onChange={(event) => {
                              const value = Number(event.target.value || 1);
                              setLeaveRuleDrafts((prev) => ({ ...prev, [row.user.id]: Number.isFinite(value) ? Math.max(1, Math.round(value)) : 1 }));
                            }}
                            className="neumorphic-input h-9 w-28 px-3 py-1 text-sm"
                          />
                          <div className="flex gap-2">
                            <button className="neumorphic-button px-3 py-2 text-xs" onClick={() => {
                              const nextRule = Number(leaveRuleDrafts[row.user.id] || 7);
                              const normalized = Number.isFinite(nextRule) ? Math.max(1, Math.round(nextRule)) : 7;
                              const nextUsers = (users || []).map((u) => u.id === row.user.id ? { ...u, leaveRuleDays: normalized } : u);
                              if (onUsersChange) onUsersChange(nextUsers);
                              setLeaveRuleDrafts((prev) => ({ ...prev, [row.user.id]: normalized }));
                              setEditingLeaveRuleUserId(null);
                            }}>Salvar regra</button>
                            <button className="neumomorphic-button px-3 py-2 text-xs" onClick={() => setEditingLeaveRuleUserId(null)}>Cancelar</button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="neumorphic-card p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ArrowRight className="h-5 w-5 text-slate-500" />
              <h3 className="text-lg font-semibold text-slate-800">Fluxograma de transferências</h3>
            </div>
            <button className={`neumorphic-button ${showTransferPanel ? 'primary' : 'secondary'} inline-flex items-center gap-2 px-3 py-2 text-xs`} onClick={() => setShowTransferPanel((prev) => !prev)}>
              {showTransferPanel ? <><ChevronUp className="h-4 w-4" />Recolher</> : <><ChevronDown className="h-4 w-4" />Expandir</>}
            </button>
          </div>
          {showTransferPanel && (
            <div className="space-y-3">
              {transferDashboard.length > 0 ? (
                transferDashboard.map((transfer) => {
                  const source = (events || []).find((event) => String(event.id) === String(transfer.sourceEventId));
                  const target = (events || []).find((event) => String(event.id) === String(transfer.targetEventId));
                  return (
                    <div key={transfer.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="rounded-full bg-sky-100 px-2 py-1 text-[11px] font-bold uppercase text-sky-700">Transferência</span>
                        <span className="font-semibold text-slate-800">{source?.name || transfer.sourceEventName || 'Origem'}</span>
                        <ArrowRight className="h-4 w-4 text-slate-400" />
                        <span className="font-semibold text-slate-800">{target?.name || transfer.targetEventName || 'Destino'}</span>
                      </div>
                      <div className="mt-2 text-xs text-slate-500">
                        Total de equipamentos transferidos: {transfer.totalQuantity} unidade(s)
                      </div>
                      <div className="mt-2 space-y-2 text-xs text-slate-500">
                        {transfer.items.map((item, index) => (
                          <div key={`${transfer.id}-${index}`}>
                            {item.equipmentType} • {item.quantity} unidade(s)
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-sm text-slate-500">Nenhuma transferência registrada.</div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
