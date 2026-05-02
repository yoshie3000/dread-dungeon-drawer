import { useState, useEffect, useRef } from 'react';
import { useMapStore } from './store';
import { MousePointer2, Square, SquareDashed, PaintBucket, Eraser, Trash2, Slash, DoorOpen, ArrowUpSquare, ArrowDownSquare, ArrowDownCircle, Download, Undo2, Redo2, Crop, RotateCw, Columns, Eye, EyeOff, Circle, Box, RectangleHorizontal, Shapes, Grid, Layers, Lock, Unlock, Upload, Paintbrush, Shovel } from 'lucide-react';
import Canvas from './components/Canvas';
import PatternEditor from './components/PatternEditor';
import { generateDysonSegments, segmentsToPath } from './utils/dysonGenerator';

function App() {
  const { tool, setTool, hatchStyle, setHatchStyle, softBorderColor, setSoftBorderColor, hatchDensity, setHatchDensity, hatchWidth, setHatchWidth, hatchOrganic, setHatchOrganic, hatchSmoothness, setHatchSmoothness, stairSteps, setStairSteps, snapToGrid, setSnapToGrid, showGrid, toggleGrid, showHatch, setShowHatch, activeLayer, setActiveLayer, layerVisibility, toggleLayerVisibility, layerLock, toggleLayerLock, gridSize, setGridSize, dynamicSegments, setDynamicSegments, savedPatterns, setSavedPattern, undo, redo, pastElements, futureElements, elements, selectedElementIds, updateElement, addElement, setElements, setSelectedElementIds, brushColor, setBrushColor, brushWidth, setBrushWidth, brushShape, setBrushShape, brushSmoothness, setBrushSmoothness, shovelTargetLayer, setShovelTargetLayer } = useMapStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        const img = new Image();
        img.onload = () => {
          // Use the intrinsic width and height of the uploaded SVG
          const imgWidth = img.width || gridSize * 4;
          const imgHeight = img.height || gridSize * 4;

          addElement({
            id: Math.random().toString(36).substring(2, 9),
            type: 'image' as any,
            layer: activeLayer,
            points: [{ x: 0, y: 0 }, { x: imgWidth, y: imgHeight }],
            properties: { dataUrl }
          });
        };
        img.src = dataUrl;
      }
    };
    reader.readAsDataURL(file);
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const exportTileEl = elements.find(el => el.type === 'export-tile');
  const exportTile = exportTileEl ? exportTileEl.points[0] : null;

  const [editingSlot, setEditingSlot] = useState<number | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [isHatchPanelOpen, setIsHatchPanelOpen] = useState(false);
  const [isStairPanelOpen, setIsStairPanelOpen] = useState(false);

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
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        if (selectedElementIds.length > 0) {
          const selectedElements = elements.filter(el => selectedElementIds.includes(el.id));
          const newElements = selectedElements.map(el => ({
            ...el,
            id: Math.random().toString(36).substring(2, 9),
            points: el.points.map(p => ({ x: p.x + gridSize, y: p.y + gridSize }))
          }));
          setElements([...elements, ...newElements]);
          setSelectedElementIds(newElements.map(el => el.id));
        }
      } else if (e.key.startsWith('Arrow') && selectedElementIds.length > 0) {
        e.preventDefault();
        const moveAmount = snapToGrid ? gridSize / 2 : 5;
        let dx = 0;
        let dy = 0;
        if (e.key === 'ArrowUp') dy = -moveAmount;
        if (e.key === 'ArrowDown') dy = moveAmount;
        if (e.key === 'ArrowLeft') dx = -moveAmount;
        if (e.key === 'ArrowRight') dx = moveAmount;

        const newElements = elements.map(el => {
          if (selectedElementIds.includes(el.id)) {
            return {
              ...el,
              points: el.points.map(p => ({ x: p.x + dx, y: p.y + dy }))
            };
          }
          return el;
        });
        setElements(newElements);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, elements, selectedElementIds, gridSize, setElements, setSelectedElementIds, snapToGrid]);

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
        { id: 'export-tile', icon: Grid, label: 'Mark Tile' },
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
      id: 'painting',
      icon: Paintbrush,
      label: 'Painting & Masking',
      tools: [
        { id: 'brush', icon: Paintbrush, label: 'Brush' },
        { id: 'shovel', icon: Shovel, label: 'Shovel (Mask)' },
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

    // DOM Manipulation Approach
    const svgCopy = svg.cloneNode(true) as SVGSVGElement;
    
    // 1. Remove all export-ignore UI elements
    svgCopy.querySelectorAll('.export-ignore').forEach(el => el.remove());
    
    // 2. Remove Tailwind classes
    svgCopy.removeAttribute('class');
    
    // 3. Set the strict viewBox and dimensions
    svgCopy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svgCopy.setAttribute('viewBox', `${exportBBox.minX} ${exportBBox.minY} ${width} ${height}`);
    svgCopy.setAttribute('width', `${width}px`);
    svgCopy.setAttribute('height', `${height}px`);
    svgCopy.setAttribute('style', 'background: transparent; overflow: hidden;');
    
    // 4. Clean up map container transform and apply clipPath
    const mapContainer = svgCopy.querySelector('#map-container');
    if (mapContainer) {
      mapContainer.removeAttribute('transform');
      mapContainer.setAttribute('clip-path', 'url(#export-crop)');
    }
    
    // 5. Explicitly bound the global grid to the export box and fix its scale/offset
    const gridRect = svgCopy.querySelector('rect[fill="url(#global-grid)"]');
    if (gridRect) {
      gridRect.setAttribute('x', exportBBox.minX.toString());
      gridRect.setAttribute('y', exportBBox.minY.toString());
      gridRect.setAttribute('width', width.toString());
      gridRect.setAttribute('height', height.toString());
    }
    const globalGridPattern = svgCopy.querySelector('#global-grid');
    if (globalGridPattern) {
      globalGridPattern.setAttribute('width', '24');
      globalGridPattern.setAttribute('height', '24');
      globalGridPattern.setAttribute('x', '0');
      globalGridPattern.setAttribute('y', '0');
      const gridPath = globalGridPattern.querySelector('path');
      if (gridPath) gridPath.setAttribute('d', 'M 24 0 L 0 0 0 24');
    }

    // 6. Inject the clipPath cleanly into <defs>
    let defsEl = svgCopy.querySelector('defs');
    if (!defsEl) {
      defsEl = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      svgCopy.insertBefore(defsEl, svgCopy.firstChild);
    }
    const clipPathEl = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
    clipPathEl.setAttribute('id', 'export-crop');
    const clipRectEl = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    clipRectEl.setAttribute('x', exportBBox.minX.toString());
    clipRectEl.setAttribute('y', exportBBox.minY.toString());
    clipRectEl.setAttribute('width', width.toString());
    clipRectEl.setAttribute('height', height.toString());
    clipPathEl.appendChild(clipRectEl);
    defsEl.appendChild(clipPathEl);

    // 7. Inject styles
    const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    styleEl.textContent = `
      .dyson-wall { fill: none; stroke: #1a1a1a; stroke-width: 3px; stroke-linejoin: round; stroke-linecap: round; }
      .dyson-grid { stroke: #e2e8f0; stroke-width: 1px; }
    `;
    svgCopy.insertBefore(styleEl, svgCopy.firstChild);

    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(svgCopy);

    // Convert rgba() to rgb() + opacity for better compatibility with SVG viewers like Illustrator
    source = source.replace(/stroke="rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)"/g, 'stroke="rgb($1,$2,$3)" stroke-opacity="$4"');
    source = source.replace(/fill="rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)"/g, 'fill="rgb($1,$2,$3)" fill-opacity="$4"');

    const blob = new Blob([source], {type: "image/svg+xml;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = bbox ? "osr-map-region.svg" : "osr-map-full.svg";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
          <div className="relative tool-group w-full flex justify-center">
            <button
              onClick={() => setOpenMenu(openMenu === 'export' ? null : 'export')}
              className={`p-3 rounded-xl transition-colors flex-shrink-0 text-slate-500 hover:bg-slate-100 ${openMenu === 'export' ? 'bg-slate-100 text-slate-900' : ''}`}
              title="Export Options"
            >
              <Download size={24} strokeWidth={2} />
            </button>
            
            {openMenu === 'export' && (
              <div className="absolute left-full bottom-0 ml-2 bg-white rounded-xl shadow-lg border border-slate-200 p-2 flex flex-col gap-1 z-50 min-w-[160px]">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 mb-1">Export</div>
                <button
                  onClick={() => {
                    exportMap();
                    setOpenMenu(null);
                  }}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium w-full text-left text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                >
                  <Download size={18} strokeWidth={2} className="text-slate-400" />
                  Full Map
                </button>
                <button
                  onClick={() => {
                    if (exportTile) {
                      exportMap({ minX: exportTile.x, minY: exportTile.y, maxX: exportTile.x + 144, maxY: exportTile.y + 144 });
                      setOpenMenu(null);
                    }
                  }}
                  disabled={!exportTile}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium w-full text-left ${exportTile ? 'text-slate-600 hover:bg-slate-50 hover:text-slate-900' : 'text-slate-300 cursor-not-allowed'}`}
                >
                  <Grid size={18} strokeWidth={2} className={exportTile ? "text-slate-400" : "text-slate-300"} />
                  Marked Tile
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 relative overflow-hidden bg-slate-200">
        <Canvas onExportRegion={exportMap} />
      </div>

      {/* Right Sidebar - Properties */}
      <div className="w-64 bg-white border-l border-slate-200 p-4 flex flex-col z-10 shadow-sm overflow-y-auto">
        <h1 className="text-lg font-bold text-slate-900 tracking-tight mb-1">OSR Map Builder</h1>
        <div className="mb-6">
          <h2 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-3 pb-2 border-b border-slate-100 flex items-center gap-2">
            <Layers size={14} />
            Layers
          </h2>
          <div className="space-y-1">
            {[3, 2, 1, 0].map(layerIndex => (
              <div 
                key={layerIndex} 
                className={`flex items-center justify-between p-2 rounded cursor-pointer ${activeLayer === layerIndex ? 'bg-indigo-50 border border-indigo-100' : 'hover:bg-slate-50 border border-transparent'}`}
                onClick={() => setActiveLayer(layerIndex)}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${activeLayer === layerIndex ? 'bg-indigo-500' : 'bg-transparent border border-slate-300'}`} />
                  <span className={`text-sm ${activeLayer === layerIndex ? 'text-indigo-700 font-medium' : 'text-slate-600'}`}>Layer {layerIndex}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={(e) => { e.stopPropagation(); toggleLayerLock(layerIndex); }}
                    className={`p-1 rounded hover:bg-slate-200 ${layerLock[layerIndex] ? 'text-red-500' : 'text-slate-400'}`}
                    title={layerLock[layerIndex] ? "Unlock Layer" : "Lock Layer"}
                  >
                    {layerLock[layerIndex] ? <Lock size={14} /> : <Unlock size={14} />}
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); toggleLayerVisibility(layerIndex); }}
                    className={`p-1 rounded hover:bg-slate-200 ${layerVisibility[layerIndex] ? 'text-slate-600' : 'text-slate-400'}`}
                    title={layerVisibility[layerIndex] ? "Hide Layer" : "Show Layer"}
                  >
                    {layerVisibility[layerIndex] ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-4 pt-4 border-t border-slate-200">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImageUpload} 
              accept=".svg" 
              className="hidden" 
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 bg-white border border-slate-300 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              <Upload size={16} />
              Upload Background (SVG)
            </button>
          </div>
        </div>

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
           
           {(tool === 'brush' || tool === 'shovel') && (
             <div className="mt-4 p-3 bg-slate-50 rounded border border-slate-200">
               <h3 className="text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wider">{tool === 'brush' ? 'Brush Settings' : 'Shovel Settings'}</h3>
               
               {tool === 'brush' && (
                 <div className="mb-3">
                   <label className="block text-xs font-medium text-slate-600 mb-1">Color</label>
                   <div className="flex gap-2">
                     <input type="color" value={brushColor} onChange={(e) => setBrushColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer" />
                     <input type="text" value={brushColor} onChange={(e) => setBrushColor(e.target.value)} className="flex-1 text-sm border border-slate-200 rounded px-2" />
                   </div>
                 </div>
               )}

               {tool === 'shovel' && (
                 <div className="mb-3">
                   <label className="block text-xs font-medium text-slate-600 mb-1">Target Layer to Reveal</label>
                   <select 
                     value={shovelTargetLayer} 
                     onChange={(e) => setShovelTargetLayer(Number(e.target.value))}
                     className="w-full text-sm border border-slate-200 rounded p-1"
                   >
                     {[0, 1, 2, 3].map(l => <option key={l} value={l}>Layer {l}</option>)}
                   </select>
                 </div>
               )}

               <div className="mb-3">
                 <label className="block text-xs font-medium text-slate-600 mb-1">Width: {brushWidth}px</label>
                 <input 
                   type="range" min="1" max="100" value={brushWidth} 
                   onChange={(e) => setBrushWidth(Number(e.target.value))} 
                   className="w-full"
                 />
               </div>

               <div className="mb-3">
                 <label className="block text-xs font-medium text-slate-600 mb-1">Shape</label>
                 <select 
                   value={brushShape} 
                   onChange={(e) => setBrushShape(e.target.value as 'round' | 'splat')}
                   className="w-full text-sm border border-slate-200 rounded p-1"
                 >
                   <option value="round">Round</option>
                   <option value="splat">Splat / Organic</option>
                 </select>
               </div>

               {brushShape === 'splat' && (
                 <div>
                   <label className="block text-xs font-medium text-slate-600 mb-1">Splat Intensity: {Math.round(brushSmoothness * 100)}%</label>
                   <input 
                     type="range" min="0" max="1" step="0.05" value={brushSmoothness} 
                     onChange={(e) => setBrushSmoothness(Number(e.target.value))} 
                     className="w-full"
                   />
                 </div>
               )}
             </div>
           )}

           <div>
             <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer mt-2">
               <input 
                 type="checkbox" 
                 className="rounded text-indigo-600 focus:ring-indigo-500" 
                 checked={showHatch}
                 onChange={(e) => setShowHatch(e.target.checked)}
               />
               Show Hatch
             </label>
          </div>
          <div>
             <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer mt-2">
               <input 
                 type="checkbox" 
                 className="rounded text-indigo-600 focus:ring-indigo-500" 
                 checked={snapToGrid}
                 onChange={(e) => setSnapToGrid(e.target.checked)}
               />
               Snap to Grid
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
          <div className="mt-6 border border-slate-200 rounded-md bg-white overflow-hidden">
            <button 
              onClick={() => setIsHatchPanelOpen(!isHatchPanelOpen)}
              className="w-full flex items-center justify-between p-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm transition-colors"
            >
              <span>Hatch Properties</span>
              <svg 
                className={`w-4 h-4 transform transition-transform ${isHatchPanelOpen ? 'rotate-180' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            <div className={`transition-all duration-200 ease-in-out ${isHatchPanelOpen ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
              <div className="p-4 border-t border-slate-200">
                <div>
                  <label className="block text-sm text-slate-700 mb-1">Hatch Style</label>
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
          </div>

          <div className="mt-6 border border-slate-200 rounded-md bg-white overflow-hidden">
            <button 
              onClick={() => setIsStairPanelOpen(!isStairPanelOpen)}
              className="w-full flex items-center justify-between p-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm transition-colors"
            >
              <span>Stair Properties</span>
              <svg 
                className={`w-4 h-4 transform transition-transform ${isStairPanelOpen ? 'rotate-180' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            <div className={`transition-all duration-200 ease-in-out ${isStairPanelOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
              <div className="p-4 border-t border-slate-200">
                <div>
                  <label className="block text-sm text-slate-700 mb-1 mt-2">
                    Quantity of Steps ({(elements.find(el => selectedElementIds.length === 1 && selectedElementIds[0] === el.id && el.type.startsWith('stair'))?.properties?.stairSteps ?? stairSteps)})
                  </label>
                  <input 
                    type="range" 
                    className="w-full" 
                    value={(elements.find(el => selectedElementIds.length === 1 && selectedElementIds[0] === el.id && el.type.startsWith('stair'))?.properties?.stairSteps ?? stairSteps)}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setStairSteps(val);
                      const selectedStairs = elements.filter(el => selectedElementIds.includes(el.id) && el.type.startsWith('stair'));
                      selectedStairs.forEach(stair => {
                         updateElement(stair.id, { properties: { ...stair.properties, stairSteps: val } });
                      });
                    }}
                    min="4"
                    max="20"
                    step="1"
                  />
                </div>
              </div>
            </div>
          </div>

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
