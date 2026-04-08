import React, { useState, useEffect, useRef } from 'react';
import { 
  Hexagon, 
  ArrowRightLeft, 
  Layers, 
  List, 
  Settings, 
  Plus, 
  Minus, 
  ChevronDown, 
  ChevronRight,
  Upload,
  Download,
  Play,
  X,
  Trash2,
  Database,
  Link as LinkIcon,
  Clock,
  Shield,
  Globe,
  Zap,
  Lock,
  Unlock,
  Search,
  Filter,
  Eye,
  EyeOff,
  Activity,
  BarChart3,
  Server
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { cn } from './lib/utils';
import { Table, Field, Relation, Endpoint, Middleware, LogEntry, ProjectConfig, ClientRequest, ClientResponse, Environment, VaultSecret, ProxyRoute } from './types';
import { INITIAL_TABLES, INITIAL_RELATIONS, INITIAL_ENDPOINTS, INITIAL_MIDDLEWARE } from './constants';

// --- Components ---

const Button = ({ 
  children, 
  className, 
  variant = 'secondary', 
  ...props 
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' }) => (
  <button 
    className={cn(
      "px-3 py-1.5 rounded-md font-mono text-[11px] cursor-pointer transition-all flex items-center gap-2 border",
      variant === 'primary' && "bg-amber text-bg0 border-amber font-semibold hover:bg-amber2",
      variant === 'secondary' && "bg-bg3 text-text1 border-border2 hover:border-amber hover:text-amber",
      variant === 'danger' && "bg-red/10 text-red border-red/20 hover:bg-red/20",
      className
    )}
    {...props}
  >
    {children}
  </button>
);

const Badge = ({ children, className, method }: { children: React.ReactNode, className?: string, method?: string }) => (
  <span className={cn(
    "px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider",
    method === 'GET' && "bg-cyan/10 text-cyan",
    method === 'POST' && "bg-green/10 text-green",
    method === 'PUT' && "bg-amber/10 text-amber",
    method === 'DELETE' && "bg-red/10 text-red",
    method === 'WS' && "bg-purple/10 text-purple",
    !method && "bg-bg4 text-text2",
    className
  )}>
    {children}
  </span>
);

// --- Main App ---

export default function App() {
  const [activeView, setActiveView] = useState<'schema' | 'endpoints' | 'middleware' | 'logger' | 'client' | 'vault' | 'proxies'>('schema');
  const [tables, setTables] = useState<Table[]>(INITIAL_TABLES);
  const [relations, setRelations] = useState<Relation[]>(INITIAL_RELATIONS);
  const [endpoints, setEndpoints] = useState<Endpoint[]>(INITIAL_ENDPOINTS);
  const [middleware, setMiddleware] = useState<Middleware[]>(INITIAL_MIDDLEWARE);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [clientRequests, setClientRequests] = useState<ClientRequest[]>([]);
  const [activeRequest, setActiveRequest] = useState<ClientRequest>({
    id: 'scratch',
    name: 'New Request',
    method: 'GET',
    url: 'https://jsonplaceholder.typicode.com/todos/1',
    headers: [{ key: 'Content-Type', value: 'application/json', enabled: true }],
    body: ''
  });
  const [lastResponse, setLastResponse] = useState<ClientResponse | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [requestLatency, setRequestLatency] = useState(0);
  const [environments, setEnvironments] = useState<Environment[]>([
    { id: 'default', name: 'Global', variables: [{ key: 'base_url', value: 'https://jsonplaceholder.typicode.com' }] }
  ]);
  const [activeEnvId, setActiveEnvId] = useState<string>('default');
  const [vault, setVault] = useState<VaultSecret[]>([]);
  const [proxies, setProxies] = useState<ProxyRoute[]>([]);
  const [isVaultLocked, setIsVaultLocked] = useState(true);
  const [showVisualizer, setShowVisualizer] = useState(true);
  const [activeFlow, setActiveFlow] = useState<{ from: string, to: string, type: 'mock' | 'proxy' | 'client' } | null>(null);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(tables[0]?.id || null);
  const [selectedField, setSelectedField] = useState<{ tableId: string, fieldName: string } | null>(null);
  const [selectedEndpointId, setSelectedEndpointId] = useState<string | null>(endpoints[0]?.id || null);
  const [zoom, setZoom] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState<string | null>(null);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState('varchar');
  const [newEndpointPath, setNewEndpointPath] = useState('');
  const [newEndpointMethod, setNewEndpointMethod] = useState<'GET' | 'POST' | 'PUT' | 'DELETE'>('GET');

  const canvasRef = useRef<HTMLDivElement>(null);
  const [draggingTable, setDraggingTable] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Sync with backend
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch('/api/bator/config');
        const data = await res.json();
        if (data.tables) setTables(data.tables);
        if (data.relations) setRelations(data.relations);
        if (data.endpoints) setEndpoints(data.endpoints);
        if (data.middleware) setMiddleware(data.middleware);
        if (data.clientRequests) setClientRequests(data.clientRequests);
        if (data.environments) setEnvironments(data.environments);
        if (data.vault) setVault(data.vault);
        if (data.proxies) setProxies(data.proxies);
      } catch (e) {}
    };
    fetchConfig();
  }, []);

  useEffect(() => {
    const syncConfig = async () => {
      try {
        await fetch('/api/bator/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tables, relations, endpoints, middleware, logs, clientRequests, environments, vault, proxies })
        });
      } catch (e) {
        console.error("Failed to sync config", e);
      }
    };
    syncConfig();
  }, [tables, relations, endpoints, middleware, clientRequests, environments, vault, proxies]);

  // Poll logs
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/bator/logs');
        const data = await res.json();
        if (data.length > logs.length) {
          const latest = data[data.length - 1];
          if (latest.path.startsWith('/mock')) {
            setActiveFlow({ from: 'Client', to: 'Bator', type: 'mock' });
            setTimeout(() => setActiveFlow(null), 2000);
          } else if (latest.path.startsWith('[PROXY:')) {
            setActiveFlow({ from: 'Client', to: 'Bator', type: 'proxy' });
            setTimeout(() => {
              setActiveFlow({ from: 'Bator', to: 'Server', type: 'proxy' });
              setTimeout(() => setActiveFlow(null), 1000);
            }, 500);
          }
        }
        setLogs(data);
      } catch (e) {}
    }, 2000);
    return () => clearInterval(interval);
  }, [logs.length]);

  const handleTableDragStart = (e: React.MouseEvent, tableId: string) => {
    if ((e.target as HTMLElement).closest('.tc-act')) return;
    setDraggingTable(tableId);
    const table = tables.find(t => t.id === tableId);
    if (table && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left - table.x,
        y: e.clientY - rect.top - table.y
      });
    }
    setSelectedTableId(tableId);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggingTable && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const newX = (e.clientX - rect.left - dragOffset.x);
      const newY = (e.clientY - rect.top - dragOffset.y);
      
      setTables(prev => prev.map(t => 
        t.id === draggingTable ? { ...t, x: newX, y: newY } : t
      ));
    }
  };

  const handleMouseUp = () => {
    setDraggingTable(null);
  };

  const addField = () => {
    if (!selectedTableId || !newFieldName) return;
    setTables(prev => prev.map(t => {
      if (t.id === selectedTableId) {
        return {
          ...t,
          fields: [...t.fields, { name: newFieldName, type: newFieldType }]
        };
      }
      return t;
    }));
    setNewFieldName('');
    setIsModalOpen(null);
  };

  const addEndpoint = () => {
    if (!newEndpointPath) return;
    const newEp: Endpoint = {
      id: Date.now().toString(),
      method: newEndpointMethod,
      path: newEndpointPath,
      latency: 50,
      tags: ['Custom']
    };
    setEndpoints([...endpoints, newEp]);
    setNewEndpointPath('');
    setIsModalOpen(null);
  };

  const sendClientRequest = async () => {
    setIsRequesting(true);
    setActiveFlow({ from: 'Client', to: 'Bator', type: 'client' });
    try {
      const env = environments.find(e => e.id === activeEnvId);
      const vars = env?.variables || [];
      
      const replaceVars = (str: string) => {
        let result = str;
        vars.forEach(v => {
          result = result.replace(new RegExp(`{{${v.key}}}`, 'g'), v.value);
        });
        // Also replace from vault if unlocked
        if (!isVaultLocked) {
          vault.forEach(v => {
            result = result.replace(new RegExp(`{{vault.${v.key}}}`, 'g'), v.value);
          });
        }
        return result;
      };

      const headersObj: Record<string, string> = {};
      activeRequest.headers.forEach(h => {
        if (h.enabled && h.key) headersObj[replaceVars(h.key)] = replaceVars(h.value);
      });

      const res = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: activeRequest.method,
          url: replaceVars(activeRequest.url),
          headers: headersObj,
          body: replaceVars(activeRequest.body),
          latency: requestLatency
        })
      });
      
      setActiveFlow({ from: 'Bator', to: 'Server', type: 'proxy' });
      const data = await res.json();
      setLastResponse(data);
      setActiveFlow({ from: 'Server', to: 'Client', type: 'client' });
      
      // Add to history
      if (!clientRequests.find(r => r.id === activeRequest.id)) {
        setClientRequests(prev => [{ ...activeRequest, id: Date.now().toString() }, ...prev].slice(0, 20));
      }
    } catch (e) {
      console.error("Request failed", e);
    } finally {
      setIsRequesting(false);
      setTimeout(() => setActiveFlow(null), 2000);
    }
  };

  const saveClientRequest = () => {
    if (activeRequest.id === 'scratch') {
      const newReq = { ...activeRequest, id: Date.now().toString(), name: `Request ${clientRequests.length + 1}` };
      setClientRequests(prev => [newReq, ...prev]);
      setActiveRequest(newReq);
    } else {
      setClientRequests(prev => prev.map(r => r.id === activeRequest.id ? activeRequest : r));
    }
  };

  const addTable = (name: string) => {
    const newTable: Table = {
      id: name.toLowerCase().replace(/\s+/g, '_'),
      name,
      color: '#' + Math.floor(Math.random()*16777215).toString(16),
      x: 100 + Math.random() * 200,
      y: 100 + Math.random() * 200,
      fields: [
        { name: 'id', type: 'uuid', pk: true, faker: 'string.uuid' },
        { name: 'created_at', type: 'timestamp', faker: 'date.recent' }
      ]
    };
    setTables([...tables, newTable]);
    setIsModalOpen(null);
  };

  const updateTable = (id: string, updates: Partial<Table>) => {
    setTables(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const updateField = (tableId: string, fieldName: string, updates: Partial<Field>) => {
    setTables(prev => prev.map(t => {
      if (t.id === tableId) {
        return {
          ...t,
          fields: t.fields.map(f => f.name === fieldName ? { ...f, ...updates } : f)
        };
      }
      return t;
    }));
  };

  const selectedTable = tables.find(t => t.id === selectedTableId);
  const selectedFieldData = selectedField ? tables.find(t => t.id === selectedField.tableId)?.fields.find(f => f.name === selectedField.fieldName) : null;
  const selectedEndpoint = endpoints.find(e => e.id === selectedEndpointId);

  return (
    <div id="app" className="grid grid-cols-[52px_240px_1fr] grid-rows-[36px_1fr_24px] h-screen bg-bg0 text-text0 font-mono overflow-hidden">
      
      {/* --- Titlebar --- */}
      <header className="col-span-full flex items-center bg-bg1 border-b border-border px-3 gap-4 select-none">
        <div className="font-sans font-extrabold text-[15px] tracking-tight text-amber flex items-center gap-1.5">
          <div className="w-5 h-5 bg-amber [clip-path:polygon(50%_0%,100%_38%,82%_100%,18%_100%,0%_38%)]" />
          Bator
          <span className="font-mono text-[9px] text-text2 font-normal bg-bg3 px-1 rounded border border-border2">v0.1.0</span>
        </div>
        <div className="ml-2 flex items-center gap-1.5 text-[11px] text-text2">
          <span className="text-text1">ecommerce-api</span>
          <span>›</span>
          <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-widest bg-amber/15 text-amber border border-amber/50">mock</span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-[10px] text-green">
            <div className="w-1.5 h-1.5 rounded-full bg-green shadow-[0_0_6px_var(--color-green)] animate-pulse" />
            Server :3000
          </div>
          <Button onClick={() => setIsModalOpen('import')}>⬆ Import</Button>
          <Button onClick={() => setIsModalOpen('export')}>⬇ Export</Button>
          <Button variant="primary" onClick={() => window.open('/mock/api/users', '_blank')}>▶ Run Mock</Button>
        </div>
      </header>

      {/* --- Activity Bar --- */}
      <nav className="bg-bg1 border-r border-border flex flex-col items-center py-2 gap-1">
        {[
          { id: 'schema', icon: Hexagon, title: 'Schema Builder' },
          { id: 'endpoints', icon: ArrowRightLeft, title: 'Endpoint Studio' },
          { id: 'client', icon: Globe, title: 'API Client' },
          { id: 'proxies', icon: Server, title: 'Proxy Interceptor' },
          { id: 'vault', icon: Shield, title: 'Secrets Vault' },
          { id: 'middleware', icon: Layers, title: 'Middleware' },
          { id: 'logger', icon: List, title: 'Request Logger' }
        ].map(item => (
          <button
            key={item.id}
            onClick={() => setActiveView(item.id as any)}
            className={cn(
              "w-9 h-9 flex items-center justify-center rounded-md cursor-pointer transition-all relative",
              activeView === item.id ? "text-amber bg-amber/15" : "text-text2 hover:text-text1 hover:bg-bg3"
            )}
            title={item.title}
          >
            <item.icon size={18} />
            {activeView === item.id && (
              <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-[3px] h-[18px] bg-amber rounded-r" />
            )}
          </button>
        ))}
        <div className="flex-1" />
        <div className="w-6 h-[1px] bg-border my-1" />
        <button className="w-9 h-9 flex items-center justify-center rounded-md text-text2 hover:text-text1 hover:bg-bg3" title="Settings">
          <Settings size={18} />
        </button>
      </nav>

      {/* --- Side Panel --- */}
      <aside className="bg-bg1 border-r border-border flex flex-col overflow-hidden">
        <div className="p-2.5 pb-2 text-[9px] font-semibold tracking-widest uppercase text-text2 border-b border-border flex items-center justify-between">
          <span>{activeView.charAt(0).toUpperCase() + activeView.slice(1)}</span>
          <div className="flex gap-1">
            <button 
              className="w-4.5 h-4.5 flex items-center justify-center rounded hover:bg-amber/15 hover:text-amber transition-all" 
              onClick={() => setIsModalOpen(activeView === 'endpoints' ? 'new-endpoint' : 'new-table')}
            >
              <Plus size={12} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {activeView === 'schema' && (
            <>
              <div className="border-b border-border">
                <div className="p-2 flex items-center gap-1.5 text-[10px] text-text1 cursor-pointer hover:bg-bg3 transition-all">
                  <Hexagon size={10} className="text-cyan" /> Tables
                  <span className="ml-auto text-[9px] text-text2 pr-1.5">{tables.length}</span>
                  <ChevronDown size={10} className="text-text2" />
                </div>
                <div>
                  {tables.map(table => (
                    <div 
                      key={table.id} 
                      onClick={() => setSelectedTableId(table.id)}
                      className={cn(
                        "px-3 py-1 text-[11px] cursor-pointer flex items-center gap-2 transition-all truncate",
                        selectedTableId === table.id ? "bg-bg4 text-amber" : "text-text1 hover:bg-bg3"
                      )}
                    >
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: table.color }} />
                      {table.name}
                      <span className="ml-auto text-[9px] bg-bg4 text-text2 px-1 rounded">{table.fields.length} cols</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-b border-border">
                <div className="p-2 flex items-center gap-1.5 text-[10px] text-text1 cursor-pointer hover:bg-bg3 transition-all">
                  <ArrowRightLeft size={10} className="text-purple" /> Relations
                  <span className="ml-auto text-[9px] text-text2 pr-1.5">{relations.length}</span>
                  <ChevronDown size={10} className="text-text2" />
                </div>
                <div className="px-3 py-1 space-y-1">
                  {relations.map((rel, i) => (
                    <div key={i} className="text-[10px] text-text2 flex items-center gap-1.5">
                      <span className="text-amber">→</span> {rel.from} → {rel.to}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeView === 'endpoints' && (
             <div className="border-b border-border">
              <div className="p-2 flex items-center gap-1.5 text-[10px] text-text1">
                <ArrowRightLeft size={10} className="text-cyan" /> Routes
                <span className="ml-auto text-[9px] text-text2 pr-1.5">{endpoints.length}</span>
              </div>
              <div>
                {endpoints.map(ep => (
                  <div 
                    key={ep.id}
                    onClick={() => setSelectedEndpointId(ep.id)}
                    className={cn(
                      "px-3 py-1.5 text-[11px] cursor-pointer flex items-center gap-2 transition-all",
                      selectedEndpointId === ep.id ? "bg-bg3 border-l-2 border-amber" : "hover:bg-bg3"
                    )}
                  >
                    <Badge method={ep.method}>{ep.method}</Badge>
                    <span className="truncate text-text1">{ep.path}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeView === 'client' && (
            <>
              <div className="border-b border-border">
                <div className="p-2 flex items-center gap-1.5 text-[10px] text-text1">
                  <Globe size={10} className="text-blue-400" /> Environment
                  <button className="ml-auto text-amber hover:underline text-[9px]" onClick={() => setIsModalOpen('manage-env')}>Manage</button>
                </div>
                <div className="px-3 pb-2">
                  <select 
                    className="w-full bg-bg3 border border-border2 text-text0 px-2 py-1 rounded text-[10px] outline-none cursor-pointer"
                    value={activeEnvId}
                    onChange={(e) => setActiveEnvId(e.target.value)}
                  >
                    {environments.map(env => <option key={env.id} value={env.id}>{env.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="border-b border-border">
                <div className="p-2 flex items-center gap-1.5 text-[10px] text-text1">
                  <Clock size={10} className="text-amber" /> Collection
                  <button className="ml-auto text-red hover:underline text-[9px]" onClick={() => setClientRequests([])}>Clear</button>
                </div>
                <div className="space-y-0.5">
                  <div 
                    onClick={() => setActiveRequest({ id: 'scratch', name: 'New Request', method: 'GET', url: '', headers: [], body: '' })}
                    className={cn(
                      "px-3 py-1.5 text-[10px] cursor-pointer flex items-center gap-2 transition-all",
                      activeRequest.id === 'scratch' ? "bg-bg3 text-amber" : "text-text2 hover:bg-bg3 hover:text-text1"
                    )}
                  >
                    <Plus size={10} /> New Request
                  </div>
                  {clientRequests.map(req => (
                    <div 
                      key={req.id}
                      onClick={() => setActiveRequest(req)}
                      className={cn(
                        "px-3 py-1.5 text-[10px] cursor-pointer flex items-center gap-2 transition-all group",
                        activeRequest.id === req.id ? "bg-bg3 text-amber" : "text-text2 hover:bg-bg3 hover:text-text1"
                      )}
                    >
                      <Badge method={req.method} className="w-8 text-center">{req.method}</Badge>
                      <span className="truncate flex-1">{req.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeView === 'logger' && (
            <div className="p-2 space-y-1">
              <div className="text-[9px] font-bold text-text2 uppercase tracking-widest px-1 mb-1">Recent Activity</div>
              {logs.slice(-10).reverse().map(log => (
                <div key={log.id} className="text-[10px] flex items-center gap-2 p-1 rounded hover:bg-bg3">
                  <div className={cn("w-1.5 h-1.5 rounded-full", log.status < 300 ? "bg-green" : "bg-red")} />
                  <span className="text-text1">{log.status}</span>
                  <span className="text-text2 truncate">{log.path}</span>
                </div>
              ))}
            </div>
          )}

          {activeView === 'vault' && (
            <div className="p-2 space-y-2">
              <div className="flex items-center justify-between px-1">
                <div className="text-[9px] font-bold text-text2 uppercase tracking-widest">Secrets</div>
                <button onClick={() => setIsVaultLocked(!isVaultLocked)} className="text-text2 hover:text-amber">
                  {isVaultLocked ? <Lock size={12} /> : <Unlock size={12} />}
                </button>
              </div>
              <div className="space-y-1">
                {vault.map(s => (
                  <div key={s.id} className="p-2 bg-bg3 border border-border2 rounded text-[10px] flex flex-col gap-1">
                    <span className="text-amber font-bold">{s.key}</span>
                    <span className="text-text2 font-mono truncate">{isVaultLocked ? '••••••••••••' : s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeView === 'proxies' && (
            <div className="p-2 space-y-2">
              <div className="text-[9px] font-bold text-text2 uppercase tracking-widest px-1">Active Proxies</div>
              <div className="space-y-1">
                {proxies.map(p => (
                  <div key={p.id} className={cn("p-2 border rounded text-[10px] flex flex-col gap-1", p.enabled ? "bg-bg3 border-amber/30" : "bg-bg2 border-border2 opacity-60")}>
                    <div className="flex items-center justify-between">
                      <span className="text-text1 font-bold">/p/{p.prefix}</span>
                      <div className={cn("w-1.5 h-1.5 rounded-full", p.enabled ? "bg-green" : "bg-text3")} />
                    </div>
                    <span className="text-text2 truncate">{p.target}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* --- Main Content --- */}
      <main className="flex flex-col overflow-hidden bg-bg0">
        {/* Tabs */}
        <div className="flex items-stretch bg-bg1 border-b border-border h-[34px] overflow-x-auto shrink-0">
          {[
            { id: 'schema', label: 'schema.bator', color: 'bg-amber' },
            { id: 'endpoints', label: 'endpoints.bator', color: 'bg-cyan' },
            { id: 'client', label: 'api.client', color: 'bg-blue-400' },
            { id: 'proxies', label: 'proxy.conf', color: 'bg-orange-400' },
            { id: 'vault', label: 'vault.env', color: 'bg-red-400' },
            { id: 'middleware', label: 'middleware.bator', color: 'bg-purple' },
            { id: 'logger', label: 'request.log', color: 'bg-green' }
          ].map(tab => (
            <div
              key={tab.id}
              onClick={() => setActiveView(tab.id as any)}
              className={cn(
                "flex items-center gap-1.5 px-3.5 text-[11px] cursor-pointer border-r border-border whitespace-nowrap transition-all relative select-none",
                activeView === tab.id ? "text-text0 bg-bg0" : "text-text2 hover:text-text1 hover:bg-bg2"
              )}
            >
              <div className={cn("w-1.5 h-1.5 rounded-full", tab.color)} />
              {tab.label}
              {activeView === tab.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber" />}
              <button className="ml-1 w-3.5 h-3.5 flex items-center justify-center rounded-sm text-text2 opacity-0 hover:bg-bg4 hover:text-red transition-all group-hover:opacity-100">
                <X size={10} />
              </button>
            </div>
          ))}
        </div>

        {/* Content Views */}
        <div className="flex-1 relative overflow-hidden">
          
          {/* --- Schema Builder --- */}
          <AnimatePresence mode="wait">
            {activeView === 'schema' && (
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 flex"
              >
                <div 
                  ref={canvasRef}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  className="flex-1 relative overflow-hidden bg-[linear-gradient(rgba(34,211,238,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.02)_1px,transparent_1px)] bg-[length:24px_24px]"
                >
                  <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
                    {relations.map((rel, i) => {
                      const fromTable = tables.find(t => t.id === rel.from);
                      const toTable = tables.find(t => t.id === rel.to);
                      if (!fromTable || !toTable) return null;
                      
                      const fx = fromTable.x + 200;
                      const fy = fromTable.y + 50;
                      const tx = toTable.x;
                      const ty = toTable.y + 50;
                      const cx = (fx + tx) / 2;

                      return (
                        <g key={i}>
                          <path 
                            d={`M ${fx} ${fy} C ${cx} ${fy}, ${cx} ${ty}, ${tx} ${ty}`}
                            className="stroke-amber stroke-[1.5] fill-none stroke-dasharray-[4,3] opacity-60 [animation:dash_20s_linear_infinite]"
                          />
                          <circle cx={fx} cy={fy} r={3} className="fill-amber" />
                          <circle cx={tx} cy={ty} r={3} className="fill-amber" />
                        </g>
                      );
                    })}
                  </svg>

                  <div className="absolute top-3 left-3 flex gap-1.5 z-20">
                    <Button onClick={() => setIsModalOpen('new-table')}>+ Table</Button>
                    <Button onClick={() => {
                      setTables(prev => prev.map((t, i) => ({
                        ...t,
                        x: 40 + (i % 3) * 260,
                        y: 60 + Math.floor(i / 3) * 320
                      })));
                    }}>⊞ Auto Layout</Button>
                    <Button onClick={() => setZoom(z => Math.min(z + 0.1, 2))}>+ Zoom</Button>
                    <Button onClick={() => setZoom(z => Math.max(z - 0.1, 0.5))}>− Zoom</Button>
                  </div>

                  <div className="absolute bottom-3 right-3 w-36 h-24 bg-bg2 border border-border2 rounded-md overflow-hidden z-20">
                    <span className="absolute top-1 left-1.5 text-[8px] text-text2 tracking-widest">MINIMAP</span>
                  </div>

                  <div style={{ transform: `scale(${zoom})`, transformOrigin: '0 0' }}>
                    {tables.map(table => (
                      <div
                        key={table.id}
                        onMouseDown={(e) => handleTableDragStart(e, table.id)}
                        style={{ left: table.x, top: table.y }}
                        className={cn(
                          "absolute bg-bg2 border border-border2 rounded-lg min-w-[200px] shadow-2xl z-20 transition-shadow",
                          selectedTableId === table.id && "border-amber shadow-[0_4px_32px_rgba(245,158,11,0.12)]",
                          draggingTable === table.id && "opacity-85 shadow-none z-50"
                        )}
                      >
                        <div className="flex items-center gap-2 p-2 border-b border-border cursor-grab active:cursor-grabbing rounded-t-lg">
                          <div className="w-5 h-5 rounded bg-amber/10 text-amber flex items-center justify-center text-[11px]" style={{ color: table.color, backgroundColor: `${table.color}22` }}>⬡</div>
                          <span className="text-[12px] font-semibold text-text0">{table.name}</span>
                          <div className="ml-auto flex gap-0.5">
                            <button className="w-4 h-4 flex items-center justify-center rounded-sm text-text2 hover:text-amber hover:bg-amber/15 transition-all tc-act" onClick={(e) => { e.stopPropagation(); setIsModalOpen('new-field'); }}>+</button>
                            <button className="w-4 h-4 flex items-center justify-center rounded-sm text-text2 hover:text-amber hover:bg-amber/15 transition-all tc-act">⋯</button>
                          </div>
                        </div>
                        <div className="py-1">
                          {table.fields.map(field => (
                            <div 
                              key={field.name}
                              onClick={(e) => { e.stopPropagation(); setSelectedField({ tableId: table.id, fieldName: field.name }); }}
                              className={cn(
                                "flex items-center gap-2 px-2.5 py-1 cursor-pointer hover:bg-bg3 transition-all relative group",
                                field.pk && "text-amber",
                                field.fk && "text-cyan"
                              )}
                            >
                              <div className="w-3.5 h-3.5 flex items-center justify-center text-[9px] shrink-0">
                                {field.pk ? '🔑' : field.fk ? '🔗' : ''}
                              </div>
                              <span className="text-[11px] flex-1">{field.name}</span>
                              <span className="text-[9px] text-text2 bg-bg4 px-1 rounded">{field.type}</span>
                              <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full border border-border2 bg-bg3 cursor-crosshair group-hover:bg-amber group-hover:border-amber group-hover:shadow-[0_0_6px_var(--color-amber)] transition-all z-30" />
                            </div>
                          ))}
                        </div>
                        <div className="p-1.5 text-[10px] text-text2 cursor-pointer border-t border-border flex items-center gap-1.5 hover:text-amber hover:bg-amber/5 transition-all rounded-b-lg" onClick={() => setIsModalOpen('new-field')}>
                          <Plus size={10} /> Add field
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Properties Panel */}
                <div className="w-64 bg-bg1 border-l border-border flex flex-col overflow-y-auto">
                  <div className="p-2.5 text-[9px] font-semibold tracking-widest uppercase text-text2 border-b border-border">Properties</div>
                  
                  {selectedTable && (
                    <div className="border-b border-border">
                      <div className="p-2.5 text-[9px] font-semibold tracking-widest uppercase text-text2">Table</div>
                      <div className="px-3 pb-3 space-y-2">
                        <div className="space-y-1">
                          <label className="text-[10px] text-text2">Name</label>
                          <input 
                            className="w-full bg-bg3 border border-border2 text-text0 px-2 py-1 rounded text-[10px] outline-none focus:border-amber" 
                            value={selectedTable.name}
                            onChange={(e) => updateTable(selectedTable.id, { name: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-text2">Database</label>
                          <select className="w-full bg-bg3 border border-border2 text-text0 px-2 py-1 rounded text-[10px] outline-none cursor-pointer">
                            <option>PostgreSQL</option>
                            <option>MySQL</option>
                            <option>MongoDB</option>
                            <option>SQLite</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedFieldData && (
                    <div className="border-b border-border">
                      <div className="p-2.5 text-[9px] font-semibold tracking-widest uppercase text-text2">
                        Field: <span className="text-amber">{selectedFieldData.name}</span>
                      </div>
                      <div className="px-3 pb-3 space-y-2">
                        <div className="space-y-1">
                          <label className="text-[10px] text-text2">Name</label>
                          <input 
                            className="w-full bg-bg3 border border-border2 text-text0 px-2 py-1 rounded text-[10px] outline-none focus:border-amber" 
                            value={selectedFieldData.name}
                            onChange={(e) => updateField(selectedField!.tableId, selectedField!.fieldName, { name: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-text2">Type</label>
                          <select 
                            className="w-full bg-bg3 border border-border2 text-text0 px-2 py-1 rounded text-[10px] outline-none cursor-pointer"
                            value={selectedFieldData.type}
                            onChange={(e) => updateField(selectedField!.tableId, selectedField!.fieldName, { type: e.target.value })}
                          >
                            <option>uuid</option>
                            <option>int</option>
                            <option>varchar</option>
                            <option>text</option>
                            <option>timestamp</option>
                            <option>boolean</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-text2">Mock Seeder (Faker)</label>
                          <input 
                            className="w-full bg-bg3 border border-border2 text-text0 px-2 py-1 rounded text-[10px] outline-none focus:border-amber" 
                            placeholder="e.g. person.fullName"
                            value={selectedFieldData.faker || ''}
                            onChange={(e) => updateField(selectedField!.tableId, selectedField!.fieldName, { faker: e.target.value })}
                          />
                        </div>
                        <div className="flex flex-col gap-1.5 pt-1">
                          <label className="flex items-center gap-2 text-[10px] text-text1 cursor-pointer">
                            <input type="checkbox" checked={selectedFieldData.pk} onChange={(e) => updateField(selectedField!.tableId, selectedField!.fieldName, { pk: e.target.checked })} className="accent-amber" /> Primary Key
                          </label>
                          <label className="flex items-center gap-2 text-[10px] text-text1 cursor-pointer">
                            <input type="checkbox" checked={selectedFieldData.unique} onChange={(e) => updateField(selectedField!.tableId, selectedField!.fieldName, { unique: e.target.checked })} className="accent-amber" /> Unique
                          </label>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* --- Endpoint Studio --- */}
          <AnimatePresence mode="wait">
            {activeView === 'endpoints' && (
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 flex"
              >
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {selectedEndpoint ? (
                    <>
                      <div className="bg-bg2 border border-border rounded-lg overflow-hidden">
                        <div className="px-3 py-2 border-b border-border text-[10px] font-semibold text-text1 flex items-center gap-2">
                          <ArrowRightLeft size={12} /> Endpoint Configuration
                        </div>
                        <div className="p-3 space-y-3">
                          <div className="flex items-center gap-2 bg-bg3 border border-border2 rounded-md p-2">
                            <span className="text-[10px] font-bold text-cyan">{selectedEndpoint.method}</span>
                            <input 
                              className="flex-1 bg-transparent border-none outline-none text-[11px] text-text0 font-mono" 
                              value={selectedEndpoint.path}
                              onChange={(e) => setEndpoints(prev => prev.map(ep => ep.id === selectedEndpoint.id ? { ...ep, path: e.target.value } : ep))}
                            />
                          </div>
                          <div className="flex gap-1.5 flex-wrap">
                            {selectedEndpoint.tags?.map(tag => (
                              <Badge key={tag} className="bg-bg4 text-text2">{tag}</Badge>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="bg-bg2 border border-border rounded-lg overflow-hidden">
                        <div className="px-3 py-2 border-b border-border text-[10px] font-semibold text-text1 flex items-center gap-2">
                          <Database size={12} /> Data Source
                        </div>
                        <div className="p-3 space-y-3">
                          <div className="space-y-1">
                            <label className="text-[10px] text-text2">Linked Table (ORM Mock)</label>
                            <select 
                              className="w-full bg-bg3 border border-border2 text-text0 px-2 py-1.5 rounded text-[11px] outline-none cursor-pointer"
                              value={selectedEndpoint.tableId || ''}
                              onChange={(e) => setEndpoints(prev => prev.map(ep => ep.id === selectedEndpoint.id ? { ...ep, tableId: e.target.value } : ep))}
                            >
                              <option value="">— None (Custom JSON) —</option>
                              {tables.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] text-text2">Latency Simulation (ms)</label>
                            <div className="flex items-center gap-3">
                              <input 
                                type="range" min="0" max="2000" step="10"
                                className="flex-1 accent-amber"
                                value={selectedEndpoint.latency}
                                onChange={(e) => setEndpoints(prev => prev.map(ep => ep.id === selectedEndpoint.id ? { ...ep, latency: parseInt(e.target.value) } : ep))}
                              />
                              <span className="text-[10px] text-amber w-10 text-right">{selectedEndpoint.latency}ms</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-bg2 border border-border rounded-lg overflow-hidden">
                        <div className="px-3 py-2 border-b border-border text-[10px] font-semibold text-text1 flex items-center gap-2">
                          <Hexagon size={12} /> Mock Response Preview
                        </div>
                        <div className="p-3">
                          <div className="bg-bg0 border border-border rounded p-3 text-[11px] text-text1 font-mono leading-relaxed overflow-x-auto whitespace-pre">
                            {JSON.stringify({
                              data: [
                                { id: "550e8400-e29b-41d4", email: "alice@example.com", name: "Alice Chen" }
                              ],
                              meta: { page: 1, limit: 20, total: 50 }
                            }, null, 2)}
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-text2 opacity-30 gap-3">
                      <ArrowRightLeft size={48} />
                      <span className="text-[12px]">Select an endpoint to configure</span>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* --- Middleware --- */}
          <AnimatePresence mode="wait">
            {activeView === 'middleware' && (
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 overflow-y-auto p-5"
              >
                <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-3">
                  {middleware.map(mw => (
                    <div 
                      key={mw.id}
                      className={cn(
                        "bg-bg2 border border-border rounded-lg overflow-hidden transition-all",
                        mw.enabled && "border-amber"
                      )}
                    >
                      <div className="flex items-center gap-3 p-3 border-b border-border">
                        <div className="w-8 h-8 rounded-lg bg-amber/10 text-amber flex items-center justify-center text-lg">{mw.icon}</div>
                        <div className="flex-1">
                          <div className="text-[12px] font-semibold text-text0">{mw.name}</div>
                          <div className="text-[10px] text-text2">{mw.description}</div>
                        </div>
                        <button 
                          onClick={() => setMiddleware(prev => prev.map(m => m.id === mw.id ? { ...m, enabled: !m.enabled } : m))}
                          className={cn(
                            "w-8 h-4.5 rounded-full border border-border2 relative transition-all cursor-pointer",
                            mw.enabled ? "bg-amber border-amber" : "bg-bg4"
                          )}
                        >
                          <div className={cn(
                            "absolute top-0.5 w-3 h-3 rounded-full transition-all",
                            mw.enabled ? "left-4 bg-bg0" : "left-0.5 bg-text2"
                          )} />
                        </button>
                      </div>
                      <div className="p-3 space-y-2">
                        {Object.entries(mw.config).map(([key, val]) => (
                          <div key={key} className="flex items-center gap-2">
                            <span className="text-[10px] text-text2 w-20 shrink-0 capitalize">{key}</span>
                            <input 
                              className="flex-1 bg-bg3 border border-border2 text-text0 px-2 py-1 rounded text-[10px] outline-none focus:border-amber" 
                              value={val as string}
                              onChange={(e) => {
                                setMiddleware(prev => prev.map(m => {
                                  if (m.id === mw.id) {
                                    return { ...m, config: { ...m.config, [key]: e.target.value } };
                                  }
                                  return m;
                                }));
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* --- Logger --- */}
          <AnimatePresence mode="wait">
            {activeView === 'logger' && (
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col"
              >
                <div className="flex items-center gap-2 p-2 bg-bg1 border-b border-border shrink-0">
                  <div className="flex items-center gap-2 bg-bg3 border border-border2 rounded px-2 py-1 flex-1">
                    <Search size={12} className="text-text2" />
                    <input className="bg-transparent border-none outline-none text-[10px] text-text0 w-full" placeholder="Filter by path, status, method..." />
                  </div>
                  <div className="flex gap-1">
                    <button className="px-2 py-1 text-[9px] font-bold rounded bg-cyan/10 text-cyan border border-cyan/20">GET</button>
                    <button className="px-2 py-1 text-[9px] font-bold rounded bg-green/10 text-green border border-green/20">POST</button>
                  </div>
                  <div className="flex-1" />
                  <Button onClick={() => setLogs([])}>⊘ Clear</Button>
                  <Button>⬇ Export HAR</Button>
                </div>

                {/* Monitoring Charts */}
                <div className="grid grid-cols-2 gap-4 p-4 border-b border-border bg-bg1 h-48">
                  <div className="bg-bg2 border border-border rounded-lg p-3 flex flex-col">
                    <div className="text-[9px] font-bold text-text2 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                      <Activity size={10} /> Response Times (ms)
                    </div>
                    <div className="flex-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={logs.slice(-20)}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e2530" vertical={false} />
                          <XAxis dataKey="time" hide />
                          <YAxis hide domain={[0, 'auto']} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#14171c', border: '1px solid #1e2530', fontSize: '10px' }}
                            itemStyle={{ color: '#f59e0b' }}
                          />
                          <Line type="monotone" dataKey="duration" stroke="#f59e0b" strokeWidth={2} dot={false} animationDuration={300} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="bg-bg2 border border-border rounded-lg p-3 flex flex-col">
                    <div className="text-[9px] font-bold text-text2 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                      <BarChart3 size={10} /> Method Distribution
                    </div>
                    <div className="flex-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={[
                          { name: 'GET', count: logs.filter(l => l.method === 'GET').length },
                          { name: 'POST', count: logs.filter(l => l.method === 'POST').length },
                          { name: 'PUT', count: logs.filter(l => l.method === 'PUT').length },
                          { name: 'DEL', count: logs.filter(l => l.method === 'DELETE').length },
                        ]}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e2530" vertical={false} />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 8, fill: '#4a5568' }} />
                          <YAxis hide />
                          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                            { [0, 1, 2, 3].map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={['#22d3ee', '#4ade80', '#f59e0b', '#f87171'][index]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-[80px_48px_1fr_60px_60px_80px] px-3 py-1.5 border-b border-border text-[9px] text-text2 uppercase tracking-wider">
                  <span>Time</span>
                  <span>Method</span>
                  <span>Path</span>
                  <span className="text-right">Status</span>
                  <span className="text-right">Duration</span>
                  <span className="text-right">Size</span>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {logs.slice().reverse().map(log => (
                    <div key={log.id} className="grid grid-cols-[80px_48px_1fr_60px_60px_80px] px-3 py-1.5 border-b border-border text-[10px] hover:bg-bg2 cursor-pointer transition-all">
                      <span className="text-text2">{new Date(log.time).toLocaleTimeString()}</span>
                      <span><Badge method={log.method}>{log.method}</Badge></span>
                      <span className="text-text1 truncate">{log.path}</span>
                      <span className={cn("text-right font-bold", log.status < 300 ? "text-green" : "text-red")}>{log.status}</span>
                      <span className="text-right text-text2">{log.duration}ms</span>
                      <span className="text-right text-text2">{log.size}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* --- API Client --- */}
          <AnimatePresence mode="wait">
            {activeView === 'client' && (
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col bg-bg0"
              >
                {/* Request Builder */}
                <div className="p-4 border-b border-border space-y-4 bg-bg1">
                  <div className="flex gap-2">
                    <input 
                      className="bg-transparent border-none outline-none text-[12px] font-bold text-text0 w-48"
                      value={activeRequest.name}
                      onChange={(e) => setActiveRequest({ ...activeRequest, name: e.target.value })}
                      placeholder="Request Name"
                    />
                    <div className="flex-1" />
                    <div className="flex items-center gap-3 px-3 bg-bg3 border border-border2 rounded-md h-8">
                      <span className="text-[9px] text-text2 uppercase">Latency</span>
                      <input 
                        type="range" min="0" max="5000" step="100" 
                        value={requestLatency} 
                        onChange={(e) => setRequestLatency(parseInt(e.target.value))}
                        className="w-24 accent-amber"
                      />
                      <span className="text-[10px] text-amber font-mono w-10">{requestLatency}ms</span>
                    </div>
                    <Button onClick={saveClientRequest}>Save</Button>
                  </div>
                  <div className="flex gap-2">
                    <select 
                      value={activeRequest.method}
                      onChange={(e) => setActiveRequest({ ...activeRequest, method: e.target.value as any })}
                      className="bg-bg3 border border-border2 text-text0 px-3 py-2 rounded-md text-[11px] font-bold outline-none cursor-pointer w-24"
                    >
                      <option>GET</option>
                      <option>POST</option>
                      <option>PUT</option>
                      <option>DELETE</option>
                      <option>PATCH</option>
                    </select>
                    <input 
                      className="flex-1 bg-bg3 border border-border2 text-text0 px-3 py-2 rounded-md text-[11px] outline-none focus:border-amber" 
                      placeholder="https://api.example.com/v1/resource or {{base_url}}/todos"
                      value={activeRequest.url}
                      onChange={(e) => setActiveRequest({ ...activeRequest, url: e.target.value })}
                    />
                    <Button 
                      variant="primary" 
                      className="px-6" 
                      onClick={sendClientRequest}
                      disabled={isRequesting}
                    >
                      {isRequesting ? 'Sending...' : 'Send'}
                    </Button>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="text-[9px] font-bold text-text2 uppercase tracking-widest">Headers</div>
                      <div className="space-y-1">
                        {activeRequest.headers.map((h, i) => (
                          <div key={i} className="flex gap-1">
                            <input 
                              type="checkbox" checked={h.enabled} 
                              onChange={(e) => {
                                const newHeaders = [...activeRequest.headers];
                                newHeaders[i].enabled = e.target.checked;
                                setActiveRequest({ ...activeRequest, headers: newHeaders });
                              }}
                              className="accent-amber"
                            />
                            <input 
                              className="flex-1 bg-bg3 border border-border2 text-text0 px-2 py-1 rounded text-[10px] outline-none" 
                              placeholder="Key" value={h.key}
                              onChange={(e) => {
                                const newHeaders = [...activeRequest.headers];
                                newHeaders[i].key = e.target.value;
                                setActiveRequest({ ...activeRequest, headers: newHeaders });
                              }}
                            />
                            <input 
                              className="flex-1 bg-bg3 border border-border2 text-text0 px-2 py-1 rounded text-[10px] outline-none" 
                              placeholder="Value" value={h.value}
                              onChange={(e) => {
                                const newHeaders = [...activeRequest.headers];
                                newHeaders[i].value = e.target.value;
                                setActiveRequest({ ...activeRequest, headers: newHeaders });
                              }}
                            />
                            <button 
                              className="text-text3 hover:text-red p-1"
                              onClick={() => {
                                const newHeaders = activeRequest.headers.filter((_, idx) => idx !== i);
                                setActiveRequest({ ...activeRequest, headers: newHeaders });
                              }}
                            >
                              <Minus size={12} />
                            </button>
                          </div>
                        ))}
                        <button 
                          className="text-[10px] text-amber hover:underline flex items-center gap-1"
                          onClick={() => setActiveRequest({ ...activeRequest, headers: [...activeRequest.headers, { key: '', value: '', enabled: true }] })}
                        >
                          <Plus size={10} /> Add Header
                        </button>
                      </div>
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-[9px] font-bold text-text2 uppercase tracking-widest">Body (JSON)</div>
                        <button 
                          className="text-[9px] text-amber hover:underline"
                          onClick={() => {
                            try {
                              const formatted = JSON.stringify(JSON.parse(activeRequest.body), null, 2);
                              setActiveRequest({ ...activeRequest, body: formatted });
                            } catch (e) {}
                          }}
                        >
                          Format JSON
                        </button>
                      </div>
                      <textarea 
                        className="w-full h-24 bg-bg3 border border-border2 text-text0 p-2 rounded text-[10px] font-mono outline-none focus:border-amber resize-none"
                        placeholder='{ "key": "value" }'
                        value={activeRequest.body}
                        onChange={(e) => setActiveRequest({ ...activeRequest, body: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Response Viewer */}
                <div className="flex-1 flex flex-col overflow-hidden">
                  {lastResponse ? (
                    <>
                      <div className="px-4 py-2 bg-bg2 border-b border-border flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] text-text2 uppercase">Status:</span>
                          <span className={cn(
                            "text-[10px] font-bold",
                            lastResponse.status < 300 ? "text-green" : "text-red"
                          )}>{lastResponse.status} {lastResponse.statusText}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] text-text2 uppercase">Time:</span>
                          <span className="text-[10px] text-amber font-bold">{lastResponse.duration}ms</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] text-text2 uppercase">Size:</span>
                          <span className="text-[10px] text-cyan font-bold">{lastResponse.size}</span>
                        </div>
                      </div>
                      <div className="flex-1 overflow-y-auto p-4 bg-bg0">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-[9px] font-bold text-text2 uppercase tracking-widest">Response Body</div>
                          <button 
                            className="text-[9px] text-amber hover:underline"
                            onClick={() => {
                              navigator.clipboard.writeText(JSON.stringify(lastResponse.data, null, 2));
                            }}
                          >
                            Copy to Clipboard
                          </button>
                        </div>
                        <pre className="text-[11px] text-text1 font-mono leading-relaxed whitespace-pre-wrap">
                          {JSON.stringify(lastResponse.data, null, 2)}
                        </pre>
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-text2 opacity-20 gap-4">
                      <Globe size={64} />
                      <span className="text-[14px] font-sans font-bold tracking-widest uppercase">Ready to send request</span>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* --- Secrets Vault --- */}
          <AnimatePresence mode="wait">
            {activeView === 'vault' && (
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col bg-bg0 p-6"
              >
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-sans font-bold text-text0 flex items-center gap-3">
                      <Shield className="text-red" /> Secrets Vault
                    </h2>
                    <p className="text-[11px] text-text2 mt-1">Store sensitive keys and tokens securely. Use them in requests via <code className="text-amber">{"{{vault.KEY}}"}</code></p>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => setIsVaultLocked(!isVaultLocked)}>
                      {isVaultLocked ? <><Lock size={14} /> Unlock Vault</> : <><Eye size={14} /> Lock Vault</>}
                    </Button>
                    <Button variant="primary" onClick={() => {
                      const key = prompt('Secret Key:');
                      const value = prompt('Secret Value:');
                      if (key && value) setVault([...vault, { id: Date.now().toString(), key, value, isEncrypted: true }]);
                    }}>+ Add Secret</Button>
                  </div>
                </div>

                <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
                  {vault.map(secret => (
                    <div key={secret.id} className="bg-bg2 border border-border rounded-xl p-4 space-y-3 relative group">
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] font-bold text-amber">{secret.key}</span>
                        <button className="text-text3 hover:text-red transition-all opacity-0 group-hover:opacity-100" onClick={() => setVault(vault.filter(s => s.id !== secret.id))}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className="bg-bg3 border border-border2 rounded-lg p-2.5 flex items-center justify-between">
                        <span className="text-[11px] font-mono text-text1 truncate flex-1">
                          {isVaultLocked ? '••••••••••••••••••••••••' : secret.value}
                        </span>
                        <button className="text-text2 hover:text-text0 ml-2" onClick={() => {
                          if (!isVaultLocked) navigator.clipboard.writeText(secret.value);
                        }}>
                          <Download size={12} />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 text-[9px] text-text2 uppercase tracking-widest">
                        <Shield size={10} className="text-green" /> AES-256 Encrypted
                      </div>
                    </div>
                  ))}
                  {vault.length === 0 && (
                    <div className="col-span-full h-48 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center text-text3 gap-2">
                      <Lock size={32} />
                      <span className="text-[11px]">No secrets stored in the vault</span>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* --- Proxy Interceptor --- */}
          <AnimatePresence mode="wait">
            {activeView === 'proxies' && (
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col bg-bg0 p-6"
              >
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-sans font-bold text-text0 flex items-center gap-3">
                      <Server className="text-orange-400" /> Proxy Interceptor
                    </h2>
                    <p className="text-[11px] text-text2 mt-1">Sit between your frontend and backend. Catch payloads, headers, and simulate latency.</p>
                  </div>
                  <Button variant="primary" onClick={() => {
                    const prefix = prompt('Proxy Prefix (e.g. v1):');
                    const target = prompt('Target URL (e.g. https://api.example.com):');
                    if (prefix && target) setProxies([...proxies, { id: Date.now().toString(), prefix, target, enabled: true, latency: 0 }]);
                  }}>+ New Proxy Route</Button>
                </div>

                <div className="space-y-3">
                  {proxies.map(proxy => (
                    <div key={proxy.id} className={cn(
                      "bg-bg2 border border-border rounded-xl p-4 flex items-center gap-6 transition-all",
                      proxy.enabled ? "border-orange-400/30" : "opacity-60"
                    )}>
                      <div className="w-12 h-12 rounded-xl bg-orange-400/10 text-orange-400 flex items-center justify-center">
                        <ArrowRightLeft size={24} />
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-3">
                          <span className="text-[13px] font-bold text-text0">/p/{proxy.prefix}/*</span>
                          <span className="text-text2">→</span>
                          <span className="text-[11px] font-mono text-text1">{proxy.target}/*</span>
                        </div>
                        <div className="text-[10px] text-text2">
                          Access via: <code className="text-amber">{window.location.origin}/p/{proxy.prefix}/...</code>
                        </div>
                      </div>
                      <div className="w-48 space-y-1">
                        <div className="flex justify-between text-[9px] text-text2 uppercase font-bold">
                          <span>Latency</span>
                          <span className="text-amber">{proxy.latency}ms</span>
                        </div>
                        <input 
                          type="range" min="0" max="5000" step="100" 
                          value={proxy.latency} 
                          onChange={(e) => setProxies(proxies.map(p => p.id === proxy.id ? { ...p, latency: parseInt(e.target.value) } : p))}
                          className="w-full accent-orange-400"
                        />
                      </div>
                      <div className="flex items-center gap-4">
                        <button 
                          onClick={() => setProxies(proxies.map(p => p.id === proxy.id ? { ...p, enabled: !p.enabled } : p))}
                          className={cn(
                            "w-10 h-5 rounded-full border border-border2 relative transition-all cursor-pointer",
                            proxy.enabled ? "bg-orange-400 border-orange-400" : "bg-bg4"
                          )}
                        >
                          <div className={cn(
                            "absolute top-0.5 w-3.5 h-3.5 rounded-full transition-all",
                            proxy.enabled ? "left-5.5 bg-bg0" : "left-0.5 bg-text2"
                          )} />
                        </button>
                        <button className="text-text3 hover:text-red transition-all" onClick={() => setProxies(proxies.filter(p => p.id !== proxy.id))}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {proxies.length === 0 && (
                    <div className="h-48 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center text-text3 gap-2">
                      <Server size={32} />
                      <span className="text-[11px]">No proxy routes defined</span>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* --- Flow Visualizer Widget --- */}
      <AnimatePresence>
        {showVisualizer && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-10 right-6 bg-bg2 border border-border rounded-xl shadow-2xl p-3 z-[100] w-64 overflow-hidden"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="text-[9px] font-bold text-text2 uppercase tracking-widest flex items-center gap-1.5">
                <Activity size={10} className="text-green" /> Flow Visualizer
              </div>
              <button onClick={() => setShowVisualizer(false)} className="text-text2 hover:text-text0"><X size={12} /></button>
            </div>
            <div className="flex items-center justify-between relative px-2 py-4">
              <div className="flex flex-col items-center gap-1 z-10">
                <div className="w-8 h-8 rounded-lg bg-bg3 border border-border2 flex items-center justify-center text-text1">
                  <Globe size={14} />
                </div>
                <span className="text-[8px] text-text2 uppercase font-bold">Client</span>
              </div>
              
              <div className="flex-1 h-[1px] bg-border relative mx-2">
                {activeFlow && (
                  <motion.div 
                    initial={{ left: activeFlow.from === 'Client' ? '0%' : '100%' }}
                    animate={{ left: activeFlow.to === 'Bator' || activeFlow.to === 'Server' ? '100%' : '0%' }}
                    className={cn(
                      "absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full shadow-[0_0_8px_currentColor]",
                      activeFlow.type === 'mock' ? "text-amber bg-amber" : 
                      activeFlow.type === 'proxy' ? "text-orange-400 bg-orange-400" : "text-cyan bg-cyan"
                    )}
                  />
                )}
              </div>

              <div className="flex flex-col items-center gap-1 z-10">
                <div className="w-8 h-8 rounded-lg bg-amber/10 border border-amber/30 flex items-center justify-center text-amber">
                  <Hexagon size={14} />
                </div>
                <span className="text-[8px] text-amber uppercase font-bold">Bator</span>
              </div>

              <div className="flex-1 h-[1px] bg-border relative mx-2">
                {activeFlow && (activeFlow.to === 'Server' || activeFlow.from === 'Server') && (
                   <motion.div 
                    initial={{ left: activeFlow.from === 'Bator' ? '0%' : '100%' }}
                    animate={{ left: activeFlow.to === 'Server' ? '100%' : '0%' }}
                    className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full text-orange-400 bg-orange-400 shadow-[0_0_8px_currentColor]"
                  />
                )}
              </div>

              <div className="flex flex-col items-center gap-1 z-10">
                <div className="w-8 h-8 rounded-lg bg-bg3 border border-border2 flex items-center justify-center text-text1">
                  <Server size={14} />
                </div>
                <span className="text-[8px] text-text2 uppercase font-bold">Server</span>
              </div>
            </div>
            {activeFlow && (
              <div className="text-center mt-1">
                <span className="text-[9px] text-amber font-mono animate-pulse">
                  {activeFlow.type.toUpperCase()} REQUEST...
                </span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {!showVisualizer && (
        <button 
          onClick={() => setShowVisualizer(true)}
          className="fixed bottom-10 right-6 w-10 h-10 rounded-full bg-bg2 border border-border flex items-center justify-center text-text2 hover:text-amber shadow-xl z-[100]"
        >
          <Activity size={18} />
        </button>
      )}

        </div>
      </main>

      {/* --- Statusbar --- */}
      <footer className="col-span-full bg-amber text-bg0 flex items-center px-2.5 gap-3.5 text-[9px] font-semibold tracking-wider">
        <div className="flex items-center gap-1"><Hexagon size={10} /> Bator</div>
        <div className="w-[1px] h-3 bg-black/20" />
        <div>ecommerce-api</div>
        <div className="w-[1px] h-3 bg-black/20" />
        <div className="bg-black/10 px-1.5 py-0.5 rounded">:3000</div>
        <div className="w-[1px] h-3 bg-black/20" />
        <div>PostgreSQL · Mock Mode</div>
        <div className="ml-auto flex gap-3">
          <span>{tables.length} tables</span>
          <div className="w-[1px] h-3 bg-black/20" />
          <span>{endpoints.length} routes</span>
          <div className="w-[1px] h-3 bg-black/20" />
          <span>{middleware.filter(m => m.enabled).length} middleware</span>
        </div>
      </footer>

      {/* --- Modals --- */}
      <AnimatePresence>
        {isModalOpen === 'new-table' && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: -10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -10 }}
              className="bg-bg2 border border-border2 rounded-xl w-full max-w-[420px] shadow-2xl overflow-hidden"
            >
              <div className="flex items-center p-4 border-b border-border gap-2">
                <Hexagon size={16} className="text-amber" />
                <span className="font-sans font-bold text-[14px] text-text0 flex-1">New Table</span>
                <button onClick={() => setIsModalOpen(null)} className="text-text2 hover:text-text0 transition-all"><X size={16} /></button>
              </div>
              <div className="p-4 space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-text2">Table Name</label>
                  <input 
                    id="modal-table-name" 
                    className="w-full bg-bg3 border border-border2 text-text0 px-3 py-2 rounded-md text-[11px] outline-none focus:border-amber" 
                    placeholder="e.g. users, products..." 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-text2">Database Type</label>
                  <select className="w-full bg-bg3 border border-border2 text-text0 px-3 py-2 rounded-md text-[11px] outline-none cursor-pointer">
                    <option>PostgreSQL</option><option>MySQL</option><option>MongoDB</option>
                  </select>
                </div>
              </div>
              <div className="p-4 border-t border-border flex justify-end gap-2">
                <Button onClick={() => setIsModalOpen(null)}>Cancel</Button>
                <Button variant="primary" onClick={() => {
                  const name = (document.getElementById('modal-table-name') as HTMLInputElement).value;
                  if (name) addTable(name);
                }}>Create Table</Button>
              </div>
            </motion.div>
          </div>
        )}

        {isModalOpen === 'new-field' && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: -10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -10 }}
              className="bg-bg2 border border-border2 rounded-xl w-full max-w-[420px] shadow-2xl overflow-hidden"
            >
              <div className="flex items-center p-4 border-b border-border gap-2">
                <Plus size={16} className="text-amber" />
                <span className="font-sans font-bold text-[14px] text-text0 flex-1">New Field in {selectedTable?.name}</span>
                <button onClick={() => setIsModalOpen(null)} className="text-text2 hover:text-text0 transition-all"><X size={16} /></button>
              </div>
              <div className="p-4 space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-text2">Field Name</label>
                  <input 
                    value={newFieldName}
                    onChange={(e) => setNewFieldName(e.target.value)}
                    className="w-full bg-bg3 border border-border2 text-text0 px-3 py-2 rounded-md text-[11px] outline-none focus:border-amber" 
                    placeholder="e.g. username, price..." 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-text2">Data Type</label>
                  <select 
                    value={newFieldType}
                    onChange={(e) => setNewFieldType(e.target.value)}
                    className="w-full bg-bg3 border border-border2 text-text0 px-3 py-2 rounded-md text-[11px] outline-none cursor-pointer"
                  >
                    <option>uuid</option><option>int</option><option>varchar</option><option>text</option><option>timestamp</option>
                  </select>
                </div>
              </div>
              <div className="p-4 border-t border-border flex justify-end gap-2">
                <Button onClick={() => setIsModalOpen(null)}>Cancel</Button>
                <Button variant="primary" onClick={addField}>Add Field</Button>
              </div>
            </motion.div>
          </div>
        )}

        {isModalOpen === 'new-endpoint' && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: -10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -10 }}
              className="bg-bg2 border border-border2 rounded-xl w-full max-w-[420px] shadow-2xl overflow-hidden"
            >
              <div className="flex items-center p-4 border-b border-border gap-2">
                <ArrowRightLeft size={16} className="text-cyan" />
                <span className="font-sans font-bold text-[14px] text-text0 flex-1">New Endpoint</span>
                <button onClick={() => setIsModalOpen(null)} className="text-text2 hover:text-text0 transition-all"><X size={16} /></button>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex gap-2">
                  <div className="w-24 space-y-1">
                    <label className="text-[10px] text-text2">Method</label>
                    <select 
                      value={newEndpointMethod}
                      onChange={(e) => setNewEndpointMethod(e.target.value as any)}
                      className="w-full bg-bg3 border border-border2 text-text0 px-3 py-2 rounded-md text-[11px] outline-none cursor-pointer"
                    >
                      <option>GET</option><option>POST</option><option>PUT</option><option>DELETE</option>
                    </select>
                  </div>
                  <div className="flex-1 space-y-1">
                    <label className="text-[10px] text-text2">Path</label>
                    <input 
                      value={newEndpointPath}
                      onChange={(e) => setNewEndpointPath(e.target.value)}
                      className="w-full bg-bg3 border border-border2 text-text0 px-3 py-2 rounded-md text-[11px] outline-none focus:border-amber" 
                      placeholder="/api/resource" 
                    />
                  </div>
                </div>
              </div>
              <div className="p-4 border-t border-border flex justify-end gap-2">
                <Button onClick={() => setIsModalOpen(null)}>Cancel</Button>
                <Button variant="primary" onClick={addEndpoint}>Create Endpoint</Button>
              </div>
            </motion.div>
          </div>
        )}

        {isModalOpen === 'manage-env' && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: -10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -10 }}
              className="bg-bg2 border border-border2 rounded-xl w-full max-w-[600px] shadow-2xl overflow-hidden"
            >
              <div className="flex items-center p-4 border-b border-border gap-2">
                <Globe size={16} className="text-blue-400" />
                <span className="font-sans font-bold text-[14px] text-text0 flex-1">Manage Environments</span>
                <button onClick={() => setIsModalOpen(null)} className="text-text2 hover:text-text0 transition-all"><X size={16} /></button>
              </div>
              <div className="flex h-[400px]">
                <div className="w-48 border-r border-border bg-bg1 flex flex-col">
                  <div className="flex-1 overflow-y-auto">
                    {environments.map(env => (
                      <div 
                        key={env.id}
                        onClick={() => setActiveEnvId(env.id)}
                        className={cn(
                          "px-4 py-2 text-[11px] cursor-pointer transition-all",
                          activeEnvId === env.id ? "bg-bg3 text-amber" : "text-text2 hover:bg-bg3"
                        )}
                      >
                        {env.name}
                      </div>
                    ))}
                  </div>
                  <button 
                    className="p-3 text-[10px] text-amber border-t border-border hover:bg-bg3"
                    onClick={() => {
                      const newEnv = { id: Date.now().toString(), name: 'New Env', variables: [] };
                      setEnvironments([...environments, newEnv]);
                      setActiveEnvId(newEnv.id);
                    }}
                  >
                    + Add Environment
                  </button>
                </div>
                <div className="flex-1 p-4 overflow-y-auto space-y-4">
                  {environments.find(e => e.id === activeEnvId) && (
                    <>
                      <div className="space-y-1">
                        <label className="text-[10px] text-text2">Environment Name</label>
                        <input 
                          className="w-full bg-bg3 border border-border2 text-text0 px-3 py-2 rounded-md text-[11px] outline-none focus:border-amber" 
                          value={environments.find(e => e.id === activeEnvId)?.name}
                          onChange={(e) => setEnvironments(prev => prev.map(env => env.id === activeEnvId ? { ...env, name: e.target.value } : env))}
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="text-[10px] font-bold text-text2 uppercase tracking-widest">Variables</div>
                        <div className="space-y-1">
                          {environments.find(e => e.id === activeEnvId)?.variables.map((v, i) => (
                            <div key={i} className="flex gap-1">
                              <input 
                                className="flex-1 bg-bg3 border border-border2 text-text0 px-2 py-1 rounded text-[10px] outline-none" 
                                placeholder="Key" value={v.key}
                                onChange={(e) => {
                                  setEnvironments(prev => prev.map(env => {
                                    if (env.id === activeEnvId) {
                                      const newVars = [...env.variables];
                                      newVars[i].key = e.target.value;
                                      return { ...env, variables: newVars };
                                    }
                                    return env;
                                  }));
                                }}
                              />
                              <input 
                                className="flex-1 bg-bg3 border border-border2 text-text0 px-2 py-1 rounded text-[10px] outline-none" 
                                placeholder="Value" value={v.value}
                                onChange={(e) => {
                                  setEnvironments(prev => prev.map(env => {
                                    if (env.id === activeEnvId) {
                                      const newVars = [...env.variables];
                                      newVars[i].value = e.target.value;
                                      return { ...env, variables: newVars };
                                    }
                                    return env;
                                  }));
                                }}
                              />
                              <button 
                                className="text-text3 hover:text-red p-1"
                                onClick={() => {
                                  setEnvironments(prev => prev.map(env => {
                                    if (env.id === activeEnvId) {
                                      return { ...env, variables: env.variables.filter((_, idx) => idx !== i) };
                                    }
                                    return env;
                                  }));
                                }}
                              >
                                <Minus size={12} />
                              </button>
                            </div>
                          ))}
                          <button 
                            className="text-[10px] text-amber hover:underline flex items-center gap-1"
                            onClick={() => {
                              setEnvironments(prev => prev.map(env => {
                                if (env.id === activeEnvId) {
                                  return { ...env, variables: [...env.variables, { key: '', value: '' }] };
                                }
                                return env;
                              }));
                            }}
                          >
                            <Plus size={10} /> Add Variable
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className="p-4 border-t border-border flex justify-end">
                <Button variant="primary" onClick={() => setIsModalOpen(null)}>Done</Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
