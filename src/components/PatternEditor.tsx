import React, { useState, useRef } from 'react';
import { wrapAndClipSegment } from '../utils/dysonGenerator';
import type { Segment } from '../utils/dysonGenerator';

interface PatternEditorProps {
  initialSegments: Segment[];
  gridSize: number;
  onSave: (segments: Segment[]) => void;
  onCancel: () => void;
}

export default function PatternEditor({ initialSegments, gridSize, onSave, onCancel }: PatternEditorProps) {
  const [segments, setSegments] = useState<Segment[]>(initialSegments);
  const [tool, setTool] = useState<'select' | 'draw' | 'erase'>('draw');
  
  const [drawingLine, setDrawingLine] = useState<{x1: number, y1: number, x2: number, y2: number} | null>(null);
  const [draggingSegment, setDraggingSegment] = useState<{id: string, startX: number, startY: number, original: Segment} | null>(null);
  
  const svgRef = useRef<SVGSVGElement>(null);

  const getMousePos = (e: React.MouseEvent | MouseEvent) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const CTM = svgRef.current.getScreenCTM();
    if (!CTM) return { x: 0, y: 0 };
    return {
      x: (e.clientX - CTM.e) / CTM.a,
      y: (e.clientY - CTM.f) / CTM.d
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (tool === 'draw') {
      const pos = getMousePos(e);
      setDrawingLine({ x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const pos = getMousePos(e);

    if (tool === 'draw' && drawingLine) {
      setDrawingLine({ ...drawingLine, x2: pos.x, y2: pos.y });
    } else if (tool === 'select' && draggingSegment) {
      const dx = pos.x - draggingSegment.startX;
      const dy = pos.y - draggingSegment.startY;
      setSegments(segments.map(seg => {
        if (seg.id === draggingSegment.id) {
          return {
            ...seg,
            x1: draggingSegment.original.x1 + dx,
            y1: draggingSegment.original.y1 + dy,
            x2: draggingSegment.original.x2 + dx,
            y2: draggingSegment.original.y2 + dy,
          };
        }
        return seg;
      }));
    }
  };

  const handleMouseUp = () => {
    if (tool === 'draw' && drawingLine) {
      // Don't add if it's too short
      const len = Math.hypot(drawingLine.x2 - drawingLine.x1, drawingLine.y2 - drawingLine.y1);
      if (len > 1) {
        setSegments([...segments, {
          id: Math.random().toString(36).substring(2, 9),
          x1: drawingLine.x1,
          y1: drawingLine.y1,
          x2: drawingLine.x2,
          y2: drawingLine.y2
        }]);
      }
      setDrawingLine(null);
    } else if (tool === 'select' && draggingSegment) {
      setDraggingSegment(null);
    }
  };

  const handleSegmentMouseDown = (e: React.MouseEvent, seg: Segment) => {
    e.stopPropagation();
    if (tool === 'erase') {
      setSegments(segments.filter(s => s.id !== seg.id));
    } else if (tool === 'select') {
      const pos = getMousePos(e);
      setDraggingSegment({ id: seg.id!, startX: pos.x, startY: pos.y, original: { ...seg } });
    }
  };

  const handleSave = () => {
    // Run wrapAndClipSegment on all segments to ensure seamless tiling
    const finalSegments: Segment[] = [];
    for (const seg of segments) {
      const dx = seg.x2 - seg.x1;
      const dy = seg.y2 - seg.y1;
      const len = Math.hypot(dx, dy);
      if (len < 0.1) continue;
      
      const DirX = dx / len;
      const DirY = dy / len;
      
      const newSegs = wrapAndClipSegment(seg.x1, seg.y1, DirX, DirY, 0, len, gridSize);
      finalSegments.push(...newSegs);
    }
    onSave(finalSegments);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-2xl p-6 w-[800px] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-slate-800">Dyson Pattern Studio</h2>
          <button onClick={onCancel} className="text-slate-500 hover:text-slate-800">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-1 min-h-[500px] gap-6">
          {/* Toolbar */}
          <div className="flex flex-col gap-2 w-32">
            <button 
              className={`p-3 rounded-md text-left transition-colors ${tool === 'draw' ? 'bg-indigo-600 text-white' : 'bg-slate-100 hover:bg-slate-200'}`}
              onClick={() => setTool('draw')}
            >
              Draw
            </button>
            <button 
              className={`p-3 rounded-md text-left transition-colors ${tool === 'select' ? 'bg-indigo-600 text-white' : 'bg-slate-100 hover:bg-slate-200'}`}
              onClick={() => setTool('select')}
            >
              Move
            </button>
            <button 
              className={`p-3 rounded-md text-left transition-colors ${tool === 'erase' ? 'bg-indigo-600 text-white' : 'bg-slate-100 hover:bg-slate-200'}`}
              onClick={() => setTool('erase')}
            >
              Erase
            </button>
            
            <div className="flex-1" />
            <div className="text-xs text-slate-500 p-2 bg-slate-50 rounded border border-slate-200">
              Lines drawn outside the boundary will automatically wrap seamlessly on Save!
            </div>
          </div>

          {/* Canvas Container */}
          <div className="flex-1 bg-slate-50 border-2 border-slate-300 rounded-lg overflow-hidden flex items-center justify-center">
            {/* The SVG viewBox is exactly gridSize x gridSize, but rendered large */}
            <svg 
              ref={svgRef}
              width="500" 
              height="500" 
              viewBox={`0 0 ${gridSize} ${gridSize}`}
              className="bg-white shadow-sm cursor-crosshair border border-blue-200"
              style={{ overflow: 'visible' }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {/* Reference Grid/Boundary */}
              <rect x="0" y="0" width={gridSize} height={gridSize} fill="none" stroke="#e2e8f0" strokeWidth="0.5" />
              
              {/* Guidelines to show wraparound areas visually (outside bounds) */}
              <rect x={-gridSize} y={0} width={gridSize} height={gridSize} fill="#f8fafc" opacity="0.5" />
              <rect x={gridSize} y={0} width={gridSize} height={gridSize} fill="#f8fafc" opacity="0.5" />
              <rect x={0} y={-gridSize} width={gridSize} height={gridSize} fill="#f8fafc" opacity="0.5" />
              <rect x={0} y={gridSize} width={gridSize} height={gridSize} fill="#f8fafc" opacity="0.5" />
              
              <rect x={0} y={0} width={gridSize} height={gridSize} fill="none" stroke="#94a3b8" strokeWidth="1" strokeDasharray="2,2" />

              {/* Segments */}
              {segments.map(seg => (
                <line
                  key={seg.id}
                  x1={seg.x1} y1={seg.y1}
                  x2={seg.x2} y2={seg.y2}
                  stroke="black"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  className={tool === 'select' || tool === 'erase' ? 'cursor-pointer hover:stroke-indigo-500 hover:stroke-2' : ''}
                  onMouseDown={(e) => handleSegmentMouseDown(e, seg)}
                />
              ))}

              {/* Current Drawing Line */}
              {drawingLine && (
                <line
                  x1={drawingLine.x1} y1={drawingLine.y1}
                  x2={drawingLine.x2} y2={drawingLine.y2}
                  stroke="indigo"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeDasharray="2,2"
                />
              )}
            </svg>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button 
            onClick={onCancel}
            className="px-6 py-2 rounded-md font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            className="px-6 py-2 rounded-md font-medium text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-colors"
          >
            Save & Wrap Pattern
          </button>
        </div>
      </div>
    </div>
  );
}
