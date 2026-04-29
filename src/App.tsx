import { useState, useEffect } from 'react';
import { useMapStore } from './store';
import { MousePointer2, Square, SquareDashed, PaintBucket, Eraser, Trash2, Slash, DoorOpen, ArrowUpSquare, ArrowDownSquare, ArrowDownCircle, Download, Undo2, Redo2, Crop, RotateCw, Columns, EyeOff, Circle, Box, RectangleHorizontal, Shapes } from 'lucide-react';
import Canvas from './components/Canvas';
import PatternEditor from './components/PatternEditor';
import { generateDysonSegments, segmentsToPath } from './utils/dysonGenerator';

function App() {
  const { tool, setTool, hatchStyle, setHatchStyle, softBorderColor, setSoftBorderColor, hatchDensity, setHatchDensity, hatchWidth, setHatchWidth, hatchOrganic, setHatchOrganic, hatchSmoothness, setHatchSmoothness, showGrid, toggleGrid, gridSize, setGridSize, dynamicSegments, setDynamicSegments, savedPatterns, setSavedPattern, undo, redo, pastElements, futureElements, elements } = useMapStore();

  const [editingSlot, setEditingSlot] = useState<number | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (!(e.target as Element).closest('.tool-group')) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  useEffect(() => {
    setDynamicSegments(generateDysonSegments(gridSize, hatchDensity));
  }, [gridSize, hatchDensity, setDynamicSegments]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  const toolGroups = [
    {
      id: 'edit',
      icon: MousePointer2,
      label: 'Edit & Select',
      tools: [
        { id: 'select', icon: MousePointer2, label: 'Select' },
        { id: 'delete', icon: Trash2, label: 'Erase Area' },
        { id: 'rotate', icon: RotateCw, label: 'Rotate' },
        { id: 'export-region', icon: Crop, label: 'Export Region' },
      ]
    },
    {
      id: 'architecture',
      icon: Square,
      label: 'Architecture',
      tools: [
        { id: 'room', icon: Square, label: 'Room' },
        { id: 'interior', icon: SquareDashed, label: 'Interior' },
        { id: 'wall', icon: Slash, label: 'Wall' },
      ]
    },
    {
      id: 'hatch',
      icon: PaintBucket,
      label: 'Hatching',
      tools: [
        { id: 'fill', icon: PaintBucket, label: 'Fill Area' },
        { id: 'unfill', icon: Eraser, label: 'Unfill Area' },
      ]
    },
    {
      id: 'doors',
      icon: DoorOpen,
      label: 'Doors',
      tools: [
        { id: 'door', icon: DoorOpen, label: 'Single Door' },
        { id: 'door-double', icon: Columns, label: 'Double Door' },
        { id: 'door-secret', icon: EyeOff, label: 'Secret Door' },
      ]
    },
    {
      id: 'stairs',
      icon: ArrowUpSquare,
      label: 'Stairs',
      tools: [
        { id: 'stair', icon: ArrowUpSquare, label: 'Stair (Taper)' },
        { id: 'stair-depth', icon: ArrowDownSquare, label: 'Stair (Depth)' },
        { id: 'stair-perspective', icon: ArrowDownCircle, label: 'Stair (Perspective)' },
      ]
    },
    {
      id: 'decorations',
      icon: Shapes,
      label: 'Decorations',
      tools: [
        { id: 'decoration-circle', icon: Circle, label: 'Circle' },
        { id: 'decoration-square', icon: Box, label: 'Square' },
        { id: 'decoration-rectangle', icon: RectangleHorizontal, label: 'Rectangle' },
      ]
    }
  ] as const;

  const exportMap = (bbox?: { minX: number, minY: number, maxX: number, maxY: number }) => {
    const svg = document.getElementById('map-svg');
    if (!svg) return;
    
    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(svg);
    
    if(!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)){
        source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }

    // Strip the transform from the main container so it exports at original coordinates
    source = source.replace(/<g id="map-container" transform="[^"]*">/, '<g id="map-container">');

    let exportBBox = bbox;
    if (!exportBBox) {
      if (elements.length === 0) {
        exportBBox = { minX: 0, minY: 0, maxX: 1000, maxY: 1000 };
      } else {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        elements.forEach(el => {
          el.points.forEach(p => {
            if (p.x < minX) minX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.x > maxX) maxX = p.x;
            if (p.y > maxY) maxY = p.y;
          });
        });
        exportBBox = {
          minX: minX - gridSize * 2,
          minY: minY - gridSize * 2,
          maxX: maxX + gridSize * 2,
          maxY: maxY + gridSize * 2,
        };
      }
    }

    const width = exportBBox.maxX - exportBBox.minX;
    const height = exportBBox.maxY - exportBBox.minY;

    // Inject the correct viewBox and dimensions
    source = source.replace(/^<svg([^>]*)>/, `<svg$1 viewBox="${exportBBox.minX} ${exportBBox.minY} ${width} ${height}" width="${width}" height="${height}">`);

    const blob = new Blob([source], {type: "image/svg+xml;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = bbox ? "osr-map-region.svg" : "osr-map-full.svg";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTool('select');
  };

  return (
    <div className="flex h-screen w-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* Left Sidebar - Tools */}
      <div className="w-16 bg-white border-r border-slate-200 flex flex-col items-center py-4 gap-2 z-10 shadow-sm relative">
        {toolGroups.map(group => {
          const isActiveGroup = group.tools.some(t => t.id === tool);
          return (
            <div key={group.id} className="relative tool-group w-full flex justify-center">
              <button
                onClick={() => setOpenMenu(openMenu === group.id ? null : group.id)}
                className={`p-3 rounded-xl transition-colors flex-shrink-0 ${isActiveGroup ? 'bg-indigo-100 text-indigo-600' : 'text-slate-500 hover:bg-slate-100'}`}
                title={group.label}
              >
                <group.icon size={24} strokeWidth={2} />
              </button>
              
              {openMenu === group.id && (
                <div className="absolute left-full top-0 ml-2 bg-white rounded-xl shadow-lg border border-slate-200 p-2 flex flex-col gap-1 z-50 min-w-[160px]">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 mb-1">{group.label}</div>
                  {group.tools.map(t => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setTool(t.id as any);
                        setOpenMenu(null);
                      }}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium w-full text-left ${tool === t.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                    >
                      <t.icon size={18} strokeWidth={2} className={tool === t.id ? 'text-indigo-600' : 'text-slate-400'} />
                      {t.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        
        <div className="mt-auto flex flex-col gap-2">
          <button 
            className={`p-3 rounded-xl transition-colors ${pastElements.length > 0 ? 'text-slate-500 hover:bg-slate-100 cursor-pointer' : 'text-slate-300 cursor-not-allowed'}`}
            title="Undo (Cmd/Ctrl + Z)"
            onClick={() => pastElements.length > 0 && undo()}
            disabled={pastElements.length === 0}
          >
            <Undo2 size={24} strokeWidth={2} />
          </button>
          <button 
            className={`p-3 rounded-xl transition-colors ${futureElements.length > 0 ? 'text-slate-500 hover:bg-slate-100 cursor-pointer' : 'text-slate-300 cursor-not-allowed'}`}
            title="Redo (Cmd/Ctrl + Y)"
            onClick={() => futureElements.length > 0 && redo()}
            disabled={futureElements.length === 0}
          >
            <Redo2 size={24} strokeWidth={2} />
          </button>
          <div className="w-8 h-px bg-slate-200 mx-auto my-1"></div>
          <button 
            className="p-3 rounded-xl text-slate-500 hover:bg-slate-100"
            title="Export Full Map SVG"
            onClick={() => exportMap()}
          >
            <Download size={24} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 relative overflow-hidden bg-slate-200">
        <Canvas onExportRegion={exportMap} />
      </div>

      {/* Right Sidebar - Properties */}
      <div className="w-64 bg-white border-l border-slate-200 p-4 flex flex-col z-10 shadow-sm overflow-y-auto">
        <h1 className="text-lg font-bold text-slate-900 tracking-tight mb-1">OSR Map Builder</h1>
        <h2 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-6 pb-2 border-b border-slate-100">Properties</h2>
        
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
              <option value="soft-border">Soft Border</option>
              <option value="dyson-dynamic">Procedural Dyson</option>
            </select>
            
            {hatchStyle === 'soft-border' && (
              <div className="mt-3">
                <label className="block text-xs font-medium text-slate-500 mb-1">Border Color</label>
                <div className="flex gap-2">
                  {[
                    { value: 'rgba(0,0,0,0.625)', bg: 'bg-black' },
                    { value: 'rgba(64,64,64,0.625)', bg: 'bg-stone-700' },
                    { value: 'rgba(160,160,160,0.625)', bg: 'bg-stone-400' }
                  ].map(color => (
                    <button
                      key={color.value}
                      onClick={() => setSoftBorderColor(color.value)}
                      className={`w-8 h-8 rounded-full border-2 ${color.bg} ${softBorderColor === color.value ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-transparent'}`}
                      title={color.bg.replace('bg-', '')}
                    />
                  ))}
                </div>
              </div>
            )}
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
          <div className="mt-4 flex flex-col gap-2">
            <div className="flex items-center">
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
            
            {hatchOrganic && (
              <div className="ml-6 mt-2 p-3 bg-slate-50 border border-slate-200 rounded-md">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Smoothness</label>
                  <span className="text-xs text-slate-500 font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">{hatchSmoothness}</span>
                </div>
                <input 
                  type="range" 
                  className="w-full accent-indigo-500" 
                  value={hatchSmoothness}
                  onChange={(e) => setHatchSmoothness(Number(e.target.value))}
                  min="0"
                  max="100"
                  step="5"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-1 uppercase font-medium">
                  <span>Blocky</span>
                  <span>Smooth</span>
                </div>
              </div>
            )}
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
