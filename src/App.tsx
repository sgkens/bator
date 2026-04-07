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

  // Sync state helpers
  const setTables = (tables: Table[]) => updateActiveWorkspace({ tables });
  const setEndpoints = (endpoints: Endpoint[]) => updateActiveWorkspace({ endpoints });
  const setMiddleware = (middleware: Middleware[]) => updateActiveWorkspace({ middleware });
  const setEnvironments = (environments: Environment[]) => updateActiveWorkspace({ environments });
  const setVault = (vault: VaultSecret[]) => updateActiveWorkspace({ vault });
  const setProxies = (proxies: ProxyRoute[]) => updateActiveWorkspace({ proxies });
  const setClientRequests = (clientRequests: ClientRequest[]) => updateActiveWorkspace({ clientRequests });

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

  const selectedEndpoint = config.endpoints.find(e => e.id === selectedEndpointId);

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
                </div>
              ))}
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
            </div>
          )}
          
          {/* ... Other side panel views ... */}
        </div>
      </aside>

      {/* --- Main Content --- */}
      <main className="flex flex-col overflow-hidden bg-bg0">
        <div className="flex-1 relative overflow-hidden">
          {activeView === 'schema' && <SchemaEditor />}
          
          {activeView === 'endpoints' && (
            <div className="flex h-full flex-col p-4">
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
            <div className="flex flex-col h-full p-4 space-y-4">
              <div className="bg-bg1 border border-border rounded-lg p-4 space-y-4">
                <div className="flex gap-2">
                  <select 
                    value={activeRequest.method}
                    onChange={(e) => setActiveRequest({ ...activeRequest, method: e.target.value as any })}
                    className="bg-bg3 border border-border2 text-text0 px-3 py-2 rounded-md text-[11px] font-bold outline-none cursor-pointer w-24"
                  >
                    <option>GET</option><option>POST</option><option>PUT</option><option>DELETE</option>
                  </select>
                  <input 
                    className="flex-1 bg-bg3 border border-border2 text-text0 px-3 py-2 rounded-md text-[11px] outline-none focus:border-amber" 
                    value={activeRequest.url}
                    onChange={(e) => setActiveRequest({ ...activeRequest, url: e.target.value })}
                  />
                  <Button variant="primary" onClick={sendClientRequest} disabled={isRequesting}>
                    {isRequesting ? 'Sending...' : 'Send'}
                  </Button>
                </div>
              </div>
              {lastResponse && (
                <div className="flex-1 bg-bg2 border border-border rounded-lg overflow-hidden flex flex-col">
                  <div className="px-4 py-2 border-b border-border bg-bg3 flex items-center gap-4 text-[10px]">
                    <span className={cn("font-bold", lastResponse.status < 300 ? "text-green" : "text-red")}>
                      {lastResponse.status} {lastResponse.statusText}
                    </span>
                    <span className="text-amber">{lastResponse.duration}ms</span>
                  </div>
                  <pre className="p-4 overflow-auto text-[11px] text-text1">
                    {JSON.stringify(lastResponse.data, null, 2)}
                  </pre>
                </div>
              )}
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
    </div>
  );
}
