import React, { useMemo, useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import NeumorphicCard from './NeumorphicCard.jsx';
import { Pencil, Trash2, CheckCircle2, FileText, MessageCircle, PlusCircle, ChevronDown, ExternalLink, MoreHorizontal, ArrowRight } from 'lucide-react';
import { generateSeparationPdf, generateEventChecklistPdf, generateMountedItemsPdf } from '../utils/pdfGenerator.js';
import { validateEventForm } from '../utils/validation.js';
import { applyScheduledSectorTransfers, getEffectiveConsumptionDate, isTransferActiveOnDate } from '../utils/stockPlanning.js';
import { canManageAdminFeatures, normalizeUserRole } from '../utils/auth.js';

const defaultBoardTitles = ['INFORMAÇÕES DO EVENTO', 'MONTAGEM DO EVENTO', 'SEPARAR ITENS PARA O EVENTO', 'HOSPEDAGEM', 'DESLOCAMENTO', 'DESMONTAGEM'];

function formatPhoneUrl(phone) {
  const digits = phone.replace(/[^0-9]/g, '');
  if (!digits) return '';
  if (digits.length === 13 && digits.startsWith('55')) return digits;
  if (digits.length === 11 || digits.length === 10) return `55${digits}`;
  return digits;
}

function formatWhatsappMask(value) {
  let digits = value.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('55') && digits.length > 11) {
    digits = digits.slice(2);
  }
  if (digits.length <= 2) return digits;
  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);
  let formatted = `(${ddd})`;
  if (rest.length <= 4) {
    formatted += ` ${rest}`;
  } else if (rest.length <= 5) {
    formatted += ` ${rest}`;
  } else {
    const prefix = rest.slice(0, rest.length - 4);
    const suffix = rest.slice(rest.length - 4);
    formatted += ` ${prefix}-${suffix}`;
  }
  return formatted;
}

function formatShortDate(value) {
  if (!value) return 'Não informado';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function formatAuditDateTime(value) {
  if (!value) return 'Sem data';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function parseDateOnly(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

function getEventTransferDateRange(event) {
  if (!event) return { minDate: '', maxDate: '' };
  const candidates = [event.departureDate, event.startDate, event.eventDate, event.returnDate, event.endDate].filter(Boolean).sort();
  if (!candidates.length) return { minDate: '', maxDate: '' };
  return { minDate: candidates[0], maxDate: candidates[candidates.length - 1] };
}

function isDateWithinEventTransferRange(dateValue, event) {
  const date = parseDateOnly(dateValue);
  if (!date || !event) return false;
  const { minDate, maxDate } = getEventTransferDateRange(event);
  if (!minDate || !maxDate) return false;
  const min = parseDateOnly(minDate);
  const max = parseDateOnly(maxDate);
  if (!min || !max) return false;
  return date >= min && date <= max;
}

function revokeAttachmentData(value) {
  if (typeof value === 'string' && value.startsWith('blob:')) {
    URL.revokeObjectURL(value);
  }
}

function downloadAttachment(item) {
  if (!item?.attachmentData || !item?.attachmentName) return;
  const link = document.createElement('a');
  link.href = item.attachmentData;
  link.download = item.attachmentName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  if (typeof item.attachmentData === 'string' && item.attachmentData.startsWith('blob:')) {
    setTimeout(() => URL.revokeObjectURL(item.attachmentData), 0);
  }
}

function getDefaultEventForm() {
  return {
    name: '',
    address: '',
    locationName: '',
    clientName: '',
    organizerName: '',
    contact: '',
    departureDate: '',
    startDate: '',
    endDate: '',
    returnDate: '',
    caexMontageDate: '',
    secretariaMontageDate: '',
    labelSize: '9X5',
    environmentLink: 'https://sigevent.pro/bcs/',
  };
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null, showDetails: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // log to console for now
    // eslint-disable-next-line no-console
    console.error('EventBoard error:', error, info);
    try {
      const payload = { error: String(error), stack: error?.stack || null, info };
      localStorage.setItem('eventboard_last_error', JSON.stringify(payload));
    } catch (e) {
      // ignore
    }
    this.setState({ info, showDetails: true });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 text-rose-700">
          <div className="text-lg font-semibold">Erro ao renderizar o painel</div>
          <div className="text-sm mt-2">Ocorreu um erro ao abrir o evento. Abra o console do desenvolvedor para mais detalhes.</div>
          <div className="mt-3">
            <button className="neumorphic-button" onClick={() => window.location.reload()}>Recarregar</button>
            <button className="neumorphic-button ml-2" onClick={() => this.setState((s) => ({ showDetails: !s.showDetails }))}>Detalhes</button>
          </div>
          {this.state.showDetails && (
            <pre className="mt-3 text-xs whitespace-pre-wrap bg-slate-50 p-3 rounded">{String(this.state.error?.stack || this.state.error)}</pre>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

export default function EventBoard({ events = [], inventory = [], config = {}, users = [], user, onEventsChange = () => {} }) {
  const [lastSavedError, setLastSavedError] = useState(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem('eventboard_last_error');
      if (raw) setLastSavedError(JSON.parse(raw));
    } catch (e) {
      // ignore
    }
  }, []);
  const [activeEventId, setActiveEventId] = useState((Array.isArray(events) ? events : [])[0]?.id || null);
  const [form, setForm] = useState(getDefaultEventForm());
  const [showCompletedEvents, setShowCompletedEvents] = useState(false);
  const [newMontagemItem, setNewMontagemItem] = useState({ itemType: '', sector: 'SECRETARIA', customSector: '', quantity: 1, mountDate: '' });
  const [newSeparationSource, setNewSeparationSource] = useState('ESTOQUE');
  const [newSeparationInventoryId, setNewSeparationInventoryId] = useState('');
  const [newSeparationQuantity, setNewSeparationQuantity] = useState(1);
  const [newSeparationRentalType, setNewSeparationRentalType] = useState(config.itemTypes?.find((type) => type !== 'LOCAÇÃO EXTERNA') || config.itemTypes?.[0] || '');
  const [newSeparationRentalName, setNewSeparationRentalName] = useState('');
  const [editingItem, setEditingItem] = useState(null);
  const [newEventUsers, setNewEventUsers] = useState([]);
  const [newEventUserAssignments, setNewEventUserAssignments] = useState([]);
  const [selectedEventUserId, setSelectedEventUserId] = useState('');
  const [selectedEventUserDepartureDate, setSelectedEventUserDepartureDate] = useState('');
  const [selectedEventUserReturnDate, setSelectedEventUserReturnDate] = useState('');
  const fileInputRef = React.useRef(null);
  const [importStatus, setImportStatus] = useState('');
  const [importErrors, setImportErrors] = useState([]);
  const [newTransportMode, setNewTransportMode] = useState('CARRO BCS');
  const [newTransportDepartureDate, setNewTransportDepartureDate] = useState('');
  const [newTransportReturnDate, setNewTransportReturnDate] = useState('');
  const [newTransportDepartureTime, setNewTransportDepartureTime] = useState('');
  const [newTransportReturnTime, setNewTransportReturnTime] = useState('');
  const [newTransportVehicleModel, setNewTransportVehicleModel] = useState('');
  const [newTransportCompany, setNewTransportCompany] = useState('');
  const [newTransportReservationCode, setNewTransportReservationCode] = useState('');
  const [newTransportVoucherName, setNewTransportVoucherName] = useState('');
  const [newTransportVoucherType, setNewTransportVoucherType] = useState('');
  const [newTransportVoucherData, setNewTransportVoucherData] = useState('');
  const [newTransportProfessionalIds, setNewTransportProfessionalIds] = useState([]);
  const [showEventForm, setShowEventForm] = useState(false);
  const [expandedBoard, setExpandedBoard] = useState([]);
  const [showEventSelector, setShowEventSelector] = useState(true);
  const [editingEventId, setEditingEventId] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);
  const [showExtraInfo, setShowExtraInfo] = useState(false);
  const [extraInfoDraft, setExtraInfoDraft] = useState('');
  const [pendingEventClosure, setPendingEventClosure] = useState(null);
  const [formErrors, setFormErrors] = useState([]);
  const [editingTransportItemId, setEditingTransportItemId] = useState(null);
  const [editingAccommodationItemId, setEditingAccommodationItemId] = useState(null);
  const [transferForm, setTransferForm] = useState({ transferDate: '', targetEventId: '', transferQuantity: 1, selectedItemId: '' });
  const [showTransferPanel, setShowTransferPanel] = useState(false);
  const [sectorTransferItemId, setSectorTransferItemId] = useState(null);
  const [sectorTransferTarget, setSectorTransferTarget] = useState('');
  const [sectorTransferDate, setSectorTransferDate] = useState('');
  const [sectorTransferQuantity, setSectorTransferQuantity] = useState(1);
  const [editingTransferItemId, setEditingTransferItemId] = useState(null);
  const [transferEditForm, setTransferEditForm] = useState({ transferQuantity: 1, transferDate: '' });
  const [showRentalPanel, setShowRentalPanel] = useState(false);
  const [rentalForm, setRentalForm] = useState({ selectedItemId: '', company: '', quantity: 1, deliveryDate: '', returnDate: '' });
  const [sectorEditing, setSectorEditing] = useState(null);
  const [sectorEditDrafts, setSectorEditDrafts] = useState({});

  const currentUserRole = normalizeUserRole(user?.role || '');
  const canManageEvents = canManageAdminFeatures(user?.role || '');
  const canTransferItems = canManageAdminFeatures(user?.role || '');

  const safeEvents = Array.isArray(events) ? events : [];
  const visibleEventList = canManageEvents
    ? safeEvents
    : safeEvents.filter((event) => Array.isArray(event?.users) && event.users.some((userId) => userId === user?.id));

  const availableItemTypes = useMemo(() => [
    ...(config.itemTypes || []),
    ...(config.proposalItemTypes || []),
  ].filter(Boolean).reduce((unique, type) => {
    if (!unique.includes(type)) unique.push(type);
    return unique;
  }, []), [config.itemTypes, config.proposalItemTypes]);

  const selectedEvent = visibleEventList.find((event) => event.id === activeEventId) || visibleEventList[0] || null;
  const eventProfessionals = useMemo(() => {
    if (!selectedEvent) return [];
    const ids = new Set([...(selectedEvent.users || []), ...(selectedEvent.userAssignments?.map((assignment) => assignment.userId) || [])]);
    return users.filter((user) => ids.has(user.id));
  }, [selectedEvent, users]);
  const targetTransferDateRange = useMemo(() => {
    const targetEvent = events.find((event) => String(event.id) === String(transferForm.targetEventId));
    return getEventTransferDateRange(targetEvent);
  }, [events, transferForm.targetEventId]);

  const handleXlsxUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportStatus('Importando planilha...');
    setImportErrors([]);

    try {
      const rows = await parseXlsxFile(file);
      const importedEvents = buildImportedEvents(rows);
      if (!importedEvents.length) {
        setImportStatus('Nenhum evento encontrado na planilha. Verifique os cabeçalhos.');
        return;
      }
      onEventsChange([...events, ...importedEvents]);
      setActiveEventId(importedEvents[0].id);
      setShowEventSelector(false);
      setImportStatus(`Importados ${importedEvents.length} evento(s) com ${rows.length} linha(s).`);
    } catch (error) {
      setImportStatus('Erro ao importar a planilha. Veja o console para detalhes.');
      setImportErrors([String(error)]);
      // eslint-disable-next-line no-console
      console.error('Importação XLSX falhou', error);
    } finally {
      event.target.value = '';
    }
  };

  function renderEventSelector() {
    return (
      <div className="space-y-6">
        <NeumorphicCard>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold">Seleção de Evento</h2>
              <p className="text-sm text-slate-500">Escolha o evento para visualizar o quadro completo.</p>
            </div>
            {canManageEvents && (
              <div className="flex flex-wrap gap-3">
                <button className="neumorphic-button" onClick={() => setShowEventForm((prev) => !prev)}>
                  <PlusCircle className="mr-2 h-4 w-4" />{showEventForm ? 'Fechar' : 'Novo Evento'}
                </button>
                <button className="neumorphic-button" onClick={() => fileInputRef.current?.click()}>
                  <FileText className="mr-2 h-4 w-4" />Importar XLSX
                </button>
                <input type="file" accept=".xlsx,.xls" ref={fileInputRef} className="hidden" onChange={handleXlsxUpload} />
              </div>
            )}
          </div>
          {!canManageEvents && (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Sem permissão para criar ou gerenciar eventos.
            </div>
          )}
          {canManageEvents && visibleEventList.length === 0 && !showEventForm && (
            <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-800">
              <div className="font-semibold">Nenhum evento cadastrado.</div>
              <div className="mt-2">Clique em “Novo Evento” para criar o primeiro evento.</div>
            </div>
          )}
          {importStatus && (
            <div className="mt-3 rounded-3xl bg-slate-100 px-4 py-3 text-sm text-slate-700 shadow-sm">
              {importStatus}
            </div>
          )}
          {importErrors.length > 0 && (
            <div className="mt-3 rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 shadow-sm">
              {importErrors.map((error, index) => (
                <div key={index}>{error}</div>
              ))}
            </div>
          )}
          {showEventForm && (
            <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-800">{editingEventId ? 'Editar evento' : 'Criar novo evento'}</h3>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Nome</span>
                  <input className="neumorphic-input w-full" value={form.name} onChange={(e) => handleForm('name', e.target.value)} />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Cliente</span>
                  <input className="neumorphic-input w-full" value={form.clientName} onChange={(e) => handleForm('clientName', e.target.value)} />
                </label>
                <label className="space-y-2 md:col-span-2">
                  <span className="text-sm font-medium text-slate-700">Endereço</span>
                  <input className="neumorphic-input w-full" value={form.address} onChange={(e) => handleForm('address', e.target.value)} />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Local</span>
                  <input className="neumorphic-input w-full" value={form.locationName} onChange={(e) => handleForm('locationName', e.target.value)} />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Contato</span>
                  <input className="neumorphic-input w-full" value={form.contact} onChange={(e) => handleForm('contact', e.target.value)} />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Data de saída</span>
                  <input type="date" className="neumorphic-input w-full" value={form.departureDate} onChange={(e) => handleForm('departureDate', e.target.value)} />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Data do evento</span>
                  <input type="date" className="neumorphic-input w-full" value={form.startDate || form.departureDate} onChange={(e) => handleForm('startDate', e.target.value)} />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Data de retorno</span>
                  <input type="date" className="neumorphic-input w-full" value={form.returnDate || form.endDate} onChange={(e) => handleForm('returnDate', e.target.value)} />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Tamanho do rótulo</span>
                  <input className="neumorphic-input w-full" value={form.labelSize} onChange={(e) => handleForm('labelSize', e.target.value)} />
                </label>
              </div>
              {formErrors.length > 0 && (
                <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                  {formErrors.map((error) => (
                    <div key={error.field}>{error.message}</div>
                  ))}
                </div>
              )}
              <div className="mt-5 flex flex-wrap gap-3">
                <button className="neumorphic-button primary" onClick={createEvent}>{editingEventId ? 'Salvar alterações' : 'Criar evento'}</button>
                <button className="neumorphic-button outline" onClick={() => {
                  setShowEventForm(false);
                  setForm(getDefaultEventForm());
                  setFormErrors([]);
                }}>Cancelar</button>
              </div>
            </div>
          )}
        </NeumorphicCard>
      </div>
    );
  }

  const handleForm = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFormErrors((prev) => prev.filter((error) => error.field !== field));
  };

  const initializeEventBoards = (event, defaultItems = []) => ({
    info: { ...event },
    montagem: defaultItems.map((item) => ({
      id: `default-${item.id}-${Date.now()}`,
      type: item.type,
      name: item.type,
      quantity: 1,
      checked: false,
      sector: item.subframe || 'SECRETARIA',
      ...item.type === 'LOCAÇÃO EXTERNA' ? { externalRental: true } : {},
    })),
    desmontagem: [],
    hospedagem: [],
    deslocamento: [],
    separar: [],
  });

  const findInventoryItem = (id) => inventory.find((item) => String(item.id) === String(id)) || null;

  const createEvent = () => {
    if (!canManageAdminFeatures(user?.role || '')) return;

    const errors = validateEventForm(form, newEventUserAssignments);
    setFormErrors(errors);
    if (errors.length) return;

    const baseEventData = {
      ...form,
      departureDate: form.departureDate || form.startDate,
      returnDate: form.returnDate || form.endDate,
      users: newEventUsers,
      userAssignments: newEventUserAssignments,
    };

    if (editingEventId) {
      const existingEvent = events.find((event) => event.id === editingEventId);
      if (!existingEvent) return;

      const updatedEvent = {
        ...existingEvent,
        ...baseEventData,
        departureDate: baseEventData.departureDate,
        returnDate: baseEventData.returnDate,
        users: newEventUsers,
        userAssignments: newEventUserAssignments,
        boards: {
          ...existingEvent.boards,
          info: {
            ...existingEvent.boards?.info,
            ...baseEventData,
            id: existingEvent.id,
            status: existingEvent.status,
            users: newEventUsers,
            userAssignments: newEventUserAssignments,
          },
        },
      };

      updateEvent(updatedEvent);
      setEditingEventId(null);
      setActiveEventId(updatedEvent.id);
      setShowEventForm(false);
      setShowEventSelector(false);
      setExpandedBoard([]);
      setForm(getDefaultEventForm());
      setNewEventUsers([]);
      setNewEventUserAssignments([]);
      return;
    }

    const nextEvent = {
      ...baseEventData,
      id: Date.now(),
      status: 'A Iniciar',
      extraInfo: '',
      extraInfoMessages: [],
      accommodation: { type: 'NONE', hotelName: '', address: '', voucherType: 'HOSPEDAGEM EVENTO' },
      externalRentalInfo: { company: '', deliveryDate: '', returnDate: '' },
      boards: initializeEventBoards(baseEventData, config.defaultItems || []),
    };
    onEventsChange([...events, nextEvent]);
    setForm(getDefaultEventForm());
    setNewEventUsers([]);
    setNewEventUserAssignments([]);
    setFormErrors([]);
    setActiveEventId(nextEvent.id);
    setShowEventForm(false);
    setShowEventSelector(false);
    setExpandedBoard([]);
  };

  const updateEvent = (updated) => onEventsChange(events.map((item) => (item.id === updated.id ? updated : item)));

  if (!selectedEvent) {
    return renderEventSelector();
  }

  const normalizeHeaderKey = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/[^a-z0-9 ]/g, '');

  const parseXlsxFile = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const arrayBuffer = event.target.result;
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, {
          defval: '',
          raw: false,
          cellDates: true,
          dateNF: 'yyyy-mm-dd',
        });
        resolve(rows);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });

  const getHeaderValue = (row, aliases) => {
    const normalizedRow = Object.entries(row).reduce((acc, [key, value]) => {
      acc[normalizeHeaderKey(key)] = value;
      return acc;
    }, {});

    for (const alias of aliases) {
      const key = normalizeHeaderKey(alias);
      if (Object.prototype.hasOwnProperty.call(normalizedRow, key) && normalizedRow[key] !== '') {
        return normalizedRow[key];
      }
    }

    return '';
  };

  const getGroupHeaderValue = (rows, aliases) => {
    for (const r of rows) {
      const val = getHeaderValue(r, aliases);
      if (val !== '' && val !== null && val !== undefined) return val;
    }
    return '';
  };

  const formatImportedDate = (value) => {
    if (value === null || value === undefined || value === '') return '';
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) return '';
      return value.toISOString().slice(0, 10);
    }
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
    return String(value).trim();
  };

  const normalizeItemText = (value) => String(value || '').trim().normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase();

  const determineImportedType = (sheetType, equipmentName) => {
    const normalizedSheetType = normalizeItemText(sheetType);
    const normalizedEquipmentName = normalizeItemText(equipmentName);
    const knownTypes = [
      ...(config.itemTypes || []),
      ...(config.proposalItemTypes || []),
    ].map((type) => ({ original: type, normalized: normalizeItemText(type) }));

    const exactMatch = knownTypes.find((type) => type.normalized === normalizedSheetType || type.normalized === normalizedEquipmentName);
    if (exactMatch) return exactMatch.original;

    const matchingBySubstring = knownTypes.find((type) => type.normalized && (normalizedSheetType.includes(type.normalized) || normalizedEquipmentName.includes(type.normalized)));
    if (matchingBySubstring) return matchingBySubstring.original;

    // Check proposalItems mapping from settings (Nome na proposta -> type)
    const proposalMapping = (config.proposalItems || []).map((p) => ({ name: p.name, normalized: normalizeItemText(p.name), type: p.type }));
    const matchedProposal = proposalMapping.find((p) => p.normalized === normalizedEquipmentName || normalizedEquipmentName.includes(p.normalized) || normalizedSheetType.includes(p.normalized));
    if (matchedProposal) return matchedProposal.type;

    if (normalizedEquipmentName.includes('ALL IN ONE') || normalizedSheetType.includes('ALL IN ONE')) {
      return 'NOTEBOOK';
    }
    if (normalizedEquipmentName.includes('NOTEBOOK') || normalizedSheetType.includes('NOTEBOOK')) {
      return 'NOTEBOOK';
    }
    if (normalizedEquipmentName.includes('IMPRESSORA TERMICA') || normalizedSheetType.includes('IMPRESSORA TERMICA')) {
      return 'IMPRESSORA TÉRMICA';
    }
    if (normalizedEquipmentName.includes('MILHEIRO DE ETIQUETAS') || normalizedEquipmentName.includes('ETIQUETA') || normalizedEquipmentName.includes('ETIQUETAS')) {
      return 'ETIQUETA';
    }
    if (normalizedEquipmentName.includes('RIBBON') || normalizedSheetType.includes('RIBBON') || normalizedEquipmentName.includes('RIBON')) {
      return 'RIBBON';
    }

    return 'ABERTO';
  };

  const buildImportedEvents = (rows) => {
    const eventGroups = {};
    let unnamedCount = 1;

    rows.forEach((rawRow) => {
      const row = Object.entries(rawRow).reduce((acc, [key, value]) => {
        acc[normalizeHeaderKey(key)] = value;
        return acc;
      }, {});

      const eventName = String(row['nome do evento'] || row['evento'] || row['nome'] || '').trim();
      const groupKey = eventName || `evento-importado-${unnamedCount}`;
      if (!eventGroups[groupKey]) {
        eventGroups[groupKey] = {
          eventName: eventName || `Evento importado ${unnamedCount}`,
          rows: [],
        };
        if (!eventName) unnamedCount += 1;
      }
      eventGroups[groupKey].rows.push(row);
    });

    return Object.values(eventGroups).map((group, groupIndex) => {
      const row = group.rows[0] || {};
      const eventData = {
        id: Date.now() + groupIndex,
        name: group.eventName,
        address: getHeaderValue(row, ['endereço', 'endereco', 'address']) || '',
        locationName: getHeaderValue(row, ['local do evento', 'local', 'localização', 'localizacao']) || '',
        clientName: getHeaderValue(row, ['cliente', 'nome do cliente', 'customer', 'client']) || '',
        organizerName: getHeaderValue(row, ['organizador', 'responsável', 'responsavel', 'organizer']) || '',
        contact: getHeaderValue(row, ['contato', 'telefone', 'whatsapp', 'celular']) || '',
        departureDate: formatImportedDate(getGroupHeaderValue(group.rows, ['data de partida', 'data de saida', 'data de saída'])) || '',
        startDate: formatImportedDate(getGroupHeaderValue(group.rows, ['data inicial', 'data inicial do evento', 'data inicio', 'data de inicio', 'data de início', 'data do evento', 'data inicio do evento', 'inicio'])) || '',
        endDate: formatImportedDate(getGroupHeaderValue(group.rows, ['data final', 'data final do evento', 'data de fim', 'data fim'])) || '',
        returnDate: formatImportedDate(getGroupHeaderValue(group.rows, ['data de retorno', 'data retorno', 'return date'])) || '',
        labelSize: getHeaderValue(row, ['tamanho da etiqueta', 'label size']) || '9X5',
        status: 'A Iniciar',
        users: [],
        userAssignments: [],
        boardStatus: {},
      };

      const montagem = group.rows.map((rowEntry, rowIndex) => {
        const equipmentName = String(getHeaderValue(rowEntry, ['equipamento', 'item', 'descrição', 'descricao', 'description']) || '').trim();
        const sheetType = String(getHeaderValue(rowEntry, ['tipo', 'tipo de equipamento', 'equipment type', 'item type']) || '').trim();
        const quantity = Number(getHeaderValue(rowEntry, ['quantidade', 'qtd', 'qty', 'quantity']) || 1) || 1;
        const sector = String(getHeaderValue(rowEntry, ['setor', 'subquadro', 'setor de montagem', 'sector']) || 'MONTAGEM').trim() || 'MONTAGEM';
        const mountDate = formatImportedDate(getHeaderValue(rowEntry, ['data', 'data de operação', 'data de operação', 'data instalação', 'data instalacao', 'installation date', 'data de instalação']) || '');
        const recognizedType = determineImportedType(sheetType, equipmentName);

        return {
          id: `import-${groupIndex}-${rowIndex}-${Date.now()}`,
          type: recognizedType,
          name: equipmentName || (recognizedType === 'ABERTO' ? 'Equipamento em aberto' : recognizedType),
          quantity,
          checked: false,
          sector: sector.toUpperCase(),
          source: 'IMPORTADO',
          status: 'Importado',
          originalType: sheetType || 'ABERTO',
          mountDate,
        };
      }).filter((item) => item.name || item.originalType || item.quantity);

      const eventWithoutSeparation = {
        ...eventData,
        boards: {
          info: { ...eventData },
          montagem,
          desmontagem: [],
          hospedagem: [],
          deslocamento: [],
          separar: [],
        },
      };
      return {
        ...eventWithoutSeparation,
        boards: {
          ...eventWithoutSeparation.boards,
          separar: generateSeparationFromMontagem(eventWithoutSeparation),
        },
      };
    });
  };

  const normalizeExtraInfoMessages = (value) => {
    if (!value) return [];
    if (Array.isArray(value)) {
      return value
        .map((entry) => {
          if (!entry) return null;
          if (typeof entry === 'string') {
            const text = entry.trim();
            return text ? { id: Date.now() + Math.random(), text, userName: 'Sistema' } : null;
          }
          const text = String(entry.text || '').trim();
          if (!text) return null;
          return {
            id: entry.id || `extra-${Date.now()}-${Math.random()}`,
            text,
            userName: entry.userName || 'Sistema',
            createdAt: entry.createdAt || new Date().toISOString(),
          };
        })
        .filter(Boolean);
    }

    if (typeof value === 'string') {
      const text = value.trim();
      return text ? [{ id: `extra-${Date.now()}-${Math.random()}`, text, userName: 'Sistema', createdAt: new Date().toISOString() }] : [];
    }

    return [];
  };

  const updateExtraInfoMessages = (event, nextMessages) => {
    const normalized = nextMessages
      .map((entry) => {
        const text = String(entry.text || '').trim();
        if (!text) return null;
        return {
          id: entry.id || `extra-${Date.now()}-${Math.random()}`,
          text,
          userName: entry.userName || 'Sistema',
          createdAt: entry.createdAt || new Date().toISOString(),
        };
      })
      .filter(Boolean);

    updateEvent({
      ...event,
      extraInfoMessages: normalized,
      extraInfo: normalized.map((entry) => entry.text).join('\n\n'),
    });
  };

  const addExtraInfoMessage = (event, message) => {
    const text = String(message || '').trim();
    if (!text) return;

    const nextMessages = [
      ...normalizeExtraInfoMessages(event.extraInfoMessages ?? event.extraInfo),
      {
        id: `extra-${Date.now()}`,
        text,
        userName: user?.name || 'Usuário',
        createdAt: new Date().toISOString(),
      },
    ];

    updateExtraInfoMessages(event, nextMessages);
    setExtraInfoDraft('');
  };

  const completeEvent = (event) => {
    if (!canManageAdminFeatures(user?.role || '')) return;

    const updated = { ...event, status: 'Concluído' };
    if (event.boards?.montagem?.length) {
      updated.boards = { ...event.boards, desmontagem: event.boards.montagem.map((item) => ({ ...item, checked: false })) };
    }
    updateEvent(updated);
  };

  const reopenEvent = (event) => {
    if (!canManageAdminFeatures(user?.role || '')) return;
    updateEvent({ ...event, status: 'A Iniciar' });
  };

  const removeEvent = (eventId) => onEventsChange(events.filter((item) => item.id !== eventId));

  const changeBoardItem = (event, boardKey, itemId, nextFields) => {
    if (event.status === 'Concluído') return;
    const board = event.boards[boardKey].map((item) => {
      if (item.id !== itemId) return item;

      const updatedItem = { ...item, ...nextFields };

      if (boardKey === 'separar' && nextFields.separated !== undefined) {
        if (nextFields.separated === true && !item.separated) {
          const newAuditTrail = addAuditTrail(item, 'separado');
          updatedItem.auditTrail = newAuditTrail;
        } else if (nextFields.separated === false && item.separated) {
          const newAuditTrail = addAuditTrail(item, 'desmarcado');
          updatedItem.auditTrail = newAuditTrail;
        }
      }

      return updatedItem;
    });

    const nextEvent = { ...event, boards: { ...event.boards, [boardKey]: board } };
    if (boardKey === 'montagem') {
      nextEvent.boards.separar = generateSeparationFromMontagem(nextEvent);
    }
    updateEvent(nextEvent);
  };

  const addBoardItem = (event, boardKey, item) => {
    if (event.status === 'Concluído') return;
    const next = [...event.boards[boardKey], { ...item, id: `${item.id || Date.now()}-${Date.now()}`, quantity: item.quantity ?? 1, checked: false }];
    const nextEvent = { ...event, boards: { ...event.boards, [boardKey]: next } };
    if (boardKey === 'montagem') {
      nextEvent.boards.separar = generateSeparationFromMontagem(nextEvent);
    }
    updateEvent(nextEvent);
  };

  const setEventField = (event, field, value) => updateEvent({ ...event, [field]: value });
  const setEventAccommodation = (event, changes) => updateEvent({ ...event, accommodation: { ...(event.accommodation || { type: 'NONE', hotelName: '', address: '', voucherType: 'HOSPEDAGEM EVENTO', attachmentName: '', attachmentType: '', attachmentData: '' }), ...changes } });

  const updateMontagemRealQuantity = (event, itemId, quantity) => {
    if (event.status === 'Concluído') return;
    changeBoardItem(event, 'montagem', itemId, { realQuantity: quantity });
  };

  const confirmRealMontagemQuantity = (event, item) => {
    if (event.status === 'Concluído') return;
    const confirmedQuantity = Number(item.realQuantity ?? item.quantity ?? 0) || 0;
    changeBoardItem(event, 'montagem', item.id, { realQuantity: confirmedQuantity, realQuantityConfirmed: true });
  };

  const editRealMontagemQuantity = (event, item) => {
    if (event.status === 'Concluído') return;
    changeBoardItem(event, 'montagem', item.id, { realQuantityConfirmed: false });
  };

  const downloadMountedItemsPdf = (event) => {
    const checkedItems = (event.boards?.montagem || []).filter((item) => item.checked);
    if (!checkedItems.length) return;
    generateMountedItemsPdf(event, checkedItems);
  };

  const handleAccommodationVoucherUpload = (event, file) => {
    if (!file) return;
    const currentAccommodation = event.accommodation || { type: 'NONE', hotelName: '', address: '', voucherType: 'HOSPEDAGEM EVENTO', attachmentName: '', attachmentType: '', attachmentData: '' };
    if (currentAccommodation.attachmentData) {
      revokeAttachmentData(currentAccommodation.attachmentData);
    }
    const objectUrl = URL.createObjectURL(file);
    setEventAccommodation(event, {
      attachmentName: file.name,
      attachmentType: file.type,
      attachmentData: objectUrl,
    });
  };

  const addAccommodation = (event) => {
    const accommodation = event.accommodation || { type: 'NONE', hotelName: '', address: '', voucherType: 'HOSPEDAGEM EVENTO', attachmentName: '', attachmentType: '', attachmentData: '' };
    if (accommodation.type === 'NONE') return;
    if (accommodation.type === 'HOTEL' && (!accommodation.hotelName?.trim() || !accommodation.address?.trim())) return;
    if (accommodation.type === 'AIRBNB' && !accommodation.address?.trim()) return;

    const accommodationId = `accommodation-${Date.now()}`;
    const voucherId = `hospedagem-${Date.now()}`;
    const nextAccommodations = [
      ...(event.accommodations || []),
      {
        id: accommodationId,
        accommodationType: accommodation.type,
        hotelName: accommodation.hotelName?.trim() || '',
        address: accommodation.address?.trim() || '',
        voucherType: accommodation.voucherType || 'HOSPEDAGEM EVENTO',
        voucherId,
        attachmentName: accommodation.attachmentName || '',
        attachmentType: accommodation.attachmentType || '',
        attachmentData: accommodation.attachmentData || '',
      },
    ];

    const voucherItem = {
      id: voucherId,
      name: accommodation.type === 'HOTEL' ? accommodation.hotelName?.trim() || 'Voucher de Hospedagem' : accommodation.address?.trim() || 'Voucher de Hospedagem',
      type: 'HOSPEDAGEM',
      quantity: 1,
      voucherType: accommodation.voucherType || 'HOSPEDAGEM EVENTO',
      accommodationType: accommodation.type,
      accommodationName: accommodation.hotelName?.trim() || '',
      accommodationAddress: accommodation.address?.trim() || '',
      checked: false,
      attachmentName: accommodation.attachmentName || '',
      attachmentType: accommodation.attachmentType || '',
      attachmentData: accommodation.attachmentData || '',
      accommodationId,
    };

    updateEvent({
      ...event,
      accommodations: nextAccommodations,
      boards: {
        ...event.boards,
        hospedagem: [...(event.boards.hospedagem || []), voucherItem],
      },
      accommodation: { type: 'NONE', hotelName: '', address: '', voucherType: 'HOSPEDAGEM EVENTO', attachmentName: '', attachmentType: '', attachmentData: '' },
    });
  };

  const removeAccommodation = (event, accommodationId) => {
    const next = (event.accommodations || []).filter((item) => item.id !== accommodationId);
    const nextVouchers = (event.boards.hospedagem || []).filter((item) => item.accommodationId !== accommodationId);
    updateEvent({ ...event, accommodations: next, boards: { ...event.boards, hospedagem: nextVouchers } });
  };

  const removeBoardItem = (event, boardKey, itemId) => {
    if (event.status === 'Concluído') return;
    const next = event.boards[boardKey].filter((item) => item.id !== itemId);
    const nextDesmontagem = boardKey === 'montagem'
      ? event.boards.desmontagem.filter((item) => item.montagemSourceId !== itemId)
      : event.boards.desmontagem;
    const nextEvent = { ...event, boards: { ...event.boards, [boardKey]: next, desmontagem: nextDesmontagem } };
    if (boardKey === 'montagem') {
      nextEvent.boards.separar = generateSeparationFromMontagem(nextEvent);
    }
    updateEvent(nextEvent);
  };

  const getTransferDateLabel = (value) => {
    if (!value) return 'sem data';
    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) return value;
    return parsedDate.toLocaleDateString('pt-BR');
  };

  const updateTransferEquipment = (itemId, updates) => {
    if (!selectedEvent) return;

    const originEvent = events.find((event) => event.id === selectedEvent.id);
    const originItem = (originEvent?.boards?.separar || []).find((item) => item.id === itemId);
    if (!originItem?.transferReference) return;

    const updatedQuantity = Number(updates.transferQuantity ?? originItem.transferQuantity ?? originItem.quantity ?? 1) || 1;
    const updatedDate = updates.transferDate ?? originItem.transferDate ?? '';
    const formattedDate = getTransferDateLabel(updatedDate);
    const targetEventName = originItem.transferTargetEventName || '';

    const nextEvents = events.map((event) => {
      if (event.id === originEvent.id) {
        const nextSeparation = (event.boards?.separar || []).map((entry) => {
          if (entry.id !== itemId) return entry;
          return {
            ...entry,
            quantity: entry.quantity ?? updatedQuantity,
            transferQuantity: updatedQuantity,
            transferDate: updatedDate,
            transferObservation: `Será transferido ${updatedQuantity} unidade(s) para ${targetEventName} em ${formattedDate}`,
            editable: true,
          };
        });

        const nextTransfers = (event.transfers || []).map((entry) => (
          entry.id === originItem.transferReference
            ? { ...entry, quantity: updatedQuantity, transferDate: updatedDate }
            : entry
        ));

        return { ...event, boards: { ...event.boards, separar: nextSeparation }, transfers: nextTransfers };
      }

      // Find main item in target event and update its incomingTransfers
      const nextSeparation = (event.boards?.separar || []).map((entry) => {
        if (entry.transferReference === originItem.transferReference && entry.isTransferred) {
          // this is a fallback transferred-only entry (created when there was no main item)
          return {
            ...entry,
            quantity: updatedQuantity,
            transferQuantity: updatedQuantity,
            transferDate: updatedDate,
            transferObservation: `Será recebido do evento ${originEvent.name} • qtd ${updatedQuantity} em ${formattedDate}`,
          };
        }
        // update main item incomingTransfers if matching
        if (!entry.isTransferred && (String(entry.type) === String(originItem.type) || String(entry.name) === String(originItem.name))) {
          const existingIncoming = Array.isArray(entry.incomingTransfers) ? [...entry.incomingTransfers] : [];
          // find existing incoming by transferReference id
          const foundIndex = existingIncoming.findIndex((it) => it.id === originItem.transferReference);
          if (foundIndex !== -1) {
            existingIncoming[foundIndex] = { ...existingIncoming[foundIndex], quantity: updatedQuantity, transferDate: updatedDate, transferObservation: `Será recebido do evento ${originEvent.name} • qtd ${updatedQuantity} em ${formattedDate}` };
          } else {
            existingIncoming.push({ id: originItem.transferReference, quantity: updatedQuantity, sourceEventId: originEvent.id, sourceEventName: originEvent.name, transferDate: updatedDate, transferObservation: `Será recebido do evento ${originEvent.name} • qtd ${updatedQuantity} em ${formattedDate}`, excludeFromNF: true });
          }

          const contract = Number(entry.contractQuantity ?? entry.quantity ?? 0) || 0;
          const backup = Number(entry.backupQuantity ?? 1) || 1;
          const incomingSum = existingIncoming.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
          const adjustedTotal = Math.max(0, contract + backup - incomingSum);

          return { ...entry, incomingTransfers: existingIncoming, quantity: adjustedTotal };
        }
        return entry;
      });

      const nextTransfers = (event.transfers || []).map((entry) => (
        entry.id === originItem.transferReference
          ? { ...entry, quantity: updatedQuantity, transferDate: updatedDate, status: 'RECEBIDO' }
          : entry
      ));

      return { ...event, boards: { ...event.boards, separar: nextSeparation }, transfers: nextTransfers };
    });

    onEventsChange(nextEvents);
    setEditingTransferItemId(null);
    setTransferEditForm({ transferQuantity: 1, transferDate: '' });
  };

  const cancelTransferEquipment = (itemId) => {
    if (!selectedEvent) return;

    const originEvent = events.find((event) => event.id === selectedEvent.id);
    const originItem = (originEvent?.boards?.separar || []).find((item) => item.id === itemId);
    if (!originItem?.transferReference) return;

    const nextEvents = events.map((event) => {
      if (event.id === originEvent.id) {
        const nextSeparation = (event.boards?.separar || []).map((entry) => {
          if (entry.id !== itemId) return entry;
          const rest = { ...entry };
          delete rest.transferObservation;
          delete rest.transferReference;
          delete rest.transferQuantity;
          delete rest.transferDate;
          delete rest.transferTargetEventId;
          delete rest.transferTargetEventName;
          delete rest.isTransferred;
          return { ...rest, editable: true };
        });
        const nextTransfers = (event.transfers || []).filter((entry) => entry.id !== originItem.transferReference);
        return { ...event, boards: { ...event.boards, separar: nextSeparation }, transfers: nextTransfers };
      }

      const targetItem = (event.boards?.separar || []).find((entry) => entry.transferReference === originItem.transferReference && entry.isTransferred);
      let nextSeparation = Array.from(event.boards?.separar || []);
      if (targetItem) {
        const transferQty = Number(targetItem.transferQuantity || targetItem.quantity || 0) || 0;
        // remove fallback transfer-only entry
        nextSeparation = nextSeparation.filter((entry) => entry.id !== targetItem.id);
        // remove incoming transfer from main item incomingTransfers and restore totals
        nextSeparation = nextSeparation.map((entry) => {
          if (!entry.isTransferred && (String(entry.type) === String(originItem.type) || String(entry.name) === String(originItem.name))) {
            const updated = { ...entry };
            const existingIncoming = Array.isArray(updated.incomingTransfers) ? [...updated.incomingTransfers] : [];
            const filteredIncoming = existingIncoming.filter((it) => it.id !== originItem.transferReference);
            const incomingSum = filteredIncoming.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
            const contract = Number(updated.contractQuantity ?? updated.quantity ?? 0) || 0;
            const backup = Number(updated.backupQuantity ?? 1) || 1;
            const adjustedTotal = Math.max(0, contract + backup - incomingSum);
            updated.incomingTransfers = filteredIncoming;
            updated.quantity = adjustedTotal;
            return updated;
          }
          return entry;
        });
      }

      const nextTransfers = (event.transfers || []).filter((entry) => entry.id !== originItem.transferReference);
      return { ...event, boards: { ...event.boards, separar: nextSeparation }, transfers: nextTransfers };
    });

    onEventsChange(nextEvents);
    setEditingTransferItemId(null);
    setTransferEditForm({ transferQuantity: 1, transferDate: '' });
  };

  const rentEquipment = () => {
    if (!selectedEvent) return;
    const company = String(rentalForm.company || '').trim();
    const selId = rentalForm.selectedItemId;
    const qty = Math.max(1, Number(rentalForm.quantity) || 1);
    if (!company || !selId || qty < 1) return;

    const originEvent = events.find((e) => e.id === selectedEvent.id);
    if (!originEvent) return;

    const item = (originEvent.boards?.separar || []).find((it) => String(it.id) === String(selId));
    if (!item) return;

    // compute available displayed quantity
    const existingIncoming = Array.isArray(item.incomingTransfers) ? item.incomingTransfers.reduce((s, it) => s + (Number(it.quantity) || 0), 0) : 0;
    const existingRentals = Array.isArray(item.externalRentals) ? item.externalRentals.reduce((s, it) => s + (Number(it.quantity) || 0), 0) : 0;
    const contract = Number(item.contractQuantity ?? item.quantity ?? 0) || 0;
    const backup = Number(item.backupQuantity ?? 1) || 1;
    const displayedAvailable = Math.max(0, contract + backup - existingIncoming - existingRentals);
    if (qty > displayedAvailable) return;

    const deliveryDate = String(rentalForm.deliveryDate || '').trim();
    const returnDate = String(rentalForm.returnDate || '').trim();
    const observation = `Locado para ${company} • qtd ${qty}`;

    const rentalEntry = {
      id: `rental-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      company,
      quantity: qty,
      startDate: deliveryDate,
      endDate: returnDate,
      date: new Date().toISOString(),
      observation,
    };

    const nextEvents = events.map((ev) => {
      if (ev.id !== originEvent.id) return ev;
      const nextSeparation = (ev.boards?.separar || []).map((entry) => {
        if (String(entry.id) !== String(item.id)) return entry;
        const existing = Array.isArray(entry.externalRentals) ? [...entry.externalRentals] : [];
        existing.push(rentalEntry);
        return { ...entry, externalRentals: existing };
      });
      return { ...ev, boards: { ...ev.boards, separar: nextSeparation } };
    });

    onEventsChange(nextEvents);
    setRentalForm({ selectedItemId: '', company: '', quantity: 1, deliveryDate: '', returnDate: '' });
    setShowRentalPanel(false);
  };

  const cancelExternalRental = (itemId, rentalId) => {
    if (!selectedEvent) return;
    const originEvent = events.find((e) => e.id === selectedEvent.id);
    if (!originEvent) return;
    const nextEvents = events.map((ev) => {
      if (ev.id !== originEvent.id) return ev;
      const nextSeparation = (ev.boards?.separar || []).map((entry) => {
        if (String(entry.id) !== String(itemId)) return entry;
        const nextRentals = (entry.externalRentals || []).filter((r) => r.id !== rentalId);
        return { ...entry, externalRentals: nextRentals };
      });
      return { ...ev, boards: { ...ev.boards, separar: nextSeparation } };
    });
    onEventsChange(nextEvents);
  };

  const transferEquipment = () => {
    if (!selectedEvent || !transferForm.transferDate || !transferForm.targetEventId) return;

    const transferQuantity = Number(transferForm.transferQuantity) || 1;
    if (transferQuantity < 1) return;

    const originEvent = events.find((event) => String(event.id) === String(activeEventId)) || selectedEvent;
    const targetEvent = events.find((event) => String(event.id) === String(transferForm.targetEventId));
    if (!targetEvent || !originEvent || targetEvent.id === originEvent.id) return;

    const targetRange = getEventTransferDateRange(targetEvent);
    if (!isDateWithinEventTransferRange(transferForm.transferDate, targetEvent)) {
      window.alert(`A data de transferência deve estar entre ${formatShortDate(targetRange.minDate)} e ${formatShortDate(targetRange.maxDate)} para o evento destino.`);
      return;
    }

    const sourceItems = (originEvent.boards?.separar || []).filter((item) => Number(item.quantity || 0) > 0);
    const selectedTransferItem = sourceItems.find((item) => String(item.id) === String(transferForm.selectedItemId));
    const equipmentToTransfer = selectedTransferItem || sourceItems[0];
    if (!equipmentToTransfer) return;

    const availableQuantity = Number(equipmentToTransfer.quantity || 0);
    if (transferQuantity > availableQuantity) return;

    const formattedTransferDate = new Date(transferForm.transferDate).toLocaleDateString('pt-BR');
    const remainingQuantity = availableQuantity - transferQuantity;
    const transferEntry = {
      id: `transfer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      equipmentType: equipmentToTransfer.type,
      quantity: transferQuantity,
      transferDate: transferForm.transferDate,
      targetEventId: targetEvent.id,
      sourceEventId: originEvent.id,
      targetEventName: targetEvent.name,
      sourceEventName: originEvent.name,
      status: 'PENDENTE',
    };

    const existingObservation = equipmentToTransfer.transferObservation ? `${equipmentToTransfer.transferObservation} • ` : '';
    const transferObservation = `${existingObservation}Será transferido ${transferQuantity} unidade(s) para ${targetEvent.name} em ${formattedTransferDate}`;

    const updatedOriginBoards = {
      ...originEvent.boards,
      separar: (originEvent.boards?.separar || []).map((item) => {
        if (item.id !== equipmentToTransfer.id) return item;
        return {
          ...item,
          transferObservation,
          transferReferences: [...(item.transferReferences || []), transferEntry.id],
          transferReference: transferEntry.id,
          transferQuantity,
          transferDate: transferForm.transferDate,
          transferTargetEventId: targetEvent.id,
          transferTargetEventName: targetEvent.name,
          editable: true,
        };
      }),
    };

    // Adjust target separation: attach incoming transfer to existing main item (no new item)
    const targetSeparation = Array.from(targetEvent.boards?.separar || []);
    const mainIndex = targetSeparation.findIndex((entry) => String(entry.type) === String(equipmentToTransfer.type) || String(entry.name) === String(equipmentToTransfer.name));
    if (mainIndex !== -1) {
      const mainItem = { ...targetSeparation[mainIndex] };
      const existingIncoming = Array.isArray(mainItem.incomingTransfers) ? [...mainItem.incomingTransfers] : [];
      existingIncoming.push({
        id: transferEntry.id,
        quantity: transferQuantity,
        sourceEventId: originEvent.id,
        sourceEventName: originEvent.name,
        transferDate: transferForm.transferDate,
        transferObservation: `Será recebido do evento ${originEvent.name} • qtd ${transferQuantity} em ${formattedTransferDate}`,
        excludeFromNF: true,
      });

      // compute adjusted total (contractQuantity stays the same)
      const contract = Number(mainItem.contractQuantity ?? mainItem.quantity ?? 0) || 0;
      const backup = Number(mainItem.backupQuantity ?? 1) || 1;
      const incomingSum = existingIncoming.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
      const adjustedTotal = Math.max(0, contract + backup - incomingSum);

      targetSeparation[mainIndex] = { ...mainItem, incomingTransfers: existingIncoming, quantity: adjustedTotal };
    } else {
      // No matching main item: attach as a new entry but mark excludeFromNF
      targetSeparation.push({
        id: `transfer-${Date.now()}-${targetEvent.id}`,
        type: equipmentToTransfer.type,
        name: equipmentToTransfer.name,
        quantity: transferQuantity,
        transferReference: transferEntry.id,
        sourceEventId: originEvent.id,
        sourceEventName: originEvent.name,
        isTransferred: true,
        editable: false,
        transferObservation: `Será recebido do evento ${originEvent.name} • qtd ${transferQuantity} em ${formattedTransferDate}`,
        transferQuantity,
        transferDate: transferForm.transferDate,
        transferTargetEventId: targetEvent.id,
        transferTargetEventName: targetEvent.name,
        excludeFromNF: true,
      });
    }

    const updatedTargetBoards = { ...targetEvent.boards, separar: targetSeparation };

    const nextEvents = events.map((event) => {
      if (event.id === originEvent.id) {
        return { ...event, boards: updatedOriginBoards, transfers: [...(event.transfers || []), transferEntry] };
      }
      if (event.id === targetEvent.id) {
        return { ...event, boards: updatedTargetBoards, transfers: [...(event.transfers || []), { ...transferEntry, status: 'RECEBIDO' }] };
      }
      return event;
    });

    onEventsChange(nextEvents);
    setTransferForm({ transferDate: '', targetEventId: '', transferQuantity: 1, selectedItemId: '' });
    setShowTransferPanel(false);
  };

  const getSectorPlanning = (event, sector) => {
    const normalizedSector = sector || 'OUTRO SETOR';
    return event.sectorPlanning?.[normalizedSector] || { mountDate: '' };
  };

  const updateSectorPlanning = (event, sector, updates) => {
    const normalizedSector = sector || 'OUTRO SETOR';
    updateEvent({
      ...event,
      sectorPlanning: {
        ...(event.sectorPlanning || {}),
        [normalizedSector]: {
          ...(event.sectorPlanning?.[normalizedSector] || {}),
          ...updates,
        },
      },
    });
  };

  const removeMontagemSector = (event, sector) => {
    const nextMontagem = event.boards.montagem.filter((item) => item.sector !== sector);
    const nextDesmontagem = event.boards.desmontagem.filter((item) => nextMontagem.some((montagemItem) => montagemItem.id === item.montagemSourceId));
    const nextSectorPlanning = { ...(event.sectorPlanning || {}) };
    delete nextSectorPlanning[sector || 'OUTRO SETOR'];
    updateEvent({ ...event, boards: { ...event.boards, montagem: nextMontagem, desmontagem: nextDesmontagem }, sectorPlanning: nextSectorPlanning });
  };

  const transferMontagemItemToSector = (event, item, targetSector, transferDate, transferQuantity) => {
    const normalizedTargetSector = targetSector || 'OUTRO SETOR';
    const normalizedSourceSector = item.sector || 'OUTRO SETOR';
    const normalizedTransferQuantity = Math.max(1, Math.min(Number(transferQuantity) || 1, Number(item.quantity || 1) || 1));
    if (!transferDate || !normalizedTargetSector || normalizedTransferQuantity < 1) return;

    const transferItemId = `transfer-placeholder-${item.id}-${Date.now()}`;
    const transferBatchId = `transfer-batch-${Date.now()}`;
    const transferLabel = `Transferido do setor ${normalizedSourceSector} para ${normalizedTargetSector} em ${new Date(transferDate).toLocaleDateString('pt-BR')}`;
    const isTransferActiveNow = isTransferActiveOnDate({ transferDate, currentDate: new Date() });

    const nextMontagem = [...(event.boards?.montagem || [])];

    const sourceItem = {
      ...item,
      transferScheduled: true,
      transferDate,
      transferTargetSector: normalizedTargetSector,
      transferSourceSector: normalizedSourceSector,
      transferReferenceId: transferItemId,
      transferQuantity: normalizedTransferQuantity,
      transferBatchId,
      transferPending: !isTransferActiveNow,
      transferApplied: isTransferActiveNow,
      transferAppliedAt: isTransferActiveNow ? transferDate : undefined,
      transferLabel,
    };

    const placeholderItem = {
      ...item,
      id: transferItemId,
      quantity: normalizedTransferQuantity,
      sector: normalizedTargetSector,
      isTransferPlaceholder: true,
      transferReferenceId: item.id,
      transferDate,
      transferSourceSector: normalizedSourceSector,
      transferTargetSector: normalizedTargetSector,
      transferLabel,
      transferScheduled: true,
      transferQuantity: normalizedTransferQuantity,
      transferBatchId,
      transferPending: !isTransferActiveNow,
      transferApplied: isTransferActiveNow,
      transferAppliedAt: isTransferActiveNow ? transferDate : undefined,
      checked: false,
      name: `${item.name} (transferido de ${normalizedSourceSector})`,
    };

    const updatedMontagem = nextMontagem.map((entry) => (entry.id === item.id ? sourceItem : entry));
    updateEvent({
      ...event,
      boards: {
        ...event.boards,
        montagem: [...updatedMontagem, placeholderItem],
      },
    });

    setSectorTransferItemId(null);
    setSectorTransferTarget('');
    setSectorTransferDate('');
    setSectorTransferQuantity(1);
  };

  const handleVoucherUpload = (event, boardKey, itemId, file) => {
    if (!file) return;
    const currentItem = event.boards[boardKey].find((item) => item.id === itemId);
    if (currentItem?.attachmentData) {
      revokeAttachmentData(currentItem.attachmentData);
    }
    const objectUrl = URL.createObjectURL(file);
    changeBoardItem(event, boardKey, itemId, {
      attachmentName: file.name,
      attachmentType: file.type,
      attachmentData: objectUrl,
    });
  };

  const handleNewTransportVoucherUpload = (file) => {
    if (!file) return;
    if (newTransportVoucherData) {
      revokeAttachmentData(newTransportVoucherData);
    }
    const objectUrl = URL.createObjectURL(file);
    setNewTransportVoucherName(file.name);
    setNewTransportVoucherType(file.type);
    setNewTransportVoucherData(objectUrl);
  };

  const clearNewTransportVoucher = () => {
    if (newTransportVoucherData) {
      revokeAttachmentData(newTransportVoucherData);
    }
    setNewTransportVoucherName('');
    setNewTransportVoucherType('');
    setNewTransportVoucherData('');
  };

  const removeVoucherAttachment = (event, boardKey, itemId) => {
    const currentItem = event.boards[boardKey].find((item) => item.id === itemId);
    if (currentItem?.attachmentData) {
      revokeAttachmentData(currentItem.attachmentData);
    }
    changeBoardItem(event, boardKey, itemId, {
      attachmentName: '',
      attachmentType: '',
      attachmentData: '',
    });
  };

  const startEditingItem = (boardKey, item) => setEditingItem({ ...item, boardKey });
  const cancelEditItem = () => setEditingItem(null);
  const saveEditedItem = () => {
    if (!editingItem) return;
    changeBoardItem(selectedEvent, editingItem.boardKey, editingItem.id, {
      name: editingItem.name,
      quantity: Number(editingItem.quantity) || 1,
      type: editingItem.type,
    });
    setEditingItem(null);
  };

  const isMontagemBoardComplete = (montagemItems) => {
    const activeItems = (montagemItems || []).filter((item) => !(item.isTransferPlaceholder && item.transferScheduled && !item.transferApplied));
    return activeItems.length > 0 && activeItems.every((item) => Boolean(item.checked));
  };

  const isSeparationBoardComplete = (separationItems) => {
    const activeItems = (separationItems || []).filter((item) => Number(item.quantity || 0) > 0);
    return activeItems.length > 0 && activeItems.every((item) => Boolean(item.separated));
  };

  const addAuditTrail = (item, action) => {
    const now = new Date().toISOString();
    const trail = item.auditTrail || {};
    const nextIndex = Object.keys(trail).length;
    return {
      ...trail,
      [nextIndex]: {
        action,
        user: user?.name || 'Usuário',
        userId: user?.id ?? null,
        timestamp: now,
      },
    };
  };

  const toggleMontagemCompletion = (event, item, checked) => {
    if (event.status === 'Concluído') return;
    const updatedMontagem = event.boards.montagem.map((entry) => {
      if (entry.id !== item.id) return entry;
      const newAuditTrail = addAuditTrail(entry, checked ? 'montado' : 'desmarcado');
      return {
        ...entry,
        checked,
        auditTrail: newAuditTrail,
      };
    });
    let updatedDesmontagem = event.boards.desmontagem;

    if (checked) {
      const hasDesmontagem = event.boards.desmontagem.some((des) => des.montagemSourceId === item.id);
      if (!hasDesmontagem) {
        updatedDesmontagem = [
          ...updatedDesmontagem,
          {
            sourceId: item.sourceId,
            montagemSourceId: item.id,
            type: item.type,
            name: item.name,
            serial: item.serial,
            quantity: item.quantity,
            checked: false,
            sector: item.sector,
            id: `desmontagem-${item.id}-${Date.now()}`,
          },
        ];
      }
    } else {
      updatedDesmontagem = event.boards.desmontagem.filter((des) => des.montagemSourceId !== item.id);
    }

    const montagemComplete = isMontagemBoardComplete(updatedMontagem);
    updateEvent({
      ...event,
      boards: { ...event.boards, montagem: updatedMontagem, desmontagem: updatedDesmontagem },
      boardStatus: {
        ...getEventBoardStatus(event),
        ['MONTAGEM DO EVENTO']: montagemComplete,
      },
    });
  };

  const toggleDesmontagemCompletion = (event, item, checked) => {
    if (event.status === 'Concluído') return;
    const updatedDesmontagem = event.boards.desmontagem.map((entry) => {
      if (entry.id !== item.id) return entry;
      const newAuditTrail = addAuditTrail(entry, checked ? 'desmontado' : 'desmarcado');
      return { ...entry, checked, auditTrail: newAuditTrail };
    });
    updateEvent({ ...event, boards: { ...event.boards, desmontagem: updatedDesmontagem } });
  };

  const addMontagemFromInventory = () => {
    if (!selectedEvent || selectedEvent.status === 'Concluído') return;

    const itemType = newMontagemItem.itemType?.trim();
    const quantity = Number(newMontagemItem.quantity) || 1;
    if (!itemType || quantity < 1) return;

    const sector = newMontagemItem.sector === 'OUTRO SETOR' ? (newMontagemItem.customSector.trim() || 'OUTRO SETOR') : newMontagemItem.sector;
    const item = {
      id: `mont-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: itemType,
      name: itemType,
      quantity,
      checked: false,
      sector,
      sourceInventory: false,
      genericType: true,
    };

    const nextMontagem = [...(selectedEvent.boards?.montagem || []), item];
    const nextEvent = {
      ...selectedEvent,
      boards: {
        ...selectedEvent.boards,
        montagem: nextMontagem,
      },
    };

    const nextEventWithSeparation = {
      ...nextEvent,
      boards: {
        ...nextEvent.boards,
        separar: generateSeparationFromMontagem(nextEvent),
      },
    };

    updateEvent(nextEventWithSeparation);
    updateSectorPlanning(nextEventWithSeparation, sector, {
      mountDate: newMontagemItem.mountDate || '',
    });
    setNewMontagemItem({ itemType: '', sector: 'SECRETARIA', customSector: '', quantity: 1, mountDate: '' });
  };

  const addSeparationItem = () => {
    if (!selectedEvent || selectedEvent.status === 'Concluído' || !newSeparationQuantity || newSeparationQuantity < 1) return;
    const quantity = Number(newSeparationQuantity);

    const itemType = newSeparationRentalType?.trim() || newSeparationInventoryId?.trim();
    if (!itemType) return;

    const item = {
      id: `separar-${Date.now()}`,
      source: 'ESTOQUE',
      type: itemType,
      name: itemType,
      quantity,
      checked: false,
      separated: false,
      editable: true,
    };

    addBoardItem(selectedEvent, 'separar', item);
    setNewSeparationInventoryId('');
    setNewSeparationRentalType('');
    setNewSeparationQuantity(1);
  };

  const generateSeparationFromMontagem = (event) => {
    const groupedItems = new Map();
    const baseTimestamp = Date.now();
    const montagemItems = applyScheduledSectorTransfers({ items: event.boards.montagem, currentDate: new Date() });

    const normalizeText = (value) => String(value || '').trim().normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase();
    let laserPrinterCount = 0;
    let thermalPrinterCount = 0;

    montagemItems.forEach((item) => {
      const type = item.type || item.name || 'Equipamento';
      const currentQuantity = Number(item.quantity) || 1;
      const sector = item.sector || 'OUTRO SETOR';
      const sectorPlanning = getSectorPlanning(event, sector);
      const effectiveDate = getEffectiveConsumptionDate({
        mountDate: sectorPlanning.mountDate || event.departureDate || event.startDate || event.returnDate || '',
        departureDate: event.departureDate || event.startDate || event.returnDate || '',
        leadDays: 1,
      });
      const normalizedType = normalizeText(type);
      const normalizedName = normalizeText(item.name);

      if (normalizedType.includes('IMPRESSORA LASER') || normalizedName.includes('IMPRESSORA LASER')) {
        laserPrinterCount += currentQuantity;
      }
      if (normalizedType.includes('IMPRESSORA TERMICA') || normalizedName.includes('IMPRESSORA TERMICA')) {
        thermalPrinterCount += currentQuantity;
      }

      if (!groupedItems.has(type)) {
        groupedItems.set(type, {
          id: `separar-${type.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${baseTimestamp}`,
          source: 'ESTOQUE',
          type,
          name: type,
          contractQuantity: currentQuantity,
          backupQuantity: 1,
          quantity: currentQuantity + 1,
          status: item.status || 'Normal',
          checked: false,
          separated: false,
          mountDate: sectorPlanning.mountDate || '',
          consumptionDate: effectiveDate,
          sector,
        });
        return;
      }

      const existing = groupedItems.get(type);
      existing.contractQuantity += currentQuantity;
      existing.backupQuantity = existing.backupQuantity ?? 1;
      existing.quantity = existing.contractQuantity + existing.backupQuantity;
      if (!existing.mountDate && (sectorPlanning.mountDate || '')) {
        existing.mountDate = sectorPlanning.mountDate;
      }
      if (!existing.consumptionDate && effectiveDate) {
        existing.consumptionDate = effectiveDate;
      }
    });

    const itensSeparation = Array.from(groupedItems.values());
    const printerCount = event.boards.montagem.filter((item) => String(item.type).toUpperCase().trim() === 'IMPRESSORA TÉRMICA').reduce((sum, item) => sum + Number(item.quantity), 0);

    if (laserPrinterCount > 0) {
      itensSeparation.push({
        id: `transformador-${baseTimestamp}`,
        source: 'ESTOQUE',
        type: 'TRANSFORMADOR',
        name: 'TRANSFORMADOR',
        contractQuantity: laserPrinterCount,
        backupQuantity: 0,
        quantity: laserPrinterCount,
        status: 'Automático',
        checked: false,
        separated: false,
        mountDate: '',
        consumptionDate: event.departureDate || event.startDate || event.returnDate || '',
        sector: 'TRANSFORMADOR',
      });
    }

    const tonnerCount = laserPrinterCount * 2;
    if (tonnerCount > 0) {
      itensSeparation.push({
        id: `tonner-${baseTimestamp}`,
        source: 'ESTOQUE',
        type: 'TONNER',
        name: 'TONNER',
        contractQuantity: tonnerCount,
        backupQuantity: 0,
        quantity: tonnerCount,
        status: 'Automático',
        checked: false,
        separated: false,
        mountDate: '',
        consumptionDate: event.departureDate || event.startDate || event.returnDate || '',
        sector: 'TONNER',
      });
    }

    if (printerCount > 0) {
      itensSeparation.push({ id: `label-${baseTimestamp}`, type: 'ETIQUETA', name: event.labelSize, quantity: Math.ceil(printerCount * 2.5), status: 'Automático', source: 'ESTOQUE', checked: false, mountDate: '', consumptionDate: event.departureDate || event.startDate || event.returnDate || '' });
      itensSeparation.push({ id: `ribbon-${baseTimestamp + 1}`, type: 'RIBBON', name: 'Ribbon', quantity: Math.ceil(printerCount * 1.5), status: 'Automático', source: 'ESTOQUE', checked: false, mountDate: '', consumptionDate: event.departureDate || event.startDate || event.returnDate || '' });
    }
    return itensSeparation;
  };

  const buildWhatsAppMessage = (event, { returnRequest = false } = {}) => {
    const lines = [];
    if (returnRequest) {
      lines.push(`Olá, solicito NF de retorno para os equipamentos do evento ${event.name || 'Não informado'}`);
    } else {
      lines.push(`Olá, segue a lista de itens para NF do evento ${event.name || 'Não informado'}`);
    }
    lines.push('');
    lines.push('Itens separados:');

    const items = (event.boards?.separar || []).filter((item) => item.excludeFromNF !== true);
    const formattedItems = items.map((item) => {
      const incomingTransfers = Array.isArray(item.incomingTransfers) ? item.incomingTransfers.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0) : 0;
      const total = Number(item.quantity || 0) + (returnRequest ? incomingTransfers : 0);
      return { item, total, incomingTransfers };
    });
    const validItems = formattedItems.filter(({ total, item }) => total > 0 || (Array.isArray(item.externalRentals) && item.externalRentals.some((r) => Number(r.quantity || 0) > 0)));

    if (validItems.length === 0) {
      lines.push('- Nenhum item para separar.');
    } else {
      validItems.forEach(({ item, total, incomingTransfers }) => {
        const label = item.name || item.type || 'Equipamento';
        lines.push(`- ${label}: ${total}`);
        if (returnRequest && incomingTransfers > 0) {
          lines.push(`  - Inclui transferência recebida: ${incomingTransfers}`);
        }

        if (Array.isArray(item.externalRentals) && item.externalRentals.length > 0) {
          item.externalRentals.forEach((rental) => {
            const rentalQty = Number(rental.quantity || 0);
            if (rentalQty > 0) {
              const company = rental.company ? ` (${rental.company})` : '';
              lines.push(`  - Locação${company}: ${rentalQty}`);
            }
          });
        }
      });
    }

    return encodeURIComponent(lines.join('\n'));
  };

  const saveMontagem = (event) => {
    const nextBoards = { ...event.boards };
    nextBoards.separar = generateSeparationFromMontagem(event);
    updateEvent({ ...event, boards: nextBoards });
  };

  const syncSeparation = (event) => {
    if (event.status === 'Concluído') return event.boards.separar || [];
    const itensSeparation = generateSeparationFromMontagem(event);
    updateEvent({ ...event, boards: { ...event.boards, separar: itensSeparation } });
    return itensSeparation;
  };

  const currentEvents = events.filter((item) => item.status !== 'Concluído');
  const completedEvents = events.filter((item) => item.status === 'Concluído');
  const visibleEvents = canManageEvents
    ? currentEvents
    : currentEvents.filter((item) => item.users?.some((userId) => userId === user.id));

  const visibleCompletedEvents = canManageEvents
    ? completedEvents
    : completedEvents.filter((item) => item.users?.some((userId) => userId === user.id));

  const getEventMonthLabel = (event) => {
    const dateKey = event.startDate || event.departureDate || event.eventDate || '';
    const date = new Date(dateKey);
    if (Number.isNaN(date.getTime())) return 'Sem data';
    return date.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
  };

  const groupEventsByMonth = (eventsList) => eventsList.reduce((groups, event) => {
    const label = getEventMonthLabel(event);
    groups[label] = groups[label] || [];
    groups[label].push(event);
    return groups;
  }, {});

  const groupedActiveEvents = groupEventsByMonth(visibleEvents);
  const groupedCompletedEvents = groupEventsByMonth(visibleCompletedEvents);

  const boardConfiguration = defaultBoardTitles.reduce((acc, title) => {
    acc[title] = false;
    return acc;
  }, {});

  const getEventBoardStatus = (event) => ({ ...boardConfiguration, ...(event.boardStatus || {}) });

  const getBoardCompletionState = (event, title) => !!getEventBoardStatus(event)[title];

  const setBoardCompletion = (event, title, value) => {
    updateEvent({
      ...event,
      boardStatus: {
        ...getEventBoardStatus(event),
        [title]: value,
      },
    });
  };

  const getEventCardColor = (event) => {
    const status = getEventBoardStatus(event);
    const allCompleted = defaultBoardTitles.every((title) => status[title]);
    const coreBoardsCompleted = ['INFORMAÇÕES DO EVENTO', 'HOSPEDAGEM', 'DESLOCAMENTO', 'SEPARAR ITENS PARA O EVENTO']
      .every((title) => status[title]);

    if (allCompleted) return 'border-emerald-400 bg-emerald-100/90';
    if (coreBoardsCompleted) return 'border-sky-400 bg-sky-100/90';
    return 'border-slate-300 bg-slate-100/90';
  };

  const handleSelectEvent = (eventId) => {
    try {
      const payload = {
        timestamp: new Date().toISOString(),
        selectingEventId: eventId,
        previousActiveEventId: activeEventId,
        eventsCount: events?.length || 0,
        sampleEvents: (events || []).slice(0, 8).map((e) => ({ id: e.id, name: e.name })),
      };
      // eslint-disable-next-line no-console
      console.log('EventBoard select debug:', payload, { resolvedEvent: events?.find((ev) => ev.id === eventId) });
      try { localStorage.setItem('eventboard_last_select', JSON.stringify(payload)); } catch (e) { /* ignore */ }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Error capturing select debug', e);
    }

    setActiveEventId(eventId);
    setShowEventSelector(false);
    setExpandedBoard([]);
  };

  const handleBackToEventSelector = () => {
    setShowEventSelector(true);
    setExpandedBoard([]);
  };

  const startEditingEvent = (event) => {
    setEditingEventId(event.id);
    setForm({
      ...getDefaultEventForm(),
      name: event.name || '',
      address: event.address || '',
      locationName: event.locationName || '',
      clientName: event.clientName || '',
      organizerName: event.organizerName || '',
      contact: event.contact || '',
      departureDate: event.departureDate || event.startDate || '',
      startDate: event.startDate || '',
      endDate: event.endDate || '',
      returnDate: event.returnDate || event.endDate || '',
      labelSize: event.labelSize || '9X5',
      environmentLink: event.environmentLink || 'https://sigevent.pro/bcs/',
    });
    setNewEventUsers(event.users || []);
    setNewEventUserAssignments((event.userAssignments || (event.users || []).map((userId) => ({
      userId,
      departureDate: event.departureDate || event.startDate || '',
      returnDate: event.returnDate || event.endDate || '',
    }))).map((assignment) => ({
      ...assignment,
      departureDate: assignment.departureDate || assignment.startDate || '',
      returnDate: assignment.returnDate || assignment.endDate || '',
    })));
    setShowEventForm(true);
    setShowEventSelector(true);
    setActiveEventId(event.id);
    setExpandedBoard([]);
  };

  const duplicateEvent = (event) => {
    const duplicatedEvent = {
      ...event,
      id: Date.now(),
      name: `${event.name || 'Evento'} - Cópia`,
      status: 'A Iniciar',
      users: event.users || [],
      extraInfo: '',
      extraInfoMessages: [],
      accommodation: { type: 'NONE', hotelName: '', address: '', voucherType: 'HOSPEDAGEM EVENTO' },
      externalRentalInfo: { company: '', deliveryDate: '', returnDate: '' },
      boards: initializeEventBoards({ ...event, id: Date.now(), status: 'A Iniciar' }, config.defaultItems || []),
      boardStatus: {},
    };

    onEventsChange([...events, duplicatedEvent]);
    setActiveEventId(duplicatedEvent.id);
    setShowEventSelector(false);
    setExpandedBoard([]);
    setPendingAction(null);
  };

  const deleteEvent = (eventId) => {
    onEventsChange(events.filter((item) => item.id !== eventId));
    if (activeEventId === eventId) {
      const remainingEvents = events.filter((item) => item.id !== eventId);
      setActiveEventId(remainingEvents[0]?.id || null);
    }
    setPendingAction(null);
  };

  const alertMessages = useMemo(() => {
    const roundDate = (dateString) => {
      const date = new Date(dateString);
      return isNaN(date.getTime()) ? null : date;
    };

    const eventRange = (event) => {
      const start = roundDate(event.departureDate || event.startDate);
      const end = roundDate(event.returnDate || event.endDate);
      return start && end ? [start.getTime(), end.getTime()] : null;
    };

    const activeEvents = events.filter((event) => event.status !== 'Concluído');
    const typeInventory = inventory.reduce((acc, item) => {
      if (!item.type) return acc;
      acc[item.type] = (acc[item.type] || 0) + Number(item.quantity || 0);
      return acc;
    }, {});

    const eventInfos = activeEvents
      .map((event) => {
        const stockBoard = (event.boards?.separar?.length ? event.boards.separar : event.boards?.montagem) || [];
        return {
          event,
          range: eventRange(event),
          typeQuantities: stockBoard.reduce((acc, item) => {
            if (!item.type) return acc;
            const type = item.type;
            if (!acc[type]) acc[type] = { stock: 0, rental: 0 };
            if (item.source === 'LOCAÇÃO') {
              acc[type].rental += Number(item.quantity || 0);
            } else {
              acc[type].stock += Number(item.quantity || 0);
            }
            return acc;
          }, {}),
        };
      })
      .filter((entry) => entry.range);

    const groups = [];
    eventInfos.forEach((current) => {
      const overlapInfos = [current];
      eventInfos.forEach((other) => {
        if (other.event.id === current.event.id) return;
        const overlap = current.range[0] <= other.range[1] && other.range[0] <= current.range[1];
        if (overlap) overlapInfos.push(other);
      });
      const key = overlapInfos.map((info) => info.event.id).sort().join(',');
      if (!groups.some((group) => group.key === key)) {
        groups.push({ key, infos: overlapInfos });
      }
    });

    const messages = [];

    const addMessage = (text) => {
      if (!messages.includes(text)) messages.push(text);
    };

    const formatDateLabel = (value) => {
      if (!value) return 'sem data';
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return 'sem data';
      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    eventInfos.forEach(({ event, range, typeQuantities }) => {
      const startLabel = range ? formatDateLabel(range[0]) : 'sem data';
      const endLabel = range ? formatDateLabel(range[1]) : 'sem data';
      Object.entries(typeQuantities).forEach(([type, qty]) => {
        if (type === 'LOCAÇÃO EXTERNA') return;
        const available = typeInventory[type] || 0;
        const availableWithRental = available + (qty.rental || 0);
        if ((qty.stock || 0) > availableWithRental) {
          addMessage(`FALTA: ${type} | Quantidade: ${(qty.stock || 0) - availableWithRental} | Período: ${startLabel} até ${endLabel} | Evento: ${event.name}`);
        }
      });
    });

    groups.forEach((group) => {
      if (group.infos.length < 2) return;

      const periodStart = group.infos.reduce((min, info) => {
        const date = roundDate(info.event.departureDate || info.event.startDate);
        return date && (!min || date < min) ? date : min;
      }, null);
      const periodEnd = group.infos.reduce((max, info) => {
        const date = roundDate(info.event.returnDate || info.event.endDate);
        return date && (!max || date > max) ? date : max;
      }, null);

      const groupTotals = group.infos.reduce((acc, info) => {
        Object.entries(info.typeQuantities).forEach(([type, qty]) => {
          acc[type] = (acc[type] || 0) + qty;
        });
        return acc;
      }, {});

      Object.entries(groupTotals).forEach(([type, totalQty]) => {
        const available = typeInventory[type] || 0;
        if (totalQty > available) {
          const names = group.infos.map((info) => info.event.name).join(', ');
          const startLabel = periodStart ? formatDateLabel(periodStart.getTime()) : 'sem data';
          const endLabel = periodEnd ? formatDateLabel(periodEnd.getTime()) : 'sem data';
          addMessage(`FALTA: ${type} | Quantidade: ${totalQty - available} | Período: ${startLabel} até ${endLabel} | Eventos em conflito: ${names}`);
        }
      });
    });

    return messages;
  }, [events, inventory]);

  const renderEventBoard = () => {
    if (!selectedEvent) return null;

    const extraInfoMessages = normalizeExtraInfoMessages(selectedEvent.extraInfoMessages ?? selectedEvent.extraInfo);
    const hasExtraInfo = extraInfoMessages.length > 0;
    const isEventCompleted = selectedEvent.status === 'Concluído';

    return (
      <div className="space-y-4">
        {alertMessages.length > 0 && (
          <div className="rounded-3xl border border-rose-500 bg-rose-100 p-4 text-sm text-rose-900">
            {alertMessages.map((message, index) => (
              <p key={index} className="font-semibold">{message}</p>
            ))}
          </div>
        )}

        {pendingEventClosure && (
          <div className="rounded-3xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-semibold">Deseja encerrar o evento {pendingEventClosure.name}?</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="neumorphic-button px-4 py-2"
                onClick={() => {
                  completeEvent(pendingEventClosure);
                  setPendingEventClosure(null);
                  setShowEventSelector(true);
                  setExpandedBoard([]);
                }}
              >
                Sim, encerrar
              </button>
              <button
                type="button"
                className="neumorphic-button px-4 py-2"
                onClick={() => setPendingEventClosure(null)}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {pendingAction && (
          <div className="rounded-3xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-semibold">
              {pendingAction.type === 'duplicate' ? `Deseja duplicar o evento ${pendingAction.event.name}?` : `Deseja excluir o evento ${pendingAction.event.name}?`}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="neumorphic-button px-4 py-2"
                onClick={() => {
                  if (pendingAction.type === 'duplicate') {
                    duplicateEvent(pendingAction.event);
                  } else {
                    deleteEvent(pendingAction.event.id);
                  }
                }}
              >
                {pendingAction.type === 'duplicate' ? 'Sim, duplicar' : 'Sim, excluir'}
              </button>
              <button
                type="button"
                className="neumorphic-button px-4 py-2"
                onClick={() => setPendingAction(null)}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-2xl font-semibold">Quadro do Evento: {selectedEvent.name}</h3>
            <p className="text-sm text-slate-500">Selecione os quadros para revisar e atualizar o evento.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canManageEvents && (
              <>
                <button
                  type="button"
                  onClick={() => startEditingEvent(selectedEvent)}
                  className="whitespace-nowrap rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-100 dark:ring-slate-600"
                >
                  Editar evento
                </button>
                <button
                  type="button"
                  onClick={() => setPendingAction({ type: 'duplicate', event: selectedEvent })}
                  className="whitespace-nowrap rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-100 dark:ring-slate-600"
                >
                  Duplicar evento
                </button>
                <button
                  type="button"
                  onClick={() => setPendingAction({ type: 'delete', event: selectedEvent })}
                  className="whitespace-nowrap rounded-full bg-rose-100 px-4 py-2 text-sm font-semibold text-rose-700 ring-1 ring-rose-200 transition hover:bg-rose-200"
                >
                  Excluir evento
                </button>
                <button
                  type="button"
                  onClick={() => setPendingEventClosure(selectedEvent)}
                  disabled={isEventCompleted}
                  className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${isEventCompleted ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-700 dark:text-slate-100 dark:ring-slate-600'}`}
                >
                  {isEventCompleted ? 'Evento encerrado' : 'Encerrar evento'}
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setShowExtraInfo((prev) => !prev)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${hasExtraInfo ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 ring-1 ring-slate-200 shadow-sm dark:bg-slate-700 dark:text-slate-100 dark:ring-slate-600'}`}
            >
              Informações extras
            </button>
          </div>
        </div>

        {showExtraInfo && (
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <label className="mb-2 block text-sm font-semibold text-slate-700">Mensagem adicional</label>
            <textarea
              className="neumorphic-textarea min-h-[110px] w-full resize-none"
              value={extraInfoDraft}
              onChange={(e) => setExtraInfoDraft(e.target.value)}
              placeholder="Digite qualquer informação extra sobre o evento..."
            />
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                className="neumorphic-button px-4 py-2"
                onClick={() => addExtraInfoMessage(selectedEvent, extraInfoDraft)}
                disabled={!extraInfoDraft.trim()}
              >
                Cadastrar
              </button>
            </div>

            {hasExtraInfo && (
              <div className="mt-4 space-y-3">
                <span className="font-semibold block text-slate-700">Mensagens registradas:</span>
                {extraInfoMessages.map((message) => (
                  <div key={message.id} className="rounded-2xl border border-emerald-300 bg-emerald-100 p-3 text-sm text-emerald-900">
                    <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-800/80">
                      <span>{message.userName || 'Sistema'}</span>
                      <span>
                        {message.createdAt ? new Date(message.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : ''}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap">{message.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="grid gap-4 items-start xl:grid-cols-2">
          {defaultBoardTitles.map((title) => {
            const isExpanded = expandedBoard.includes(title);
            const accommodationState = selectedEvent.accommodation || { type: 'NONE', hotelName: '', address: '', voucherType: 'HOSPEDAGEM EVENTO' };
            const boardCompleted = getBoardCompletionState(selectedEvent, title);
            const montagemBoardAutoComplete = title === 'MONTAGEM DO EVENTO' && isMontagemBoardComplete(selectedEvent.boards.montagem);
            const separationBoardAutoComplete = title === 'SEPARAR ITENS PARA O EVENTO' && isSeparationBoardComplete(selectedEvent.boards.separar);
            const normalizedBoardCompleted = boardCompleted || montagemBoardAutoComplete || separationBoardAutoComplete;
            const isTransportBoardCompleted = title === 'DESLOCAMENTO' && normalizedBoardCompleted;
            const boardColorClass = normalizedBoardCompleted
              ? 'border-emerald-400 bg-emerald-100/90'
              : 'border-slate-300 bg-slate-100/90';

            return (
              <NeumorphicCard key={title} className={`h-fit overflow-hidden border ${boardColorClass}`}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 text-left transition-all duration-300 ease-out"
                    onClick={() => setExpandedBoard((prev) => {
                      if (prev.includes(title)) {
                        return prev.filter((board) => board !== title);
                      }
                      return [...prev, title];
                    })}
                  >
                    <h4 className="text-base font-semibold">{title}</h4>
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-700 shadow-sm transition-transform duration-300 ease-out ring-1 ring-slate-200 dark:bg-slate-700 dark:text-slate-100 dark:ring-slate-600"
                      style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBoardCompletion(selectedEvent, title, !boardCompleted)}
                    className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${normalizedBoardCompleted ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-700 dark:text-slate-100 dark:ring-slate-600'}`}
                  >
                    {normalizedBoardCompleted ? 'Concluído' : 'Marcar'}
                  </button>
                </div>

                <div
                  className="overflow-hidden transition-all duration-300 ease-out"
                  style={{
                    maxHeight: isExpanded ? '2800px' : '0px',
                    opacity: isExpanded ? 1 : 0,
                    pointerEvents: isExpanded ? 'auto' : 'none',
                  }}
                >
                  <div className="space-y-3">
                    {title === 'INFORMAÇÕES DO EVENTO' && (
                      <div className="space-y-2 text-sm text-slate-600">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <p><span className="font-semibold">Cliente:</span> {selectedEvent.clientName || 'Não informado'}</p>
                          <p><span className="font-semibold">Responsável:</span> {selectedEvent.organizerName || 'Não informado'}</p>
                        </div>
                        <p><span className="font-semibold">Local:</span> {selectedEvent.locationName}</p>
                        <p><span className="font-semibold">Endereço:</span> {selectedEvent.address}</p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <p><span className="font-semibold">Contato:</span> {selectedEvent.contact}</p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <p><span className="font-semibold">Data de Ida:</span> {formatShortDate(selectedEvent.departureDate)}</p>
                          <p><span className="font-semibold">Data de Retorno:</span> {formatShortDate(selectedEvent.returnDate)}</p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <p><span className="font-semibold">Data Inicial do Evento:</span> {formatShortDate(selectedEvent.startDate)}</p>
                          <p><span className="font-semibold">Data Final do Evento:</span> {formatShortDate(selectedEvent.endDate)}</p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <p><span className="font-semibold">Tamanho da Etiqueta:</span> {selectedEvent.labelSize}</p>
                          <p><span className="font-semibold">Profissionais:</span> {(selectedEvent.users || [])
                              .map((userId) => users.find((u) => u.id === userId))
                              .filter(Boolean)
                              .map((u) => u.name)
                              .join(', ') || 'Nenhum profissional adicionado'}
                          </p>
                        </div>
                            <div className="flex flex-wrap items-center gap-3 pt-2">
                          {selectedEvent.contact && (
                            <a className="neumorphic-button inline-flex items-center" href={`https://wa.me/${formatPhoneUrl(selectedEvent.contact)}`} target="_blank" rel="noreferrer"><MessageCircle className="mr-2 h-4 w-4" />WhatsApp</a>
                          )}
                          {selectedEvent.environmentLink && (
                            <a className="neumorphic-button inline-flex items-center" href={selectedEvent.environmentLink} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Abrir ambiente</a>
                          )}
                          <button className="neumorphic-button inline-flex items-center" onClick={() => generateEventChecklistPdf(selectedEvent, config)}><FileText className="mr-2 h-4 w-4" />Gerar Checklist</button>
                        </div>
                      </div>
                    )}

                    {title === 'MONTAGEM DO EVENTO' && (
                      <div className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-5">
                          <select className="neumorphic-select w-full" value={newMontagemItem.itemType} onChange={(e) => setNewMontagemItem((prev) => ({ ...prev, itemType: e.target.value }))} disabled={isEventCompleted}>
                            <option value="">Tipo do item</option>
                            {config.itemTypes?.map((type) => (
                              <option key={type} value={type}>{type}</option>
                            ))}
                          </select>
                          <select className="neumorphic-select w-full" value={newMontagemItem.sector} onChange={(e) => setNewMontagemItem((prev) => ({ ...prev, sector: e.target.value }))} disabled={isEventCompleted}>
                            <option value="SECRETARIA">SECRETARIA</option>
                            <option value="CAEX">CAEX</option>
                            <option value="CONTROLE DE ACESSO">CONTROLE DE ACESSO</option>
                            <option value="OUTRO SETOR">OUTRO SETOR</option>
                          </select>
                          <input type="number" min="1" className="neumorphic-input w-full" placeholder="Quantidade" value={newMontagemItem.quantity} onChange={(e) => setNewMontagemItem((prev) => ({ ...prev, quantity: Number(e.target.value) || 1 }))} disabled={isEventCompleted} />
                          <button className="neumorphic-button w-full" onClick={addMontagemFromInventory} disabled={isEventCompleted}>Adicionar item por tipo</button>
                        </div>
                        {newMontagemItem.sector === 'OUTRO SETOR' && (
                          <input className="neumorphic-input w-full" placeholder="Nome do setor" value={newMontagemItem.customSector} onChange={(e) => setNewMontagemItem((prev) => ({ ...prev, customSector: e.target.value }))} />
                        )}
                        {selectedEvent.boards.montagem.some((item) => item.type === 'LOCAÇÃO EXTERNA') && (
                          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                            <h4 className="text-base font-semibold">Locação Externa</h4>
                            <div className="grid gap-3 sm:grid-cols-2 mt-3">
                              <input className="neumorphic-input" placeholder="Empresa de locação" value={selectedEvent.externalRentalInfo?.company || ''} onChange={(e) => setEventField(selectedEvent, 'externalRentalInfo', { ...(selectedEvent.externalRentalInfo || {}), company: e.target.value })} />
                              <input type="date" className="neumorphic-input" value={selectedEvent.externalRentalInfo?.deliveryDate || ''} onChange={(e) => setEventField(selectedEvent, 'externalRentalInfo', { ...(selectedEvent.externalRentalInfo || {}), deliveryDate: e.target.value })} />
                            </div>
                            <input type="date" className="neumorphic-input mt-3" value={selectedEvent.externalRentalInfo?.returnDate || ''} onChange={(e) => setEventField(selectedEvent, 'externalRentalInfo', { ...(selectedEvent.externalRentalInfo || {}), returnDate: e.target.value })} />
                          </div>
                        )}
                        {selectedEvent.boards.montagem.length === 0 ? (
                          <div className="text-slate-500">Nenhum equipamento adicionado à montagem.</div>
                        ) : (
                          <>
                            <div className="text-xs text-slate-500">A lista geral de separação é gerada automaticamente com base nos itens de montagem.</div>
                            <div className="flex items-center gap-3">
                              <button className="neumorphic-button secondary inline-flex items-center gap-2 px-4 py-2 max-w-fit" onClick={() => downloadMountedItemsPdf(selectedEvent)} disabled={!selectedEvent.boards.montagem.some((item) => item.checked)}>
                                <FileText className="h-4 w-4" />
                                Exportar PDF
                              </button>
                            </div>
                            {Object.entries(selectedEvent.boards.montagem.reduce((groups, item) => {
                              const sector = item.sector || 'OUTRO SETOR';
                              if (!groups[sector]) groups[sector] = [];
                              groups[sector].push(item);
                              return groups;
                            }, {})).map(([sector, items]) => (
                              <div key={sector} className="space-y-3">
                                <div className="rounded-3xl bg-slate-100 p-3 text-sm font-semibold text-slate-700">
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                      <span>Setor: {sector}</span>
                                      {getSectorPlanning(selectedEvent, sector).mountDate && (
                                        <span className="text-xs text-slate-500">Data de montagem {formatShortDate(getSectorPlanning(selectedEvent, sector).mountDate)}</span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button className="neumorphic-button px-3 py-2 text-xs" onClick={() => removeMontagemSector(selectedEvent, sector)}>Excluir setor</button>
                                      <button className="neumorphic-button px-3 py-2 text-xs" onClick={() => {
                                        const planning = getSectorPlanning(selectedEvent, sector);
                                        setSectorEditDrafts((prev) => ({ ...prev, [sector]: { mountDate: planning.mountDate || '' } }));
                                        setSectorEditing(sector);
                                      }}><MoreHorizontal className="h-4 w-4" /></button>
                                    </div>
                                  </div>

                                  {sectorEditing === sector ? (
                                    <div className="mt-3 grid gap-3 sm:grid-cols-2 items-center">
                                      <input type="date" className="neumorphic-input w-full" value={sectorEditDrafts[sector]?.mountDate || ''} onChange={(e) => setSectorEditDrafts((prev) => ({ ...prev, [sector]: { ...(prev[sector] || {}), mountDate: e.target.value } }))} />
                                      <div className="flex items-center gap-2">
                                        <div className="flex gap-2">
                                          <button className="neumorphic-button px-3 py-2" onClick={() => {
                                            const draft = sectorEditDrafts[sector] || {};
                                            updateSectorPlanning(selectedEvent, sector, { mountDate: draft.mountDate || '' });
                                            setSectorEditing(null);
                                            setSectorEditDrafts((prev) => { const next = { ...prev }; delete next[sector]; return next; });
                                          }}>Salvar</button>
                                          <button className="neumorphic-button px-3 py-2" onClick={() => {
                                            setSectorEditing(null);
                                            setSectorEditDrafts((prev) => { const next = { ...prev }; delete next[sector]; return next; });
                                          }}>Cancelar</button>
                                        </div>
                                      </div>
                                    </div>
                                  ) : (null)}
                                </div>
                                {items.map((item) => {
                                  const isEditing = editingItem?.boardKey === 'montagem' && editingItem?.id === item.id;
                                  const isTransferActive = Boolean(item.transferApplied) || isTransferActiveOnDate({ transferDate: item.transferDate });
                                  const isTransferPlaceholder = Boolean(item.isTransferPlaceholder);
                                  const isTransferPending = Boolean(item.transferScheduled && !item.transferApplied && item.transferDate && !isTransferActiveOnDate({ transferDate: item.transferDate }));
                                  return (
                                    <div key={item.id} className={`p-3 rounded-3xl shadow-sm ${isTransferPending ? 'border border-amber-200 bg-amber-50/80' : 'bg-white/80'}`}>
                                      <div className="grid gap-3 sm:grid-cols-[1fr_80px_120px] items-center">
                                        <div>
                                          <div className="font-semibold">{item.type || item.name}</div>
                                          {item.name && item.type && (
                                            <div className="text-sm text-slate-500">{item.name}</div>
                                          )}
                                          {item.serial && <div className="text-xs text-slate-500">Serial: {item.serial}</div>}
                                          <div className="text-xs text-slate-500">Setor: {item.sector || 'OUTRO SETOR'}</div>
                                          {item.mountDate && (
                                            <div className="text-xs text-slate-500">Data de operação: {formatShortDate(item.mountDate)}</div>
                                          )}
                                          {item.type === 'ABERTO' && (
                                            <div className="mt-2">
                                              <select className="neumorphic-select w-full" value={item.type} onChange={(e) => changeBoardItem(selectedEvent, 'montagem', item.id, { type: e.target.value })}>
                                                <option value="ABERTO">Tipo não definido</option>
                                                {availableItemTypes.map((type) => (
                                                  <option key={type} value={type}>{type}</option>
                                                ))}
                                              </select>
                                            </div>
                                          )}
                                          {item.transferScheduled && (
                                            <div className={`text-xs ${isTransferPending ? 'text-amber-600' : 'text-slate-500'}`}>
                                              {isTransferPlaceholder
                                                ? (isTransferActive ? 'Ativo no setor' : `Ativa em ${formatShortDate(item.transferDate)}`)
                                                : `Transferência para ${item.transferTargetSector || 'outro setor'} em ${formatShortDate(item.transferDate)} • qtd ${item.transferQuantity || item.quantity || 1}`}
                                            </div>
                                          )}
                                        </div>
                                        <input type="number" min="1" className="neumorphic-input" value={item.quantity} onChange={(e) => changeBoardItem(selectedEvent, 'montagem', item.id, { quantity: Number(e.target.value) || 1 })} disabled={isEventCompleted || item.realQuantityConfirmed || Boolean(item.transferScheduled && !item.transferApplied)} />
                                        <label className="inline-flex items-center gap-2 text-sm">
                                          <input type="checkbox" checked={item.checked} onChange={(e) => toggleMontagemCompletion(selectedEvent, item, e.target.checked)} disabled={isEventCompleted || (isTransferPlaceholder && !isTransferActive)} />
                                          Montado
                                        </label>
                                        {item.checked && (
                                          <div className="grid w-full gap-2 sm:grid-cols-[1fr_auto] items-end">
                                            <label className="space-y-1 w-full">
                                              <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Quantidade real montada</span>
                                              <input
                                                type="number"
                                                min="0"
                                                className="neumorphic-input w-full"
                                                value={(item.realQuantity ?? item.quantity) || 0}
                                                onChange={(e) => updateMontagemRealQuantity(selectedEvent, item.id, Math.max(0, Number(e.target.value) || 0))}
                                                disabled={isEventCompleted || item.realQuantityConfirmed}
                                              />
                                            </label>
                                            {item.realQuantityConfirmed ? (
                                              <button
                                                className="neumorphic-button outline w-full sm:w-auto"
                                                onClick={() => editRealMontagemQuantity(selectedEvent, item)}
                                                disabled={isEventCompleted}
                                              >
                                                Editar
                                              </button>
                                            ) : (
                                              <button
                                                className="neumorphic-button primary w-full sm:w-auto"
                                                onClick={() => confirmRealMontagemQuantity(selectedEvent, item)}
                                                disabled={isEventCompleted}
                                              >
                                                Confirmar
                                              </button>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                      {item.auditTrail && Object.keys(item.auditTrail).length > 0 && (
                                        <div className="mt-2 space-y-1">
                                          {Object.values(item.auditTrail).map((entry, idx) => (
                                            <div key={idx} className="text-[10px] font-medium uppercase tracking-[0.15em] text-slate-500">
                                              ({entry.action} por) {entry.user} • {formatAuditDateTime(entry.timestamp)}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                      <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <button className="neumorphic-button px-3 py-2" onClick={() => startEditingItem('montagem', item)} disabled={isEventCompleted}><Pencil className="h-4 w-4" /></button>
                                          <button className="neumorphic-button px-3 py-2" onClick={() => removeBoardItem(selectedEvent, 'montagem', item.id)} disabled={isEventCompleted}><Trash2 className="h-4 w-4" /></button>
                                          <button className="neumorphic-button px-3 py-2" title="Transferir setor" onClick={() => {
                                            if (isEventCompleted) return;
                                            setSectorTransferItemId(item.id);
                                            setSectorTransferTarget(item.transferTargetSector || '');
                                            setSectorTransferDate(item.transferDate || '');
                                            setSectorTransferQuantity(Number(item.transferQuantity || item.quantity || 1) || 1);
                                          }} disabled={isEventCompleted}><ArrowRight className="h-4 w-4" /></button>
                                        </div>
                                        {sectorTransferItemId === item.id && (
                                          <div className="flex flex-wrap items-center gap-2 w-full mt-2">
                                            <select className="neumorphic-select" value={sectorTransferTarget} onChange={(e) => setSectorTransferTarget(e.target.value)}>
                                              <option value="">Selecione o setor</option>
                                              {( ['SECRETARIA', 'CAEX', 'CONTROLE DE ACESSO', 'OUTRO SETOR']
                                                .filter((sectorOption) => sectorOption !== (item.sector || 'OUTRO SETOR'))
                                                .map((sectorOption) => (
                                                  <option key={sectorOption} value={sectorOption}>{sectorOption}</option>
                                                )) )}
                                            </select>
                                            <input type="date" className="neumorphic-input" value={sectorTransferDate} onChange={(e) => setSectorTransferDate(e.target.value)} />
                                            <input type="number" min="1" max={item.quantity || 1} className="neumorphic-input" value={sectorTransferQuantity} onChange={(e) => setSectorTransferQuantity(Math.max(1, Math.min(Number(e.target.value) || 1, Number(item.quantity || 1) || 1)))} />
                                            <button className="neumorphic-button px-3 py-2" onClick={() => transferMontagemItemToSector(selectedEvent, item, sectorTransferTarget, sectorTransferDate, sectorTransferQuantity)} disabled={isEventCompleted}>Salvar</button>
                                            <button className="neumomorphic-button px-3 py-2" onClick={() => {
                                              setSectorTransferItemId(null);
                                              setSectorTransferTarget('');
                                              setSectorTransferDate('');
                                            }}>Cancelar</button>
                                          </div>
                                        )}
                                        {isEditing && (
                                          <div className="grid gap-2 sm:grid-cols-[1fr_120px_80px_auto] mt-3 w-full">
                                            <input className="neumorphic-input" value={editingItem.name} onChange={(e) => setEditingItem((prev) => ({ ...prev, name: e.target.value }))} />
                                            <select className="neumorphic-select" value={editingItem.type || 'ABERTO'} onChange={(e) => setEditingItem((prev) => ({ ...prev, type: e.target.value }))}>
                                              <option value="ABERTO">Tipo não definido</option>
                                              {availableItemTypes.map((type) => (
                                                <option key={type} value={type}>{type}</option>
                                              ))}
                                            </select>
                                            <input type="number" min="1" className="neumorphic-input" value={editingItem.quantity} onChange={(e) => setEditingItem((prev) => ({ ...prev, quantity: Number(e.target.value) || 1 }))} />
                                            <div className="flex gap-2">
                                              <button className="neumorphic-button px-3 py-2" onClick={saveEditedItem}>Salvar</button>
                                              <button className="neumorphic-button px-3 py-2" onClick={cancelEditItem}>Cancelar</button>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    )}

                    {title === 'DESMONTAGEM' && (
                      <div className="space-y-4">
                        {selectedEvent.boards.desmontagem.length === 0 ? (
                          <div className="text-slate-500">Nenhum item para desmontagem. Marque equipamento como montado na montagem.</div>
                        ) : (
                          selectedEvent.boards.desmontagem.map((item) => (
                            <div key={item.id} className="p-3 rounded-3xl bg-white/80 shadow-sm">
                              <div className="grid gap-3 sm:grid-cols-[1fr_100px_140px] items-center">
                                <div>
                                  <div className="font-semibold">{item.name}</div>
                                  <div className="text-sm text-slate-500">{item.type}</div>
                                  {item.sector && <div className="text-xs text-slate-500">Setor: {item.sector}</div>}
                                </div>
                                <span className="text-sm">Qtd: {item.quantity}</span>
                                <label className="inline-flex items-center gap-2 text-sm">
                                  <input type="checkbox" checked={item.checked} onChange={(e) => toggleDesmontagemCompletion(selectedEvent, item, e.target.checked)} />
                                  Desmontado
                                </label>
                              </div>
                              {item.auditTrail && Object.keys(item.auditTrail).length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {Object.values(item.auditTrail).map((entry, idx) => (
                                    <div key={idx} className="text-[10px] font-medium uppercase tracking-[0.15em] text-slate-500">
                                      ({entry.action} por) {entry.user} • {formatAuditDateTime(entry.timestamp)}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {title === 'HOSPEDAGEM' && (
                      <div className="space-y-4">
                        {boardCompleted ? (
                          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                            Hospedagem definida
                          </div>
                        ) : (
                          <>
                            <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
                              <select className="neumorphic-select w-full" value={accommodationState.type} onChange={(e) => {
                                const type = e.target.value;
                                setEventAccommodation(selectedEvent, { type, hotelName: '', address: '', voucherType: type === 'NONE' ? 'HOSPEDAGEM EVENTO' : 'HOSPEDAGEM EVENTO' });
                              }}>
                                <option value="NONE">Sem hospedagem</option>
                                <option value="AIRBNB">AIRBNB</option>
                                <option value="HOTEL">HOTEL</option>
                              </select>
                              {!boardCompleted && (
                                <button type="button" className="neumorphic-button w-full" onClick={() => addAccommodation(selectedEvent)} disabled={accommodationState.type === 'NONE'}><PlusCircle className="mr-2 h-4 w-4" />Cadastrar Hospedagem</button>
                              )}
                            </div>

                            {accommodationState.type !== 'NONE' && (
                              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                                <div className="text-sm font-semibold">Dados da hospedagem</div>
                                <div className="text-sm text-slate-600">Tipo: {accommodationState.type}</div>
                                {accommodationState.type === 'HOTEL' && (
                                  <>
                                    <input className="neumorphic-input w-full" placeholder="Nome do hotel" value={accommodationState.hotelName || ''} onChange={(e) => setEventAccommodation(selectedEvent, { hotelName: e.target.value })} />
                                    <input className="neumorphic-input w-full" placeholder="Endereço do hotel" value={accommodationState.address || ''} onChange={(e) => setEventAccommodation(selectedEvent, { address: e.target.value })} />
                                  </>
                                )}
                                {accommodationState.type === 'AIRBNB' && (
                                  <input className="neumorphic-input w-full" placeholder="Endereço do Airbnb" value={accommodationState.address || ''} onChange={(e) => setEventAccommodation(selectedEvent, { address: e.target.value })} />
                                )}
                                <select className="neumorphic-select w-full" value={accommodationState.voucherType || 'HOSPEDAGEM EVENTO'} onChange={(e) => setEventAccommodation(selectedEvent, { voucherType: e.target.value })}>
                                  <option value="HOSPEDAGEM EVENTO">EVENTO</option>
                                  <option value="HOSPEDAGEM IDA">IDA</option>
                                  <option value="HOSPEDAGEM VOLTA">VOLTA</option>
                                </select>

                                <div className="rounded-2xl border border-slate-200 bg-white/70 p-3">
                                  <div className="text-sm font-semibold text-slate-700">Voucher</div>
                                  <div className="grid gap-3 sm:grid-cols-[1fr_auto] items-center mt-3">
                                    <div className="neumorphic-input flex items-center justify-between gap-3">
                                      <span>{accommodationState.attachmentName || 'Nenhum voucher anexado'}</span>
                                    </div>
                                    <label className="neumorphic-button px-3 py-2 cursor-pointer">
                                      <span>{accommodationState.attachmentName ? 'Trocar voucher' : 'Anexar voucher'}</span>
                                      <input type="file" className="hidden" onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handleAccommodationVoucherUpload(selectedEvent, file);
                                        e.target.value = '';
                                      }} />
                                    </label>
                                  </div>
                                </div>
                              </div>
                            )}
                          </>
                        )}

                        {selectedEvent.boards.hospedagem.length === 0 ? (
                          <div className="text-slate-500">Nenhum voucher de hospedagem adicionado.</div>
                        ) : (
                          selectedEvent.boards.hospedagem.map((item) => {
                            const uploadId = `hospedagem-upload-${item.id}`;
                            const isEditingAccommodationItem = editingAccommodationItemId === item.id;
                            const primaryAccommodationLabel = item.accommodationName || item.accommodationAddress || item.name;
                            const secondaryAccommodationLabel = item.accommodationAddress && item.accommodationName ? item.accommodationAddress : null;
                            return (
                              <div key={item.id} className="p-3 rounded-3xl bg-white/80 shadow-sm">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1">
                                    <div className="text-base font-semibold text-slate-800">{primaryAccommodationLabel}</div>
                                    {secondaryAccommodationLabel && (
                                      <div className="text-sm text-slate-500">{secondaryAccommodationLabel}</div>
                                    )}
                                    <div className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-500">{item.voucherType}</div>
                                    {item.accommodationType && <div className="text-xs text-slate-500">Tipo: {item.accommodationType}</div>}
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {!isEditingAccommodationItem && item.attachmentName && (
                                      <button className="neumorphic-button px-3 py-2" onClick={() => downloadAttachment(item)}>Baixar voucher</button>
                                    )}
                                    <button className="neumorphic-button px-3 py-2" onClick={() => setEditingAccommodationItemId(isEditingAccommodationItem ? null : item.id)}>
                                      {isEditingAccommodationItem ? 'Voltar' : 'Editar'}
                                    </button>
                                    <button className="neumorphic-button px-3 py-2" onClick={() => removeBoardItem(selectedEvent, 'hospedagem', item.id)}>Remover</button>
                                  </div>
                                </div>

                                <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                                  <div className="text-sm font-semibold text-slate-700">Voucher</div>
                                  <div className="grid gap-3 sm:grid-cols-[1fr_auto] items-center mt-3">
                                    <div className="neumorphic-input flex items-center justify-between gap-3">
                                      <span>{item.attachmentName || 'Nenhum voucher anexado'}</span>
                                    </div>
                                    <label htmlFor={uploadId} className="neumorphic-button px-3 py-2 cursor-pointer">
                                      <span>{item.attachmentName ? 'Trocar voucher' : 'Anexar voucher'}</span>
                                      <input id={uploadId} type="file" className="hidden" onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handleVoucherUpload(selectedEvent, 'hospedagem', item.id, file);
                                        e.target.value = '';
                                      }} />
                                    </label>
                                  </div>
                                </div>

                                {isEditingAccommodationItem && (
                                  <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                                    <div className="text-sm font-semibold text-slate-700">Editar hospedagem</div>
                                    <div className="grid gap-3 sm:grid-cols-2">
                                      <div className="space-y-1">
                                        <label className="text-xs uppercase tracking-[0.2em] text-slate-500">Tipo</label>
                                        <select className="neumorphic-select w-full" value={item.accommodationType || 'HOTEL'} onChange={(e) => changeBoardItem(selectedEvent, 'hospedagem', item.id, { accommodationType: e.target.value })}>
                                          <option value="HOTEL">HOTEL</option>
                                          <option value="AIRBNB">AIRBNB</option>
                                        </select>
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-xs uppercase tracking-[0.2em] text-slate-500">Tipo de voucher</label>
                                        <select className="neumorphic-select w-full" value={item.voucherType || 'HOSPEDAGEM EVENTO'} onChange={(e) => changeBoardItem(selectedEvent, 'hospedagem', item.id, { voucherType: e.target.value })}>
                                          <option value="HOSPEDAGEM EVENTO">EVENTO</option>
                                          <option value="HOSPEDAGEM IDA">IDA</option>
                                          <option value="HOSPEDAGEM VOLTA">VOLTA</option>
                                        </select>
                                      </div>
                                      <div className="space-y-1 sm:col-span-2">
                                        <label className="text-xs uppercase tracking-[0.2em] text-slate-500">Nome / Estabelecimento</label>
                                        <input className="neumorphic-input w-full" value={item.accommodationName || item.name || ''} onChange={(e) => changeBoardItem(selectedEvent, 'hospedagem', item.id, { accommodationName: e.target.value, name: e.target.value })} />
                                      </div>
                                      <div className="space-y-1 sm:col-span-2">
                                        <label className="text-xs uppercase tracking-[0.2em] text-slate-500">Endereço</label>
                                        <input className="neumorphic-input w-full" value={item.accommodationAddress || ''} onChange={(e) => changeBoardItem(selectedEvent, 'hospedagem', item.id, { accommodationAddress: e.target.value })} />
                                      </div>
                                    </div>
                                    <div className="rounded-2xl border border-slate-200 bg-white/70 p-3">
                                      <div className="text-sm font-semibold text-slate-700">Voucher</div>
                                      <div className="grid gap-3 sm:grid-cols-[1fr_auto] items-center mt-3">
                                        <div className="neumorphic-input flex items-center justify-between gap-3">
                                          <span>{item.attachmentName || 'Nenhum voucher anexado'}</span>
                                        </div>
                                        <label htmlFor={uploadId} className="neumorphic-button px-3 py-2 cursor-pointer">
                                          <span>Cadastrar voucher</span>
                                          <input id={uploadId} type="file" className="hidden" onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) handleVoucherUpload(selectedEvent, 'hospedagem', item.id, file);
                                            e.target.value = '';
                                          }} />
                                        </label>
                                      </div>
                                    </div>
                                    <div className="flex justify-end">
                                      <button className="neumorphic-button px-3 py-2" onClick={() => setEditingAccommodationItemId(null)}>
                                        Salvar
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}

                    {title === 'DESLOCAMENTO' && (
                      <div className="space-y-4">
                        {selectedEvent.status !== 'Concluído' && !isTransportBoardCompleted ? (
                          <>
                            <div className="space-y-3">
                              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                                <select className="neumorphic-select" value={newTransportMode} onChange={(e) => setNewTransportMode(e.target.value)}>
                                  <option value="CARRO BCS">CARRO BCS</option>
                                  <option value="UBER">UBER</option>
                                  <option value="AVIÃO">AVIÃO</option>
                                  <option value="ÔNIBUS">ÔNIBUS</option>
                                  <option value="LOCAÇÃO DE VEÍCULO">LOCAÇÃO DE VEÍCULO</option>
                                </select>
                                {!isEventCompleted ? (
                                  <button className="neumorphic-button" onClick={() => {
                                    const item = {
                                      id: `trans-${Date.now()}`,
                                      name: 'Transporte',
                                      type: 'DESLOCAMENTO',
                                      quantity: 1,
                                      transportMode: newTransportMode,
                                      departureDate: newTransportDepartureDate,
                                      returnDate: newTransportReturnDate,
                                      departureTime: newTransportDepartureTime,
                                      returnTime: newTransportReturnTime,
                                      vehicleModel: newTransportVehicleModel,
                                      reservationCode: newTransportReservationCode,
                                      passageCode: newTransportReservationCode,
                                      company: newTransportCompany,
                                      professionalIds: newTransportProfessionalIds,
                                      checked: false,
                                      attachmentName: newTransportVoucherName,
                                      attachmentType: newTransportVoucherType,
                                      attachmentData: newTransportVoucherData,
                                    };
                                    addBoardItem(selectedEvent, 'deslocamento', item);
                                    setNewTransportDepartureDate('');
                                    setNewTransportReturnDate('');
                                    setNewTransportDepartureTime('');
                                    setNewTransportReturnTime('');
                                    setNewTransportVehicleModel('');
                                    setNewTransportCompany('');
                                    setNewTransportReservationCode('');
                                    setNewTransportProfessionalIds([]);
                                    clearNewTransportVoucher();
                                  }}>
                                    <PlusCircle className="mr-2 h-4 w-4" />Cadastrar Transporte
                                  </button>
                                ) : null}
                              </div>
                              <div className="space-y-2">
                                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Profissionais (opcional)</div>
                                {eventProfessionals.length === 0 ? (
                                  <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">Sem profissionais no evento</div>
                                ) : (
                                  <div className="grid gap-2 rounded-3xl border border-slate-200 bg-white/80 p-3">
                                    {eventProfessionals.map((professional) => (
                                      <label key={professional.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                                        <input
                                          type="checkbox"
                                          className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                                          checked={newTransportProfessionalIds.includes(professional.id)}
                                          onChange={(e) => {
                                            const id = professional.id;
                                            setNewTransportProfessionalIds((prev) => (
                                              e.target.checked
                                                ? [...prev, id]
                                                : prev.filter((existingId) => existingId !== id)
                                            ));
                                          }}
                                        />
                                        <span>{professional.name}{professional.email ? ` (${professional.email})` : ''}</span>
                                      </label>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                            {newTransportMode === 'CARRO BCS' && (
                              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                                <div className="text-sm font-semibold text-slate-700">Detalhes do veículo</div>
                                <div className="space-y-1">
                                  <label className="text-xs uppercase tracking-[0.2em] text-slate-500">Modelo do veículo</label>
                                  <input type="text" className="neumorphic-input" value={newTransportVehicleModel} onChange={(e) => setNewTransportVehicleModel(e.target.value)} placeholder="Ex.: Corolla, Hilux, Onix" />
                                </div>
                              </div>
                            )}
                            {(newTransportMode === 'AVIÃO' || newTransportMode === 'ÔNIBUS' || newTransportMode === 'LOCAÇÃO DE VEÍCULO') && (
                              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                                <div className="text-sm font-semibold text-slate-700">Informações de viagem</div>
                                <div className="grid gap-3 sm:grid-cols-2">
                                  <div className="space-y-1">
                                    <label className="text-xs uppercase tracking-[0.2em] text-slate-500">DATA DE IDA</label>
                                    <input type="date" className="neumorphic-input" value={newTransportDepartureDate} onChange={(e) => setNewTransportDepartureDate(e.target.value)} />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-xs uppercase tracking-[0.2em] text-slate-500">DATA DE RETORNO</label>
                                    <input type="date" className="neumorphic-input" value={newTransportReturnDate} onChange={(e) => setNewTransportReturnDate(e.target.value)} />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-xs uppercase tracking-[0.2em] text-slate-500">HORA (IDA)</label>
                                    <input type="time" className="neumorphic-input" value={newTransportDepartureTime} onChange={(e) => setNewTransportDepartureTime(e.target.value)} />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-xs uppercase tracking-[0.2em] text-slate-500">HORA (VOLTA)</label>
                                    <input type="time" className="neumorphic-input" value={newTransportReturnTime} onChange={(e) => setNewTransportReturnTime(e.target.value)} />
                                  </div>
                                  {(newTransportMode === 'AVIÃO' || newTransportMode === 'LOCAÇÃO DE VEÍCULO') && (
                                    <div className="space-y-1 sm:col-span-2">
                                      <label className="text-xs uppercase tracking-[0.2em] text-slate-500">CÓDIGO DA RESERVA</label>
                                      <input type="text" className="neumorphic-input" value={newTransportReservationCode} onChange={(e) => setNewTransportReservationCode(e.target.value)} placeholder="Digite o código da reserva" />
                                    </div>
                                  )}
                                  {(newTransportMode === 'AVIÃO' || newTransportMode === 'LOCAÇÃO DE VEÍCULO') && (
                                    <div className="space-y-1 sm:col-span-2">
                                      <label className="text-xs uppercase tracking-[0.2em] text-slate-500">EMPRESA</label>
                                      <input type="text" className="neumorphic-input" value={newTransportCompany} onChange={(e) => setNewTransportCompany(e.target.value)} placeholder="Digite a empresa" />
                                    </div>
                                  )}
                                  {(newTransportMode === 'AVIÃO' || newTransportMode === 'LOCAÇÃO DE VEÍCULO') && (
                                    <div className="space-y-2 sm:col-span-2">
                                      <label className="text-xs uppercase tracking-[0.2em] text-slate-500">VOUCHER</label>
                                      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white/70 p-3">
                                        <label className="neumorphic-button cursor-pointer px-3 py-2">
                                          <span>{newTransportVoucherName || 'Escolher voucher'}</span>
                                          <input type="file" className="hidden" onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) handleNewTransportVoucherUpload(file);
                                            e.target.value = '';
                                          }} />
                                        </label>
                                        <label className="neumorphic-button cursor-pointer px-3 py-2">
                                          <span>Cadastrar voucher</span>
                                          <input type="file" className="hidden" onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) handleNewTransportVoucherUpload(file);
                                            e.target.value = '';
                                          }} />
                                        </label>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                            Deslocamento definido
                          </div>
                        )}
                        {selectedEvent.boards.deslocamento.length === 0 ? (
                          <div className="text-slate-500">Nenhum deslocamento configurado.</div>
                        ) : (
                          selectedEvent.boards.deslocamento.map((item) => {
                            const uploadId = `deslocamento-upload-${item.id}`;
                            const requiresVoucher = item.transportMode === 'AVIÃO' || item.transportMode === 'ÔNIBUS' || item.transportMode === 'LOCAÇÃO DE VEÍCULO';
                            const canUploadVoucher = requiresVoucher && item.departureDate && item.returnDate && item.departureTime && item.returnTime;
                            const isEditingTransportItem = editingTransportItemId === item.id;
                            return (
                              <div key={item.id} className="p-3 rounded-3xl bg-white/80 shadow-sm">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <div className="font-semibold">{item.transportMode || 'Transporte'}</div>
                                    <div className="text-sm text-slate-500">{item.name}</div>
                                    {!isEditingTransportItem && (
                                      <div className="mt-2 space-y-1 text-sm text-slate-600">
                                        {item.vehicleModel && <div>Modelo: {item.vehicleModel}</div>}
                                        {item.company && <div>EMPRESA: {item.company}</div>}
                                        {item.professionalIds?.length > 0 && (
                                          <div>Profissionais: {item.professionalIds.map((id) => users.find((user) => user.id === id)?.name || `#${id}`).join(', ')}</div>
                                        )}
                                        {requiresVoucher && (
                                          <div className="space-y-1">
                                            <div>DATA DE IDA: {item.departureDate ? formatShortDate(item.departureDate) : 'Não informado'}</div>
                                            <div>HORA (IDA): {item.departureTime || 'Não informado'}</div>
                                            <div>DATA DE RETORNO: {item.returnDate ? formatShortDate(item.returnDate) : 'Não informado'}</div>
                                            <div>HORA (VOLTA): {item.returnTime || 'Não informado'}</div>
                                            <div>CÓDIGO DA RESERVA: {item.reservationCode || item.passageCode || 'Não informado'}</div>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {!isEditingTransportItem && item.attachmentName && (
                                      <button className="neumorphic-button px-3 py-2" onClick={() => downloadAttachment(item)}>Baixar voucher</button>
                                    )}
                                    <button className="neumorphic-button px-3 py-2" onClick={() => setEditingTransportItemId(isEditingTransportItem ? null : item.id)}>
                                      {isEditingTransportItem ? 'Cancelar' : 'Editar'}
                                    </button>
                                    <button className="neumorphic-button px-3 py-2" onClick={() => removeBoardItem(selectedEvent, 'deslocamento', item.id)}>Remover</button>
                                  </div>
                                </div>
                                {isEditingTransportItem && (
                                  <div className="mt-3 space-y-3">
                                    {item.transportMode === 'CARRO BCS' && (
                                      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                                        <div className="text-sm font-semibold text-slate-700">Detalhes do veículo</div>
                                        <div className="space-y-1 mt-2">
                                          <label className="text-xs uppercase tracking-[0.2em] text-slate-500">Modelo do veículo</label>
                                          <input type="text" className="neumorphic-input" value={item.vehicleModel || ''} onChange={(e) => changeBoardItem(selectedEvent, 'deslocamento', item.id, { vehicleModel: e.target.value })} placeholder="Descreva o modelo do veículo" />
                                        </div>
                                      </div>
                                    )}
                                    {requiresVoucher && (
                                      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                                        <div className="text-sm font-semibold text-slate-700">Informações de viagem</div>
                                        <div className="grid gap-3 sm:grid-cols-2 mt-2">
                                          <div className="space-y-1">
                                            <label className="text-xs uppercase tracking-[0.2em] text-slate-500">DATA DE IDA</label>
                                            <input type="date" className="neumorphic-input" value={item.departureDate || ''} onChange={(e) => changeBoardItem(selectedEvent, 'deslocamento', item.id, { departureDate: e.target.value })} />
                                          </div>
                                          <div className="space-y-1">
                                            <label className="text-xs uppercase tracking-[0.2em] text-slate-500">DATA DE RETORNO</label>
                                            <input type="date" className="neumorphic-input" value={item.returnDate || ''} onChange={(e) => changeBoardItem(selectedEvent, 'deslocamento', item.id, { returnDate: e.target.value })} />
                                          </div>
                                          <div className="space-y-1">
                                            <label className="text-xs uppercase tracking-[0.2em] text-slate-500">HORA (IDA)</label>
                                            <input type="time" className="neumorphic-input" value={item.departureTime || ''} onChange={(e) => changeBoardItem(selectedEvent, 'deslocamento', item.id, { departureTime: e.target.value })} />
                                          </div>
                                          <div className="space-y-1">
                                            <label className="text-xs uppercase tracking-[0.2em] text-slate-500">HORA (VOLTA)</label>
                                            <input type="time" className="neumorphic-input" value={item.returnTime || ''} onChange={(e) => changeBoardItem(selectedEvent, 'deslocamento', item.id, { returnTime: e.target.value })} />
                                          </div>
                                        </div>
                                        {(item.transportMode === 'AVIÃO' || item.transportMode === 'LOCAÇÃO DE VEÍCULO') && (
                                          <div className="space-y-1 mt-3">
                                            <label className="text-xs uppercase tracking-[0.2em] text-slate-500">CÓDIGO DA RESERVA</label>
                                            <input type="text" className="neumorphic-input" value={item.reservationCode || item.passageCode || ''} onChange={(e) => changeBoardItem(selectedEvent, 'deslocamento', item.id, { reservationCode: e.target.value, passageCode: e.target.value })} placeholder="Digite o código da reserva" />
                                          </div>
                                        )}
                                        {(item.transportMode === 'AVIÃO' || item.transportMode === 'LOCAÇÃO DE VEÍCULO') && (
                                          <div className="space-y-1 mt-3">
                                            <label className="text-xs uppercase tracking-[0.2em] text-slate-500">EMPRESA</label>
                                            <input type="text" className="neumorphic-input" value={item.company || ''} onChange={(e) => changeBoardItem(selectedEvent, 'deslocamento', item.id, { company: e.target.value })} placeholder="Digite a empresa" />
                                          </div>
                                        )}
                                        {canUploadVoucher ? (
                                          <div className="grid gap-3 sm:grid-cols-[1fr_auto] items-center mt-3">
                                            <div className="neumorphic-input flex items-center justify-between gap-3">
                                              <span>{item.attachmentName || 'Nenhum voucher anexado'}</span>
                                              {!item.attachmentName && <span className="text-slate-600">Disponível</span>}
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                              {item.attachmentName && (
                                                <button className="neumorphic-button px-3 py-2" onClick={() => downloadAttachment(item)}>Baixar voucher</button>
                                              )}
                                              <label htmlFor={uploadId} className="neumorphic-button px-3 py-2 cursor-pointer">
                                                <span>Cadastrar voucher</span>
                                                <input id={uploadId} type="file" className="hidden" onChange={(e) => {
                                                  const file = e.target.files?.[0];
                                                  if (file) handleVoucherUpload(selectedEvent, 'deslocamento', item.id, file);
                                                  e.target.value = '';
                                                }} />
                                              </label>
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="text-sm text-slate-500 mt-3">Preencha todas as informações do transporte para anexar o voucher.</div>
                                        )}
                                      </div>
                                    )}
                                    {isEditingTransportItem && (
                                      <div className="flex justify-end pt-2">
                                        <button className="neumorphic-button px-3 py-2" onClick={() => setEditingTransportItemId(null)}>
                                          Salvar
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}

                    {title === 'SEPARAR ITENS PARA O EVENTO' && (
                      <div className="space-y-3">
                        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 space-y-4">
                          <div className="flex flex-wrap items-center justify-between gap-4">
                            <div className="text-sm font-semibold">Adicionar item de separação</div>
                            <span className="status-badge status-badge-rental">Separação</span>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-[2fr_1fr_auto] items-end">
                            <select className="neumorphic-select w-full" value={newSeparationRentalType} onChange={(e) => setNewSeparationRentalType(e.target.value)} disabled={isEventCompleted}>
                              <option value="">Selecionar tipo de equipamento</option>
                              {config.itemTypes.filter((type) => type !== 'LOCAÇÃO EXTERNA').map((type) => (
                                <option key={type} value={type}>{type}</option>
                              ))}
                            </select>
                            <input type="number" min="1" className="neumorphic-input w-full" placeholder="Quantidade" value={newSeparationQuantity} onChange={(e) => setNewSeparationQuantity(Number(e.target.value) || 1)} disabled={isEventCompleted} />
                            <button className="neumorphic-button primary w-full sm:w-auto" onClick={addSeparationItem} disabled={isEventCompleted}><PlusCircle className="mr-2 h-4 w-4" />Adicionar item</button>
                          </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          <button className="neumorphic-button secondary w-full flex items-center justify-center gap-2" onClick={() => syncSeparation(selectedEvent)} disabled={isEventCompleted}><FileText className="mr-2 h-4 w-4" />Refazer lista</button>
                          <button className="neumorphic-button secondary w-full flex items-center justify-center gap-2" onClick={() => generateSeparationPdf(selectedEvent, selectedEvent.boards.separar || [], config.nfContact)}><FileText className="mr-2 h-4 w-4" />Gerar PDF</button>
                          <button className="neumorphic-button secondary w-full flex items-center justify-center gap-2" onClick={() => window.open(`https://wa.me/${formatPhoneUrl(config.nfContact.phone)}?text=${buildWhatsAppMessage(selectedEvent)}`, '_blank')}><MessageCircle className="mr-2 h-4 w-4" />Enviar para NF</button>
                          <button className="neumorphic-button secondary w-full flex items-center justify-center gap-2" onClick={() => window.open(`https://wa.me/${formatPhoneUrl(config.nfContact.phone)}?text=${buildWhatsAppMessage(selectedEvent, { returnRequest: true })}`, '_blank')}><MessageCircle className="mr-2 h-4 w-4" />Solicitar NF de retorno</button>
                        </div>
                        <div className="space-y-3 mt-4">
                          <div className="grid gap-3 sm:grid-cols-2">
                            {canTransferItems && (
                              <button className="neumorphic-button primary w-full" title="Transferir itens" onClick={() => !isEventCompleted && setShowTransferPanel((prev) => !prev)} disabled={isEventCompleted}><ExternalLink className="mr-2 h-4 w-4" />Transferir itens</button>
                            )}
                            {canTransferItems && (
                              <button className="neumorphic-button secondary w-full" title="Locação externa" onClick={() => !isEventCompleted && setShowRentalPanel((prev) => !prev)} disabled={isEventCompleted}><ExternalLink className="mr-2 h-4 w-4" />Locação externa</button>
                            )}
                          </div>
                          {showTransferPanel && (
                            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                              <div className="flex items-center justify-between gap-3">
                                <div className="text-sm font-semibold">Transferir itens para outro evento</div>
                                <span className="status-badge status-badge-transfer">Transferência</span>
                              </div>
                              <div className="grid gap-3 md:grid-cols-3">
                                <select className="neumorphic-select w-full" value={transferForm.selectedItemId} onChange={(e) => {
                                  const nextItemId = e.target.value;
                                  const nextItem = (selectedEvent.boards?.separar || []).find((item) => String(item.id) === String(nextItemId));
                                  setTransferForm((prev) => ({
                                    ...prev,
                                    selectedItemId: nextItemId,
                                    equipmentType: nextItem?.type || prev.equipmentType,
                                  }));
                                }}>
                                  <option value="">Selecione o item</option>
                                  {(selectedEvent.boards?.separar || []).filter((item) => Number(item.quantity || 0) > 0).map((item) => (
                                    <option key={item.id} value={item.id}>{item.name}</option>
                                  ))}
                                </select>
                                <input type="number" min="1" className="neumorphic-input w-full" placeholder="Qtd a transferir" value={transferForm.transferQuantity} onChange={(e) => setTransferForm((prev) => ({ ...prev, transferQuantity: Number(e.target.value) || 1 }))} />
                                <select className="neumorphic-select w-full" value={transferForm.targetEventId} onChange={(e) => {
                                  const nextTargetEventId = e.target.value;
                                  const nextTargetEvent = events.find((event) => String(event.id) === String(nextTargetEventId));
                                  const nextTransferDate = transferForm.transferDate && isDateWithinEventTransferRange(transferForm.transferDate, nextTargetEvent)
                                    ? transferForm.transferDate
                                    : '';
                                  setTransferForm((prev) => ({ ...prev, targetEventId: nextTargetEventId, transferDate: nextTransferDate }));
                                }}>
                                  <option value="">Selecione o evento destino</option>
                                  {events.filter((event) => event.id !== selectedEvent.id && event.status !== 'Concluído').map((event) => (
                                    <option key={event.id} value={event.id}>{event.name}</option>
                                  ))}
                                </select>
                              </div>
                              {transferForm.targetEventId && (
                                <div className="grid gap-3 md:grid-cols-1">
                                  <input
                                    type="date"
                                    className="neumorphic-input w-full"
                                    value={transferForm.transferDate}
                                    min={targetTransferDateRange.minDate || undefined}
                                    max={targetTransferDateRange.maxDate || undefined}
                                    onChange={(e) => setTransferForm((prev) => ({ ...prev, transferDate: e.target.value }))}
                                  />
                                  {targetTransferDateRange.minDate && targetTransferDateRange.maxDate && (
                                    <p className="text-xs text-slate-500">Datas válidas para o evento destino: {formatShortDate(targetTransferDateRange.minDate)} até {formatShortDate(targetTransferDateRange.maxDate)}.</p>
                                  )}
                                </div>
                              )}
                              <button className="neumorphic-button outline w-full flex items-center justify-center gap-2" title="Transferir equipamento" onClick={transferEquipment} disabled={transferForm.targetEventId && transferForm.transferDate && !isDateWithinEventTransferRange(transferForm.transferDate, events.find((event) => String(event.id) === String(transferForm.targetEventId)))}><ExternalLink className="h-4 w-4" />Transferir equipamento</button>
                            </div>
                          )}
                          {showRentalPanel && (
                            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                              <div className="flex items-center justify-between gap-3">
                                <div className="text-sm font-semibold">Registrar locação externa</div>
                                <span className="status-badge status-badge-rental">Locação externa</span>
                              </div>
                              <div className="grid gap-3 md:grid-cols-3">
                                <select className="neumorphic-select w-full" value={rentalForm.selectedItemId} onChange={(e) => setRentalForm((prev) => ({ ...prev, selectedItemId: e.target.value }))}>
                                  <option value="">Selecione o item</option>
                                  {(selectedEvent.boards?.separar || []).map((item) => (
                                    <option key={item.id} value={item.id}>{item.name}</option>
                                  ))}
                                </select>
                                <input className="neumorphic-input w-full" placeholder="Empresa" value={rentalForm.company} onChange={(e) => setRentalForm((prev) => ({ ...prev, company: e.target.value }))} />
                                <input type="number" min="1" className="neumorphic-input w-full" placeholder="Quantidade" value={rentalForm.quantity} onChange={(e) => setRentalForm((prev) => ({ ...prev, quantity: Number(e.target.value) || 1 }))} />
                              </div>
                              <div className="grid gap-3 md:grid-cols-2">
                                <label className="space-y-1">
                                  <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Data de recebimento</span>
                                  <input type="date" className="neumorphic-input w-full" value={rentalForm.deliveryDate} onChange={(e) => setRentalForm((prev) => ({ ...prev, deliveryDate: e.target.value }))} />
                                </label>
                                <label className="space-y-1">
                                  <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Data de devolução</span>
                                  <input type="date" className="neumorphic-input w-full" value={rentalForm.returnDate} onChange={(e) => setRentalForm((prev) => ({ ...prev, returnDate: e.target.value }))} />
                                </label>
                              </div>
                              <div className="grid w-full gap-2 sm:grid-cols-2">
                                <button className="neumorphic-button primary w-full flex items-center justify-center gap-2" onClick={rentEquipment}>Cadastrar locação</button>
                                <button className="neumorphic-button outline w-full flex items-center justify-center gap-2" onClick={() => setShowRentalPanel(false)}>Cancelar</button>
                              </div>
                            </div>
                          )}
                          {(selectedEvent.boards.separar || []).map((item) => (
                            <div key={item.id} className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white/90 p-3 shadow-sm transition hover:border-slate-300">
                              <div className="flex flex-col gap-3">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="break-words text-base font-semibold leading-6 text-slate-800">{item.name}</div>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {item.transferReference && (
                                      <span className="status-badge status-badge-transfer">Transferência</span>
                                    )}
                                    {Array.isArray(item.externalRentals) && item.externalRentals.length > 0 && (
                                      <span className="status-badge status-badge-rental">Locação externa</span>
                                    )}
                                    {item.isTransferred && (
                                      <span className="status-badge status-badge-receive">Recebimento</span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex w-full flex-col gap-2 pt-1">
                                  <div className="grid gap-3 sm:grid-cols-3">
                                    <div className="flex min-h-[96px] flex-col items-center justify-center rounded-3xl border border-slate-200 bg-slate-50 p-3 text-center">
                                      <div className="text-xs text-slate-500">CONTRATO</div>
                                      <div className="font-medium text-slate-900">{item.contractQuantity ?? item.quantity}</div>
                                    </div>
                                    <div className="flex min-h-[96px] flex-col items-center justify-center rounded-3xl border border-slate-200 bg-slate-50 p-3 text-center">
                                      <div className="text-xs text-slate-500">BACKUP</div>
                                      <input type="number" min="0" className="neumorphic-input w-full text-center px-3 py-2 text-base" value={item.backupQuantity ?? 1} onChange={(e) => {
                                        const next = Math.max(0, Number(e.target.value) || 0);
                                        changeBoardItem(selectedEvent, 'separar', item.id, { backupQuantity: next, quantity: (item.contractQuantity ?? item.quantity ?? 0) + next });
                                      }} disabled={selectedEvent.status === 'Concluído' || Boolean(item.separated)} />
                                    </div>
                                    {(() => {
                                      const incomingSum = (Array.isArray(item.incomingTransfers) ? item.incomingTransfers.reduce((s, it) => s + (Number(it.quantity) || 0), 0) : 0);
                                      const rentalSum = (Array.isArray(item.externalRentals) ? item.externalRentals.reduce((s, it) => s + (Number(it.quantity) || 0), 0) : 0);
                                      const contractVal = Number(item.contractQuantity ?? item.quantity ?? 0) || 0;
                                      const backupVal = item.backupQuantity === undefined ? 1 : Math.max(0, Number(item.backupQuantity) || 0);
                                      const totalDisplayed = Math.max(0, contractVal + backupVal - incomingSum - rentalSum);
                                      return (
                                        <div className="flex min-h-[96px] flex-col items-center justify-center rounded-3xl border border-slate-200 bg-slate-50 p-3 text-center">
                                          <div className="text-xs text-slate-500">TOTAL</div>
                                          <div className="text-lg font-semibold text-slate-900">{totalDisplayed}</div>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-3 pt-1">
                                    <label className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                                      <input type="checkbox" checked={Boolean(item.separated)} onChange={(e) => changeBoardItem(selectedEvent, 'separar', item.id, { separated: e.target.checked })} disabled={selectedEvent.status === 'Concluído'} />
                                      Separado
                                    </label>
                                  </div>
                                  {item.auditTrail && Object.keys(item.auditTrail).length > 0 && (
                                    <div className="mt-2 space-y-1">
                                      {Object.values(item.auditTrail)
                                        .slice()
                                        .sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''))
                                        .map((entry, idx) => (
                                          <div key={`${entry.action}-${entry.timestamp || idx}`} className="text-[10px] font-medium uppercase tracking-[0.15em] text-slate-500">
                                            ({entry.action === 'separado' ? 'separado' : entry.action === 'desmarcado' ? 'desmarcado' : 'alterado'}) por {entry.user || 'Usuário'} • {formatAuditDateTime(entry.timestamp)}
                                          </div>
                                        ))}
                                    </div>
                                  )}
                                  <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
                                    {item.transferReference && item.editable !== false && (
                                      <button className="neumorphic-button outline w-full px-3 py-2" onClick={() => cancelTransferEquipment(item.id)} disabled={selectedEvent.status === 'Concluído'}>Cancelar transferência</button>
                                    )}
                                    {item.editable !== false && (
                                      <button className="neumorphic-button outline w-full px-3 py-2" onClick={() => removeBoardItem(selectedEvent, 'separar', item.id)} disabled={selectedEvent.status === 'Concluído'}>Excluir</button>
                                    )}
                                  </div>
                                </div>
                              </div>
                              {(item.transferObservation || item.isTransferred || (Array.isArray(item.incomingTransfers) && item.incomingTransfers.length > 0) || (Array.isArray(item.externalRentals) && item.externalRentals.length > 0)) && (
                                <div className="rounded-2xl border border-slate-300 bg-slate-100 px-3 py-3 text-sm leading-6 text-slate-700 space-y-3">
                                  {item.transferObservation && <div className="font-semibold text-slate-900">{item.transferObservation}</div>}
                                  {item.isTransferred && <div className="text-slate-700">Transferido entre eventos</div>}
                                  {Array.isArray(item.incomingTransfers) && item.incomingTransfers.map((t) => (
                                    <div key={t.id} className="mt-1 text-slate-800">
                                      {t.transferObservation || `Recebido de ${t.sourceEventName || ''} • qtd ${t.quantity} • ${t.transferDate ? new Date(t.transferDate).toLocaleDateString('pt-BR') : ''}`}
                                    </div>
                                  ))}
                                  {Array.isArray(item.externalRentals) && item.externalRentals.map((r) => (
                                    <div key={r.id} className="mt-1 flex items-center justify-between gap-2 rounded-2xl bg-sky-50 p-2 text-slate-700">
                                      <div>{r.observation || `Locado: ${r.company} • qtd ${r.quantity}`}</div>
                                      <div>
                                        <button className="neumorphic-button outline px-2 py-1 text-xs" onClick={() => cancelExternalRental(item.id, r.id)}>Cancelar locação</button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </NeumorphicCard>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      {showEventSelector ? renderEventSelector() : renderEventBoard()}
    </ErrorBoundary>
  );
}
