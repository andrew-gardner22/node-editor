import React, { useState, useCallback, useEffect } from 'react';
import ReactFlow, {
  ReactFlowProvider,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  Node,
} from 'reactflow';
import 'reactflow/dist/style.css';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';

const initialNodes = [
  { id: '1', type: 'default', data: { label: 'Start Node' }, position: { x: 250, y: 5 } },
];

function App() {
  const stored = JSON.parse(localStorage.getItem('flow') || 'null');
  const [nodes, setNodes, onNodesChange] = useNodesState(stored?.nodes || initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(stored?.edges || []);
  const [rfInstance, setRfInstance] = useState(null);
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    localStorage.setItem('flow', JSON.stringify({ nodes, edges }));
  }, [nodes, edges]);

  const onConnect = useCallback((params) => setEdges((eds) => addEdge(params, eds)), []);

  const addCodeNode = () => {
    const id = (nodes.length + 1).toString();
    setNodes((nds) => [...nds, {
      id,
      type: 'codeNode',
      position: { x: 100, y: 100 },
      data: { code: '// write JS here' }
    }]);
  };

  const addArithmeticNode = () => {
    const id = (nodes.length + 1).toString();
    setNodes((nds) => [...nds, {
      id,
      type: 'arithmeticNode',
      position: { x: 200, y: 200 },
      data: { a: 0, b: 0, op: '+' , result: null }
    }]);
  };

  const addHttpNode = () => {
    const id = (nodes.length + 1).toString();
    setNodes((nds) => [...nds, {
      id,
      type: 'httpNode',
      position: { x: 300, y: 300 },
      data: { url: '', method: 'GET', response: null }
    }]);
  };

  const executeFlow = async () => {
    // Build graph mapping
    const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));
    const adj = {} as Record<string, string[]>;
    const indegree = {} as Record<string, number>;
    nodes.forEach(n => { adj[n.id] = []; indegree[n.id] = 0; });
    edges.forEach(e => {
      adj[e.source].push(e.target);
      indegree[e.target]++;
    });
    // Kahn's algorithm
    const queue = nodes.filter(n => indegree[n.id] === 0).map(n => n.id);
    const order: string[] = [];
    while (queue.length) {
      const id = queue.shift()!;
      order.push(id);
      for (const tgt of adj[id]) {
        indegree[tgt]--;
        if (indegree[tgt] === 0) queue.push(tgt);
      }
    }
    // Execute in order
    for (const id of order) {
      const node = nodeMap[id];
      if (!node) continue;
      switch (node.type) {
        case 'codeNode': {
          try { new Function(node.data.code)(); } catch (e) { console.error(e); }
          break;
        }
        case 'arithmeticNode': {
          const { a, b, op } = node.data;
          node.data.result = Function(`return ${a}${op}${b}`)();
          break;
        }
        case 'httpNode': {
          try { node.data.response = await fetch(node.data.url, { method: node.data.method }).then(r => r.text()); } catch (e) { node.data.response = e.message; }
          break;
        }
        default: break;
      }
    }
    setNodes([...nodes]);
  };

  const saveFlow = () => {
    if (rfInstance) {
      const flow = rfInstance.toObject();
      const blob = new Blob([JSON.stringify(flow, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'flow.json';
      a.click();
    }
  };

  const loadFlow = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const flow = JSON.parse(reader.result);
      setNodes(flow.nodes || []);
      setEdges(flow.edges || []);
    };
    reader.readAsText(file);
  };

  const nodeTypes = {
    codeNode: ({ id, data }) => (
      <div className="bg-gray-100 p-2 rounded border">
        <CodeMirror
          value={data.code}
          height="150px"
          extensions={[javascript()]}
          onChange={(value) => {
            setNodes((nds) => nds.map((n) => n.id === id ? { ...n, data: { code: value } } : n));
          }}
        />
      </div>
    ),
    arithmeticNode: ({ id, data }) => (
      <div className="bg-yellow-100 p-2 rounded border">
        <div className="flex space-x-1">
          <input type="number" className="w-1/3 border p-1" value={data.a} onChange={e=>{
            const val=+e.target.value; setNodes(nds=>nds.map(n=>n.id===id?{...n,data:{...n,data,a:val}}:n));
          }}/>
          <select className="border p-1" value={data.op} onChange={e=>{
            const op=e.target.value; setNodes(nds=>nds.map(n=>n.id===id?{...n,data:{...n,data,op}}:n));
          }}><option>+</option><option>-</option><option>*</option><option>/</option></select>
          <input type="number" className="w-1/3 border p-1" value={data.b} onChange={e=>{
            const val=+e.target.value; setNodes(nds=>nds.map(n=>n.id===id?{...n,data:{...n,data,b:val}}:n));
          }}/>
        </div>
        <div className="mt-1">Result: {data.result}</div>
      </div>
    ),
    httpNode: ({ id, data }) => (
      <div className="bg-blue-100 p-2 rounded border">
        <input type="text" placeholder="URL" className="w-full border p-1 mb-1" value={data.url} onChange={e=>{
          const url=e.target.value; setNodes(nds=>nds.map(n=>n.id===id?{...n,data:{...n,data,url}}:n));
        }}/>
        <select className="w-full border p-1 mb-1" value={data.method} onChange={e=>{
          const method=e.target.value; setNodes(nds=>nds.map(n=>n.id===id?{...n,data:{...n,data,method}}:n));
        }}><option>GET</option><option>POST</option></select>
        <div className="text-sm">Response: <pre className="max-h-24 overflow-auto">{data.response}</pre></div>
      </div>
    ),
  };

  return (
    <div className={`${theme} h-screen flex`}>
      <div className="w-60 p-2 border-r bg-white dark:bg-gray-800">
        <button onClick={()=>setTheme(t=>t==='light'?'dark':'light')} className="w-full mb-2 bg-gray-600 text-white py-2 rounded">Toggle Theme</button>
        <button onClick={addCodeNode} className="w-full mb-2 bg-blue-500 text-white py-2 rounded">Add Code Node</button>
        <button onClick={addArithmeticNode} className="w-full mb-2 bg-yellow-500 text-white py-2 rounded">Add Arithmetic Node</button>
        <button onClick={addHttpNode} className="w-full mb-2 bg-indigo-500 text-white py-2 rounded">Add HTTP Node</button>
        <button onClick={saveFlow} className="w-full mb-2 bg-green-500 text-white py-2 rounded">Save Flow</button>
        <button onClick={executeFlow} className="w-full mb-2 bg-purple-500 text-white py-2 rounded">Execute Flow</button>
        <input type="file" accept=".json" onChange={loadFlow} className="w-full mb-2" />
      </div>
      <div className="flex-1">
        <ReactFlowProvider>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setRfInstance}
            nodeTypes={nodeTypes}
            zoomOnScroll={true}
            panOnScroll={true}
            minZoom={0.2}
            maxZoom={4}
          >
            <MiniMap />
            <Controls />
            <Background />
          </ReactFlow>
        </ReactFlowProvider>
      </div>
    </div>
  );
}

export default App;
