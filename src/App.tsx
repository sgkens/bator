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
import * as Dialog from '@radix-ui/react-dialog';
import * as Tabs from '@radix-ui/react-tabs';
import { cn } from './lib/utils';
import { Table, Field, Relation, Endpoint, Middleware, LogEntry, ProjectConfig, ClientRequest, ClientResponse, Environment, VaultSecret, ProxyRoute } from './types';
import { useWorkspaces } from './lib/WorkspaceManager';
import { SchemaEditor } from './lib/SchemaEditor';
import { generateCode } from './lib/codegen';

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
  const { activeWorkspace, updateActiveWorkspace, workspaces, setActiveWorkspace, addWorkspace } = useWorkspaces();
  const [activeView, setActiveView] = useState<'schema' | 'endpoints' | 'middleware' | 'logger' | 'client' | 'vault' | 'proxies'>('schema');
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [selectedEndpointId, setSelectedEndpointId] = useState<string | null>(null);
  const [codeLanguage, setCodeLanguage] = useState<'curl' | 'javascript' | 'axios' | 'python'>('curl');
  
  const { config } = activeWorkspace;
  const [logs, setLogs] = useState<LogEntry[]>([]);
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
  const [activeEnvId, setActiveEnvId] = useState<string>('default');
  const [isVaultLocked, setIsVaultLocked] = useState(true);
  const [showVisualizer, setShowVisualizer] = useState(true);
  const [activeFlow, setActiveFlow] = useState<{ from: string, to: string, type: 'mock' | 'proxy' | 'client' } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<string | null>(null);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState('varchar');
  const [newEndpointPath, setNewEndpointPath] = useState('');
  const [newEndpointMethod, setNewEndpointMethod] = useState<'GET' | 'POST' | 'PUT' | 'DELETE'>('GET');

  // Sync state helpers
  const setTables = (tables: Table[]) => updateActiveWorkspace({ tables });
  const setEndpoints = (endpoints: Endpoint[]) => updateActiveWorkspace({ endpoints });
  const setMiddleware = (middleware: Middleware[]) => updateActiveWorkspace({ middleware });
  const setEnvironments = (environments: Environment[]) => updateActiveWorkspace({ environments });
  const setVault = (vault: VaultSecret[]) => updateActiveWorkspace({ vault });
  const setProxies = (proxies: ProxyRoute[]) => updateActiveWorkspace({ proxies });
  const setClientRequests = (clientRequests: ClientRequest[]) => updateActiveWorkspace({ clientRequests });

  // Sync with backend
  useEffect(() => {
    const syncConfig = async () => {
      try {
        await fetch('/api/bator/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config)
        });
      } catch (e) {
        console.error("Failed to sync config", e);
      }
    };
    syncConfig();
  }, [config]);

  // Sync with backend (Global effect for logs or server sync if needed)
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/bator/logs');
        const data = await res.json();
        setLogs(data);
      } catch (e) {}
    }, 2000);
    return () => clearInterval(interval);
  }, []);

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
    setTables([...config.tables, newTable]);
    setIsModalOpen(null);
  };

  const updateTable = (id: string, updates: Partial<Table>) => {
    setTables(config.tables.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const addField = () => {
    if (!selectedTableId || !newFieldName) return;
    setTables(config.tables.map(t => {
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

  const updateField = (tableId: string, fieldName: string, updates: Partial<Field>) => {
    setTables(config.tables.map(t => {
      if (t.id === tableId) {
        return {
          ...t,
          fields: t.fields.map(f => f.name === fieldName ? { ...f, ...updates } : f)
        };
      }
      return t;
    }));
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
    setEndpoints([...config.endpoints, newEp]);
    setNewEndpointPath('');
    setIsModalOpen(null);
  };

  const selectedTable = config.tables.find(t => t.id === selectedTableId);
  const [isGenerating, setIsGenerating] = useState(false);

  const generateWithAI = async () => {
    const prompt = window.prompt("Describe the schema or API you want to generate (e.g., 'A blog system with users, posts, and comments'):");
    if (!prompt) return;

    setIsGenerating(true);
    try {
      console.log("Generating with prompt:", prompt);
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      if (prompt.toLowerCase().includes('blog')) {
        const aiTables: Table[] = [
          { id: 'users', name: 'Users', color: '#f59e0b', x: 50, y: 50, fields: [{ name: 'id', type: 'uuid', pk: true, faker: 'string.uuid' }, { name: 'username', type: 'varchar', faker: 'internet.userName' }] },
          { id: 'posts', name: 'Posts', color: '#22d3ee', x: 300, y: 50, fields: [{ name: 'id', type: 'uuid', pk: true, faker: 'string.uuid' }, { name: 'title', type: 'varchar', faker: 'lorem.sentence' }, { name: 'content', type: 'text', faker: 'lorem.paragraphs' }] }
        ];
        setTables([...config.tables, ...aiTables]);
      } else {
        alert("AI Model: Try a prompt like 'blog system'. Full integration requires API key.");
      }
    } catch (e) {
      console.error("AI Generation failed", e);
    } finally {
      setIsGenerating(false);
    }
  };

  const sendClientRequest = async () => {
    setIsRequesting(true);
    setActiveFlow({ from: 'Client', to: 'Bator', type: 'client' });
    try {
      const env = config.environments.find(e => e.id === activeEnvId);
      const vars = env?.variables || [];
      
      const replaceVars = (str: string) => {
        let result = str;
        vars.forEach(v => {
          result = result.replace(new RegExp(`{{${v.key}}}`, 'g'), v.value);
        });
        if (!isVaultLocked) {
          config.vault.forEach(v => {
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
      
      if (!config.clientRequests.find(r => r.id === activeRequest.id)) {
        setClientRequests([{ ...activeRequest, id: Date.now().toString() }, ...config.clientRequests].slice(0, 20));
      }
    } catch (e) {
      console.error("Request failed", e);
    } finally {
      setIsRequesting(false);
      setTimeout(() => setActiveFlow(null), 2000);
    }
  };

  return (
    <div id="app" className="grid grid-cols-[52px_240px_1fr] grid-rows-[36px_1fr_24px] h-screen bg-bg0 text-text0 font-mono overflow-hidden">
      
      {/* --- Titlebar --- */}
      <header className="col-span-full flex items-center bg-bg1 border-b border-border px-3 gap-4 select-none">
        <div className="font-sans font-extrabold text-[15px] tracking-tight text-amber flex items-center gap-1.5">
          <div className="w-5 h-5 bg-amber [clip-path:polygon(50%_0%,100%_38%,82%_100%,18%_100%,0%_38%)]" />
          Bator
          <span className="font-mono text-[9px] text-text2 font-normal bg-bg3 px-1 rounded border border-border2">v0.2.0</span>
        </div>
        <div className="ml-2 flex items-center gap-1.5 text-[11px] text-text2">
          <select 
            value={activeWorkspace.id} 
            onChange={(e) => setActiveWorkspace(e.target.value)}
            className="bg-bg3 border border-border2 text-amber px-2 py-0.5 rounded text-[10px] outline-none cursor-pointer"
          >
            {workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-[10px] text-green">
            <div className="w-1.5 h-1.5 rounded-full bg-green shadow-[0_0_6px_var(--color-green)] animate-pulse" />
            Server :3000
          </div>
          <Button onClick={generateWithAI} disabled={isGenerating}>
            <Zap size={12} className={cn(isGenerating && "animate-spin")} /> {isGenerating ? 'Generating...' : 'AI Generate'}
          </Button>
          <Button onClick={() => addWorkspace('New Project')}>+ Workspace</Button>
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
      </nav>

      {/* --- Side Panel --- */}
      <aside className="bg-bg1 border-r border-border flex flex-col overflow-hidden">
        <div className="p-2.5 pb-2 text-[9px] font-semibold tracking-widest uppercase text-text2 border-b border-border flex items-center justify-between">
          <span>{activeView.charAt(0).toUpperCase() + activeView.slice(1)}</span>
          <div className="flex gap-1">
            <button 
              className="w-4.5 h-4.5 flex items-center justify-center rounded hover:bg-amber/15 hover:text-amber transition-all cursor-pointer" 
              onClick={() => setIsModalOpen(activeView === 'endpoints' ? 'new-endpoint' : 'new-table')}
            >
              <Plus size={12} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {activeView === 'schema' && (
            <div className="p-2 space-y-1">
              {config.tables.map(table => (
                <div 
                  key={table.id} 
                  onClick={() => setSelectedTableId(table.id)}
                  className={cn(
                    "px-3 py-1.5 text-[11px] cursor-pointer flex items-center gap-2 transition-all rounded hover:bg-bg3",
                    selectedTableId === table.id ? "bg-bg4 text-amber" : "text-text1"
                  )}
                >
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: table.color }} />
                  {table.name}
                  <span className="ml-auto text-[9px] bg-bg4 text-text2 px-1 rounded">{table.fields.length}</span>
                </div>
              ))}
              <button 
                onClick={() => setIsModalOpen('new-table')}
                className="w-full mt-2 px-3 py-1.5 text-[10px] text-text2 hover:text-amber flex items-center gap-2 border border-dashed border-border rounded transition-all"
              >
                <Plus size={12} /> Add Table
              </button>
            </div>
          )}

          {activeView === 'endpoints' && (
            <div className="p-2 space-y-1">
              {config.endpoints.map(ep => (
                <div 
                  key={ep.id}
                  onClick={() => setSelectedEndpointId(ep.id)}
                  className={cn(
                    "px-3 py-1.5 text-[11px] cursor-pointer flex items-center gap-2 transition-all rounded hover:bg-bg3",
                    selectedEndpointId === ep.id ? "bg-bg3 border-l-2 border-amber" : ""
                  )}
                >
                  <Badge method={ep.method}>{ep.method}</Badge>
                  <span className="truncate text-text1">{ep.path}</span>
                </div>
              ))}
              <button 
                onClick={() => setIsModalOpen('new-endpoint')}
                className="w-full mt-2 px-3 py-1.5 text-[10px] text-text2 hover:text-amber flex items-center gap-2 border border-dashed border-border rounded transition-all"
              >
                <Plus size={12} /> Add Endpoint
              </button>
            </div>
          )}

          {activeView === 'client' && (
            <div className="p-2 space-y-4">
              <div className="space-y-1">
                <div className="px-2 text-[9px] font-bold text-text2 uppercase tracking-widest">Environment</div>
                <select 
                  value={activeEnvId} 
                  onChange={(e) => setActiveEnvId(e.target.value)}
                  className="w-full bg-bg3 border border-border2 text-text0 px-2 py-1 rounded text-[10px] outline-none cursor-pointer"
                >
                  {config.environments.map(env => <option key={env.id} value={env.id}>{env.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <div className="px-2 text-[9px] font-bold text-text2 uppercase tracking-widest">Collection</div>
                {config.clientRequests.map(req => (
                  <div 
                    key={req.id}
                    onClick={() => setActiveRequest(req)}
                    className={cn(
                      "px-3 py-1.5 text-[10px] cursor-pointer flex items-center gap-2 transition-all group rounded hover:bg-bg3",
                      activeRequest.id === req.id ? "bg-bg3 text-amber border-l-2 border-amber" : "text-text2"
                    )}
                  >
                    <Badge method={req.method} className="w-8 text-center">{req.method}</Badge>
                    <span className="truncate flex-1">{req.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeView === 'logger' && (
            <div className="p-2 space-y-1">
              <div className="text-[9px] font-bold text-text2 uppercase tracking-widest px-1 mb-1">Recent Activity</div>
              {logs.slice(-15).reverse().map(log => (
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
                {config.vault.map(s => (
                  <div key={s.id} className="p-2 bg-bg3 border border-border2 rounded text-[10px] flex flex-col gap-1">
                    <span className="text-amber font-bold">{s.key}</span>
                    <span className="text-text2 font-mono truncate">{isVaultLocked ? '••••••••' : s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeView === 'proxies' && (
            <div className="p-2 space-y-2">
              <div className="text-[9px] font-bold text-text2 uppercase tracking-widest px-1">Active Proxies</div>
              <div className="space-y-1">
                {config.proxies.map(p => (
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
            </div>
          ))}
        </div>

        <div className="flex-1 relative overflow-hidden flex">
          {activeView === 'schema' && (
            <>
              <div className="flex-1">
                <SchemaEditor />
              </div>
              
              {/* Properties Panel */}
              <div className="w-64 bg-bg1 border-l border-border flex flex-col overflow-y-auto">
                <div className="p-2.5 text-[9px] font-semibold tracking-widest uppercase text-text2 border-b border-border">Properties</div>
                
                {selectedTable ? (
                  <div className="p-3 space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] text-text2 uppercase tracking-wider">Table Name</label>
                      <input 
                        className="w-full bg-bg3 border border-border2 text-text0 px-2 py-1 rounded text-[11px] outline-none focus:border-amber" 
                        value={selectedTable.name}
                        onChange={(e) => updateTable(selectedTable.id, { name: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] text-text2 uppercase tracking-wider">Fields</label>
                        <button onClick={() => setIsModalOpen('new-field')} className="text-amber hover:text-amber2 transition-all"><Plus size={12} /></button>
                      </div>
                      <div className="space-y-1">
                        {selectedTable.fields.map(field => (
                          <div key={field.name} className="bg-bg2 border border-border2 rounded p-2 space-y-2 group">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-text1">{field.name}</span>
                              <Badge className="text-[8px]">{field.type}</Badge>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[8px] text-text3 uppercase">Seeder</label>
                              <input 
                                className="w-full bg-bg3 border border-border2 text-text0 px-1.5 py-0.5 rounded text-[10px] outline-none" 
                                value={field.faker || ''}
                                placeholder="e.g. person.fullName"
                                onChange={(e) => updateField(selectedTable.id, field.name, { faker: e.target.value })}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Button variant="danger" className="w-full justify-center mt-4" onClick={() => setTables(config.tables.filter(t => t.id !== selectedTable.id))}>
                      <Trash2 size={12} /> Delete Table
                    </Button>
                  </div>
                ) : (
                  <div className="p-8 text-center text-text3 text-[10px] italic">
                    Select a table to edit properties
                  </div>
                )}
              </div>
            </>
          )}
          
          {activeView === 'endpoints' && (
            <div className="flex h-full flex-col p-4 w-full">
              {selectedEndpoint ? (
                <Tabs.Root defaultValue="config" className="flex flex-col h-full">
                  <Tabs.List className="flex border-b border-border mb-4">
                    <Tabs.Trigger value="config" className="px-4 py-2 text-[11px] data-[state=active]:text-amber data-[state=active]:border-b-2 data-[state=active]:border-amber">Configuration</Tabs.Trigger>
                    <Tabs.Trigger value="code" className="px-4 py-2 text-[11px] data-[state=active]:text-amber data-[state=active]:border-b-2 data-[state=active]:border-amber">Code Generation</Tabs.Trigger>
                  </Tabs.List>

                  <Tabs.Content value="config" className="space-y-4">
                    <div className="bg-bg2 border border-border rounded-lg p-4 space-y-4">
                      <div className="flex items-center gap-2 bg-bg3 border border-border2 rounded-md p-2">
                        <Badge method={selectedEndpoint.method}>{selectedEndpoint.method}</Badge>
                        <input 
                          className="flex-1 bg-transparent border-none outline-none text-[11px] text-text0 font-mono" 
                          value={selectedEndpoint.path}
                          onChange={(e) => setEndpoints(config.endpoints.map(ep => ep.id === selectedEndpoint.id ? { ...ep, path: e.target.value } : ep))}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-text2">Latency Simulation (ms)</label>
                        <div className="flex items-center gap-3">
                          <input 
                            type="range" min="0" max="2000" step="10"
                            className="flex-1 accent-amber"
                            value={selectedEndpoint.latency}
                            onChange={(e) => setEndpoints(config.endpoints.map(ep => ep.id === selectedEndpoint.id ? { ...ep, latency: parseInt(e.target.value) } : ep))}
                          />
                          <span className="text-[10px] text-amber w-10 text-right">{selectedEndpoint.latency}ms</span>
                        </div>
                      </div>
                    </div>
                  </Tabs.Content>

                  <Tabs.Content value="code" className="flex flex-col flex-1">
                    <div className="flex gap-2 mb-3">
                      {(['curl', 'javascript', 'axios', 'python'] as const).map(lang => (
                        <button 
                          key={lang}
                          onClick={() => setCodeLanguage(lang)}
                          className={cn(
                            "px-2 py-1 text-[9px] rounded uppercase font-bold border",
                            codeLanguage === lang ? "bg-amber/10 text-amber border-amber/30" : "bg-bg3 text-text2 border-border2"
                          )}
                        >
                          {lang}
                        </button>
                      ))}
                    </div>
                    <div className="relative group flex-1">
                      <pre className="bg-bg2 border border-border p-4 rounded-lg text-[11px] font-mono text-cyan overflow-auto h-full">
                        {generateCode(selectedEndpoint, codeLanguage)}
                      </pre>
                      <button 
                        className="absolute top-2 right-2 bg-bg3 hover:bg-bg4 p-1.5 rounded text-text2 opacity-0 group-hover:opacity-100 transition-all"
                        onClick={() => navigator.clipboard.writeText(generateCode(selectedEndpoint, codeLanguage))}
                      >
                        <Download size={14} />
                      </button>
                    </div>
                  </Tabs.Content>
                </Tabs.Root>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-text2 opacity-30 gap-3">
                  <ArrowRightLeft size={48} />
                  <span>Select an endpoint to configure</span>
                </div>
              )}
            </div>
          )}

          {activeView === 'client' && (
            <div className="flex flex-col h-full bg-bg0">
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
                  <Button onClick={() => {
                    const newReq = { ...activeRequest, id: Date.now().toString(), name: activeRequest.name || `Request ${config.clientRequests.length + 1}` };
                    setClientRequests([newReq, ...config.clientRequests]);
                    setActiveRequest(newReq);
                  }}>Save</Button>
                </div>
                <div className="flex gap-2">
                  <select 
                    value={activeRequest.method}
                    onChange={(e) => setActiveRequest({ ...activeRequest, method: e.target.value as any })}
                    className="bg-bg3 border border-border2 text-text0 px-3 py-2 rounded-md text-[11px] font-bold outline-none cursor-pointer w-24"
                  >
                    <option>GET</option><option>POST</option><option>PUT</option><option>DELETE</option><option>PATCH</option>
                  </select>
                  <input 
                    className="flex-1 bg-bg3 border border-border2 text-text0 px-3 py-2 rounded-md text-[11px] outline-none focus:border-amber" 
                    placeholder="https://api.example.com/v1/resource or {{base_url}}/todos"
                    value={activeRequest.url}
                    onChange={(e) => setActiveRequest({ ...activeRequest, url: e.target.value })}
                  />
                  <Button variant="primary" className="px-6" onClick={sendClientRequest} disabled={isRequesting}>
                    {isRequesting ? 'Sending...' : 'Send'}
                  </Button>
                </div>

                <div className="flex gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="text-[9px] font-bold text-text2 uppercase tracking-widest">Headers</div>
                    <div className="space-y-1">
                      {activeRequest.headers.map((h, i) => (
                        <div key={i} className="flex gap-1">
                          <input type="checkbox" checked={h.enabled} onChange={(e) => {
                            const next = [...activeRequest.headers];
                            next[i].enabled = e.target.checked;
                            setActiveRequest({ ...activeRequest, headers: next });
                          }} className="accent-amber" />
                          <input className="flex-1 bg-bg3 border border-border2 text-text0 px-2 py-1 rounded text-[10px] outline-none" placeholder="Key" value={h.key} onChange={(e) => {
                            const next = [...activeRequest.headers];
                            next[i].key = e.target.value;
                            setActiveRequest({ ...activeRequest, headers: next });
                          }} />
                          <input className="flex-1 bg-bg3 border border-border2 text-text0 px-2 py-1 rounded text-[10px] outline-none" placeholder="Value" value={h.value} onChange={(e) => {
                            const next = [...activeRequest.headers];
                            next[i].value = e.target.value;
                            setActiveRequest({ ...activeRequest, headers: next });
                          }} />
                        </div>
                      ))}
                      <button className="text-[10px] text-amber hover:underline flex items-center gap-1" onClick={() => setActiveRequest({ ...activeRequest, headers: [...activeRequest.headers, { key: '', value: '', enabled: true }] })}>
                        <Plus size={10} /> Add Header
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="text-[9px] font-bold text-text2 uppercase tracking-widest">Body (JSON)</div>
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
              <div className="flex-1 overflow-hidden flex flex-col">
                {lastResponse ? (
                  <>
                    <div className="px-4 py-2 border-b border-border bg-bg2 flex items-center gap-4 text-[10px]">
                      <span className={cn("font-bold", lastResponse.status < 300 ? "text-green" : "text-red")}>
                        {lastResponse.status} {lastResponse.statusText}
                      </span>
                      <span className="text-amber">{lastResponse.duration}ms</span>
                      <span className="text-cyan">{lastResponse.size}</span>
                    </div>
                    <pre className="p-4 overflow-auto text-[11px] text-text1 font-mono flex-1 bg-bg0">
                      {JSON.stringify(lastResponse.data, null, 2)}
                    </pre>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-text2 opacity-20 gap-4">
                    <Globe size={64} />
                    <span className="text-[14px] font-sans font-bold tracking-widest uppercase">Ready to send request</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeView === 'logger' && (
            <div className="flex flex-col h-full bg-bg0">
              <div className="grid grid-cols-2 gap-4 p-4 border-b border-border bg-bg1 h-48 shrink-0">
                <div className="bg-bg2 border border-border rounded-lg p-3 flex flex-col">
                  <div className="text-[9px] font-bold text-text2 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <Activity size={10} /> Latency (ms)
                  </div>
                  <div className="flex-1 min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={logs.slice(-20)}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e2530" vertical={false} />
                        <XAxis dataKey="time" hide />
                        <YAxis hide domain={[0, 'auto']} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#14171c', border: '1px solid #1e2530', fontSize: '10px' }}
                          itemStyle={{ color: '#f59e0b' }}
                        />
                        <Line type="monotone" dataKey="duration" stroke="#f59e0b" strokeWidth={2} dot={false} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="bg-bg2 border border-border rounded-lg p-3 flex flex-col">
                  <div className="text-[9px] font-bold text-text2 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <BarChart3 size={10} /> Method Distribution
                  </div>
                  <div className="flex-1 min-h-0">
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
                          { [0, 1, 2, 3].map((_, index) => (
                            <Cell key={`cell-${index}`} fill={['#22d3ee', '#4ade80', '#f59e0b', '#f87171'][index]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-[80px_48px_1fr_60px_60px_80px] px-3 py-1.5 border-b border-border text-[9px] text-text2 uppercase tracking-wider bg-bg1">
                <span>Time</span><span>Method</span><span>Path</span><span className="text-right">Status</span><span className="text-right">Dur</span><span className="text-right">Size</span>
              </div>
              <div className="flex-1 overflow-y-auto">
                {logs.slice().reverse().map(log => (
                  <div key={log.id} className="grid grid-cols-[80px_48px_1fr_60px_60px_80px] px-3 py-1.5 border-b border-border text-[10px] hover:bg-bg2 transition-all">
                    <span className="text-text2">{new Date(log.time).toLocaleTimeString()}</span>
                    <span><Badge method={log.method}>{log.method}</Badge></span>
                    <span className="text-text1 truncate">{log.path}</span>
                    <span className={cn("text-right font-bold", log.status < 300 ? "text-green" : "text-red")}>{log.status}</span>
                    <span className="text-right text-text2">{log.duration}ms</span>
                    <span className="text-right text-text2">{log.size}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeView === 'middleware' && (
            <div className="p-5 overflow-y-auto bg-bg0 grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4 h-full">
              {config.middleware.map(mw => (
                <div key={mw.id} className={cn("bg-bg2 border border-border rounded-lg overflow-hidden transition-all", mw.enabled && "border-amber")}>
                  <div className="flex items-center gap-3 p-3 border-b border-border bg-bg1">
                    <div className="w-8 h-8 rounded-lg bg-amber/10 text-amber flex items-center justify-center text-lg">{mw.icon}</div>
                    <div className="flex-1">
                      <div className="text-[12px] font-semibold text-text0">{mw.name}</div>
                      <div className="text-[10px] text-text2">{mw.description}</div>
                    </div>
                    <button onClick={() => setMiddleware(config.middleware.map(m => m.id === mw.id ? { ...m, enabled: !m.enabled } : m))} className={cn("w-8 h-4.5 rounded-full border border-border2 relative transition-all cursor-pointer", mw.enabled ? "bg-amber border-amber" : "bg-bg4")}>
                      <div className={cn("absolute top-0.5 w-3 h-3 rounded-full transition-all", mw.enabled ? "left-4 bg-bg0" : "left-0.5 bg-text2")} />
                    </button>
                  </div>
                  <div className="p-3 space-y-2">
                    {Object.entries(mw.config).map(([key, val]) => (
                      <div key={key} className="flex items-center gap-2">
                        <span className="text-[10px] text-text2 w-20 shrink-0 capitalize">{key}</span>
                        <input className="flex-1 bg-bg3 border border-border2 text-text0 px-2 py-1 rounded text-[10px] outline-none" value={val as string} onChange={(e) => {
                          setMiddleware(config.middleware.map(m => m.id === mw.id ? { ...m, config: { ...m.config, [key]: e.target.value } } : m));
                        }} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeView === 'vault' && (
            <div className="p-6 overflow-y-auto bg-bg0 h-full space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-text0 flex items-center gap-3"><Shield className="text-red" /> Secrets Vault</h2>
                  <p className="text-[11px] text-text2 mt-1">Use secrets in requests via <code className="text-amber">{"{{vault.KEY}}"}</code></p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => setIsVaultLocked(!isVaultLocked)}>{isVaultLocked ? <><Lock size={14} /> Unlock</> : <><Eye size={14} /> Lock</>}</Button>
                  <Button variant="primary" onClick={() => {
                    const key = prompt('Secret Key:');
                    const value = prompt('Secret Value:');
                    if (key && value) setVault([...config.vault, { id: Date.now().toString(), key, value, isEncrypted: true }]);
                  }}>+ Add Secret</Button>
                </div>
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
                {config.vault.map(secret => (
                  <div key={secret.id} className="bg-bg2 border border-border rounded-xl p-4 space-y-3 relative group">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-bold text-amber">{secret.key}</span>
                      <button className="text-text3 hover:text-red transition-all" onClick={() => setVault(config.vault.filter(s => s.id !== secret.id))}><Trash2 size={14} /></button>
                    </div>
                    <div className="bg-bg3 border border-border2 rounded-lg p-2.5 flex items-center justify-between">
                      <span className="text-[11px] font-mono text-text1 truncate flex-1">{isVaultLocked ? '••••••••' : secret.value}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeView === 'proxies' && (
            <div className="p-6 overflow-y-auto bg-bg0 h-full space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-text0 flex items-center gap-3"><Server className="text-orange-400" /> Proxy Interceptor</h2>
                  <p className="text-[11px] text-text2 mt-1">Sit between your frontend and backend to catch payloads and simulate latency.</p>
                </div>
                <Button variant="primary" onClick={() => {
                  const prefix = prompt('Proxy Prefix (e.g. v1):');
                  const target = prompt('Target URL:');
                  if (prefix && target) setProxies([...config.proxies, { id: Date.now().toString(), prefix, target, enabled: true, latency: 0 }]);
                }}>+ New Proxy</Button>
              </div>
              <div className="space-y-3">
                {config.proxies.map(proxy => (
                  <div key={proxy.id} className={cn("bg-bg2 border border-border rounded-xl p-4 flex items-center gap-6", !proxy.enabled && "opacity-60")}>
                    <div className="w-12 h-12 rounded-xl bg-orange-400/10 text-orange-400 flex items-center justify-center"><ArrowRightLeft size={24} /></div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-3">
                        <span className="text-[13px] font-bold text-text0">/p/{proxy.prefix}/*</span>
                        <span className="text-text2">→</span>
                        <span className="text-[11px] font-mono text-text1">{proxy.target}/*</span>
                      </div>
                    </div>
                    <button onClick={() => setProxies(config.proxies.map(p => p.id === proxy.id ? { ...p, enabled: !p.enabled } : p))} className={cn("w-10 h-5 rounded-full border border-border2 relative transition-all", proxy.enabled ? "bg-orange-400" : "bg-bg4")}>
                      <div className={cn("absolute top-0.5 w-3.5 h-3.5 rounded-full transition-all", proxy.enabled ? "left-5.5 bg-bg0" : "left-0.5 bg-text2")} />
                    </button>
                    <button className="text-text3 hover:text-red transition-all" onClick={() => setProxies(config.proxies.filter(p => p.id !== proxy.id))}><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* --- Statusbar --- */}
      <footer className="col-span-full bg-amber text-bg0 flex items-center px-2.5 gap-3.5 text-[9px] font-semibold tracking-wider">
        <div className="flex items-center gap-1"><Hexagon size={10} /> Bator</div>
        <div>{activeWorkspace.name}</div>
        <div className="ml-auto flex gap-3">
          <span>{config.tables.length} tables</span>
          <span>{config.endpoints.length} routes</span>
        </div>
      </footer>

      {/* Flow Visualizer */}
      <AnimatePresence>
        {showVisualizer && (
          <motion.div className="fixed bottom-10 right-6 bg-bg2 border border-border rounded-xl shadow-2xl p-3 z-[100] w-64">
            <div className="flex items-center justify-between mb-3 text-[9px] font-bold text-text2 uppercase tracking-widest">
              <span><Activity size={10} className="text-green inline mr-1" /> Flow Visualizer</span>
              <button onClick={() => setShowVisualizer(false)}><X size={12} /></button>
            </div>
            <div className="flex items-center justify-between py-4 px-2">
              <div className="text-center"><Globe size={14} /><div className="text-[8px]">CLIENT</div></div>
              <div className="flex-1 h-[1px] bg-border mx-2" />
              <div className="text-center text-amber"><Hexagon size={14} /><div className="text-[8px]">BATOR</div></div>
              <div className="flex-1 h-[1px] bg-border mx-2" />
              <div className="text-center"><Server size={14} /><div className="text-[8px]">SERVER</div></div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Modals 
        isModalOpen={isModalOpen} 
        setIsModalOpen={setIsModalOpen}
        addTable={addTable}
        addField={addField}
        addEndpoint={addEndpoint}
        selectedTable={selectedTable}
        newFieldName={newFieldName}
        setNewFieldName={setNewFieldName}
        newFieldType={newFieldType}
        setNewFieldType={setNewFieldType}
        newEndpointPath={newEndpointPath}
        setNewEndpointPath={setNewEndpointPath}
        newEndpointMethod={newEndpointMethod}
        setNewEndpointMethod={setNewEndpointMethod}
      />
    </div>
  );
}

// --- Modals ---

const Modals = ({ isModalOpen, setIsModalOpen, addTable, addField, addEndpoint, selectedTable, newFieldName, setNewFieldName, newFieldType, setNewFieldType, newEndpointPath, setNewEndpointPath, newEndpointMethod, setNewEndpointMethod }: any) => {
  return (
    <AnimatePresence>
      {isModalOpen === 'new-table' && (
        <Dialog.Root open onOpenChange={() => setIsModalOpen(null)}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000]" />
            <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-bg2 border border-border2 rounded-xl w-full max-w-[420px] shadow-2xl overflow-hidden z-[1001]">
              <div className="flex items-center p-4 border-b border-border gap-2">
                <Hexagon size={16} className="text-amber" />
                <span className="font-sans font-bold text-[14px] text-text0 flex-1">New Table</span>
                <button onClick={() => setIsModalOpen(null)} className="text-text2 hover:text-text0 transition-all"><X size={16} /></button>
              </div>
              <div className="p-4 space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-text2 uppercase">Table Name</label>
                  <input 
                    id="modal-table-name" 
                    className="w-full bg-bg3 border border-border2 text-text0 px-3 py-2 rounded-md text-[11px] outline-none focus:border-amber" 
                    placeholder="e.g. users, products..." 
                    onKeyDown={(e) => e.key === 'Enter' && addTable((e.target as HTMLInputElement).value)}
                  />
                </div>
              </div>
              <div className="p-4 border-t border-border flex justify-end gap-2">
                <Button onClick={() => setIsModalOpen(null)}>Cancel</Button>
                <Button variant="primary" onClick={() => {
                  const name = (document.getElementById('modal-table-name') as HTMLInputElement).value;
                  if (name) addTable(name);
                }}>Create Table</Button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}

      {isModalOpen === 'new-field' && (
        <Dialog.Root open onOpenChange={() => setIsModalOpen(null)}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000]" />
            <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-bg2 border border-border2 rounded-xl w-full max-w-[420px] shadow-2xl overflow-hidden z-[1001]">
              <div className="flex items-center p-4 border-b border-border gap-2">
                <Plus size={16} className="text-amber" />
                <span className="font-sans font-bold text-[14px] text-text0 flex-1">New Field in {selectedTable?.name}</span>
                <button onClick={() => setIsModalOpen(null)} className="text-text2 hover:text-text0 transition-all"><X size={16} /></button>
              </div>
              <div className="p-4 space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-text2 uppercase">Field Name</label>
                  <input 
                    value={newFieldName}
                    onChange={(e) => setNewFieldName(e.target.value)}
                    className="w-full bg-bg3 border border-border2 text-text0 px-3 py-2 rounded-md text-[11px] outline-none focus:border-amber" 
                    placeholder="e.g. username, price..." 
                    onKeyDown={(e) => e.key === 'Enter' && addField()}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-text2 uppercase">Data Type</label>
                  <select 
                    value={newFieldType}
                    onChange={(e) => setNewFieldType(e.target.value)}
                    className="w-full bg-bg3 border border-border2 text-text0 px-3 py-2 rounded-md text-[11px] outline-none cursor-pointer"
                  >
                    <option>uuid</option><option>int</option><option>varchar</option><option>text</option><option>timestamp</option><option>boolean</option><option>decimal</option>
                  </select>
                </div>
              </div>
              <div className="p-4 border-t border-border flex justify-end gap-2">
                <Button onClick={() => setIsModalOpen(null)}>Cancel</Button>
                <Button variant="primary" onClick={addField}>Add Field</Button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}

      {isModalOpen === 'new-endpoint' && (
        <Dialog.Root open onOpenChange={() => setIsModalOpen(null)}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000]" />
            <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-bg2 border border-border2 rounded-xl w-full max-w-[420px] shadow-2xl overflow-hidden z-[1001]">
              <div className="flex items-center p-4 border-b border-border gap-2">
                <ArrowRightLeft size={16} className="text-cyan" />
                <span className="font-sans font-bold text-[14px] text-text0 flex-1">New Endpoint</span>
                <button onClick={() => setIsModalOpen(null)} className="text-text2 hover:text-text0 transition-all"><X size={16} /></button>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex gap-2">
                  <div className="w-24 space-y-1">
                    <label className="text-[10px] text-text2 uppercase">Method</label>
                    <select 
                      value={newEndpointMethod}
                      onChange={(e) => setNewEndpointMethod(e.target.value as any)}
                      className="w-full bg-bg3 border border-border2 text-text0 px-3 py-2 rounded-md text-[11px] outline-none cursor-pointer"
                    >
                      <option>GET</option><option>POST</option><option>PUT</option><option>DELETE</option>
                    </select>
                  </div>
                  <div className="flex-1 space-y-1">
                    <label className="text-[10px] text-text2 uppercase">Path</label>
                    <input 
                      value={newEndpointPath}
                      onChange={(e) => setNewEndpointPath(e.target.value)}
                      className="w-full bg-bg3 border border-border2 text-text0 px-3 py-2 rounded-md text-[11px] outline-none focus:border-amber" 
                      placeholder="/api/resource" 
                      onKeyDown={(e) => e.key === 'Enter' && addEndpoint()}
                    />
                  </div>
                </div>
              </div>
              <div className="p-4 border-t border-border flex justify-end gap-2">
                <Button onClick={() => setIsModalOpen(null)}>Cancel</Button>
                <Button variant="primary" onClick={addEndpoint}>Create Endpoint</Button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </AnimatePresence>
  );
};
