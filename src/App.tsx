import { useState, useEffect } from 'react';
import { useMapStore } from './store';
import { MousePointer2, Square, SquareDashed, PaintBucket, Eraser, Trash2, Slash, DoorOpen, ArrowUpSquare, ArrowDownSquare, ArrowDownCircle, Download } from 'lucide-react';
import Canvas from './components/Canvas';
import PatternEditor from './components/PatternEditor';
import { generateDysonSegments, segmentsToPath } from './utils/dysonGenerator';

function App() {
  const { tool, setTool, hatchStyle, setHatchStyle, hatchDensity, setHatchDensity, hatchWidth, setHatchWidth, hatchOrganic, setHatchOrganic, showGrid, toggleGrid, gridSize, setGridSize, dynamicSegments, setDynamicSegments, savedPatterns, setSavedPattern } = useMapStore();

  const [editingSlot, setEditingSlot] = useState<number | null>(null);

  useEffect(() => {
    setDynamicSegments(generateDysonSegments(gridSize, hatchDensity));
  }, [gridSize, hatchDensity, setDynamicSegments]);

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
              <option value="dyson-dynamic">Procedural Dyson</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-700 mb-1 mt-4">Hatch Density ({hatchDensity})</label>
            <input 
              type="range" 
              className="w-full" 
              value={hatchDensity}
              onChange={(e) => setHatchDensity(Number(e.target.value))}
              min="10"
              max="200"
              step="10"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-700 mb-1 mt-4">Hatch Max Width ({(hatchWidth * 100).toFixed(0)}%)</label>
            <input 
              type="range" 
              className="w-full" 
              value={hatchWidth}
              onChange={(e) => setHatchWidth(Number(e.target.value))}
              min="0.1"
              max="0.5"
              step="0.05"
            />
          </div>
          <div className="mt-4 flex items-center">
            <input 
              type="checkbox" 
              id="hatch-organic"
              checked={hatchOrganic}
              onChange={(e) => setHatchOrganic(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
            />
            <label htmlFor="hatch-organic" className="ml-2 block text-sm text-slate-700">
              Organic Boundary (10% - Max)
            </label>
          </div>

          {hatchStyle === 'dyson-dynamic' || hatchStyle.startsWith('saved-') ? (
            <div className="mt-6 border-t pt-4">
              <h3 className="text-sm font-semibold text-slate-800 mb-2">Dyson Pattern Studio</h3>
              <div className="bg-slate-100 rounded-md p-2 mb-4 border border-slate-200 text-center">
                <span className="text-xs text-slate-500 block mb-1">Current Dynamic Pattern</span>
                <svg width="100" height="100" viewBox={`0 0 ${gridSize} ${gridSize}`} className="mx-auto bg-white border border-slate-300">
                  <path d={segmentsToPath(dynamicSegments)} stroke="black" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                </svg>
                <button 
                  onClick={() => setDynamicSegments(generateDysonSegments(gridSize, hatchDensity))}
                  className="mt-2 text-xs text-indigo-600 hover:text-indigo-800"
                >
                  Regenerate
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[0, 1, 2, 3].map(i => {
                  const pattern = savedPatterns[i];
                  return (
                    <div key={`slot-${i}`} className={`p-2 rounded border flex flex-col items-center ${hatchStyle === `saved-${i}` ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-white'}`}>
                      <div className="text-xs font-medium text-slate-600 mb-1 flex items-center justify-between w-full">
                        <span>Slot {i + 1}</span>
                        {hatchStyle === `saved-${i}` && <span className="text-[10px] text-indigo-600 font-bold">ACTIVE</span>}
                      </div>
                      {pattern ? (
                        <>
                          <svg width="60" height="60" viewBox={`0 0 ${gridSize} ${gridSize}`} className="bg-white border border-slate-200 mb-2 cursor-pointer hover:border-indigo-400" onClick={() => setHatchStyle(`saved-${i}`)}>
                            <path d={segmentsToPath(pattern)} stroke="black" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                          </svg>
                          <div className="flex gap-1 w-full">
                            <button onClick={() => setEditingSlot(i)} className="flex-1 py-1 text-[10px] bg-slate-100 hover:bg-slate-200 rounded text-slate-600 transition-colors">Edit</button>
                            <button onClick={() => {
                              setSavedPattern(i, null);
                              if (hatchStyle === `saved-${i}`) setHatchStyle('dyson-dynamic');
                            }} className="flex-1 py-1 text-[10px] bg-red-50 hover:bg-red-100 rounded text-red-600 transition-colors">Clear</button>
                          </div>
                        </>
                      ) : (
                        <div className="flex-1 flex items-center justify-center w-full h-[60px] border border-dashed border-slate-300 rounded mb-2 bg-slate-50 hover:bg-slate-100 transition-colors">
                          <button 
                            onClick={() => setSavedPattern(i, dynamicSegments)}
                            className="text-[10px] text-slate-500 hover:text-indigo-600 font-medium w-full h-full"
                          >
                            Save Here
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null}

        </div>
      </div>

      {editingSlot !== null && savedPatterns[editingSlot] !== null && (
        <PatternEditor 
          initialSegments={savedPatterns[editingSlot]!} 
          gridSize={gridSize} 
          onSave={(newSegs) => {
            setSavedPattern(editingSlot, newSegs);
            setEditingSlot(null);
          }} 
          onCancel={() => setEditingSlot(null)} 
        />
      )}

    </div>
  );
}

export default App;
