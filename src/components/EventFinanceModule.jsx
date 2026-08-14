import React, { useEffect, useMemo, useState } from 'react';
import { canManageAdminFeatures, normalizeUserRole } from '../utils/auth.js';
import { generateFinancePdf } from '../utils/pdfGenerator.js';

function currency(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function loadScript(src) {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) return res();
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => res();
    s.onerror = () => rej(new Error('Failed to load ' + src));
    document.head.appendChild(s);
  });
}

const CORE_EXPENSE_TYPES = ['HOSPEDAGEM', 'COMBUSTIVEL', 'ESTACIONAMENTO', 'OUTRO'];

export default function EventFinanceModule({ events = [], users = [], config = {}, currentUser, onEventsChange }) {
  const [selectedEventId, setSelectedEventId] = useState(() => (events[0] ? events[0].id : null));
  const [form, setForm] = useState({ date: '', amount: '', type: 'BCS', expenseType: '', otherType: '', paymentType: '', note: '' });
  const [fileUpload, setFileUpload] = useState(null);
  const [showReport, setShowReport] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editingDraft, setEditingDraft] = useState(null);

  useEffect(() => {
    if (!selectedEventId && events[0]) setSelectedEventId(events[0].id);
  }, [events]);

  const selectedEvent = useMemo(() => events.find((e) => e.id === selectedEventId) || null, [events, selectedEventId]);

  const finances = selectedEvent?.finances || [];

  const canSeeAll = canManageAdminFeatures(currentUser?.role || '') && normalizeUserRole(currentUser?.role || '') === 'master';

  const visibleFinances = useMemo(() => {
    if (canSeeAll) return finances;
    return (finances || []).filter((f) => String(f.createdBy) === String(currentUser?.id));
  }, [finances, canSeeAll, currentUser]);

  const handleInput = (key, value) => setForm((s) => ({ ...s, [key]: value }));

  const formatMoneyEntry = (value) => {
    const digits = String(value ?? '').replace(/\D/g, '');
    if (!digits) return '';

    const padded = digits.padStart(3, '0');
    const intPart = padded.slice(0, -2) || '0';
    const decimalPart = padded.slice(-2).padStart(2, '0');
    const formattedInt = Number(intPart).toLocaleString('pt-BR');
    return `${formattedInt},${decimalPart}`;
  };

  const parseMoneyValue = (value) => {
    const normalized = String(value ?? '').replace(/\./g, '').replace(',', '.').trim();
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const saveEventFinances = (newFinances) => {
    const newEvents = events.map((ev) => (ev.id === selectedEventId ? { ...ev, finances: newFinances } : ev));
    onEventsChange(newEvents);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!selectedEvent) return;
    if (!form.date || !form.amount) return alert('Preencha data e valor');
    if (String(form.type || '').toLowerCase() !== 'pessoal' && !form.paymentType) return alert('Selecione o tipo de pagamento (obrigatório para gastos BCS)');

    let fileData = null;
    if (fileUpload) {
      const reader = new FileReader();
      fileData = await new Promise((res) => {
        reader.onload = () => res({ name: fileUpload.name, type: fileUpload.type, dataUrl: reader.result });
        reader.readAsDataURL(fileUpload);
      });
    }

    const newItem = {
      id: `f-${Date.now()}`,
      date: form.date,
      amount: parseMoneyValue(form.amount),
      type: form.type || 'BCS',
      expenseType: form.expenseType || '',
      otherType: form.expenseType === 'OUTRO' ? (form.otherType || '') : undefined,
      paymentType: form.paymentType || '',
      note: form.note || '',
      receipt: fileData,
      createdBy: currentUser?.id,
      createdByName: currentUser?.name,
    };

    const newFinances = [...(selectedEvent.finances || []), newItem];
    saveEventFinances(newFinances);
    setForm({ date: '', amount: '', type: 'BCS', expenseType: '', otherType: '', paymentType: '', note: '' });
    setFileUpload(null);
  };

  const handleUploadChange = (ev) => {
    const f = ev.target.files && ev.target.files[0];
    setFileUpload(f || null);
  };

  const downloadFile = (receipt) => {
    if (!receipt) return;
    const a = document.createElement('a');
    a.href = receipt.dataUrl;
    a.download = receipt.name || 'comprovante';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const downloadAllReceipts = async () => {
    const receipts = (selectedEvent.finances || []).map((f) => ({ id: f.id, receipt: f.receipt } )).filter((r) => r.receipt);
    if (receipts.length === 0) return alert('Nenhum comprovante para baixar');

    try {
      await loadScript('https://cdn.jsdelivr.net/npm/jszip@3.7.1/dist/jszip.min.js');
      await loadScript('https://cdn.jsdelivr.net/npm/file-saver@2.0.5/dist/FileSaver.min.js');
      const zip = new window.JSZip();
      receipts.forEach((r) => {
        const parts = r.receipt.dataUrl.split(',');
        const meta = parts[0];
        const b64 = parts[1];
        const blob = b64ToBlob(b64, r.receipt.type || 'application/octet-stream');
        zip.file(r.receipt.name || `${r.id}.bin`, blob);
      });
      const content = await zip.generateAsync({ type: 'blob' });
      window.saveAs(content, `${selectedEvent.name || 'comprovantes'}-receipts.zip`);
    } catch (err) {
      console.error(err);
      alert('Falha ao gerar ZIP. Você pode baixar recibos individualmente.');
    }
  };

  const b64ToBlob = (b64, contentType = '', sliceSize = 512) => {
    const byteCharacters = atob(b64);
    const byteArrays = [];

    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
      const slice = byteCharacters.slice(offset, offset + sliceSize);

      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i += 1) {
        byteNumbers[i] = slice.charCodeAt(i);
      }

      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }

    return new Blob(byteArrays, { type: contentType });
  };

  const handleDelete = (id) => {
    if (!selectedEvent) return;
    const newFinances = (selectedEvent.finances || []).filter((f) => f.id !== id);
    saveEventFinances(newFinances);
  };

  const startEdit = (f) => {
    setEditingId(f.id);
    setEditingDraft({ ...f });
  };

  const handleEditUploadChange = (ev) => {
    const f = ev.target.files && ev.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      setEditingDraft((d) => ({ ...d, receipt: { name: f.name, type: f.type, dataUrl: reader.result } }));
    };
    reader.readAsDataURL(f);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingDraft(null);
  };

  const saveEdit = () => {
    if (!selectedEvent || !editingDraft) return;
    if (String(editingDraft.type || '').toLowerCase() !== 'pessoal' && !editingDraft.paymentType) return alert('Selecione o tipo de pagamento (obrigatório para gastos BCS)');
    const newFinances = (selectedEvent.finances || []).map((it) => (it.id === editingId ? { ...editingDraft, amount: parseMoneyValue(editingDraft.amount) } : it));
    saveEventFinances(newFinances);
    cancelEdit();
  };
  const [paymentTypeFilter, setPaymentTypeFilter] = useState('ALL');

  const totals = useMemo(() => {
    const all = selectedEvent?.finances || [];
    const visible = visibleFinances || [];
    const totalVisible = visible.reduce((s, i) => s + Number(i.amount || 0), 0);
    const totalAll = all.reduce((s, i) => s + Number(i.amount || 0), 0);
    const byType = {};
    all.forEach((i) => { const key = i.expenseType === 'OUTRO' && i.otherType ? `OUTRO (${i.otherType})` : (i.expenseType || 'Sem tipo'); byType[key] = (byType[key] || 0) + Number(i.amount || 0); });
    const personalSum = all.filter((i) => String(i.type || '').toLowerCase() === 'pessoal').reduce((s, i) => s + Number(i.amount || 0), 0);
    return { totalVisible, totalAll, byType, personalSum };
  }, [selectedEvent, visibleFinances]);

  const formatDateShort = (value) => {
    if (!value) return 'Não informado';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Não informado';
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yy = String(date.getFullYear() % 100).padStart(2, '0');
    return `${dd}/${mm}/${yy}`;
  };

  const generateReportText = () => {
    if (!selectedEvent) return '';
    const lines = [];
    lines.push(`Relatório financeiro - ${selectedEvent.name || ''}`);
    // título: apenas nome do evento
    lines.push(`${selectedEvent.name || ''}`);
    // WhatsApp message: only event name, lines with date - valor - tipo (Gasto BCS / Gasto Pessoal), and total reembolso
    const financesOrdered = (selectedEvent.finances || []).slice().sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0;
      const db = b.date ? new Date(b.date).getTime() : 0;
      return (da || 0) - (db || 0);
    });
    financesOrdered.forEach((f) => {
      const kind = String(f.type || '').toLowerCase() === 'pessoal' ? 'Gasto Pessoal' : 'Gasto BCS';
      lines.push(`${formatDateShort(f.date)} - ${currency(f.amount)} - ${kind}`);
    });
    lines.push('');
    lines.push(`Total geral: ${currency(totals.totalAll)}`);
    if (totals.personalSum > 0) lines.push(`Total para reembolso (pessoal): ${currency(totals.personalSum)}`);
    return lines.join('\n');
  };

  const sendWhatsApp = () => {
    if (!selectedEvent) return alert('Selecione um evento');
    const phone = config?.nfContact?.phone ? String(config.nfContact.phone).replace(/[^0-9]/g, '') : '';
    let target = phone;
    if (!target) {
      target = window.prompt('Número do responsável NF (somente dígitos, ex: 5511999999999)');
      if (!target) return;
    }

    const message = encodeURIComponent(generateReportText());
    window.open(`https://wa.me/${target}?text=${message}`, '_blank');
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="neumorphic-card p-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Financeiro do Evento</h3>
            <div className="flex items-center gap-2">
              <button className="neumorphic-button" onClick={() => setShowReport((s) => !s)}>{showReport ? 'Ocultar relatório' : 'Mostrar relatório'}</button>
              <button className="neumorphic-button" onClick={sendWhatsApp}>Enviar por WhatsApp</button>
              <select className="neumorphic-select" value={paymentTypeFilter} onChange={(e) => setPaymentTypeFilter(e.target.value)}>
                <option value="ALL">Todos tipos de pagamento</option>
                {(config.paymentTypes || []).map((p) => <option key={p} value={p}>{p}</option>)}
                <option value="Sem pagamento">Sem pagamento</option>
              </select>
              <button className="neumorphic-button" onClick={() => { if (!selectedEvent) return alert('Selecione um evento'); generateFinancePdf(selectedEvent, config, paymentTypeFilter); }}>Gerar relatório (PDF)</button>
          </div>
        </header>

        <section className="neumorphic-card p-4">
          <label className="block text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Evento</label>
          <select className="neumorphic-select mt-2 w-full" value={selectedEventId || ''} onChange={(e) => setSelectedEventId(e.target.value)}>
            {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.name} ({ev.eventDate || ev.departureDate || ''})</option>)}
          </select>

          {showReport && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <h4 className="font-semibold text-slate-800">Resumo</h4>
              <div className="mt-3 space-y-2 text-sm text-slate-700">
                <p>Total geral: {currency(totals.totalAll)}</p>
                <p>Reembolso (pessoal): {currency(totals.personalSum)}</p>
              </div>
              <div className="mt-3">
                <strong className="text-slate-800">Por tipo:</strong>
                <ul className="mt-2 space-y-1 text-sm text-slate-700">
                  {Object.keys(totals.byType).map((k) => <li key={k}>{k}: {currency(totals.byType[k])}</li>)}
                </ul>
              </div>
            </div>
          )}
        </section>

          <section className="neumorphic-card p-4">
          <h4 className="font-semibold mb-2">Cadastrar gasto</h4>
          <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input type="date" value={form.date} onChange={(e) => handleInput('date', e.target.value)} className="neumorphic-input" />
            <input
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={form.amount}
              onChange={(e) => handleInput('amount', formatMoneyEntry(e.target.value))}
              className="neumorphic-input"
            />
            <select value={form.type} onChange={(e) => handleInput('type', e.target.value)} className="neumorphic-select">
              <option value="BCS">Gasto BCS</option>
              <option value="Pessoal">Gasto Pessoal</option>
            </select>
            <select value={form.expenseType} onChange={(e) => handleInput('expenseType', e.target.value)} className="neumorphic-select">
              <option value="">Tipo de gasto</option>
              {(CORE_EXPENSE_TYPES.concat(config.expenseTypes || [])).map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            {form.expenseType === 'OUTRO' && (
              <input type="text" placeholder="Especifique o tipo" value={form.otherType} onChange={(e) => handleInput('otherType', e.target.value)} className="p-2 sm:col-span-2" />
            )}
            {String(form.type || '').toLowerCase() !== 'pessoal' && (
              <select value={form.paymentType} onChange={(e) => handleInput('paymentType', e.target.value)} className="neumorphic-select">
                <option value="">Tipo de pagamento (obrigatório)</option>
                {(config.paymentTypes || []).map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            )}
            <input type="text" placeholder="Observação" value={form.note} onChange={(e) => handleInput('note', e.target.value)} className="neumorphic-input sm:col-span-2" />
            <div className="sm:col-span-3">
              <label className="block text-sm font-medium uppercase tracking-[0.18em] text-slate-500">Comprovante</label>
              <input type="file" onChange={handleUploadChange} className="mt-2 block w-full text-sm text-slate-600 file:mr-3 file:rounded-full file:border-0 file:bg-slate-200 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-300" />
            </div>
            <div className="sm:col-span-3">
              <button type="submit" className="neumorphic-button">Adicionar gasto</button>
            </div>
          </form>
        </section>

        <section className="neumorphic-card p-4">
          <h4 className="font-semibold mb-2">Gastos cadastrados</h4>
          <div className="flex items-center gap-2 mb-3">
            <button className="neumorphic-button" onClick={() => downloadAllReceipts()}>Download todos comprovantes</button>
          </div>
          <div className="space-y-2">
            {(visibleFinances || []).map((f) => (
              <div key={f.id} className="p-3 border rounded-md flex items-start justify-between">
                <div className="w-full">
                      {editingId === f.id ? (
                    <div className="grid gap-2">
                      <input type="date" value={editingDraft.date} onChange={(e) => setEditingDraft((d) => ({ ...d, date: e.target.value }))} className="neumorphic-input" />
                      <input
                        type="text"
                        inputMode="decimal"
                        value={editingDraft.amount}
                        onChange={(e) => setEditingDraft((d) => ({ ...d, amount: formatMoneyEntry(e.target.value) }))}
                        className="neumorphic-input"
                      />
                      <select value={editingDraft.type} onChange={(e) => setEditingDraft((d) => ({ ...d, type: e.target.value }))} className="neumorphic-select">
                        <option value="BCS">Gasto BCS</option>
                        <option value="Pessoal">Gasto Pessoal</option>
                      </select>
                      <select value={editingDraft.expenseType || ''} onChange={(e) => setEditingDraft((d) => ({ ...d, expenseType: e.target.value }))} className="neumorphic-select">
                        <option value="">Tipo de gasto</option>
                        {(CORE_EXPENSE_TYPES.concat(config.expenseTypes || [])).map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                      {editingDraft.expenseType === 'OUTRO' && <input type="text" placeholder="Especifique" value={editingDraft.otherType || ''} onChange={(e) => setEditingDraft((d) => ({ ...d, otherType: e.target.value }))} className="neumorphic-input" />}
                      {String(editingDraft.type || '').toLowerCase() !== 'pessoal' && (
                        <select value={editingDraft.paymentType || ''} onChange={(e) => setEditingDraft((d) => ({ ...d, paymentType: e.target.value }))} className="neumorphic-select">
                          <option value="">Tipo de pagamento (obrigatório)</option>
                          {(config.paymentTypes || []).map((p) => <option key={p} value={p}>{p}</option>)}
                        </select>
                      )}
                      <input type="text" value={editingDraft.note || ''} onChange={(e) => setEditingDraft((d) => ({ ...d, note: e.target.value }))} className="neumorphic-input" />
                      <div>
                        <label className="block text-sm">Comprovante (upload)</label>
                        <input type="file" onChange={handleEditUploadChange} />
                        {editingDraft.receipt && <div className="mt-2"><button className="neumorphic-button" onClick={() => downloadFile(editingDraft.receipt)}>Download comprovante atual</button></div>}
                      </div>
                      <div className="flex gap-2">
                        <button className="neumorphic-button" onClick={saveEdit}>Salvar</button>
                        <button className="neumorphic-button" onClick={cancelEdit}>Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="font-medium">{formatDateShort(f.date)} — {currency(f.amount)} {String(f.type || '') === 'Pessoal' ? '(Pessoal)' : ''} {f.expenseType ? `• ${f.expenseType}${f.expenseType === 'OUTRO' && f.otherType ? ` (${f.otherType})` : ''}` : ''}</div>
                      <div className="text-sm text-slate-600">{f.paymentType ? `Pagamento: ${f.paymentType} • ` : ''}Cadastro: {f.createdByName || f.createdBy}</div>
                      {f.note && <div className="mt-1 text-sm">{f.note}</div>}
                    </>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  {f.receipt && <button className="neumorphic-button" onClick={() => downloadFile(f.receipt)}>Download comprovante</button>}
                  {editingId === f.id ? null : <button className="neumorphic-button" onClick={() => startEdit(f)}>Editar</button>}
                  <button className="neumorphic-button" onClick={() => handleDelete(f.id)}>Remover</button>
                </div>
              </div>
            ))}

            {visibleFinances.length === 0 && <p className="text-sm text-slate-500">Nenhum gasto encontrado.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
