import React, { useMemo, useState } from 'react';
import NeumorphicCard from './NeumorphicCard.jsx';
import { Pencil, Trash2, PlusCircle, ChevronDown, Speaker, Lightbulb, Camera, Sidebar, Palette, Layers, Laptop, Printer, Tag, Barcode, Truck, Smartphone, FileText, MonitorSmartphone } from 'lucide-react';
import { validateInventoryForm } from '../utils/validation.js';

export default function InventoryModule({ inventory = [], events = [], onUpdateInventory = () => {}, itemTypes = [] }) {
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ type: '', name: '', serial: '', quantity: 1, status: 'Disponível' });
  const [planningFilter, setPlanningFilter] = useState('15d');
  const [validationErrors, setValidationErrors] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);

  const handleInput = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setValidationErrors((prev) => prev.filter((error) => error.field !== key));
  };

  const totalAvailable = useMemo(() => {
    return inventory.reduce((sum, item) => {
      return sum + (item.status === 'EM MANUTENÇÃO' ? 0 : Number(item.quantity));
    }, 0);
  }, [inventory]);
  const [expandedTypes, setExpandedTypes] = useState({});

  const normalizeType = (value) => String(value || '').trim().toUpperCase();

  const getTypeMeta = (type) => {
    const normalized = normalizeType(type);
    const mapping = {
      'SOM': { icon: Speaker, color: 'text-blue-700', bg: 'bg-blue-100/80', border: 'border-blue-500/60' },
      'LUZ': { icon: Lightbulb, color: 'text-amber-700', bg: 'bg-amber-100/80', border: 'border-amber-500/60' },
      'IMAGEM': { icon: Camera, color: 'text-violet-700', bg: 'bg-violet-100/80', border: 'border-violet-500/60' },
      'DECORAÇÃO': { icon: Palette, color: 'text-fuchsia-700', bg: 'bg-fuchsia-100/80', border: 'border-fuchsia-500/60' },
      'MOBILIÁRIO': { icon: Sidebar, color: 'text-slate-700', bg: 'bg-slate-100/80', border: 'border-slate-500/60' },
      'NOTEBOOK': { icon: Laptop, color: 'text-slate-900', bg: 'bg-slate-100/90', border: 'border-slate-500/60' },
      'ALL IN ONE': { icon: Laptop, color: 'text-fuchsia-800', bg: 'bg-fuchsia-100/80', border: 'border-fuchsia-500/60' },
      'IMPRESSORA TÉRMICA': { icon: Printer, color: 'text-cyan-800', bg: 'bg-cyan-100/80', border: 'border-cyan-500/60' },
      'IMPRESSORA LASER': { icon: FileText, color: 'text-indigo-800', bg: 'bg-indigo-100/80', border: 'border-indigo-500/60' },
      'TOTEM': { icon: MonitorSmartphone, color: 'text-orange-800', bg: 'bg-orange-100/80', border: 'border-orange-500/60' },
      'ETIQUETA': { icon: Tag, color: 'text-emerald-800', bg: 'bg-emerald-100/80', border: 'border-emerald-500/60' },
      'COLETOR DE DADOS': { icon: Barcode, color: 'text-amber-900', bg: 'bg-amber-100/80', border: 'border-amber-500/60' },
      'CELULAR': { icon: Smartphone, color: 'text-rose-800', bg: 'bg-rose-100/80', border: 'border-rose-500/60' },
      'LOCAÇÃO EXTERNA': { icon: Truck, color: 'text-slate-800', bg: 'bg-slate-100/80', border: 'border-slate-500/40' },
    };
    return mapping[normalized] || { icon: Layers, color: 'text-slate-700', bg: 'bg-slate-100/80', border: 'border-slate-300/60' };
  };

  const inventoryGrouped = useMemo(() => {
    return inventory.reduce((acc, item) => {
      if (item.status === 'EM MANUTENÇÃO') return acc;
      const type = normalizeType(item.type);
      acc[type] = acc[type] || [];
      acc[type].push(item);
      return acc;
    }, {});
  }, [inventory]);

  const saveItem = () => {
    const errors = validateInventoryForm(form);
    setValidationErrors(errors);
    if (errors.length) return;

    const next = editingId
      ? inventory.map((item) => (item.id === editingId ? { ...item, ...form, quantity: Number(form.quantity) } : item))
      : [...inventory, { ...form, id: Date.now(), quantity: Number(form.quantity) }];
    onUpdateInventory(next);
    setForm({ type: '', name: '', serial: '', quantity: 1, status: 'Disponível' });
    setEditingId(null);
    setValidationErrors([]);
  };

  const editItem = (item) => {
    setEditingId(item.id);
    setForm({ type: item.type, name: item.name, serial: item.serial, quantity: item.quantity, status: item.status });
    setShowAddForm(false);
  };

  const removeItem = (itemId) => {
    const item = inventory.find((it) => it.id === itemId);
    if (!item) return;
    const confirmed = window.confirm(`Deseja realmente excluir o item “${item.name || item.type}”?`);
    if (!confirmed) return;
    onUpdateInventory(inventory.filter((it) => it.id !== itemId));
  };

  const inventoryByType = useMemo(() => {
    return inventory.reduce((acc, item) => {
      if (item.status === 'EM MANUTENÇÃO') return acc;
      const current = Number(item.quantity || 0);
      const type = normalizeType(item.type);
      acc[type] = (acc[type] || 0) + current;
      return acc;
    }, {});
  }, [inventory]);

  const getPeriodKey = (event) => {
    const dateValue = event.departureDate || event.startDate || event.eventDate || event.returnDate;
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return null;
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  };

  const formatPeriodLabel = (periodKey) => {
    if (!periodKey) return 'Sem data';
    const [year, month] = periodKey.split('-');
    const date = new Date(Number(year), Number(month) - 1, 1);
    return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  };

  const filteredEvents = useMemo(() => {
    const today = new Date();
    const startDate = new Date(today.getFullYear(), today.getMonth(), 1);

    return (events || []).filter((event) => {
      const periodKey = getPeriodKey(event);
      if (!periodKey) return false;

      const [year, month] = periodKey.split('-').map(Number);
      const eventDate = new Date(year, month - 1, 1);

      const limitDate = new Date();
      if (planningFilter === '15d') {
        limitDate.setDate(today.getDate() + 15);
      } else if (planningFilter === '30d') {
        limitDate.setDate(today.getDate() + 30);
      } else if (planningFilter === '45d') {
        limitDate.setDate(today.getDate() + 45);
      } else {
        limitDate.setDate(today.getDate() + 15);
      }

      return eventDate >= startDate && eventDate <= limitDate;
    });
  }, [events, planningFilter]);

  const demandByPeriod = useMemo(() => {
    const grouped = {};

    filteredEvents.forEach((event) => {
      const periodKey = getPeriodKey(event);
      if (!periodKey) return;
      const demandItems = (event.boards?.separar?.length ? event.boards.separar : event.boards?.montagem || []);

      demandItems.forEach((item) => {
        const type = normalizeType(item.type);
        if (!type) return;
        grouped[periodKey] = grouped[periodKey] || {};
        grouped[periodKey][type] = (grouped[periodKey][type] || 0) + Number(item.quantity || 0);
      });
    });

    return grouped;
  }, [filteredEvents]);

  const demandByType = useMemo(() => {
    return Object.values(demandByPeriod).reduce((acc, periodDemand) => {
      Object.entries(periodDemand).forEach(([type, quantity]) => {
        acc[type] = (acc[type] || 0) + quantity;
      });
      return acc;
    }, {});
  }, [demandByPeriod]);

  const riskEntries = useMemo(() => {
    return filteredEvents.flatMap((event) => {
      const periodKey = getPeriodKey(event);
      if (!periodKey) return [];

      const demandItems = (event.boards?.separar?.length ? event.boards.separar : event.boards?.montagem || []);
      const eventDate = event.departureDate || event.startDate || event.eventDate || event.returnDate;

      return demandItems
        .map((item) => {
          const type = normalizeType(item.type);
          if (!type) return null;

          const stock = inventoryByType[type] || 0;
          const demand = Number(item.quantity || 0);
          const deficit = demand - stock;
          if (demand <= 0 || deficit <= 0) return null;

          return {
            periodKey,
            periodLabel: formatPeriodLabel(periodKey),
            eventDate,
            eventDateLabel: eventDate ? new Date(eventDate).toLocaleDateString('pt-BR') : 'Sem data',
            type,
            demand,
            stock,
            deficit,
          };
        })
        .filter(Boolean);
    }).sort((a, b) => b.deficit - a.deficit);
  }, [filteredEvents, inventoryByType]);

  const allTypes = useMemo(() => {
    return Array.from(new Set([...Object.keys(inventoryByType), ...Object.keys(demandByType)]))
      .sort((a, b) => a.localeCompare(b));
  }, [inventoryByType, demandByType]);

  return (
    <div className="space-y-6">
      <NeumorphicCard className="p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Controle de Estoque</h2>
            <p className="text-sm text-slate-500">Gerencie quantidades e status dos equipamentos em seu estoque.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm text-slate-600">Saldo disponível: <span className="font-semibold">{totalAvailable}</span></div>
            <button className="neumorphic-button" onClick={() => setShowAddForm((prev) => !prev)}>
              <PlusCircle className="mr-2 h-4 w-4" />{showAddForm ? 'Fechar' : 'Cadastrar item'}
            </button>
          </div>
        </div>
        {showAddForm && !editingId && (
          <div className="grid gap-4 mt-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <select className="neumorphic-select w-full" value={form.type} onChange={(e) => handleInput('type', e.target.value)}>
                <option value="">Tipo de Equipamento</option>
                {itemTypes?.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              {validationErrors.find((error) => error.field === 'type') && <p className="text-sm text-rose-600">{validationErrors.find((error) => error.field === 'type').message}</p>}
            </div>
            <div className="space-y-2">
              <input className="neumorphic-input w-full" placeholder="Nome do Equipamento" value={form.name} onChange={(e) => handleInput('name', e.target.value)} />
              {validationErrors.find((error) => error.field === 'name') && <p className="text-sm text-rose-600">{validationErrors.find((error) => error.field === 'name').message}</p>}
            </div>
            <div className="space-y-2">
              <input className="neumorphic-input w-full" placeholder="Número de Série" value={form.serial} onChange={(e) => handleInput('serial', e.target.value)} />
              {validationErrors.find((error) => error.field === 'serial') && <p className="text-sm text-rose-600">{validationErrors.find((error) => error.field === 'serial').message}</p>}
            </div>
            <div className="space-y-2">
              <input type="number" min="1" className="neumorphic-input w-full" placeholder="Quantidade" value={form.quantity} onChange={(e) => handleInput('quantity', e.target.value)} />
              {validationErrors.find((error) => error.field === 'quantity') && <p className="text-sm text-rose-600">{validationErrors.find((error) => error.field === 'quantity').message}</p>}
            </div>
            <select className="neumorphic-select w-full" value={form.status} onChange={(e) => handleInput('status', e.target.value)}>
              <option>Disponível</option>
              <option>EM MANUTENÇÃO</option>
            </select>
            <div className="sm:col-span-2 lg:col-span-4 flex gap-2 justify-end mt-2">
              <button className="neumorphic-button" onClick={saveItem}>{editingId ? 'Atualizar' : 'Salvar'}</button>
              <button className="neumorphic-button" onClick={() => { setShowAddForm(false); setEditingId(null); setForm({ type: '', name: '', serial: '', quantity: 1, status: 'Disponível' }); setValidationErrors([]); }}>Cancelar</button>
            </div>
          </div>
        )}
      </NeumorphicCard>

      <NeumorphicCard className="p-6 space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-xl font-semibold">Planejamento de saída por período</h3>
            <p className="text-sm text-slate-500">Veja o estoque consolidado por tipo e os meses em que as saídas previstas podem superar o saldo disponível.</p>
          </div>
          <select className="neumorphic-select" value={planningFilter} onChange={(e) => setPlanningFilter(e.target.value)}>
            <option value="15d">Próximos 15 dias</option>
            <option value="30d">Próximos 30 dias</option>
            <option value="45d">Próximos 45 dias</option>
          </select>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
          <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-slate-50/70 p-4">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="pb-3 pr-4">Tipo</th>
                  <th className="pb-3 pr-4">Estoque</th>
                  <th className="pb-3 pr-4">Saídas previstas</th>
                  <th className="pb-3">Situação</th>
                </tr>
              </thead>
              <tbody>
                {allTypes.map((type) => {
                  const stock = inventoryByType[type] || 0;
                  const demand = demandByType[type] || 0;
                  const delta = demand - stock;
                  return (
                    <tr key={type} className="border-t border-slate-200/70">
                      <td className="py-3 pr-4 font-semibold text-slate-700">{type}</td>
                      <td className="py-3 pr-4">{stock}</td>
                      <td className="py-3 pr-4">{demand}</td>
                      <td className={`py-3 font-semibold ${delta > 0 ? 'text-rose-600' : demand > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {delta > 0 ? `Falta ${delta}` : demand > 0 ? 'Com demanda' : 'Sem demanda'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-3">
            <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4">
              <h4 className="text-base font-semibold">Períodos com maior risco</h4>
              <p className="mt-1 text-sm text-slate-500">Meses em que a demanda prevista supera o total disponível.</p>
              <div className="mt-4 space-y-2">
                {riskEntries.length === 0 ? (
                  <div className="text-sm text-slate-500">Nenhum risco identificado no período filtrado.</div>
                ) : (
                  riskEntries.slice(0, 8).map((entry) => (
                    <div key={`${entry.periodKey}-${entry.type}`} className="rounded-2xl border border-rose-100 bg-white/80 p-3 text-sm">
                      <div className="font-semibold text-slate-700">{entry.periodLabel}</div>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <span>{entry.type}</span>
                        <span className="text-rose-600">{entry.demand} / {entry.stock}</span>
                      </div>
                      <div className="mt-2 text-xs text-slate-500">Falta em: {entry.eventDateLabel}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </NeumorphicCard>

      <div className="overflow-x-auto rounded-3xl neumorphic shadow-inner">
        <table className="min-w-full border-separate" style={{ borderSpacing: '0 0.75rem' }}>
          <thead>
            <tr className="text-left text-sm text-slate-500 uppercase">
              <th className="px-6 py-3">Tipo</th>
              <th className="px-6 py-3">Nome</th>
              <th className="px-6 py-3">Nº Série</th>
              <th className="px-6 py-3">Qtd</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {Object.keys(inventoryGrouped).map((type) => {
              const items = inventoryGrouped[type] || [];
              const total = items.reduce((s, it) => s + Number(it.quantity || 0), 0);
              const expanded = !!expandedTypes[type];
              return (
                <React.Fragment key={type}>
                  <tr className="rounded-3xl shadow-sm" style={{ border: `1px solid ${getTypeMeta(type).border.replace('/60', '')}` }}>
                    <td className={`px-6 py-4 font-semibold ${getTypeMeta(type).color}`}>
                      <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${getTypeMeta(type).bg} mr-3`}>
                        {React.createElement(getTypeMeta(type).icon, { className: 'h-4 w-4' })}
                      </span>
                      {type}
                    </td>
                    <td className="px-6 py-4">-</td>
                    <td className="px-6 py-4">-</td>
                    <td className="px-6 py-4">{total}</td>
                    <td className="px-6 py-4 font-semibold text-slate-700">{items[0]?.status || ''}</td>
                    <td className="px-6 py-4 flex gap-2 items-center">
                      <button className="neumorphic-button" onClick={() => setExpandedTypes((prev) => ({ ...prev, [type]: !prev[type] }))} title={expanded ? 'Ocultar itens' : 'Ver itens'}>
                        <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'transform rotate-180' : ''}`} />
                      </button>
                    </td>
                  </tr>
                  {expanded && items.map((item) => {
                    const isEditingItem = item.id === editingId;
                    return (
                      <tr key={item.id} className="bg-white/60 rounded-3xl shadow-sm">
                        <td className={`px-6 py-4 ${getTypeMeta(item.type).color}`}>
                          {isEditingItem ? (
                            <select className="neumorphic-select w-full" value={form.type} onChange={(e) => handleInput('type', e.target.value)}>
                              <option value="">Tipo de Equipamento</option>
                              {itemTypes?.map((type) => (
                                <option key={type} value={type}>{type}</option>
                              ))}
                            </select>
                          ) : (
                            <><span className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${getTypeMeta(item.type).bg} mr-3`}>
                              {React.createElement(getTypeMeta(item.type).icon, { className: 'h-4 w-4' })}
                            </span>{item.type}</>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {isEditingItem ? (
                            <input className="neumorphic-input w-full" value={form.name} onChange={(e) => handleInput('name', e.target.value)} />
                          ) : item.name}
                        </td>
                        <td className="px-6 py-4">
                          {isEditingItem ? (
                            <input className="neumorphic-input w-full" value={form.serial} onChange={(e) => handleInput('serial', e.target.value)} />
                          ) : item.serial}
                        </td>
                        <td className="px-6 py-4">
                          {isEditingItem ? (
                            <input type="number" min="1" className="neumorphic-input w-full" value={form.quantity} onChange={(e) => handleInput('quantity', e.target.value)} />
                          ) : item.quantity}
                        </td>
                        <td className="px-6 py-4 font-semibold text-slate-700">
                          {isEditingItem ? (
                            <select className="neumorphic-select w-full" value={form.status} onChange={(e) => handleInput('status', e.target.value)}>
                              <option>Disponível</option>
                              <option>EM MANUTENÇÃO</option>
                            </select>
                          ) : item.status}
                        </td>
                        <td className="px-6 py-4 flex gap-2 items-center">
                          {isEditingItem ? (
                            <>
                              <button className="neumorphic-button" onClick={saveItem}>Salvar</button>
                              <button className="neumorphic-button" onClick={() => { setEditingId(null); setForm({ type: '', name: '', serial: '', quantity: 1, status: 'Disponível' }); setValidationErrors([]); }}>Cancelar</button>
                            </>
                          ) : (
                            <>
                              <button className="neumorphic-button p-3" onClick={() => editItem(item)} title="Editar"><Pencil className="h-4 w-4" /></button>
                              <button className="neumorphic-button p-3" onClick={() => removeItem(item.id)} title="Excluir"><Trash2 className="h-4 w-4" /></button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
