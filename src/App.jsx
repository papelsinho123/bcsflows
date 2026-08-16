import React, { useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { LogIn, Box, Settings, Layers, Sun, Moon, Activity, Calendar, FileText } from 'lucide-react';
import InventoryModule from './components/InventoryModule.jsx';
import SettingsModule from './components/SettingsModule.jsx';
import DashboardModule from './components/DashboardModule.jsx';
import EventCalendarModule from './components/EventCalendarModule.jsx';
import EventFinanceModule from './components/EventFinanceModule.jsx';
import { getDailyPhrase } from './utils/dailyPhrase.js';

const EventBoard = React.lazy(() => import('./components/EventBoard.jsx'));
import { canManageAdminFeatures, findUserByCredentials, normalizeUserRole } from './utils/auth.js';
import { isSameData, loadServerData, mergeAppData, readLocalData, saveToServer, syncWithServer, writeLocalData } from './utils/storage.js';
import './index.css';

const initialData = {
  updatedAt: Date.now(),
  users: [
    { id: 1, usuario: 'andersonsiebre', username: 'andersonsiebre', email: 'andersonsiebre@bcs.com', password: 'anderson1', role: 'master', name: 'Anderson Siebre', leaveTaken: 0, leaveRuleDays: 7 },
    { id: 2, usuario: 'admin', username: 'admin', email: 'admin@bcs.com', password: 'admin', role: 'admin', name: 'Administrador BCS', leaveTaken: 0, leaveRuleDays: 7 },
    { id: 3, usuario: 'user', username: 'user', email: 'user@bcs.com', password: 'user', role: 'user', name: 'Usuário Padrão', leaveTaken: 0, leaveRuleDays: 7 },
  ],
  inventory: [
    { id: 1, type: 'IMPRESSORA TÉRMICA', name: 'Zebra TLP 2824', serial: 'ZBR-1234', quantity: 6, status: 'Disponível' },
    { id: 2, type: 'COLETOR DE DADOS', name: 'Honeywell Dolphin', serial: 'HD-1122', quantity: 3, status: 'Disponível' },
    { id: 3, type: 'LEITOR BARCODE', name: 'Motorola LS2208', serial: 'MTR-0021', quantity: 4, status: 'EM MANUTENÇÃO' },
    { id: 4, type: 'NOTEBOOK', name: 'Dell Inspiron 15', serial: 'DL-5587', quantity: 2, status: 'Disponível' },
  ],
  config: {
    nfContact: { name: 'Rafael Sales', email: 'nf@bcs.com', phone: '+55 (11) 99999-9999' },
    itemTypes: ['IMPRESSORA TÉRMICA', 'IMPRESSORA LASER', 'TOTEM', 'COLETOR DE DADOS', 'LEITOR BARCODE', 'NOTEBOOK', 'ETIQUETA', 'RIBBON', 'ALL IN ONE', 'CELULAR'],
    proposalItemTypes: [],
    expenseTypes: [],
    paymentTypes: [],
    defaultItems: [
      { id: 1, type: 'IMPRESSORA TÉRMICA', subframe: 'SECRETARIA' },
      { id: 2, type: 'NOTEBOOK', subframe: 'CAEX' },
      { id: 3, type: 'COLETOR DE DADOS', subframe: 'CONTROLE DE ACESSO' },
    ],
  },
  events: [
    {
      id: 101,
      name: 'ExpoShop 2026',
      address: 'Av. das Nações Unidas, 12345',
      locationName: 'Expo Center Norte',
      clientName: 'Loja Amiga',
      contact: '+55 11 98888-7777',
      departureDate: '2026-08-20',
      eventDate: '2026-08-22',
      returnDate: '2026-08-24',
      labelSize: '9X5',
      status: 'A Iniciar',
      boards: {
        info: {},
        montagem: [
          { id: 'preset-1', type: 'IMPRESSORA TÉRMICA', name: 'Impressora Térmica', quantity: 2, checked: false },
          { id: 'preset-2', type: 'LEITOR BARCODE', name: 'Leitor Barcode', quantity: 2, checked: false },
        ],
        desmontagem: [],
        hospedagem: [],
        deslocamento: [],
        separar: [],
      },
    },
  ],
};

const STORAGE_KEY = 'bcs_flows_data_v1';
const assetUrl = (path) => `${import.meta.env.BASE_URL || '/'}${path}`.replace(/\/+/g, '/');

const normalizeData = (stored) => {
  const source = typeof stored === 'string' ? JSON.parse(stored) : stored;
  if (!source) return initialData;

  try {
    const parsed = source && typeof source === 'object' ? source : JSON.parse(String(source));
    const normalizedUsers = Array.isArray(parsed.users)
      ? parsed.users.map((account) => ({
          ...account,
          role: normalizeUserRole(account?.role || 'user'),
        }))
      : initialData.users;

    return {
      ...initialData,
      ...parsed,
      inventory: Array.isArray(parsed.inventory) ? parsed.inventory : initialData.inventory,
      events: Array.isArray(parsed.events) ? parsed.events : initialData.events,
      users: normalizedUsers,
      config: {
        ...initialData.config,
        ...(parsed.config || {}),
        nfContact: parsed.config?.nfContact ?? initialData.config.nfContact,
        itemTypes: Array.isArray(parsed.config?.itemTypes)
          ? Array.from(new Set([...initialData.config.itemTypes, ...parsed.config.itemTypes]))
          : initialData.config.itemTypes,
        proposalItemTypes: Array.isArray(parsed.config?.proposalItemTypes)
          ? Array.from(new Set([...(initialData.config.proposalItemTypes || []), ...parsed.config.proposalItemTypes]))
          : initialData.config.proposalItemTypes || [],
        defaultItems: Array.isArray(parsed.config?.defaultItems) ? parsed.config.defaultItems : initialData.config.defaultItems,
      },
    };
  } catch (error) {
    return initialData;
  }
};

const parseCsvRows = (csvText) => {
  const lines = csvText.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((item) => item.replace(/^"|"$/g, '').trim());
  const rows = lines.slice(1).map((line) => {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    values.push(current.trim());

    const record = {};
    headers.forEach((header, index) => {
      record[header] = values[index] ? values[index].replace(/^"|"$/g, '').trim() : '';
    });

    return record;
  });

  return rows.filter((row) => row.frase && row.autor);
};

function BCSGlassLogo({ className = '' }) {
  const logoIdRef = React.useRef('');

  if (!logoIdRef.current) {
    logoIdRef.current = `bcs-logo-${Math.random().toString(36).slice(2, 10)}`;
  }

  const logoId = logoIdRef.current;

  return (
    <svg viewBox="0 0 260 260" className={`bcs-logo-glass ${className}`} role="img" aria-label="BCS Flows">
      <defs>
        <linearGradient id={`${logoId}-liquid`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#5fe7d7" />
          <stop offset="50%" stopColor="#3ec7bf" />
          <stop offset="100%" stopColor="#1aa9a1" />
        </linearGradient>
        <filter id={`${logoId}-shadow`} x="-30%" y="-30%" width="160%" height="180%">
          <feDropShadow dx="0" dy="12" stdDeviation="10" floodColor="#1aa9a1" floodOpacity="0.22" />
        </filter>
      </defs>

      <g className="bcs-logo-mark" filter={`url(#${logoId}-shadow)`}>
        <path className="bcs-logo-shell tube-one" d="M70 52 L116 52 L160 98 L116 145 L70 145 L112 98 Z" />
        <path className="bcs-logo-shell tube-two" d="M112 98 L162 98 L200 141 L162 184 L112 184 L151 141 Z" />
        <path className="bcs-logo-shell tube-three" d="M76 145 L128 145 L172 192 L128 238 L76 238 L117 192 Z" />

        <g className="bcs-logo-fill-group">
          <path className="bcs-logo-liquid liquid-one" d="M70 52 L116 52 L160 98 L116 145 L70 145 L112 98 Z" fill={`url(#${logoId}-liquid)`} />
          <path className="bcs-logo-liquid liquid-two" d="M112 98 L162 98 L200 141 L162 184 L112 184 L151 141 Z" fill={`url(#${logoId}-liquid)`} />
          <path className="bcs-logo-liquid liquid-three" d="M76 145 L128 145 L172 192 L128 238 L76 238 L117 192 Z" fill={`url(#${logoId}-liquid)`} />
        </g>
      </g>
    </svg>
  );
}

function App() {
  const [data, setData] = useState(initialData);
  const [user, setUser] = useState(null);
  const [route, setRoute] = useState('events');
  const [eventBoardResetKey, setEventBoardResetKey] = useState(0);
  const [loginForm, setLoginForm] = useState({ usuario: '', password: '' });
  const [error, setError] = useState('');
  const [syncStatus, setSyncStatus] = useState({ ok: true, message: 'Sincronização ativa com o banco de dados.' });
  const [theme, setTheme] = useState(() => localStorage.getItem('bcs_flows_theme') || 'light');
  const [motivationalPhrase, setMotivationalPhrase] = useState({ frase: '', autor: 'BCS Flows' });
  const [showLoginVideo, setShowLoginVideo] = useState(false);
  const [showLogoutVideo, setShowLogoutVideo] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const dataRef = useRef(data);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    let isMounted = true;
    let syncInterval = null;

    // Carregar dados do servidor na inicialização
    const hydrateData = async () => {
      const localFallback = readLocalData(initialData);
      const serverData = await loadServerData();
      if (!isMounted) return;

      const nextState = normalizeData(serverData || localFallback || initialData);
      setData(nextState);
    };

    hydrateData();

    // Sincronizar com servidor a cada 2 segundos (FORÇADO, não condicional)
    syncInterval = window.setInterval(async () => {
      if (!isMounted) return;

      const serverData = await loadServerData();
      if (!serverData) return;

      console.log('📡 Sincronizando do servidor:', serverData.events?.map(e => ({
        id: e.id,
        name: e.name,
        usuariosCount: (e.users || []).length,
      })));

      setData((prev) => {
        const mergedData = mergeAppData(prev, serverData);
        if (isSameData(prev, mergedData)) {
          return prev;
        }
        console.log('🔄 Dados mesclados:', mergedData.events?.map(e => ({
          id: e.id,
          name: e.name,
          usuariosCount: (e.users || []).length,
        })));
        return mergedData;
      });
    }, 2000);

    // Sincroniza quando a aba/app volta ao foco
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && isMounted) {
        const serverData = await loadServerData();
        if (serverData) {
          setData((prev) => {
            const mergedData = mergeAppData(prev, serverData);
            if (isSameData(prev, mergedData)) {
              return prev;
            }
            return mergedData;
          });
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMounted = false;
      if (syncInterval) {
        window.clearInterval(syncInterval);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Salvar no servidor IMEDIATAMENTE quando dados mudam
  useEffect(() => {
    if (!data) return;

    console.log('📊 Dados atualizados - eventos com profissionais:', data.events?.map(e => ({
      id: e.id,
      name: e.name,
      usuariosCount: (e.users || []).length,
      assignmentsCount: (e.userAssignments || []).length,
    })));

    writeLocalData(data);
    (async () => {
      const saved = await saveToServer(data);
      if (saved) {
        setSyncStatus({ ok: true, message: 'Sincronização ativa com o banco de dados.' });
      } else {
        setSyncStatus({
          ok: false,
          message: 'Sincronização com o banco indisponível. Os dados locais ficam protegidos no cache do navegador até o servidor voltar.',
        });
      }
    })();
  }, [data]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
    localStorage.setItem('bcs_flows_theme', theme);
  }, [theme]);

  useEffect(() => {
    const loadMotivationalPhrase = async () => {
      try {
        const response = await fetch(assetUrl('frases_motivacionais.csv'));
        if (!response.ok) {
          const fallbackRows = [
            { frase: 'Comece hoje, não amanhã.', autor: 'BCS Flows' },
            { frase: 'A persistência é o caminho do êxito.', autor: 'Charles Chaplin' },
          ];
          setMotivationalPhrase(getDailyPhrase(fallbackRows, new Date()));
          return;
        }

        const csvText = await response.text();
        const rows = parseCsvRows(csvText);
        if (rows.length === 0) {
          const fallbackRows = [
            { frase: 'Comece hoje, não amanhã.', autor: 'BCS Flows' },
            { frase: 'A persistência é o caminho do êxito.', autor: 'Charles Chaplin' },
          ];
          setMotivationalPhrase(getDailyPhrase(fallbackRows, new Date()));
          return;
        }

        setMotivationalPhrase(getDailyPhrase(rows, new Date()));
      } catch (error) {
        console.error('Erro ao carregar frase motivacional:', error);
        setMotivationalPhrase({
          frase: 'Comece hoje, não amanhã.',
          autor: 'BCS Flows',
        });
      }
    };

    loadMotivationalPhrase();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentDate(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const handleLogin = () => {
    const usuario = loginForm.usuario.trim();
    const password = loginForm.password.trim();
    const safeUsers = Array.isArray(data?.users) ? data.users : initialData.users;
    const found = findUserByCredentials(safeUsers, usuario, password);

    if (found) {
      const normalizedUser = {
        ...found,
        role: normalizeUserRole(found.role || 'user'),
      };

      setError('');
      setShowLogoutVideo(false);
      setShowLoginVideo(true);
      window.setTimeout(() => {
        setShowLoginVideo(false);
        window.setTimeout(() => {
          setUser(normalizedUser);
        }, 400);
      }, 5000);
      return;
    }

    setError('Usuário ou senha incorretos.');
  };

  const handleLogout = () => {
    setShowLoginVideo(false);
    setShowLogoutVideo(true);
    window.setTimeout(() => {
      setUser(null);
      setRoute('events');
      setLoginForm({ usuario: '', password: '' });
      setError('');
      setShowLogoutVideo(false);
    }, 5000);
  };

  const handleOpenBCSColetores = () => {
    window.open('https://www.nuvematomica.com.br', '_blank', 'noopener,noreferrer');
  };

  const loginBackgroundVideo = assetUrl('login-intro.mp4');
  const introLoginVideo = assetUrl('logout-intro.mp4');
  const introLogoutVideo = assetUrl('logout-intro.mp4');
  const formattedLoginDate = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(currentDate);
  const formattedLoginTime = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(currentDate);

  const updateInventory = (inventory) => setData((prev) => ({ ...prev, inventory, updatedAt: Date.now() }));
  const updateConfig = (config) => setData((prev) => ({ ...prev, config, updatedAt: Date.now() }));
  const updateEvents = (events) => setData((prev) => ({ ...prev, events, updatedAt: Date.now() }));
  const updateUsers = (users) => setData((prev) => ({ ...prev, users, updatedAt: Date.now() }));

  const currentRole = normalizeUserRole(user?.role || '');
  const isMaster = currentRole === 'master';
  const isAdmin = canManageAdminFeatures(user?.role || '');
  const canAccessSettings = isAdmin;
  const currentConfig = data?.config || initialData.config;

  const visibleNav = [
    { id: 'events', label: 'Eventos', icon: Layers, private: false },
    { id: 'dashboard', label: 'Dashboard', icon: Activity, private: false },
    { id: 'calendar', label: 'Calendário', icon: Calendar, private: false },
    { id: 'finance', label: 'Financeiro do Evento', icon: FileText, private: false },
    { id: 'inventory', label: 'Estoque', icon: Box, private: false },
    { id: 'settings', label: 'Configurações', icon: Settings, private: true },
  ];

  const dashboard = (
    <div className="min-h-screen p-6">
      <div className="max-w-[1700px] mx-auto space-y-6">
        <header className="neumorphic-card p-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <img 
              src={theme === 'dark' ? assetUrl('dark.png') : assetUrl('light.png')} 
              alt="BCS Flows Logo" 
              className="h-12 w-auto"
            />
            <div>
              <p className="text-slate-500">BCS Flows - <strong>Planejamento estratégico.</strong> Operação sem falhas.</p>
            </div>
          </div>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
            <button
              className="neumorphic-button h-12 w-12 rounded-full p-0 flex items-center justify-center"
              aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
              onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
            >
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <span className="rounded-3xl bg-white/70 px-4 py-3 text-sm font-medium text-slate-700 shadow-sm">
              {user?.name} • {currentRole === 'master' ? 'Master' : currentRole === 'admin' ? 'Administrador' : 'Usuário'}
            </span>
            <button className="neumorphic-button" onClick={handleLogout}><LogIn className="mr-2 h-4 w-4" />Sair</button>
          </div>
        </header>

        <nav className="flex flex-wrap gap-3">
          {visibleNav.filter((nav) => !nav.private || canAccessSettings).map((nav) => (
            <button
              key={nav.id}
              className={`neumorphic-button flex items-center gap-2 px-4 py-3 ${route === nav.id ? 'primary' : 'secondary'}`}
              onClick={() => {
                if (nav.id === 'events') {
                  setEventBoardResetKey((prev) => prev + 1);
                }
                console.log(`Navigating to ${nav.id}, canAccessSettings=${canAccessSettings}, route=${nav.id}`);
                setRoute(nav.id);
              }}
            >
              <nav.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{nav.label}</span>
            </button>
          ))}
        </nav>

        <main>
          {!syncStatus.ok && (
            <div className="mb-4 rounded-3xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 shadow-sm">
              {syncStatus.message}
            </div>
          )}
          {route === 'events' && (
            <Suspense fallback={<div className="neumorphic-card p-8 text-center text-slate-600">Carregando painel de eventos...</div>}>
              <EventBoard
                key={eventBoardResetKey}
                events={data.events}
                inventory={data.inventory}
                config={data.config}
                users={data.users}
                user={user}
                onEventsChange={updateEvents}
              />
            </Suspense>
          )}
          {route === 'dashboard' && (
            <DashboardModule
              events={data.events}
              inventory={data.inventory}
              users={data.users}
              config={data.config}
              onUsersChange={updateUsers}
              currentUser={user}
            />
          )}
          {route === 'finance' && (
            <EventFinanceModule
              events={data.events}
              users={data.users}
              config={data.config}
              currentUser={user}
              onEventsChange={updateEvents}
            />
          )}
          {route === 'calendar' && (
            <EventCalendarModule
              events={data.events}
              inventory={data.inventory}
              users={data.users}
            />
          )}
          {route === 'inventory' && <InventoryModule inventory={data?.inventory || []} events={data?.events || []} onUpdateInventory={updateInventory} itemTypes={currentConfig?.itemTypes || []} currentUser={user} />}
          {route === 'settings' && canAccessSettings && <SettingsModule config={data.config} onUpdateConfig={updateConfig} users={data.users} onUpdateUsers={updateUsers} currentUser={user} />}
          {!['events', 'dashboard', 'finance', 'calendar', 'inventory', 'settings'].includes(route) && (
            <div className="p-6 text-center text-slate-600">
              <p>Página não encontrada. Rota inválida: {route}</p>
            </div>
          )}
          {route === 'settings' && !canAccessSettings && (
            <div className="p-6 text-center text-slate-600">
              <p>Você não tem permissão para acessar as configurações.</p>
            </div>
          )}
        </main>

        <footer className="pb-4 pt-2 text-center text-sm text-slate-500">
          Desenvolvido por Anderson Siebre
        </footer>
      </div>
    </div>
  );

  return (
    <div className={`app-shell login-shell min-h-screen ${theme === 'dark' ? 'theme-dark' : 'theme-light'}`}>
      {(showLoginVideo || showLogoutVideo) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm transition-opacity duration-700 ease-in-out">
          <div className="relative h-screen w-screen overflow-hidden bg-slate-950 transition-opacity duration-700 ease-in-out">
            <video
              key={showLoginVideo ? 'login-intro-video' : 'logout-intro-video'}
              className="h-full w-full object-cover scale-110"
              src={showLoginVideo ? introLoginVideo : introLogoutVideo}
              autoPlay
              muted
              playsInline
              style={{ filter: 'brightness(1.35) contrast(1.2) saturate(1.15)' }}
              onLoadedMetadata={(event) => {
                event.target.playbackRate = 1.7;
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 via-slate-900/20 to-slate-900/10" />
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 px-6 text-center text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.38em] text-slate-200/90">
                {showLoginVideo ? 'Carregando' : 'Até logo'}
              </p>
              {showLoginVideo && (
                <div className="mt-6 mx-auto max-w-2xl rounded-full border border-white/10 bg-slate-950/25 px-5 py-3 backdrop-blur-sm">
                  <p className="text-sm font-medium italic text-slate-100">“{motivationalPhrase.frase}”</p>
                  {motivationalPhrase.autor && (
                    <p className="mt-2 text-xs italic text-slate-300">— {motivationalPhrase.autor}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {!user ? (
        <div className="flex min-h-screen flex-col items-center justify-center p-5 sm:p-8">
          <div className="login-stage">
            <div className="login-card relative overflow-hidden flex flex-col flex-shrink-0">
              <video
                className="absolute inset-0 h-full w-full object-cover rounded-[2rem]"
                src={loginBackgroundVideo}
                autoPlay
                muted
                loop
                playsInline
                style={{ background: 'rgba(50, 50, 50, 0.3)', filter: 'brightness(1.28) contrast(1.12) saturate(1.1)' }}
              />
              <div className="absolute inset-0 rounded-[2rem] bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.28),transparent_32%),linear-gradient(180deg,rgba(15,23,42,0.08),rgba(15,23,42,0.72))]" />

              <button
                className="absolute top-4 right-4 z-20 neumorphic-button h-12 w-12 rounded-full p-0 flex-shrink-0 flex items-center justify-center"
                aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
                onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
              >
                {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>

              <div className="absolute bottom-0 left-0 right-0 p-7 sm:p-10 z-10">
                <div className="space-y-3">
                  <input className="neumorphic-input w-full border-white/10 bg-white/12 text-slate-900 placeholder:text-slate-400" placeholder="Usuário" value={loginForm.usuario} onChange={(e) => setLoginForm((prev) => ({ ...prev, usuario: e.target.value }))} />
                  <input type="password" className="neumorphic-input w-full border-white/10 bg-white/12 text-slate-900 placeholder:text-slate-400" placeholder="Senha" value={loginForm.password} onChange={(e) => setLoginForm((prev) => ({ ...prev, password: e.target.value }))} />
                </div>
                {error && <div className="mt-3 rounded-3xl border border-rose-200/40 bg-rose-500/15 p-3 text-sm text-rose-100 backdrop-blur-sm">{error}</div>}
                <button className="neumorphic-button w-full mt-3 bg-white/95 text-slate-900 shadow-[0_16px_32px_rgba(15,23,42,0.2)] hover:bg-white" onClick={handleLogin}>Entrar</button>
                <button className="neumorphic-button w-full mt-3 border border-sky-200/80 bg-sky-500/10 text-sky-50 hover:bg-sky-500/20" onClick={handleOpenBCSColetores}>Ir para BCS Coletores</button>
              </div>
            </div>

            <aside className="login-side-panel">
              <div className="login-date-card">
                <span className="date-kicker">Hoje</span>
                <p className="login-date">{formattedLoginDate}</p>
                <div className="date-divider" />
                <div className="date-footer">
                  <span>{formattedLoginTime}</span>
                </div>
              </div>

              <div className="login-slogan">
                <strong>Planejamento estratégico.</strong>
                <span>Operação sem falhas.</span>
              </div>

              <div className="login-quote flex flex-col justify-center min-h-full">
                <span className="eyebrow">Frase do dia</span>
                <blockquote>“{motivationalPhrase.frase}”</blockquote>
                {motivationalPhrase.autor && (
                  <p>— {motivationalPhrase.autor}</p>
                )}
              </div>
            </aside>
          </div>
        </div>
      ) : (
        dashboard
      )}
    </div>
  );
}

export default App;

