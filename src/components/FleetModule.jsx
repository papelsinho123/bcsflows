import React, { useMemo, useState } from 'react';
import NeumorphicCard from './NeumorphicCard.jsx';

const DEFAULT_FLEET_TYPES = ['Troca de óleo', 'Manutenção', 'Troca de pneus', 'Revisão'];

export const formatDatePtBR = (value) => {
  if (!value) return '';
  if (typeof value === 'string') {
    const normalized = value.trim();
    if (!normalized) return '';
    const isoMatch = normalized.match(/^\d{4}-\d{2}-\d{2}$/);
    if (isoMatch) {
      const [year, month, day] = normalized.split('-');
      return `${day}/${month}/${year}`;
    }
    const parsed = new Date(normalized);
    if (!Number.isNaN(parsed.getTime())) {
      return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(parsed);
    }
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(parsed);
};

export const normalizeFleetVehicle = (vehicle = {}) => {
  const normalized = {
    id: vehicle.id || `vehicle-${Date.now()}`,
    name: String(vehicle.name || '').trim(),
    plate: String(vehicle.plate || '').trim().toUpperCase(),
    brand: String(vehicle.brand || '').trim(),
    model: String(vehicle.model || '').trim(),
    year: Number(vehicle.year || new Date().getFullYear()),
    status: String(vehicle.status || 'Ativo').trim(),
    returnDate: vehicle.returnDate || '',
    scheduledMaintenance: vehicle.scheduledMaintenance || null,
    maintenanceHistory: Array.isArray(vehicle.maintenanceHistory) ? vehicle.maintenanceHistory.map((entry, index) => ({
      id: entry.id || `${vehicle.id || 'vehicle'}-history-${index}`,
      date: entry.date || new Date().toISOString().slice(0, 10),
      type: String(entry.type || 'Manutenção').trim(),
      description: String(entry.description || '').trim(),
      cost: Number(entry.cost || 0),
      location: String(entry.location || '').trim(),
      receipt: entry.receipt || '',
      receiptName: entry.receiptName || '',
    })) : [],
  };

  return normalized;
};

export const getFleetMaintenanceAlerts = (vehicles = [], referenceDate = new Date()) => {
  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);

  return vehicles
    .filter((vehicle) => vehicle?.scheduledMaintenance?.dueDate)
    .filter((vehicle) => {
      const dueDate = new Date(vehicle.scheduledMaintenance.dueDate);
      return !Number.isNaN(dueDate.getTime()) && dueDate <= today;
    })
    .map((vehicle) => {
      const maintenance = vehicle.scheduledMaintenance || {};
      return `${vehicle.name} (${vehicle.plate}) — ${maintenance.type} — ${maintenance.location || 'Local não informado'} — ${formatDatePtBR(maintenance.dueDate)}`;
    });
};

export const buildFleetReport = (vehicle = {}) => {
  const normalized = normalizeFleetVehicle(vehicle);
  const lines = [
    'RELATÓRIO DE MANUTENÇÃO DE VEÍCULO',
    `Veículo: ${normalized.name || 'Não identificado'}`,
    `Placa: ${normalized.plate || 'N/A'}`,
    `Marca/Modelo: ${normalized.brand || 'N/A'} ${normalized.model || ''}`.trim(),
    `Ano: ${normalized.year || 'N/A'}`,
    `Status: ${normalized.status || 'Ativo'}`,
    `Previsão de retorno: ${normalized.returnDate ? formatDatePtBR(normalized.returnDate) : 'Não informada'}`,
    '',
    'Histórico de manutenção:',
  ];

  if (!normalized.maintenanceHistory.length) {
    lines.push('Nenhum registro encontrado.');
    return lines.join('\n');
  }

  normalized.maintenanceHistory.forEach((entry) => {
    lines.push(`- ${formatDatePtBR(entry.date)} | ${entry.type} | ${entry.location || 'Local não informado'} | ${entry.description || 'Sem descrição'} | Custo: R$ ${Number(entry.cost || 0).toFixed(2)}`);
  });

  return lines.join('\n');
};

export default function FleetModule({ config = {}, onUpdateConfig = () => {}, currentUser, events = [] }) {
  const safeConfig = config || {};
  const vehicles = Array.isArray(safeConfig.fleetVehicles) ? safeConfig.fleetVehicles : [];
  const fleetAssignments = useMemo(() => {
    const map = {};
    events.forEach((event) => {
      const transportItems = Array.isArray(event?.boards?.deslocamento) ? event.boards.deslocamento : [];
      transportItems.forEach((item) => {
        if (!item?.vehicleId) return;
        const assignedProfessionals = Array.isArray(event?.users) ? event.users : [];
        const assignedFromAssignments = Array.isArray(event?.userAssignments) ? event.userAssignments.map((assignment) => assignment.userId) : [];
        map[item.vehicleId] = {
          eventId: event.id,
          eventName: event.name,
          professionals: Array.from(new Set([...assignedProfessionals, ...assignedFromAssignments])).filter(Boolean),
        };
      });
    });
    return map;
  }, [events]);
  const [form, setForm] = useState({
    name: '',
    plate: '',
    brand: '',
    model: '',
    year: new Date().getFullYear(),
    status: 'Ativo',
    returnDate: '',
  });
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [serviceForm, setServiceForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    type: DEFAULT_FLEET_TYPES[0],
    description: '',
    location: '',
    cost: '',
    receipt: '',
    receiptName: '',
  });
  const [isEditingVehicle, setIsEditingVehicle] = useState(false);

  const activeVehicle = useMemo(
    () => vehicles.find((vehicle) => vehicle.id === selectedVehicleId) || vehicles[0] || null,
    [selectedVehicleId, vehicles],
  );

  const fleetAlerts = useMemo(() => getFleetMaintenanceAlerts(vehicles), [vehicles]);
  const vehicleUsageDetails = useMemo(() => {
    const details = {};
    vehicles.forEach((vehicle) => {
      const assignment = fleetAssignments[vehicle.id];
      if (assignment) {
        details[vehicle.id] = assignment;
      }
    });
    return details;
  }, [fleetAssignments, vehicles]);

  const openVehicleEditor = (vehicle = null) => {
    const source = vehicle || activeVehicle;
    if (!source) {
      setForm({ name: '', plate: '', brand: '', model: '', year: new Date().getFullYear(), status: 'Ativo', returnDate: '' });
      setIsEditingVehicle(false);
      return;
    }

    setForm({
      name: source.name || '',
      plate: source.plate || '',
      brand: source.brand || '',
      model: source.model || '',
      year: source.year || new Date().getFullYear(),
      status: source.status || 'Ativo',
      returnDate: source.returnDate || '',
    });
    setSelectedVehicleId(source.id);
    setIsEditingVehicle(true);
  };

  const addVehicle = () => {
    const nextVehicle = normalizeFleetVehicle({
      ...form,
      id: isEditingVehicle && activeVehicle ? activeVehicle.id : `vehicle-${Date.now()}`,
      maintenanceHistory: isEditingVehicle && activeVehicle ? activeVehicle.maintenanceHistory : [],
      scheduledMaintenance: isEditingVehicle && activeVehicle ? activeVehicle.scheduledMaintenance : null,
      returnDate: form.status === 'Em manutenção' ? form.returnDate : '',
    });

    if (!nextVehicle.name || !nextVehicle.plate) {
      window.alert('Informe nome e placa do veículo.');
      return;
    }

    const nextVehicles = isEditingVehicle && activeVehicle
      ? vehicles.map((vehicle) => (vehicle.id === activeVehicle.id ? nextVehicle : vehicle))
      : [...vehicles, nextVehicle];

    onUpdateConfig({ ...safeConfig, fleetVehicles: nextVehicles });
    setSelectedVehicleId(nextVehicle.id);
    setIsEditingVehicle(false);
    setForm({
      name: '',
      plate: '',
      brand: '',
      model: '',
      year: new Date().getFullYear(),
      status: 'Ativo',
      returnDate: '',
    });
  };

  const removeVehicle = (id) => {
    const shouldDelete = window.confirm('Deseja remover esse veículo do cadastro da frota?');
    if (!shouldDelete) return;

    const nextVehicles = vehicles.filter((vehicle) => vehicle.id !== id);
    onUpdateConfig({ ...safeConfig, fleetVehicles: nextVehicles });
    if (selectedVehicleId === id) {
      setSelectedVehicleId(nextVehicles[0]?.id || '');
    }
    setIsEditingVehicle(false);
  };

  const updateStatusWithReturnDate = (status) => {
    if (!activeVehicle) return;
    const nextStatus = status || 'Ativo';
    const nextVehicles = vehicles.map((vehicle) => {
      if (vehicle.id !== activeVehicle.id) return vehicle;
      return {
        ...vehicle,
        status: nextStatus,
        returnDate: nextStatus === 'Em manutenção' ? (vehicle.returnDate || '') : '',
      };
    });
    onUpdateConfig({ ...safeConfig, fleetVehicles: nextVehicles });
  };

  const saveScheduledMaintenance = () => {
    if (!activeVehicle) return;
    const type = serviceForm.type || DEFAULT_FLEET_TYPES[0];
    const dueDate = serviceForm.date || new Date().toISOString().slice(0, 10);
    const nextVehicles = vehicles.map((vehicle) => {
      if (vehicle.id !== activeVehicle.id) return vehicle;
      return {
        ...vehicle,
        scheduledMaintenance: {
          type,
          dueDate,
          location: serviceForm.location || 'Local não informado',
        },
      };
    });
    onUpdateConfig({ ...safeConfig, fleetVehicles: nextVehicles });
  };

  const addMaintenance = () => {
    if (!activeVehicle) {
      window.alert('Cadastre um veículo antes de registrar manutenção.');
      return;
    }

    const entry = {
      id: `maintenance-${Date.now()}`,
      date: serviceForm.date || new Date().toISOString().slice(0, 10),
      type: serviceForm.type,
      description: serviceForm.description || 'Sem descrição',
      cost: Number(serviceForm.cost || 0),
      location: serviceForm.location || 'Local não informado',
      receipt: serviceForm.receipt || '',
      receiptName: serviceForm.receiptName || '',
    };

    const nextVehicles = vehicles.map((vehicle) => {
      if (vehicle.id !== activeVehicle.id) return vehicle;
      return normalizeFleetVehicle({
        ...vehicle,
        maintenanceHistory: [...(vehicle.maintenanceHistory || []), entry],
        scheduledMaintenance: null,
      });
    });

    onUpdateConfig({ ...safeConfig, fleetVehicles: nextVehicles });
    setServiceForm({
      date: new Date().toISOString().slice(0, 10),
      type: DEFAULT_FLEET_TYPES[0],
      description: '',
      location: '',
      cost: '',
      receipt: '',
      receiptName: '',
    });
  };

  const handleReceiptUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setServiceForm((prev) => ({
        ...prev,
        receipt: String(reader.result || ''),
        receiptName: file.name,
      }));
    };
    reader.readAsDataURL(file);
  };

  const downloadReceipt = (receipt, name) => {
    if (!receipt) return;
    const link = document.createElement('a');
    link.href = receipt;
    link.download = name || 'comprovante-manutencao';
    link.click();
  };

  const handlePrintReport = () => {
    if (!activeVehicle) return;
    const report = buildFleetReport(activeVehicle);
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.alert('O navegador bloqueou a abertura da janela de impressão.');
      return;
    }
    printWindow.document.write(`
      <html>
        <head>
          <title>Relatório de Manutenção - ${activeVehicle.name}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #1f2937; }
            pre { white-space: pre-wrap; word-break: break-word; }
          </style>
        </head>
        <body>
          <pre>${report.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
  };

  return (
    <div className="space-y-6">
      {fleetAlerts.length > 0 && (
        <div className="rounded-3xl border border-rose-400 bg-rose-100 p-4 text-sm text-rose-900 shadow-sm">
          <div className="mb-2 font-semibold uppercase tracking-wide">Avisos de manutenção</div>
          <div className="space-y-2">
            {fleetAlerts.map((alert, index) => (
              <p key={`${alert}-${index}`} className="font-semibold">{alert}</p>
            ))}
          </div>
        </div>
      )}

      {activeVehicle && (
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <NeumorphicCard>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold">{activeVehicle.name}</h3>
                <p className="text-sm text-slate-500">{activeVehicle.plate} • {activeVehicle.brand} {activeVehicle.model} • {activeVehicle.year}</p>
              </div>
              <div className="flex gap-2">
                <button className="neumorphic-button outline" onClick={() => openVehicleEditor(activeVehicle)}>Editar</button>
                <button className="neumorphic-button outline" onClick={() => removeVehicle(activeVehicle.id)}>Remover</button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl bg-white/70 p-3 shadow-sm">
                <div className="text-xs uppercase tracking-wide text-slate-500">Status</div>
                <div className="mt-2 flex items-center gap-2">
                  <select
                    className="neumorphic-select w-full"
                    value={activeVehicle.status}
                    onChange={(event) => updateStatusWithReturnDate(event.target.value)}
                  >
                    <option value="Ativo">Ativo</option>
                    <option value="Em manutenção">Em manutenção</option>
                    <option value="Inativo">Inativo</option>
                  </select>
                </div>
                {activeVehicle.status === 'Em manutenção' && (
                  <div className="mt-3">
                    <label className="text-xs uppercase tracking-wide text-slate-500">Previsão de retorno</label>
                    <input
                      type="date"
                      className="neumorphic-input mt-1 w-full"
                      value={activeVehicle.returnDate || ''}
                      onChange={(event) => {
                        const nextVehicles = vehicles.map((vehicle) => vehicle.id === activeVehicle.id ? { ...vehicle, returnDate: event.target.value } : vehicle);
                        onUpdateConfig({ ...safeConfig, fleetVehicles: nextVehicles });
                      }}
                    />
                  </div>
                )}
              </div>

              <div className="rounded-3xl bg-white/70 p-3 shadow-sm">
                <div className="text-xs uppercase tracking-wide text-slate-500">Última manutenção</div>
                <div className="mt-2 text-lg font-semibold">{activeVehicle.maintenanceHistory?.length ? formatDatePtBR(activeVehicle.maintenanceHistory[activeVehicle.maintenanceHistory.length - 1].date) : 'Nenhuma'}</div>
                {activeVehicle.scheduledMaintenance && (
                  <div className="mt-3 rounded-2xl border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
                    <div className="font-semibold">Manutenção programada</div>
                    <div>{activeVehicle.scheduledMaintenance.type}</div>
                    <div>{activeVehicle.scheduledMaintenance.location || 'Local não informado'}</div>
                    <div>{formatDatePtBR(activeVehicle.scheduledMaintenance.dueDate)}</div>
                  </div>
                )}
                {vehicleUsageDetails[activeVehicle.id] && (
                  <div className="mt-3 rounded-2xl border border-rose-300 bg-rose-50 p-2 text-xs text-rose-900">
                    <div className="font-semibold">Veículo em uso</div>
                    <div>Evento: {vehicleUsageDetails[activeVehicle.id].eventName}</div>
                    {vehicleUsageDetails[activeVehicle.id].professionals?.length > 0 && (
                      <div>Profissionais: {vehicleUsageDetails[activeVehicle.id].professionals.join(', ')}</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 rounded-3xl bg-white/70 p-4 shadow-sm">
              <h4 className="text-lg font-semibold">Programar manutenção</h4>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <select className="neumorphic-select" value={serviceForm.type} onChange={(e) => setServiceForm((prev) => ({ ...prev, type: e.target.value }))}>
                  {DEFAULT_FLEET_TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
                <input type="date" className="neumorphic-input" value={serviceForm.date} onChange={(e) => setServiceForm((prev) => ({ ...prev, date: e.target.value }))} />
                <input className="neumorphic-input sm:col-span-2" placeholder="Local da manutenção" value={serviceForm.location} onChange={(e) => setServiceForm((prev) => ({ ...prev, location: e.target.value }))} />
              </div>
              <div className="mt-3 flex flex-wrap gap-3">
                <button className="neumorphic-button primary" onClick={saveScheduledMaintenance}>Salvar programação</button>
              </div>
            </div>

            <div className="mt-5 rounded-3xl bg-white/70 p-4 shadow-sm">
              <h4 className="text-lg font-semibold">Registrar manutenção</h4>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <input type="date" className="neumorphic-input" value={serviceForm.date} onChange={(e) => setServiceForm((prev) => ({ ...prev, date: e.target.value }))} />
                <select className="neumorphic-select" value={serviceForm.type} onChange={(e) => setServiceForm((prev) => ({ ...prev, type: e.target.value }))}>
                  {DEFAULT_FLEET_TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
                <input className="neumorphic-input sm:col-span-2" placeholder="Local da manutenção" value={serviceForm.location} onChange={(e) => setServiceForm((prev) => ({ ...prev, location: e.target.value }))} />
                <input type="number" className="neumorphic-input" placeholder="Custo (R$)" value={serviceForm.cost} onChange={(e) => setServiceForm((prev) => ({ ...prev, cost: e.target.value }))} />
                <label className="flex items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white/80 px-3 py-2 text-sm text-slate-600">
                  <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleReceiptUpload} />
                  {serviceForm.receiptName || 'Anexar comprovante'}
                </label>
                <textarea className="neumorphic-input sm:col-span-2" rows="3" placeholder="Descrição da manutenção" value={serviceForm.description} onChange={(e) => setServiceForm((prev) => ({ ...prev, description: e.target.value }))} />
              </div>
              <div className="mt-3 flex flex-wrap gap-3">
                <button className="neumorphic-button primary" onClick={addMaintenance}>Salvar manutenção</button>
                {serviceForm.receipt && (
                  <button className="neumorphic-button secondary" onClick={() => downloadReceipt(serviceForm.receipt, serviceForm.receiptName || 'comprovante-manutencao')}>Download do comprovante</button>
                )}
                <button className="neumorphic-button secondary" onClick={handlePrintReport}>Gerar relatório</button>
              </div>
            </div>
          </NeumorphicCard>

          <NeumorphicCard>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-xl font-semibold">Histórico</h3>
            </div>
            {activeVehicle.maintenanceHistory?.length ? (
              <div className="space-y-3">
                {[...activeVehicle.maintenanceHistory].reverse().map((entry) => (
                  <div key={entry.id} className="rounded-3xl bg-white/70 p-3 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-semibold">{entry.type}</div>
                      <div className="text-xs text-slate-500">{formatDatePtBR(entry.date)}</div>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{entry.location || 'Local não informado'}</p>
                    <p className="mt-1 text-sm text-slate-600">{entry.description}</p>
                    <div className="mt-2 flex justify-between text-xs text-slate-500">
                      <span>Custo: R$ {Number(entry.cost || 0).toFixed(2)}</span>
                      {entry.receipt && (
                        <button className="text-sky-700 underline" onClick={() => downloadReceipt(entry.receipt, entry.receiptName || 'comprovante-manutencao')}>Download</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-slate-500">Nenhuma manutenção registrada para este veículo.</div>
            )}
          </NeumorphicCard>
        </div>
      )}

      <NeumorphicCard>
        <div className="space-y-3 rounded-3xl bg-white/60 p-4 shadow-sm">
          <h3 className="text-lg font-semibold">Cadastrar veículo</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <input className="neumorphic-input" placeholder="Nome do veículo" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
            <input className="neumorphic-input" placeholder="Placa" value={form.plate} onChange={(e) => setForm((prev) => ({ ...prev, plate: e.target.value.toUpperCase() }))} />
            <input className="neumorphic-input" placeholder="Marca" value={form.brand} onChange={(e) => setForm((prev) => ({ ...prev, brand: e.target.value }))} />
            <input className="neumorphic-input" placeholder="Modelo" value={form.model} onChange={(e) => setForm((prev) => ({ ...prev, model: e.target.value }))} />
            <input type="number" className="neumorphic-input" placeholder="Ano" value={form.year} onChange={(e) => setForm((prev) => ({ ...prev, year: Number(e.target.value || 0) }))} />
            <select className="neumorphic-select" value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value, returnDate: e.target.value === 'Em manutenção' ? prev.returnDate : '' }))}>
              <option value="Ativo">Ativo</option>
              <option value="Em manutenção">Em manutenção</option>
              <option value="Inativo">Inativo</option>
            </select>
            {form.status === 'Em manutenção' && (
              <input
                type="date"
                className="neumorphic-input"
                placeholder="Previsão de retorno"
                value={form.returnDate}
                onChange={(e) => setForm((prev) => ({ ...prev, returnDate: e.target.value }))}
              />
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            <button className="neumorphic-button primary" onClick={addVehicle}>{isEditingVehicle ? 'Salvar veículo' : 'Adicionar veículo'}</button>
            {isEditingVehicle && (
              <button className="neumorphic-button outline" onClick={() => { setIsEditingVehicle(false); setForm({ name: '', plate: '', brand: '', model: '', year: new Date().getFullYear(), status: 'Ativo', returnDate: '' }); }}>Cancelar</button>
            )}
          </div>
        </div>
      </NeumorphicCard>

      {!vehicles.length && (
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          Nenhum veículo cadastrado.
        </div>
      )}

      <div className="space-y-2">
        {vehicles.map((vehicle) => (
          <button
            key={vehicle.id}
            type="button"
            className={`w-full rounded-3xl border p-3 text-left shadow-sm transition ${selectedVehicleId === vehicle.id || (!selectedVehicleId && activeVehicle?.id === vehicle.id) ? 'border-sky-300 bg-sky-50' : 'border-slate-200 bg-white/80'}`}
            onClick={() => setSelectedVehicleId(vehicle.id)}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold">{vehicle.name}</div>
                <div className="text-xs text-slate-500">{vehicle.plate} • {vehicle.brand} {vehicle.model}</div>
              </div>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-slate-700">{vehicle.status}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
