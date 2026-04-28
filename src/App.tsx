import React from 'react';
import { useMapStore } from './store';
import { MousePointer2, Square, SquareDashed, PaintBucket, Eraser, Trash2, Slash, DoorOpen, ArrowUpSquare, ArrowDownSquare, ArrowDownCircle, Download } from 'lucide-react';
import Canvas from './components/Canvas';

function App() {
  const { tool, setTool, hatchStyle, setHatchStyle, showGrid, toggleGrid, gridSize, setGridSize } = useMapStore();

  const tools = [
    { id: 'select', icon: MousePointer2, label: 'Select' },
    { id: 'room', icon: Square, label: 'Room' },
    { id: 'interior', icon: SquareDashed, label: 'Interior' },
    { id: 'fill', icon: PaintBucket, label: 'Fill' },
    { id: 'unfill', icon: Eraser, label: 'Unfill' },
    { id: 'wall', icon: Slash, label: 'Wall' },
    { id: 'door', icon: DoorOpen, label: 'Door' },
    { id: 'stair', icon: ArrowUpSquare, label: 'Stair (Taper)' },
    { id: 'stair-depth', icon: ArrowDownSquare, label: 'Stair (Depth)' },
    { id: 'stair-perspective', icon: ArrowDownCircle, label: 'Stair (Perspective)' },
    { id: 'delete', icon: Trash2, label: 'Erase Area' },
  ] as const;

  const handleExport = () => {
    const svg = document.getElementById('map-svg');
    if (!svg) return;
    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(svg);
    if(!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)){
        source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    const blob = new Blob([source], {type: "image/svg+xml;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "osr-map.svg";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex h-screen w-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* Left Sidebar - Tools */}
      <div className="w-16 bg-white border-r border-slate-200 flex flex-col items-center py-4 gap-4 z-10 shadow-sm">
        {tools.map(t => (
          <button
            key={t.id}
            onClick={() => setTool(t.id as any)}
            className={`p-3 rounded-xl transition-colors ${tool === t.id ? 'bg-indigo-100 text-indigo-600' : 'text-slate-500 hover:bg-slate-100'}`}
            title={t.label}
          >
            <t.icon size={24} strokeWidth={2} />
          </button>
        ))}
        
        <div className="mt-auto">
          <button 
            className="p-3 rounded-xl text-slate-500 hover:bg-slate-100"
            title="Export SVG"
            onClick={handleExport}
          >
            <Download size={24} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 relative overflow-hidden bg-slate-200">
        <Canvas />
      </div>

      {/* Right Sidebar - Properties */}
      <div className="w-64 bg-white border-l border-slate-200 p-4 flex flex-col z-10 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-4">Properties</h2>
        
        <div className="space-y-4">
          <div>
             <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
               <input 
                 type="checkbox" 
                 className="rounded text-indigo-600 focus:ring-indigo-500" 
                 checked={showGrid}
                 onChange={toggleGrid}
               />
               Show Grid
             </label>
          </div>
          <div>
            <label className="block text-sm text-slate-700 mb-1 mt-4">Grid Size (px)</label>
            <input 
              type="number" 
              className="w-full rounded border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" 
              value={gridSize}
              onChange={(e) => setGridSize(Number(e.target.value) || 50)}
              min="10"
              max="200"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-700 mb-1 mt-4">Hatch Style</label>
            <select
              value={hatchStyle}
              onChange={(e) => setHatchStyle(e.target.value as any)}
              className="w-full rounded border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border bg-white"
            >
              <option value="dyson-hatch">Classic Cross-Hatch</option>
              <option value="dyson-scrumb">Scrumbled Lines</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
