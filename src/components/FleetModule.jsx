import React, { useMemo, useState } from 'react';
import NeumorphicCard from './NeumorphicCard.jsx';

const DEFAULT_FLEET_TYPES = ['Troca de óleo', 'Manutenção', 'Troca de pneus', 'Revisão'];

export const normalizeFleetVehicle = (vehicle = {}) => {
  const normalized = {
    id: vehicle.id || `vehicle-${Date.now()}`,
    name: String(vehicle.name || '').trim(),
    plate: String(vehicle.plate || '').trim().toUpperCase(),
    brand: String(vehicle.brand || '').trim(),
    model: String(vehicle.model || '').trim(),
    year: Number(vehicle.year || new Date().getFullYear()),
    currentOdometer: Number(vehicle.currentOdometer || 0),
    status: String(vehicle.status || 'Ativo').trim(),
    maintenanceHistory: Array.isArray(vehicle.maintenanceHistory) ? vehicle.maintenanceHistory.map((entry, index) => ({
      id: entry.id || `${vehicle.id || 'vehicle'}-history-${index}`,
      date: entry.date || new Date().toISOString().slice(0, 10),
      type: String(entry.type || 'Manutenção').trim(),
      description: String(entry.description || '').trim(),
      cost: Number(entry.cost || 0),
      odometer: Number(entry.odometer || vehicle.currentOdometer || 0),
    })) : [],
  };

  return normalized;
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
    '',
    'Histórico de manutenção:',
  ];

  if (!normalized.maintenanceHistory.length) {
    lines.push('Nenhum registro encontrado.');
    return lines.join('\n');
  }

  normalized.maintenanceHistory.forEach((entry) => {
    lines.push(`- ${entry.date} | ${entry.type} | ${entry.description || 'Sem descrição'} | KM: ${entry.odometer || 0} | Custo: R$ ${Number(entry.cost || 0).toFixed(2)}`);
  });

  return lines.join('\n');
};

export default function FleetModule({ config = {}, onUpdateConfig = () => {}, currentUser }) {
  const safeConfig = config || {};
  const vehicles = Array.isArray(safeConfig.fleetVehicles) ? safeConfig.fleetVehicles : [];
  const [form, setForm] = useState({
    name: '',
    plate: '',
    brand: '',
    model: '',
    year: new Date().getFullYear(),
    currentOdometer: 0,
    status: 'Ativo',
  });
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [serviceForm, setServiceForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    type: DEFAULT_FLEET_TYPES[0],
    description: '',
    cost: '',
    odometer: 0,
  });

  const activeVehicle = useMemo(
    () => vehicles.find((vehicle) => vehicle.id === selectedVehicleId) || vehicles[0] || null,
    [selectedVehicleId, vehicles],
  );

  const addVehicle = () => {
    const nextVehicle = normalizeFleetVehicle({
      ...form,
      id: `vehicle-${Date.now()}`,
      maintenanceHistory: [],
    });

    if (!nextVehicle.name || !nextVehicle.plate) {
      window.alert('Informe nome e placa do veículo.');
      return;
    }

    const nextVehicles = [...vehicles, nextVehicle];
    onUpdateConfig({ ...safeConfig, fleetVehicles: nextVehicles });
    setSelectedVehicleId(nextVehicle.id);
    setForm({
      name: '',
      plate: '',
      brand: '',
      model: '',
      year: new Date().getFullYear(),
      currentOdometer: 0,
      status: 'Ativo',
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
      odometer: Number(serviceForm.odometer || activeVehicle.currentOdometer || 0),
    };

    const nextVehicles = vehicles.map((vehicle) => {
      if (vehicle.id !== activeVehicle.id) return vehicle;
      const normalizedVehicle = normalizeFleetVehicle({
        ...vehicle,
        currentOdometer: Math.max(Number(vehicle.currentOdometer || 0), Number(entry.odometer || 0)),
        maintenanceHistory: [...(vehicle.maintenanceHistory || []), entry],
      });
      return normalizedVehicle;
    });

    onUpdateConfig({ ...safeConfig, fleetVehicles: nextVehicles });
    setServiceForm({
      date: new Date().toISOString().slice(0, 10),
      type: DEFAULT_FLEET_TYPES[0],
      description: '',
      cost: '',
      odometer: activeVehicle.currentOdometer || 0,
    });
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
      <NeumorphicCard>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold">Controle de Frota</h2>
            <p className="text-sm text-slate-500">Cadastro de veículos, manutenção e histórico por unidade.</p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3 rounded-3xl bg-white/60 p-4 shadow-sm">
            <h3 className="text-lg font-semibold">Cadastrar veículo</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <input className="neumorphic-input" placeholder="Nome do veículo" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
              <input className="neumorphic-input" placeholder="Placa" value={form.plate} onChange={(e) => setForm((prev) => ({ ...prev, plate: e.target.value.toUpperCase() }))} />
              <input className="neumorphic-input" placeholder="Marca" value={form.brand} onChange={(e) => setForm((prev) => ({ ...prev, brand: e.target.value }))} />
              <input className="neumorphic-input" placeholder="Modelo" value={form.model} onChange={(e) => setForm((prev) => ({ ...prev, model: e.target.value }))} />
              <input type="number" className="neumorphic-input" placeholder="Ano" value={form.year} onChange={(e) => setForm((prev) => ({ ...prev, year: Number(e.target.value || 0) }))} />
              <input type="number" className="neumorphic-input" placeholder="KM atual" value={form.currentOdometer} onChange={(e) => setForm((prev) => ({ ...prev, currentOdometer: Number(e.target.value || 0) }))} />
              <select className="neumorphic-select sm:col-span-2" value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}>
                <option value="Ativo">Ativo</option>
                <option value="Em manutenção">Em manutenção</option>
                <option value="Inativo">Inativo</option>
              </select>
            </div>
            <button className="neumorphic-button primary" onClick={addVehicle}>Adicionar veículo</button>
          </div>

          <div className="space-y-3 rounded-3xl bg-white/60 p-4 shadow-sm">
            <h3 className="text-lg font-semibold">Veículos cadastrados</h3>
            <div className="space-y-2">
              {vehicles.length === 0 ? (
                <div className="text-sm text-slate-500">Nenhum veículo cadastrado.</div>
              ) : (
                vehicles.map((vehicle) => (
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
                ))
              )}
            </div>
          </div>
        </div>
      </NeumorphicCard>

      {activeVehicle && (
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <NeumorphicCard>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold">{activeVehicle.name}</h3>
                <p className="text-sm text-slate-500">{activeVehicle.plate} • {activeVehicle.brand} {activeVehicle.model} • {activeVehicle.year}</p>
              </div>
              <button className="neumorphic-button outline" onClick={() => removeVehicle(activeVehicle.id)}>Remover veículo</button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-3xl bg-white/70 p-3 shadow-sm">
                <div className="text-xs uppercase tracking-wide text-slate-500">KM atual</div>
                <div className="mt-1 text-lg font-semibold">{Number(activeVehicle.currentOdometer || 0).toLocaleString('pt-BR')} km</div>
              </div>
              <div className="rounded-3xl bg-white/70 p-3 shadow-sm">
                <div className="text-xs uppercase tracking-wide text-slate-500">Última manutenção</div>
                <div className="mt-1 text-lg font-semibold">{activeVehicle.maintenanceHistory?.length ? activeVehicle.maintenanceHistory[activeVehicle.maintenanceHistory.length - 1].date : 'Nenhuma'}</div>
              </div>
              <div className="rounded-3xl bg-white/70 p-3 shadow-sm">
                <div className="text-xs uppercase tracking-wide text-slate-500">Status</div>
                <div className="mt-1 text-lg font-semibold">{activeVehicle.status}</div>
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
                <input type="number" className="neumorphic-input" placeholder="KM do registro" value={serviceForm.odometer} onChange={(e) => setServiceForm((prev) => ({ ...prev, odometer: Number(e.target.value || 0) }))} />
                <input type="number" className="neumorphic-input" placeholder="Custo (R$)" value={serviceForm.cost} onChange={(e) => setServiceForm((prev) => ({ ...prev, cost: e.target.value }))} />
                <textarea className="neumorphic-input sm:col-span-2" rows="3" placeholder="Descrição da manutenção" value={serviceForm.description} onChange={(e) => setServiceForm((prev) => ({ ...prev, description: e.target.value }))} />
              </div>
              <div className="mt-3 flex flex-wrap gap-3">
                <button className="neumorphic-button primary" onClick={addMaintenance}>Salvar manutenção</button>
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
                      <div className="text-xs text-slate-500">{entry.date}</div>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{entry.description}</p>
                    <div className="mt-2 flex justify-between text-xs text-slate-500">
                      <span>KM: {Number(entry.odometer || 0).toLocaleString('pt-BR')}</span>
                      <span>Custo: R$ {Number(entry.cost || 0).toFixed(2)}</span>
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
    </div>
  );
}
