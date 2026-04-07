import React, { createContext, useContext, useState, useEffect } from 'react';
import { Workspace, BatorApp, ProjectConfig } from '../types';

interface WorkspaceContextType {
  workspaces: Workspace[];
  activeWorkspace: Workspace;
  setActiveWorkspace: (id: string) => void;
  addWorkspace: (name: string) => void;
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

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [appState, setAppState] = useState<BatorApp>(() => {
    const saved = localStorage.getItem('bator_app');
    if (saved) return JSON.parse(saved);
    
    const initialWorkspace: Workspace = {
      id: 'default',
      name: 'Main Project',
      description: 'Your primary workspace',
      icon: 'Layout',
      config: defaultConfig
    };

    return {
      workspaces: [initialWorkspace],
      activeWorkspaceId: 'default',
      settings: {
        theme: 'dark',
        fontSize: 14,
        showGrid: true,
        autoSave: true
      }
    };
  });

  useEffect(() => {
    localStorage.setItem('bator_app', JSON.stringify(appState));
  }, [appState]);

  const activeWorkspace = appState.workspaces.find(w => w.id === appState.activeWorkspaceId) || appState.workspaces[0];

  const setActiveWorkspace = (id: string) => {
    setAppState(prev => ({ ...prev, activeWorkspaceId: id }));
  };

  const addWorkspace = (name: string) => {
    const newWorkspace: Workspace = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      description: 'New workspace',
      icon: 'Plus',
      config: defaultConfig
    };
    setAppState(prev => ({
      ...prev,
      workspaces: [...prev.workspaces, newWorkspace],
      activeWorkspaceId: newWorkspace.id
    }));
  };

  const updateActiveWorkspace = (configUpdates: Partial<ProjectConfig>) => {
    setAppState(prev => ({
      ...prev,
      workspaces: prev.workspaces.map(w => 
        w.id === prev.activeWorkspaceId 
          ? { ...w, config: { ...w.config, ...configUpdates } } 
          : w
      )
    }));
  };

  return (
    <WorkspaceContext.Provider value={{ 
      workspaces: appState.workspaces, 
      activeWorkspace, 
      setActiveWorkspace, 
      addWorkspace,
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
