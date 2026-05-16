import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Download, Save } from 'lucide-react';
import type { FinalTile, FinalTileSize, FinalTileType, FinalTileSide, FinalTileSegment } from '../utils/db';

interface MetadataDialogProps {
  isOpen: boolean;
  svgString: string;
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
  gridSize: number;
  onClose: () => void;
  onSave: (metadata: FinalTile, shouldDownload: boolean) => void;
}

const EDGE_LEN: Record<FinalTileSize, number> = {
  small: 2,
  medium: 3,
  large: 4
};

export default function MetadataDialog({ isOpen, svgString, bbox, gridSize, onClose, onSave }: MetadataDialogProps) {
  const [name, setName] = useState('New Tile');
  const [size, setSize] = useState<FinalTileSize>('medium');
  const [type, setType] = useState<FinalTileType>('Room');
  const [quantity, setQuantity] = useState(1);
  const [sides, setSides] = useState<[FinalTileSide, FinalTileSide, FinalTileSide, FinalTileSide]>([
    [{ kind: 'wall', width: 3 }],
    [{ kind: 'wall', width: 3 }],
    [{ kind: 'wall', width: 3 }],
    [{ kind: 'wall', width: 3 }]
  ]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const w = bbox.maxX - bbox.minX;
      const h = bbox.maxY - bbox.minY;
      const units = Math.max(Math.round(w / gridSize), Math.round(h / gridSize));
      
      let determinedSize: FinalTileSize = 'medium';
      if (units <= 2) determinedSize = 'small';
      else if (units === 3) determinedSize = 'medium';
      else if (units >= 4) determinedSize = 'large';
      
      setSize(determinedSize);
      
      const defaultLen = EDGE_LEN[determinedSize];
      setSides([
        [{ kind: 'wall', width: defaultLen }],
        [{ kind: 'wall', width: defaultLen }],
        [{ kind: 'wall', width: defaultLen }],
        [{ kind: 'wall', width: defaultLen }]
      ]);
      setError(null);
    }
  }, [isOpen, bbox, gridSize]);

  if (!isOpen) return null;

  const validateFinalTile = () => {
    const want = EDGE_LEN[size];
    const sideNames = ['Bottom', 'Left', 'Top', 'Right'];
    for (let i = 0; i < sides.length; i++) {
      const sum = sides[i].reduce((n, seg) => n + seg.width, 0);
      if (sum !== want) {
        return `Side ${sideNames[i]} segment widths sum to ${sum}, expected ${want} for size '${size}'`;
      }
    }
    if (name.trim().length === 0) return "Name is required.";
    if (quantity < 1) return "Quantity must be at least 1.";
    return null;
  };

  const handleSave = (shouldDownload: boolean) => {
    const validationError = validateFinalTile();
    if (validationError) {
      setError(validationError);
      return;
    }

    const tileData: FinalTile = {
      id: Date.now(),
      name: name.trim(),
      size,
      type,
      sides,
      image: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString),
      imageSource: 'drawn',
      quantity
    };

    onSave(tileData, shouldDownload);
  };

  const updateSideSegment = (sideIdx: number, segIdx: number, field: keyof FinalTileSegment, value: any) => {
    const newSides = [...sides] as typeof sides;
    const side = [...newSides[sideIdx]];
    side[segIdx] = { ...side[segIdx], [field]: value };
    if (field === 'kind' && value === 'wall') {
      delete side[segIdx].subtype;
    } else if (field === 'kind' && value === 'connector') {
      side[segIdx].subtype = 'hall';
    }
    newSides[sideIdx] = side;
    setSides(newSides);
  };

  const addSegment = (sideIdx: number) => {
    const newSides = [...sides] as typeof sides;
    newSides[sideIdx] = [...newSides[sideIdx], { kind: 'wall', width: 1 }];
    setSides(newSides);
  };

  const removeSegment = (sideIdx: number, segIdx: number) => {
    const newSides = [...sides] as typeof sides;
    newSides[sideIdx] = newSides[sideIdx].filter((_, i) => i !== segIdx);
    if (newSides[sideIdx].length === 0) {
      newSides[sideIdx] = [{ kind: 'wall', width: 1 }];
    }
    setSides(newSides);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-bold">Export Tile & Save Metadata</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col md:flex-row gap-8">
          {/* Left Column: Preview */}
          <div className="flex-1">
            <h3 className="font-semibold mb-2">Tile Preview</h3>
            <div 
              className="w-full aspect-square border border-slate-300 rounded overflow-hidden flex items-center justify-center bg-[#e9ecef]"
              dangerouslySetInnerHTML={{ __html: svgString }}
              style={{
                 // Scale SVG to fit visually while ignoring its internal pixel size
                 '& > svg': { width: '100%', height: '100%' }
              } as any}
            />
          </div>

          {/* Right Column: Form */}
          <div className="flex-1 flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={e => setName(e.target.value)}
                  className="w-full border border-slate-300 rounded p-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label>
                <input 
                  type="number" 
                  min="1"
                  value={quantity} 
                  onChange={e => setQuantity(parseInt(e.target.value) || 1)}
                  className="w-full border border-slate-300 rounded p-2 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Size</label>
                <select 
                  value={size} 
                  onChange={e => setSize(e.target.value as FinalTileSize)}
                  className="w-full border border-slate-300 rounded p-2 text-sm"
                >
                  <option value="small">Small (2 units)</option>
                  <option value="medium">Medium (3 units)</option>
                  <option value="large">Large (4 units)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                <select 
                  value={type} 
                  onChange={e => setType(e.target.value as FinalTileType)}
                  className="w-full border border-slate-300 rounded p-2 text-sm"
                >
                  <option value="Room">Room</option>
                  <option value="Corridor">Corridor</option>
                  <option value="Sanctuary">Sanctuary</option>
                  <option value="Unique">Unique</option>
                </select>
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="font-semibold mb-2">Edge Segments (Expected sum: {EDGE_LEN[size]})</h3>
              <p className="text-xs text-slate-500 mb-4">Define from corner to corner.</p>
              
              {['Bottom', 'Left', 'Top', 'Right'].map((sideName, sideIdx) => (
                <div key={sideName} className="mb-4 bg-slate-50 p-3 rounded border border-slate-200">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-sm">{sideName} Side</span>
                    <button 
                      onClick={() => addSegment(sideIdx)}
                      className="text-indigo-600 hover:text-indigo-800 text-xs flex items-center gap-1"
                    >
                      <Plus size={14} /> Add Segment
                    </button>
                  </div>
                  <div className="space-y-2">
                    {sides[sideIdx].map((seg, segIdx) => (
                      <div key={segIdx} className="flex gap-2 items-center">
                        <select 
                          value={seg.kind} 
                          onChange={e => updateSideSegment(sideIdx, segIdx, 'kind', e.target.value)}
                          className="border border-slate-300 rounded p-1 text-xs flex-1"
                        >
                          <option value="wall">Wall</option>
                          <option value="connector">Connector</option>
                        </select>
                        
                        {seg.kind === 'connector' && (
                          <select 
                            value={seg.subtype} 
                            onChange={e => updateSideSegment(sideIdx, segIdx, 'subtype', e.target.value)}
                            className="border border-slate-300 rounded p-1 text-xs flex-1"
                          >
                            <option value="hall">Hall</option>
                            <option value="door">Door</option>
                            <option value="stairs">Stairs</option>
                          </select>
                        )}
                        
                        <input 
                          type="number" 
                          min="1"
                          value={seg.width} 
                          onChange={e => updateSideSegment(sideIdx, segIdx, 'width', parseInt(e.target.value) || 1)}
                          className="border border-slate-300 rounded p-1 text-xs w-16"
                          title="Segment Width"
                        />
                        
                        <button 
                          onClick={() => removeSegment(sideIdx, segIdx)}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            
            {error && (
              <div className="bg-red-50 text-red-700 p-3 rounded text-sm border border-red-200">
                {error}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t bg-slate-50 flex justify-between rounded-b-lg">
          <button 
            onClick={() => onSave(null as any, true)} // Special case to skip metadata entirely
            className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded text-slate-700 hover:bg-slate-100 font-medium"
          >
            <Download size={18} /> Just Download
          </button>
          
          <button 
            onClick={() => handleSave(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 font-medium"
          >
            <Save size={18} /> Save Metadata & Download
          </button>
        </div>
      </div>
    </div>
  );
}
