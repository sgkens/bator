import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { Workspace, BatorApp, ProjectConfig } from '../types';

interface WorkspaceContextType {
  workspaces: Workspace[];
  activeWorkspace: Workspace;
  setActiveWorkspace: (id: string) => void;
  addWorkspace: (name: string) => void;
  deleteWorkspace: (id: string) => void;
  updateActiveWorkspace: (config: Partial<ProjectConfig>) => void;
}

const defaultConfig: ProjectConfig = {
  tables: [],
  relations: [],
  endpoints: [],
  middleware: [],
  logs: [],
  clientRequests: [],
  environments: [],
  vault: [],
  proxies: []
};

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

const createDefaultWorkspace = (id: string, name: string): Workspace => ({
  id,
  name,
  description: 'Primary workspace',
  icon: 'Layout',
  config: { ...defaultConfig }
});

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [appState, setAppState] = useState<BatorApp>(() => {
    try {
      const saved = localStorage.getItem('bator_app');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.workspaces?.length && parsed.activeWorkspaceId) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to load bator_app from localStorage', e);
    }
    
    const initialId = crypto.randomUUID();
    return {
      workspaces: [createDefaultWorkspace(initialId, 'Main Project')],
      activeWorkspaceId: initialId,
      settings: {
        theme: 'dark',
        fontSize: 14,
        showGrid: true,
        autoSave: true
      }
    };
  });

  useEffect(() => {
    if (appState.settings.autoSave) {
      localStorage.setItem('bator_app', JSON.stringify(appState));
    }
  }, [appState]);

  const activeWorkspace = useMemo(() => 
    appState.workspaces.find(w => w.id === appState.activeWorkspaceId) || appState.workspaces[0],
    [appState.workspaces, appState.activeWorkspaceId]
  );

  const setActiveWorkspace = useCallback((id: string) => {
    setAppState(prev => ({ ...prev, activeWorkspaceId: id }));
  }, []);

  const addWorkspace = useCallback((name: string) => {
    const newWorkspace = createDefaultWorkspace(crypto.randomUUID(), name);
    setAppState(prev => ({
      ...prev,
      workspaces: [...prev.workspaces, newWorkspace],
      activeWorkspaceId: newWorkspace.id
    }));
  }, []);

  const deleteWorkspace = useCallback((id: string) => {
    setAppState(prev => {
      if (prev.workspaces.length <= 1) return prev;
      const nextWorkspaces = prev.workspaces.filter(w => w.id !== id);
      const nextActiveId = prev.activeWorkspaceId === id ? nextWorkspaces[0].id : prev.activeWorkspaceId;
      return {
        ...prev,
        workspaces: nextWorkspaces,
        activeWorkspaceId: nextActiveId
      };
    });
  }, []);

  const updateActiveWorkspace = useCallback((configUpdates: Partial<ProjectConfig>) => {
    setAppState(prev => ({
      ...prev,
      workspaces: prev.workspaces.map(w => 
        w.id === prev.activeWorkspaceId 
          ? { ...w, config: { ...w.config, ...configUpdates } } 
          : w
      )
    }));
  }, []);

  return (
    <WorkspaceContext.Provider value={{ 
      workspaces: appState.workspaces, 
      activeWorkspace, 
      setActiveWorkspace, 
      addWorkspace,
      deleteWorkspace,
      updateActiveWorkspace
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspaces = () => {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('useWorkspaces must be used within a WorkspaceProvider');
  return context;
};
