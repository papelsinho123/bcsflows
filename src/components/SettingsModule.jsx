import React, { useState } from 'react';
import NeumorphicCard from './NeumorphicCard.jsx';
import { canManageAdminFeatures, normalizeUserRole } from '../utils/auth.js';

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

const CORE_ITEM_TYPES = [
  'IMPRESSORA TÉRMICA',
  'COLETOR DE DADOS',
  'LEITOR BARCODE',
  'NOTEBOOK',
  'ETIQUETA',
  'RIBBON',
  'ALL IN ONE',
  'CELULAR',
];

const HIDDEN_ITEM_TYPES = ['IMPRESSORA LASER', 'TOTEM'];
const CORE_EXPENSE_TYPES = ['HOSPEDAGEM', 'COMBUSTIVEL', 'ESTACIONAMENTO', 'OUTRO'];

export default function SettingsModule({ config, users, onUpdateConfig, onUpdateUsers, currentUser }) {
  const isMaster = normalizeUserRole(currentUser?.role || '') === 'master';
  const canCreateUsers = canManageAdminFeatures(currentUser?.role || '') && isMaster;
  const itemTypes = Array.isArray(config.itemTypes) ? config.itemTypes : [];
  const customItemTypes = itemTypes.filter((type) => !CORE_ITEM_TYPES.includes(type) && !HIDDEN_ITEM_TYPES.includes(type));
  const visibleItemTypes = Array.from(new Set([...itemTypes, ...CORE_ITEM_TYPES])).filter((type) => !HIDDEN_ITEM_TYPES.includes(type));
  const proposalItems = config.proposalItems ?? [];
  const legacyProposalItemTypes = config.proposalItemTypes ?? [];
  const displayProposalItems = Array.from(
    new Map([
      ...(proposalItems || []).map((p) => [p.name.toUpperCase(), { name: p.name, type: p.type, source: 'explicit' }]),
      ...legacyProposalItemTypes.map((t) => [String(t).toUpperCase(), { name: t, type: t, source: 'legacy' }]),
    ]).values(),
  );
  const defaultItems = config.defaultItems ?? [];
  const visibleDefaultItems = defaultItems.filter((item) => !HIDDEN_ITEM_TYPES.includes(item.type));
  const [contact, setContact] = useState(config.nfContact || { name: '', email: '', phone: '' });
  const [newItem, setNewItem] = useState({ type: '', subframe: 'SECRETARIA' });
  const [newType, setNewType] = useState('');
  const [newProposalName, setNewProposalName] = useState('');
  const [newProposalType, setNewProposalType] = useState('');
  const [showAllTypes, setShowAllTypes] = useState(false);
  const [showAllProposal, setShowAllProposal] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [typeEditDraft, setTypeEditDraft] = useState('');
  const [editingProposal, setEditingProposal] = useState(null);
  const [proposalEditDraft, setProposalEditDraft] = useState({ name: '', type: '' });
  const [newUser, setNewUser] = useState({ name: '', usuario: '', email: '', password: '', role: 'user', phone: '' });
  const [settingsAlerts, setSettingsAlerts] = useState([]);
  const [newExpenseType, setNewExpenseType] = useState('');
  const [newPaymentType, setNewPaymentType] = useState('');

  const handleContactChange = (key, value) => setContact((prev) => ({ ...prev, [key]: value }));
  const handleUserChange = (key, value) => setNewUser((prev) => ({ ...prev, [key]: value }));
  const addItem = () => {
    if (!newItem.type) {
      setSettingsAlerts([{ field: 'newItem.type', message: 'Selecione o tipo do item padrão.' }]);
      return;
    }
    setSettingsAlerts([]);
    onUpdateConfig({
      ...config,
      defaultItems: [...defaultItems, { ...newItem, id: Date.now() }],
    });
    setNewItem({ type: '', subframe: 'SECRETARIA' });
  };

  const addType = () => {
    const type = newType.trim().toUpperCase();
    if (!type) {
      setSettingsAlerts([{ field: 'newType', message: 'Informe o nome do novo tipo.' }]);
      return;
    }
    if (itemTypes.includes(type)) {
      setSettingsAlerts([{ field: 'newType', message: 'Esse tipo já existe.' }]);
      return;
    }
    setSettingsAlerts([]);
    onUpdateConfig({
      ...config,
      itemTypes: [...itemTypes, type],
    });
    setNewType('');
  };

  const removeType = (typeToRemove) => {
    if (CORE_ITEM_TYPES.includes(typeToRemove)) return;
    onUpdateConfig({
      ...config,
      itemTypes: itemTypes.filter((itemType) => itemType !== typeToRemove),
    });
  };

  const updateType = (oldType, newTypeValue) => {
    const value = (newTypeValue || '').trim().toUpperCase();
    if (!value) {
      setSettingsAlerts([{ field: 'editType', message: 'Nome inválido.' }]);
      return;
    }
    if (itemTypes.includes(value) && value !== oldType) {
      setSettingsAlerts([{ field: 'editType', message: 'Tipo já existe.' }]);
      return;
    }
    const next = itemTypes.map((t) => (t === oldType ? value : t));
    onUpdateConfig({ ...config, itemTypes: next });
    setEditingType(null);
    setTypeEditDraft('');
  };

  const addProposalItem = () => {
    const name = (newProposalName || '').trim();
    const type = (newProposalType || '').trim().toUpperCase();
    if (!name || !type) {
      setSettingsAlerts([{ field: 'newProposal', message: 'Preencha nome e tipo da proposta.' }]);
      return;
    }
    if (displayProposalItems.find((p) => p.name.toUpperCase() === name.toUpperCase())) {
      setSettingsAlerts([{ field: 'newProposal', message: 'Este nome já está mapeado.' }]);
      return;
    }
    setSettingsAlerts([]);
    onUpdateConfig({
      ...config,
      proposalItems: [...proposalItems, { name, type }],
    });
    setNewProposalName('');
    setNewProposalType('');
  };

  const removeProposalItem = (nameToRemove) => {
    onUpdateConfig({
      ...config,
      proposalItems: proposalItems.filter((p) => p.name !== nameToRemove),
      proposalItemTypes: legacyProposalItemTypes.filter((t) => t !== nameToRemove),
    });
  };

  const updateProposalItem = (oldName, newName, newTypeValue) => {
    const name = (newName || '').trim();
    const type = (newTypeValue || '').trim().toUpperCase();
    if (!name || !type) {
      setSettingsAlerts([{ field: 'editProposal', message: 'Preencha nome e tipo.' }]);
      return;
    }
    if (displayProposalItems.find((p) => p.name.toUpperCase() === name.toUpperCase() && p.name !== oldName)) {
      setSettingsAlerts([{ field: 'editProposal', message: 'Nome já mapeado.' }]);
      return;
    }
    // update existing explicit mapping if present, otherwise add to proposalItems and remove legacy type
    const hasExplicit = proposalItems.some((p) => p.name === oldName);
    let next;
    if (hasExplicit) {
      next = proposalItems.map((p) => (p.name === oldName ? { name, type } : p));
    } else {
      // remove legacy and add explicit mapping
      next = [...proposalItems.filter((p) => p.name !== oldName), { name, type }];
    }
    onUpdateConfig({ ...config, proposalItems: next, proposalItemTypes: legacyProposalItemTypes.filter((t) => t !== oldName) });
    setEditingProposal(null);
    setProposalEditDraft({ name: '', type: '' });
  };

  

  const removeItem = (id) => onUpdateConfig({
    ...config,
    defaultItems: defaultItems.filter((item) => item.id !== id),
  });

  const addUser = () => {
    const usuario = newUser.usuario.trim();
    const email = newUser.email.trim().toLowerCase();
    if (!newUser.name || !usuario || !newUser.password) {
      setSettingsAlerts([{ field: 'newUser', message: 'Preencha nome, usuário e senha para criar o usuário.' }]);
      return;
    }
    if (users.some((user) => (user.usuario || user.username || user.userName || '').trim().toLowerCase() === usuario.toLowerCase())) {
      setSettingsAlerts([{ field: 'newUser', message: 'Já existe um usuário com esse nome de usuário.' }]);
      return;
    }
    setSettingsAlerts([]);
    const nextUser = {
      ...newUser,
      id: Date.now(),
      usuario,
      username: usuario,
      email,
      phone: formatWhatsappMask(newUser.phone),
    };
    onUpdateUsers([...users, nextUser]);
    setNewUser({ name: '', usuario: '', email: '', password: '', role: 'user', phone: '' });
  };

  const removeUser = (id) => {
    const userToRemove = users.find((user) => user.id === id);
    if (!userToRemove) return;
    const confirmed = window.confirm(`Deseja realmente excluir o usuário ${userToRemove.name}?`);
    if (!confirmed) return;
    onUpdateUsers(users.filter((user) => user.id !== id));
  };

  return (
    <div className="space-y-6">
      <NeumorphicCard>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Configurações</h2>
            <p className="text-sm text-slate-500">Defina responsável por NF e itens padrão por subquadro.</p>
          </div>
        </div>

        {settingsAlerts.length > 0 && (
          <div className="mt-6 rounded-3xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700">
            {settingsAlerts.map((alert, index) => (
              <p key={`${alert.field}-${index}`} className="font-medium">{alert.message}</p>
            ))}
          </div>
        )}

        <div className="grid gap-4 mt-6 lg:grid-cols-2">
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Tipo de Despesa</h3>
            <div className="space-y-3">
              <p className="text-sm text-slate-500">Tipos padrão: {CORE_EXPENSE_TYPES.join(', ')} (fixos)</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <input className="neumorphic-input" placeholder="Novo tipo de despesa" value={newExpenseType} onChange={(e) => setNewExpenseType(e.target.value)} />
                <button className="neumorphic-button primary" onClick={() => {
                  const t = (newExpenseType || '').trim().toUpperCase();
                  if (!t) return setSettingsAlerts([{ field: 'expense', message: 'Informe o tipo de despesa.' }]);
                  const existing = Array.isArray(config.expenseTypes) ? config.expenseTypes : [];
                  if (existing.includes(t) || CORE_EXPENSE_TYPES.includes(t)) return setSettingsAlerts([{ field: 'expense', message: 'Tipo já existe.' }]);
                  onUpdateConfig({ ...config, expenseTypes: [...existing, t] });
                  setNewExpenseType('');
                }}>Adicionar</button>
              </div>
              <div className="space-y-2 mt-3">
                {(config.expenseTypes || []).length === 0 ? (
                  <div className="text-sm text-slate-500">Nenhum tipo de despesa customizado.</div>
                ) : (
                  (config.expenseTypes || []).map((t) => (
                    <div key={t} className="flex items-center justify-between gap-3 p-3 rounded-3xl bg-white/70 shadow-sm">
                      <div className="font-medium">{t}</div>
                      <div>
                        <button className="neumorphic-button outline" onClick={() => onUpdateConfig({ ...config, expenseTypes: (config.expenseTypes || []).filter((x) => x !== t) })}>Remover</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Tipo de Pagamento</h3>
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <input className="neumorphic-input" placeholder="Novo tipo de pagamento" value={newPaymentType} onChange={(e) => setNewPaymentType(e.target.value)} />
                <button className="neumorphic-button primary" onClick={() => {
                  const p = (newPaymentType || '').trim();
                  if (!p) return setSettingsAlerts([{ field: 'payment', message: 'Informe o tipo de pagamento.' }]);
                  const existing = Array.isArray(config.paymentTypes) ? config.paymentTypes : [];
                  if (existing.includes(p)) return setSettingsAlerts([{ field: 'payment', message: 'Tipo já existe.' }]);
                  onUpdateConfig({ ...config, paymentTypes: [...existing, p] });
                  setNewPaymentType('');
                }}>Adicionar</button>
              </div>
              <div className="space-y-2 mt-3">
                {(config.paymentTypes || []).length === 0 ? (
                  <div className="text-sm text-slate-500">Nenhum tipo de pagamento cadastrado.</div>
                ) : (
                  (config.paymentTypes || []).map((p) => (
                    <div key={p} className="flex items-center justify-between gap-3 p-3 rounded-3xl bg-white/70 shadow-sm">
                      <div className="font-medium">{p}</div>
                      <div>
                        <button className="neumorphic-button outline" onClick={() => onUpdateConfig({ ...config, paymentTypes: (config.paymentTypes || []).filter((x) => x !== p) })}>Remover</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Responsável pela NF</h3>
            <div className="grid gap-3">
              <input className="neumorphic-input" placeholder="Nome" value={contact.name} onChange={(e) => handleContactChange('name', e.target.value)} />
              <input className="neumorphic-input" placeholder="E-mail" value={contact.email} onChange={(e) => handleContactChange('email', e.target.value)} />
              <input className="neumorphic-input" placeholder="Telefone / WhatsApp" value={contact.phone} onChange={(e) => handleContactChange('phone', formatWhatsappMask(e.target.value))} />
            </div>
            <button className="neumorphic-button primary mt-4" onClick={() => onUpdateConfig({ ...config, nfContact: contact })}>Salvar Contato NF</button>
          </div>

          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Tipos de Itens</h3>
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <input className="neumorphic-input" placeholder="Novo Tipo de Equipamento" value={newType} onChange={(e) => setNewType(e.target.value)} />
                <button className="neumorphic-button primary" onClick={addType}>Adicionar Tipo</button>
              </div>
              <div className="space-y-2">
                {customItemTypes.length === 0 ? (
                  <div className="text-sm text-slate-500">Nenhum tipo customizado cadastrado.</div>
                ) : (
                  (showAllTypes ? customItemTypes : customItemTypes.slice(0, 5)).map((type) => (
                    <div key={type} className="flex items-center justify-between gap-3 p-3 rounded-3xl bg-white/70 shadow-sm">
                      <div className="flex flex-col">
                        {editingType === type ? (
                          <input className="neumorphic-input" value={typeEditDraft} onChange={(e) => setTypeEditDraft(e.target.value)} />
                        ) : (
                          <span className="font-medium">{type}</span>
                        )}
                        {editingType === type && (
                          <div className="text-xs text-slate-500 mt-1">Editar tipo</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {editingType === type ? (
                          <>
                            <button className="neumorphic-button primary px-3 py-2" onClick={() => updateType(type, typeEditDraft)}>Salvar</button>
                            <button className="neumorphic-button outline px-3 py-2" onClick={() => { setEditingType(null); setTypeEditDraft(''); }}>Cancelar</button>
                          </>
                        ) : (
                          <>
                            <button className="neumorphic-button secondary px-3 py-2" onClick={() => { setEditingType(type); setTypeEditDraft(type); }}>Editar</button>
                            <button className="neumorphic-button outline min-w-[90px]" onClick={() => removeType(type)}>Remover</button>
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
                {customItemTypes.length > 5 && (
                  <div className="mt-2">
                    <button className="neumorphic-button secondary" onClick={() => setShowAllTypes((s) => !s)}>{showAllTypes ? 'Mostrar menos' : `Ver todos (${customItemTypes.length})`}</button>
                  </div>
                )}
              </div>
                <div className="mt-6 border-t border-slate-200 pt-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-base font-semibold">Mapeamento: Nome na proposta → Tipo</h4>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <input className="neumorphic-input" placeholder="Nome na proposta" value={newProposalName} onChange={(e) => setNewProposalName(e.target.value)} />
                  <select className="neumorphic-select" value={newProposalType} onChange={(e) => setNewProposalType(e.target.value)}>
                    <option value="">Tipo do item</option>
                    {visibleItemTypes.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                  <button className="neumorphic-button primary" onClick={addProposalItem}>Adicionar mapeamento</button>
                </div>
                <div className="space-y-2 mt-4">
                  {proposalItems.length === 0 ? (
                    <div className="text-sm text-slate-500">Nenhum mapeamento cadastrado.</div>
                  ) : (
                    (showAllProposal ? displayProposalItems : displayProposalItems.slice(0, 5)).map((p) => (
                      <div key={p.name} className={`flex items-center justify-between gap-3 p-3 rounded-3xl bg-white/70 shadow-sm ${p.source === 'legacy' ? 'opacity-80 italic' : ''}`}>
                        <div className="flex flex-col">
                          {editingProposal === p.name ? (
                            <>
                              <input className="neumorphic-input mb-2" value={proposalEditDraft.name} onChange={(e) => setProposalEditDraft((prev) => ({ ...prev, name: e.target.value }))} />
                              <select className="neumorphic-select" value={proposalEditDraft.type} onChange={(e) => setProposalEditDraft((prev) => ({ ...prev, type: e.target.value }))}>
                                <option value="">Tipo do item</option>
                                {visibleItemTypes.map((type) => (
                                  <option key={type} value={type}>{type}</option>
                                ))}
                              </select>
                            </>
                          ) : (
                            <>
                              <div className="font-medium">{p.name}</div>
                              <div className="text-xs text-slate-500">Tipo: {p.type} {p.source === 'legacy' ? '(legado)' : ''}</div>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {editingProposal === p.name ? (
                            <>
                              <button className="neumorphic-button px-3 py-2" onClick={() => updateProposalItem(p.name, proposalEditDraft.name, proposalEditDraft.type)}>Salvar</button>
                              <button className="neumorphic-button px-3 py-2" onClick={() => { setEditingProposal(null); setProposalEditDraft({ name: '', type: '' }); }}>Cancelar</button>
                            </>
                          ) : (
                            <>
                              <button className="neumorphic-button px-3 py-2" onClick={() => { setEditingProposal(p.name); setProposalEditDraft({ name: p.name, type: p.type }); }}>{p.source === 'legacy' ? 'Converter' : 'Editar'}</button>
                              <button className="neumorphic-button outline min-w-[90px]" onClick={() => removeProposalItem(p.name)}>Remover</button>
                            </>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                  {displayProposalItems.length > 5 && (
                    <div className="mt-2">
                      <button className="neumorphic-button secondary" onClick={() => setShowAllProposal((s) => !s)}>{showAllProposal ? 'Mostrar menos' : `Ver todos (${displayProposalItems.length})`}</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Usuários</h3>
            <div className="space-y-3">
              {canCreateUsers ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <input className="neumorphic-input" placeholder="Nome" value={newUser.name} onChange={(e) => handleUserChange('name', e.target.value)} />
                  <input className="neumorphic-input" placeholder="Usuário" value={newUser.usuario} onChange={(e) => handleUserChange('usuario', e.target.value)} />
                  <input className="neumorphic-input" placeholder="E-mail" value={newUser.email} onChange={(e) => handleUserChange('email', e.target.value)} />
                  <input type="password" className="neumorphic-input" placeholder="Senha" value={newUser.password} onChange={(e) => handleUserChange('password', e.target.value)} />
                  <select className="neumorphic-select" value={newUser.role} onChange={(e) => handleUserChange('role', e.target.value)}>
                    <option value="user">Usuário</option>
                    <option value="admin">Administrador</option>
                    <option value="master">Master</option>
                  </select>
                  <input className="neumorphic-input" placeholder="WhatsApp" value={newUser.phone} onChange={(e) => handleUserChange('phone', formatWhatsappMask(e.target.value))} />
                  <button className="neumorphic-button primary" onClick={addUser}>Criar usuário</button>
                </div>
              ) : (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  Apenas o perfil Master pode criar usuários.
                </div>
              )}
              <div className="space-y-2">
                {users.map((user) => (
                  <div key={user.id} className="flex items-center justify-between gap-3 p-3 rounded-3xl bg-white/70 shadow-sm">
                    <div>
                      <div className="text-sm font-semibold">{user.name}</div>
                      <div className="text-xs text-slate-500">{user.email} • {user.role}</div>
                    </div>
                    <button className="neumorphic-button outline min-w-[90px]" onClick={() => removeUser(user.id)}>Remover</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Itens Padrão por Subquadro</h3>
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <select className="neumorphic-select" value={newItem.type} onChange={(e) => setNewItem((prev) => ({ ...prev, type: e.target.value }))}>
                  <option value="">Tipo de Equipamento</option>
                  {visibleItemTypes.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
                <select className="neumorphic-select" value={newItem.subframe} onChange={(e) => setNewItem((prev) => ({ ...prev, subframe: e.target.value }))}>
                  <option value="SECRETARIA">SECRETARIA</option>
                  <option value="CAEX">CAEX</option>
                  <option value="CONTROLE DE ACESSO">CONTROLE DE ACESSO</option>
                </select>
                <button className="neumorphic-button primary" onClick={addItem}>Adicionar Item Padrão</button>
              </div>
            </div>
          </div>
        </div>
      </NeumorphicCard>

      <div className="grid gap-4 md:grid-cols-3">
        {['SECRETARIA', 'CAEX', 'CONTROLE DE ACESSO'].map((sub) => (
          <div key={sub} className="neumorphic-card p-4">
            <h3 className="text-lg font-semibold mb-3">{sub}</h3>
            <div className="space-y-3">
              {visibleDefaultItems.filter((item) => item.subframe === sub).map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 p-4 rounded-3xl bg-white/70 shadow-sm">
                  <div>
                    <div className="text-sm font-semibold">{item.type}</div>
                  </div>
                  <button className="neumorphic-button outline min-w-[90px] flex items-center justify-center gap-2" onClick={() => removeItem(item.id)} aria-label={`Remover ${item.type}`}>
                    <span className="text-rose-600">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M9 3v1H4v2h16V4h-5V3H9zm1 6v8h2V9H10zm4 0v8h2V9h-2zM7 9v8h2V9H7z"/></svg>
                    </span>
                    Remover
                  </button>
                </div>
              ))}
              {visibleDefaultItems.filter((item) => item.subframe === sub).length === 0 && (
                <div className="text-sm text-slate-500">Nenhum item padrão configurado.</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
