import React, { useMemo, useCallback, useEffect } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  Connection, 
  Edge, 
  Node,
  addEdge,
  useNodesState,
  useEdgesState,
  Handle,
  Position
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Table, Relation } from '../types';
import { useWorkspaces } from './WorkspaceManager';

const TableNode = ({ data }: { data: Table }) => (
  <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-xl overflow-hidden min-w-[200px]">
    <div className="p-2 border-b border-slate-700 font-bold text-sm flex items-center gap-2" style={{ borderTop: `3px solid ${data.color}` }}>
      {data.name}
    </div>
    <div className="p-2 flex flex-col gap-1">
      {data.fields.map(field => (
        <div key={field.name} className="text-xs text-slate-300 flex justify-between items-center relative group">
          <Handle
            type="target"
            position={Position.Left}
            id={`${data.id}-${field.name}-target`}
            className="w-2 h-2 !bg-blue-500"
          />
          <span className="flex items-center gap-1">
            {field.name}
            {field.pk && <span className="text-[10px] text-yellow-500 font-bold">PK</span>}
          </span>
          <span className="text-slate-500">{field.type}</span>
          <Handle
            type="source"
            position={Position.Right}
            id={`${data.id}-${field.name}-source`}
            className="w-2 h-2 !bg-blue-500"
          />
        </div>
      ))}
    </div>
  </div>
);

const nodeTypes = {
  table: TableNode,
};

export const SchemaEditor: React.FC = () => {
  const { activeWorkspace, updateActiveWorkspace } = useWorkspaces();

  const initialNodes: Node[] = useMemo(() => activeWorkspace.config.tables.map(table => ({
    id: table.id,
    type: 'table',
    position: { x: table.x, y: table.y },
    data: table,
  })), [activeWorkspace.id]); // Only recompute when workspace changes

  const initialEdges: Edge[] = useMemo(() => activeWorkspace.config.relations.map(rel => ({
    id: `${rel.from}-${rel.fromField}-${rel.to}-${rel.toField}`,
    source: rel.from,
    sourceHandle: `${rel.from}-${rel.fromField}-source`,
    target: rel.to,
    targetHandle: `${rel.to}-${rel.toField}-target`,
    animated: true,
    style: { stroke: '#3b82f6' },
  })), [activeWorkspace.id]); // Only recompute when workspace changes

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync state when workspace ID changes
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [activeWorkspace.id, initialNodes, initialEdges, setNodes, setEdges]);

  // Persist node positions on drag end or other changes
  const onNodeDragStop = useCallback((_: any, node: Node) => {
    updateActiveWorkspace({
      tables: activeWorkspace.config.tables.map(t => 
        t.id === node.id ? { ...t, x: node.position.x, y: node.position.y } : t
      )
    });
  }, [activeWorkspace.config.tables, updateActiveWorkspace]);

  const onConnect = useCallback((params: Connection) => {
    setEdges((eds) => addEdge(params, eds));
    
    const newRelation: Relation = {
      from: params.source!,
      fromField: params.sourceHandle?.split('-')[1] || '',
      to: params.target!,
      toField: params.targetHandle?.split('-')[1] || '',
    };

    updateActiveWorkspace({
      relations: [...activeWorkspace.config.relations, newRelation]
    });
  }, [activeWorkspace.config.relations, updateActiveWorkspace, setEdges]);

  return (
    <div className="w-full h-full bg-slate-950">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background color="#334155" gap={20} />
        <Controls />
      </ReactFlow>
    </div>
  );
};
