import { useState, useEffect, useMemo } from 'react';
import { X, Download, Save } from 'lucide-react';
import type { FinalTile, FinalTileSize, FinalTileType, TileConnector, TileEdge, ConnectorSubtype } from '../utils/db';
import { EXPORT_TILE_PX_BY_SIZE } from '../utils/db';

interface MetadataDialogProps {
  isOpen: boolean;
  svgString: string;
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
  gridSize: number;
  onClose: () => void;
  onSave: (metadata: FinalTile | null, finalSvgString: string, shouldDownload: boolean) => void;
}

// Cycling order when clicking a perimeter cell: none → hall → door → stairs → none
const CONNECTOR_CYCLE: (ConnectorSubtype | null)[] = [null, 'hall', 'door', 'stairs'];

const CONNECTOR_COLORS: Record<ConnectorSubtype, string> = {
  hall: 'rgba(59,130,246,0.55)',   // blue
  door: 'rgba(34,197,94,0.55)',    // green
  stairs: 'rgba(249,115,22,0.55)', // orange
};

const CONNECTOR_LABEL: Record<ConnectorSubtype, string> = {
  hall: 'H',
  door: 'D',
  stairs: 'S',
};

// Inject tile metadata as a data-attribute on the root <svg>.
// Consumed by downstream tile-placement app.
function embedTileMetadata(svgString: string, metadata: object): string {
  const json = JSON.stringify(metadata);
  // Escape double quotes for safe attribute embedding
  const escaped = json.replace(/"/g, '&quot;');
  return svgString.replace(
    /<svg\b([^>]*)>/,
    `<svg$1 data-tile-metadata="${escaped}">`
  );
}

function detectSizeFromPx(widthPx: number): FinalTileSize {
  if (widthPx <= 750) return 'small';
  if (widthPx <= 1500) return 'medium';
  return 'large';
}

function nextConnectorType(current: ConnectorSubtype | undefined): ConnectorSubtype | null {
  const currentIdx = current === undefined ? 0 : CONNECTOR_CYCLE.indexOf(current);
  return CONNECTOR_CYCLE[(currentIdx + 1) % CONNECTOR_CYCLE.length];
}

export default function MetadataDialog({ isOpen, svgString, bbox, gridSize, onClose, onSave }: MetadataDialogProps) {
  const [name, setName] = useState('New Tile');
  const [size, setSize] = useState<FinalTileSize>('medium');
  const [type, setType] = useState<FinalTileType>('Room');
  const [quantity, setQuantity] = useState(1);
  const [connectors, setConnectors] = useState<TileConnector[]>([]);
  const [error, setError] = useState<string | null>(null);

  const widthPx = bbox.maxX - bbox.minX;
  const heightPx = bbox.maxY - bbox.minY;
  const edgeLengthCells = Math.max(1, Math.floor(widthPx / gridSize));

  useEffect(() => {
    if (isOpen) {
      setSize(detectSizeFromPx(widthPx));
      setConnectors([]);
      setError(null);
    }
    // We deliberately depend on widthPx (derived) rather than bbox to avoid
    // re-running when the parent re-renders without changing dimensions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, widthPx]);

  // Perimeter cell coords in canvas/viewBox units (not screen pixels).
  // Convention: cellIndex 0 starts at the canvas-natural origin of each edge.
  const cellRect = (side: TileEdge, cellIndex: number) => {
    const i = cellIndex;
    switch (side) {
      case 'top':    return { x: bbox.minX + i * gridSize, y: bbox.minY,                  w: gridSize, h: gridSize };
      case 'bottom': return { x: bbox.minX + i * gridSize, y: bbox.maxY - gridSize,       w: gridSize, h: gridSize };
      case 'left':   return { x: bbox.minX,                y: bbox.minY + i * gridSize,   w: gridSize, h: gridSize };
      case 'right':  return { x: bbox.maxX - gridSize,     y: bbox.minY + i * gridSize,   w: gridSize, h: gridSize };
    }
  };

  const connectorAt = (side: TileEdge, cellIndex: number) =>
    connectors.find(c => c.side === side && c.cellIndex === cellIndex);

  const handleCellClick = (side: TileEdge, cellIndex: number) => {
    const existing = connectorAt(side, cellIndex);
    const next = nextConnectorType(existing?.type);
    setConnectors(prev => {
      const without = prev.filter(c => !(c.side === side && c.cellIndex === cellIndex));
      return next ? [...without, { side, cellIndex, type: next }] : without;
    });
  };

  // Build the cell list once per render — small (≤4 * edgeLengthCells items).
  const perimeterCells = useMemo(() => {
    const items: { side: TileEdge; cellIndex: number; rect: { x: number; y: number; w: number; h: number } }[] = [];
    const sides: TileEdge[] = ['top', 'right', 'bottom', 'left'];
    for (const side of sides) {
      for (let i = 0; i < edgeLengthCells; i++) {
        items.push({ side, cellIndex: i, rect: cellRect(side, i) });
      }
    }
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edgeLengthCells, bbox.minX, bbox.minY, bbox.maxX, bbox.maxY, gridSize]);

  // Grid line coordinates for the overlay.
  const gridLines = useMemo(() => {
    const verticals: number[] = [];
    const horizontals: number[] = [];
    for (let x = bbox.minX; x <= bbox.maxX + 0.001; x += gridSize) verticals.push(x);
    for (let y = bbox.minY; y <= bbox.maxY + 0.001; y += gridSize) horizontals.push(y);
    return { verticals, horizontals };
  }, [bbox.minX, bbox.minY, bbox.maxX, bbox.maxY, gridSize]);

  if (!isOpen) return null;

  const buildFinalTile = (): FinalTile => ({
    id: Date.now(),
    name: name.trim(),
    size,
    type,
    edgeLengthCells,
    connectors,
    imageSource: 'drawn',
    quantity,
  });

  const validate = (): string | null => {
    if (name.trim().length === 0) return 'Name is required.';
    if (quantity < 1) return 'Quantity must be at least 1.';
    return null;
  };

  const handleSaveMetadata = (shouldDownload: boolean) => {
    const v = validate();
    if (v) { setError(v); return; }
    const metadataForEmbed = { size, edgeLengthCells, connectors };
    const finalSvg = embedTileMetadata(svgString, metadataForEmbed);
    const tile: FinalTile = {
      ...buildFinalTile(),
      image: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(finalSvg),
    };
    onSave(tile, finalSvg, shouldDownload);
  };

  const handleJustDownload = () => {
    // Embed connectors-as-marked even without saving — keeps the SVG self-describing.
    const metadataForEmbed = { size, edgeLengthCells, connectors };
    const finalSvg = embedTileMetadata(svgString, metadataForEmbed);
    onSave(null, finalSvg, true);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-bold">Export Tile & Mark Connectors</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col md:flex-row gap-8">
          {/* Left Column: Preview with grid + clickable perimeter cells */}
          <div className="flex-1">
            <h3 className="font-semibold mb-2">Tile Preview</h3>
            <p className="text-xs text-slate-500 mb-2">
              {edgeLengthCells} × {edgeLengthCells} cells at {gridSize} px pitch.
              Click an edge cell to cycle: <span className="text-blue-600 font-medium">hall</span> → <span className="text-green-600 font-medium">door</span> → <span className="text-orange-500 font-medium">stairs</span> → none.
            </p>
            <div className="relative w-full aspect-square border border-slate-300 rounded overflow-hidden bg-[#e9ecef]">
              {/* Bottom layer: the exported SVG */}
              <div
                className="absolute inset-0"
                dangerouslySetInnerHTML={{ __html: svgString }}
                style={{ pointerEvents: 'none' }}
              />
              {/* Top layer: grid + clickable perimeter cells, sharing the bbox viewBox */}
              <svg
                className="absolute inset-0 w-full h-full"
                viewBox={`${bbox.minX} ${bbox.minY} ${widthPx} ${heightPx}`}
                preserveAspectRatio="xMidYMid meet"
              >
                {/* Grid lines */}
                <g stroke="rgba(0,0,0,0.18)" strokeWidth={Math.max(1, gridSize * 0.02)}>
                  {gridLines.verticals.map((x, i) => (
                    <line key={`v${i}`} x1={x} y1={bbox.minY} x2={x} y2={bbox.maxY} />
                  ))}
                  {gridLines.horizontals.map((y, i) => (
                    <line key={`h${i}`} x1={bbox.minX} y1={y} x2={bbox.maxX} y2={y} />
                  ))}
                </g>
                {/* Perimeter cells (clickable) */}
                {perimeterCells.map(({ side, cellIndex, rect }) => {
                  const c = connectorAt(side, cellIndex);
                  const fill = c ? CONNECTOR_COLORS[c.type] : 'rgba(0,0,0,0)';
                  return (
                    <g key={`${side}-${cellIndex}`}
                       onClick={() => handleCellClick(side, cellIndex)}
                       style={{ cursor: 'pointer' }}>
                      <rect
                        x={rect.x} y={rect.y} width={rect.w} height={rect.h}
                        fill={fill}
                        stroke={c ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.15)'}
                        strokeWidth={Math.max(1, gridSize * 0.03)}
                      />
                      {c && (
                        <text
                          x={rect.x + rect.w / 2}
                          y={rect.y + rect.h / 2}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fontSize={gridSize * 0.5}
                          fontWeight="bold"
                          fill="white"
                          stroke="rgba(0,0,0,0.3)"
                          strokeWidth={gridSize * 0.02}
                          style={{ paintOrder: 'stroke' }}
                        >
                          {CONNECTOR_LABEL[c.type]}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
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
                  <option value="small">Small ({EXPORT_TILE_PX_BY_SIZE.small} px)</option>
                  <option value="medium">Medium ({EXPORT_TILE_PX_BY_SIZE.medium} px)</option>
                  <option value="large">Large ({EXPORT_TILE_PX_BY_SIZE.large} px)</option>
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
              <h3 className="font-semibold mb-2">Connectors ({connectors.length})</h3>
              {connectors.length === 0 ? (
                <p className="text-sm text-slate-500">No connectors marked. Click perimeter cells on the preview to add some.</p>
              ) : (
                <ul className="text-xs space-y-1 max-h-40 overflow-y-auto">
                  {connectors
                    .slice()
                    .sort((a, b) => a.side.localeCompare(b.side) || a.cellIndex - b.cellIndex)
                    .map((c, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <span
                          className="inline-block w-3 h-3 rounded-sm"
                          style={{ background: CONNECTOR_COLORS[c.type] }}
                        />
                        <span className="font-mono">
                          {c.side}[{c.cellIndex}] — {c.type}
                        </span>
                      </li>
                    ))}
                </ul>
              )}
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
            onClick={handleJustDownload}
            className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded text-slate-700 hover:bg-slate-100 font-medium"
          >
            <Download size={18} /> Just Download
          </button>

          <button
            onClick={() => handleSaveMetadata(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 font-medium"
          >
            <Save size={18} /> Save Metadata & Download
          </button>
        </div>
      </div>
    </div>
  );
}
