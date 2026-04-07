export interface Field {
  name: string;
  type: string;
  pk?: boolean;
  fk?: string; // e.g. "users.id"
  unique?: boolean;
  nn?: boolean;
  indexed?: boolean;
  default?: string;
  faker?: string;
}

export interface Table {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  fields: Field[];
  db?: string;
}

export interface Relation {
  from: string;
  fromField: string;
  to: string;
  toField: string;
}

export interface Endpoint {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'WS';
  path: string;
  latency: number;
  tableId?: string;
  response?: any;
  tags?: string[];
}

export interface Middleware {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  icon: string;
  config: Record<string, any>;
}

export interface LogEntry {
  id: string;
  time: string;
  method: string;
  path: string;
  status: number;
  duration: number;
  size: string;
}

export interface ClientRequest {
  id: string;
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  headers: { key: string; value: string; enabled: boolean }[];
  body: string;
}

export interface ClientResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: any;
  duration: number;
  size: string;
}

export interface Environment {
  id: string;
  name: string;
  variables: { key: string; value: string }[];
}

export interface VaultSecret {
  id: string;
  key: string;
  value: string;
  isEncrypted: boolean;
}

export interface ProxyRoute {
  id: string;
  prefix: string;
  target: string;
  enabled: boolean;
  latency: number;
}

export interface Workspace {
  id: string;
  name: string;
  description: string;
  icon: string;
  config: ProjectConfig;
}

export interface CodeSnippet {
  language: 'curl' | 'javascript' | 'axios' | 'python' | 'go';
  code: string;
}

export interface ProjectConfig {
  tables: Table[];
  relations: Relation[];
  endpoints: Endpoint[];
  middleware: Middleware[];
  logs: LogEntry[];
  clientRequests: ClientRequest[];
  environments: Environment[];
  vault: VaultSecret[];
  proxies: ProxyRoute[];
}

export interface BatorApp {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  settings: {
    theme: 'light' | 'dark' | 'system';
    fontSize: number;
    showGrid: boolean;
    autoSave: boolean;
  };
}
