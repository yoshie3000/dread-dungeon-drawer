import React, { useRef, useState, useEffect } from 'react';
import type { MouseEvent, WheelEvent } from 'react';
import { useMapStore } from '../store';
import type { Point } from '../store';
import rough from 'roughjs';
import { segmentsToPath } from '../utils/dysonGenerator';

const generator = rough.generator();

function getRoughPath(drawable: any): string {
  let path = '';
  for (const set of drawable.sets) {
    for (const op of set.ops) {
      const data = op.data;
      switch (op.op) {
        case 'move': path += `M${data[0]} ${data[1]} `; break;
        case 'bcurveTo': path += `C${data[0]} ${data[1]}, ${data[2]} ${data[3]}, ${data[4]} ${data[5]} `; break;
        case 'lineTo': path += `L${data[0]} ${data[1]} `; break;
      }
    }
  }
  return path.trim();
}

import type { MapElement } from '../store';

const getClickedElement = (rawPoint: Point, elements: MapElement[]) => {
  const areaTools = ['room', 'interior', 'fill', 'unfill', 'decoration-square', 'decoration-circle', 'decoration-rectangle', 'export-tile', 'image'];
  
  return [...elements].reverse().find(el => {
    if (areaTools.includes(el.type)) {
      const elMinX = Math.min(el.points[0].x, el.points[1].x);
      const elMaxX = Math.max(el.points[0].x, el.points[1].x);
      const elMinY = Math.min(el.points[0].y, el.points[1].y);
      const elMaxY = Math.max(el.points[0].y, el.points[1].y);
      return rawPoint.x >= elMinX && rawPoint.x <= elMaxX && rawPoint.y >= elMinY && rawPoint.y <= elMaxY;
    } else {
      // Line elements
      const distToSegmentSquared = (p: {x: number, y: number}, v: {x: number, y: number}, w: {x: number, y: number}) => {
        const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
        if (l2 === 0) return (p.x - v.x) ** 2 + (p.y - v.y) ** 2;
        let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
        t = Math.max(0, Math.min(1, t));
        return (p.x - (v.x + t * (w.x - v.x))) ** 2 + (p.y - (v.y + t * (w.y - v.y))) ** 2;
      };
      
      for (let i = 0; i < el.points.length - 1; i++) {
        if (Math.sqrt(distToSegmentSquared(rawPoint, el.points[i], el.points[i+1])) < 20) {
          return true;
        }
      }
      return false;
    }
  });
};

interface CanvasProps {
  onExportRegion?: (bbox: { minX: number, minY: number, maxX: number, maxY: number }) => void;
}

export default function Canvas({ onExportRegion }: CanvasProps) {
  const {
    elements,
    setElements,
    addElement,
    viewState,
    setViewState,
    gridSize,
    showGrid,
    showHatch,
    layerVisibility,
    layerLock,
    tool,
    hatchStyle,
    hatchDensity,
    softBorderColor,
    hatchWidth,
    hatchOrganic,
    hatchSmoothness,
    stairSteps,
    dynamicSegments,
    savedPatterns,
    selectedElementIds,
    setSelectedElementIds,
    snapToGrid,
    setTool
  } = useMapStore();
  const svgRef = useRef<SVGSVGElement>(null);
  
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState<Point>({ x: 0, y: 0 });

  const [isDrawing, setIsDrawing] = useState(false);
  const [startDrawPoint, setStartDrawPoint] = useState<Point>({ x: 0, y: 0 });
  const [currentDrawPoint, setCurrentDrawPoint] = useState<Point>({ x: 0, y: 0 });
  
  // New Selection & Drag states
  const [isDraggingSelection, setIsDraggingSelection] = useState(false);
  const [isDrawingSelectionFence, setIsDrawingSelectionFence] = useState(false);
  const [dragStartPoint, setDragStartPoint] = useState<Point>({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState({ dx: 0, dy: 0 });

  const [isResizing, setIsResizing] = useState(false);
  const [resizeElementId, setResizeElementId] = useState<string | null>(null);
  const [resizeScale, setResizeScale] = useState(1);

  const getMapCoordinates = (e: MouseEvent<SVGSVGElement> | React.MouseEvent): Point => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    
    return {
      x: (screenX - viewState.x) / viewState.zoom,
      y: (screenY - viewState.y) / viewState.zoom
    };
  };

  const getSnappedPoint = (point: Point): Point => {
    if (!snapToGrid) return point;
    return {
      x: Math.round(point.x / gridSize) * gridSize,
      y: Math.round(point.y / gridSize) * gridSize
    };
  };

  const handleMouseDown = (e: MouseEvent<SVGSVGElement>) => {
    if (e.button === 1 || e.button === 2 || e.altKey) {
      setIsPanning(true);
      setStartPan({ x: e.clientX, y: e.clientY });
      return;
    }

    if (e.button === 0) {
      if (tool === 'select') {
        const rawPoint = getMapCoordinates(e);
        const clickedEl = getClickedElement(rawPoint, elements.filter(el => !layerLock[el.layer ?? 0]));
        
        if (clickedEl) {
          if (selectedElementIds.length === 1 && selectedElementIds[0] === clickedEl.id && clickedEl.type.startsWith('decoration-')) {
            const maxX = Math.max(...clickedEl.points.map(p => p.x));
            const maxY = Math.max(...clickedEl.points.map(p => p.y));
            
            const handleSize = 10;
            // Snapped check is too strict, check against raw point
            if (rawPoint.x >= maxX - handleSize && rawPoint.x <= maxX + handleSize && rawPoint.y >= maxY - handleSize && rawPoint.y <= maxY + handleSize) {
              setIsResizing(true);
              setResizeElementId(clickedEl.id);
              
              const minX = Math.min(...clickedEl.points.map(p => p.x));
              const minY = Math.min(...clickedEl.points.map(p => p.y));
              setDragStartPoint({x: minX, y: minY}); // Anchor point
              setResizeScale(1);
              return;
            }
          }

          if (!selectedElementIds.includes(clickedEl.id)) {
            setSelectedElementIds([clickedEl.id]);
          }
          setIsDraggingSelection(true);
          setDragStartPoint(rawPoint);
          setDragOffset({ dx: 0, dy: 0 });
        } else {
          setSelectedElementIds([]);
          setIsDrawingSelectionFence(true);
          setStartDrawPoint(rawPoint);
          setCurrentDrawPoint(rawPoint);
        }
      } else {
        const point = getSnappedPoint(getMapCoordinates(e));
        setIsDrawing(true);
        setStartDrawPoint(point);
        setCurrentDrawPoint(point);
      }
    }
  };

  const handleMouseMove = (e: MouseEvent<SVGSVGElement>) => {
    if (isPanning) {
      const dx = e.clientX - startPan.x;
      const dy = e.clientY - startPan.y;
      setViewState({ 
        x: viewState.x + dx, 
        y: viewState.y + dy 
      });
      setStartPan({ x: e.clientX, y: e.clientY });
      return;
    }

    if (isResizing && resizeElementId) {
      const snappedPoint = getSnappedPoint(getMapCoordinates(e));
      const el = elements.find(el => el.id === resizeElementId);
      if (el) {
        const minX = Math.min(...el.points.map(p => p.x));
        const maxX = Math.max(...el.points.map(p => p.x));
        const minY = Math.min(...el.points.map(p => p.y));
        const maxY = Math.max(...el.points.map(p => p.y));
        
        const origWidth = maxX - minX;
        const origHeight = maxY - minY;
        
        if (origWidth > 0 && origHeight > 0) {
          const mouseDist = Math.hypot(snappedPoint.x - minX, snappedPoint.y - minY);
          const origDist = Math.hypot(origWidth, origHeight);
          const minScale = Math.max((gridSize / 2) / origWidth, (gridSize / 2) / origHeight);
          setResizeScale(Math.max(mouseDist / origDist, minScale));
        }
      }
      return;
    }

    if (isDraggingSelection) {
      const currentRaw = getMapCoordinates(e);
      if (snapToGrid) {
        setDragOffset({
          dx: Math.round((currentRaw.x - dragStartPoint.x) / gridSize) * gridSize,
          dy: Math.round((currentRaw.y - dragStartPoint.y) / gridSize) * gridSize
        });
      } else {
        setDragOffset({
          dx: currentRaw.x - dragStartPoint.x,
          dy: currentRaw.y - dragStartPoint.y
        });
      }
      return;
    }

    if (isDrawingSelectionFence) {
      setCurrentDrawPoint(getMapCoordinates(e));
      return;
    }

    if (isDrawing) {
      const point = getSnappedPoint(getMapCoordinates(e));
      setCurrentDrawPoint(point);
    }
  };

  const handleMouseUp = (e?: React.MouseEvent<SVGSVGElement>) => {
    setIsPanning(false);

    if (isResizing && resizeElementId) {
      setIsResizing(false);
      if (resizeScale !== 1) {
        const newElements = elements.map(el => {
          if (el.id === resizeElementId) {
            const minX = Math.min(...el.points.map(p => p.x));
            const minY = Math.min(...el.points.map(p => p.y));
            const newPoints = el.points.map(p => {
              if (!snapToGrid) {
                return {
                  x: minX + (p.x - minX) * resizeScale,
                  y: minY + (p.y - minY) * resizeScale
                };
              }
              return {
                x: Math.round((minX + (p.x - minX) * resizeScale) / (gridSize / 2)) * (gridSize / 2),
                y: Math.round((minY + (p.y - minY) * resizeScale) / (gridSize / 2)) * (gridSize / 2)
              };
            });
            
            let newProperties = el.properties;
            if (el.properties?.pivot) {
               const scale = resizeScale;
               newProperties = {
                 ...el.properties,
                 pivot: { x: minX + (el.properties.pivot.x - minX) * scale, y: minY + (el.properties.pivot.y - minY) * scale },
                 originalPoints: el.properties.originalPoints?.map((p: Point) => {
                   if (!snapToGrid) {
                     return {
                       x: minX + (p.x - minX) * scale,
                       y: minY + (p.y - minY) * scale
                     };
                   }
                   return {
                     x: Math.round((minX + (p.x - minX) * scale) / (gridSize / 2)) * (gridSize / 2),
                     y: Math.round((minY + (p.y - minY) * scale) / (gridSize / 2)) * (gridSize / 2)
                   };
                 })
               };
            }
            return { ...el, points: newPoints, properties: newProperties };
          }
          return el;
        });
        setElements(newElements);
      }
      setResizeElementId(null);
      setResizeScale(1);
      return;
    }

    if (isDraggingSelection) {
      setIsDraggingSelection(false);
      if (dragOffset.dx !== 0 || dragOffset.dy !== 0) {
        const newElements = elements.map((el: MapElement) => {
          if (selectedElementIds.includes(el.id)) {
            const newPoints = el.points.map((p: Point) => ({ x: p.x + dragOffset.dx, y: p.y + dragOffset.dy }));
            
            let newProperties = el.properties;
            if (el.properties?.pivot) {
              newProperties = {
                ...el.properties,
                pivot: { x: el.properties.pivot.x + dragOffset.dx, y: el.properties.pivot.y + dragOffset.dy },
                originalPoints: el.properties.originalPoints?.map((p: Point) => ({ x: p.x + dragOffset.dx, y: p.y + dragOffset.dy }))
              };
            }
            
            return { ...el, points: newPoints, properties: newProperties };
          }
          return el;
        });
        setElements(newElements);
      }
      setDragOffset({ dx: 0, dy: 0 });
      return;
    }

    if (isDrawingSelectionFence) {
      setIsDrawingSelectionFence(false);
      const minX = Math.min(startDrawPoint.x, currentDrawPoint.x);
      const minY = Math.min(startDrawPoint.y, currentDrawPoint.y);
      const maxX = Math.max(startDrawPoint.x, currentDrawPoint.x);
      const maxY = Math.max(startDrawPoint.y, currentDrawPoint.y);
      
      if (maxX - minX > 0 && maxY - minY > 0) {
        const newlySelectedIds = elements.filter(el => {
          const elMinX = Math.min(...el.points.map((p: Point) => p.x));
          const elMaxX = Math.max(...el.points.map((p: Point) => p.x));
          const elMinY = Math.min(...el.points.map((p: Point) => p.y));
          const elMaxY = Math.max(...el.points.map((p: Point) => p.y));
          
          return !(elMaxX <= minX || elMinX >= maxX || elMaxY <= minY || elMinY >= maxY) && !layerLock[el.layer ?? 0];
        }).map(el => el.id);
        
        setSelectedElementIds(newlySelectedIds);
      }
      return;
    }

    if (isDrawing) {
      setIsDrawing(false);
      
      if (startDrawPoint.x !== currentDrawPoint.x || startDrawPoint.y !== currentDrawPoint.y) {
        if (tool === 'room' || tool === 'interior' || tool === 'fill' || tool === 'unfill' || tool.startsWith('decoration-')) {
          const minX = Math.min(startDrawPoint.x, currentDrawPoint.x);
          const minY = Math.min(startDrawPoint.y, currentDrawPoint.y);
          const maxX = Math.max(startDrawPoint.x, currentDrawPoint.x);
          const maxY = Math.max(startDrawPoint.y, currentDrawPoint.y);
          
          if (maxX - minX > 0 && maxY - minY > 0) {
             addElement({
               id: Math.random().toString(36).substring(2, 9),
               type: tool as any,
               points: [
                 { x: minX, y: minY },
                 { x: maxX, y: maxY }
               ]
             });
          }
        } else if (tool === 'stair' || tool === 'stair-depth' || tool === 'stair-perspective') {
          const minX = Math.min(startDrawPoint.x, currentDrawPoint.x);
          const minY = Math.min(startDrawPoint.y, currentDrawPoint.y);
          const maxX = Math.max(startDrawPoint.x, currentDrawPoint.x);
          const maxY = Math.max(startDrawPoint.y, currentDrawPoint.y);
          
          if (maxX - minX > 0 && maxY - minY > 0) {
             addElement({
               id: Math.random().toString(36).substring(2, 9),
               type: tool,
               points: [startDrawPoint, currentDrawPoint]
             });
          }
        } else if (tool === 'delete') {
          const minX = Math.min(startDrawPoint.x, currentDrawPoint.x);
          const minY = Math.min(startDrawPoint.y, currentDrawPoint.y);
          const maxX = Math.max(startDrawPoint.x, currentDrawPoint.x);
          const maxY = Math.max(startDrawPoint.y, currentDrawPoint.y);
          
          if (maxX - minX > 0 && maxY - minY > 0) {
            const newElements = elements.filter(el => {
              const elMinX = Math.min(el.points[0].x, el.points[1].x);
              const elMaxX = Math.max(el.points[0].x, el.points[1].x);
              const elMinY = Math.min(el.points[0].y, el.points[1].y);
              const elMaxY = Math.max(el.points[0].y, el.points[1].y);
              
              const intersect = !(elMaxX <= minX || elMinX >= maxX || elMaxY <= minY || elMinY >= maxY);
              return !intersect || layerLock[el.layer ?? 0];
            });
            setElements(newElements);
          }
        } else if (tool === 'export-region') {
          const minX = Math.min(startDrawPoint.x, currentDrawPoint.x);
          const minY = Math.min(startDrawPoint.y, currentDrawPoint.y);
          const maxX = Math.max(startDrawPoint.x, currentDrawPoint.x);
          const maxY = Math.max(startDrawPoint.y, currentDrawPoint.y);
          
          if (maxX - minX > 0 && maxY - minY > 0) {
            onExportRegion?.({ minX, minY, maxX, maxY });
          }
        } else if (tool === 'export-tile') {
          const exportPoint = startDrawPoint;
          const newEl: MapElement = {
            id: 'export-tile-marker',
            type: 'export-tile' as any,
            points: [exportPoint, { x: exportPoint.x + 144, y: exportPoint.y + 144 }]
          };
          setElements([...elements.filter(e => e.type !== 'export-tile'), newEl]);
          setTool('select');
        } else if (tool.startsWith('decoration-')) {
          let p1 = startDrawPoint;
          let p2 = currentDrawPoint;
          
          if (snapToGrid) {
             // Center-based drawing so the center snaps to the grid intersection
             const rx = Math.abs(currentDrawPoint.x - startDrawPoint.x);
             const ry = Math.abs(currentDrawPoint.y - startDrawPoint.y);
             p1 = { x: startDrawPoint.x - rx, y: startDrawPoint.y - ry };
             p2 = { x: startDrawPoint.x + rx, y: startDrawPoint.y + ry };
          }

          if (p1.x !== p2.x && p1.y !== p2.y) {
            addElement({
              id: Math.random().toString(36).substring(2, 9),
              type: tool as any,
              points: [p1, p2],
              properties: { hatchStyle, hatchDensity, hatchWidth, hatchSmoothness, hatchOrganic }
            });
          }
        } else if (tool === 'wall' || tool.startsWith('door')) {
          addElement({
            id: Math.random().toString(36).substring(2, 9),
            type: tool as any,
            points: [startDrawPoint, currentDrawPoint]
          });
        }
      } else if (tool === 'delete' && e) {
        // Handle single click deletion
        const rawPoint = getMapCoordinates(e);
        const clickedEl = getClickedElement(rawPoint, elements.filter(el => !layerLock[el.layer ?? 0]));

        if (clickedEl) {
          setElements(elements.filter(el => el.id !== clickedEl.id));
        }
      } else if (tool === 'rotate' && e) {
        const rawPoint = getMapCoordinates(e);
        const clickedEl = getClickedElement(rawPoint, elements.filter(el => !layerLock[el.layer ?? 0]));
        
        if (clickedEl) {
          const areaTools = ['room', 'interior', 'fill', 'unfill'];
          
          // Use original geometry to prevent rounding drift ("walking") across multiple rotations
          const origPoints = clickedEl.properties?.originalPoints || clickedEl.points;
          let cx = clickedEl.properties?.pivot?.x;
          let cy = clickedEl.properties?.pivot?.y;
          
          if (cx === undefined || cy === undefined) {
            const minX = Math.min(...origPoints.map((p: Point) => p.x));
            const maxX = Math.max(...origPoints.map((p: Point) => p.x));
            const minY = Math.min(...origPoints.map((p: Point) => p.y));
            const maxY = Math.max(...origPoints.map((p: Point) => p.y));
            cx = (minX + maxX) / 2;
            cy = (minY + maxY) / 2;
          }

          let rotation = (clickedEl.properties?.rotation || 0) + 90;
          if (rotation >= 360) rotation = 0;

          const rotatedPoints = origPoints.map((p: Point) => {
            let newX = p.x;
            let newY = p.y;
            
            if (rotation === 90) {
              newX = cx - (p.y - cy);
              newY = cy + (p.x - cx);
            } else if (rotation === 180) {
              newX = cx - (p.x - cx);
              newY = cy - (p.y - cy);
            } else if (rotation === 270) {
              newX = cx + (p.y - cy);
              newY = cy - (p.x - cx);
            }
            
            return {
              x: Math.round(newX / gridSize) * gridSize,
              y: Math.round(newY / gridSize) * gridSize
            };
          });

          const newProperties = {
            ...clickedEl.properties,
            originalPoints: origPoints,
            pivot: { x: cx, y: cy },
            rotation
          };

          if (areaTools.includes(clickedEl.type)) {
            // Normalize so points[0] is always top-left and points[1] is bottom-right
            const finalPoints = [
              { x: Math.min(rotatedPoints[0].x, rotatedPoints[1].x), y: Math.min(rotatedPoints[0].y, rotatedPoints[1].y) },
              { x: Math.max(rotatedPoints[0].x, rotatedPoints[1].x), y: Math.max(rotatedPoints[0].y, rotatedPoints[1].y) }
            ];
            
            setElements(elements.map((el: MapElement) => el.id === clickedEl.id ? { ...el, points: finalPoints, properties: newProperties } : el));
          } else {
            setElements(elements.map((el: MapElement) => el.id === clickedEl.id ? { ...el, points: rotatedPoints, properties: newProperties } : el));
          }
        }
      }
    }
  };

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomSensitivity = 0.001;
      const delta = -e.deltaY * zoomSensitivity;
      const newZoom = Math.max(0.1, Math.min(viewState.zoom + delta, 5));
      
      const rect = svg.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const mapX = (mouseX - viewState.x) / viewState.zoom;
      const mapY = (mouseY - viewState.y) / viewState.zoom;

      const newX = mouseX - mapX * newZoom;
      const newY = mouseY - mapY * newZoom;

      setViewState({ zoom: newZoom, x: newX, y: newY });
    };

    svg.addEventListener('wheel', handleWheel as any, { passive: false });
    return () => svg.removeEventListener('wheel', handleWheel as any);
  }, [viewState, setViewState]);

  const scaledGridSize = gridSize * viewState.zoom;

  // --- MERGE ROOM WALLS PER LAYER ---
  const { layerMergedLines, layerMergedRoughPaths } = React.useMemo(() => {
    const layerMLines: {x1: number, y1: number, x2: number, y2: number}[][] = [[], [], [], []];
    const layerMPaths: string[][] = [[], [], [], []];

    const mergeIntervals = (intervals: {start: number, end: number}[]) => {
      if (intervals.length === 0) return [];
      intervals.sort((a, b) => a.start - b.start);
      const merged = [intervals[0]];
      for (let i = 1; i < intervals.length; i++) {
        const last = merged[merged.length - 1];
        const curr = intervals[i];
        if (curr.start <= last.end) {
          last.end = Math.max(last.end, curr.end);
        } else {
          merged.push(curr);
        }
      }
      return merged.filter(i => i.end > i.start);
    };

    for (let layer = 0; layer < 4; layer++) {
      const layerElements = elements.filter(el => (el.layer ?? 0) === layer);
      const hWalls: Record<number, {start: number, end: number}[]> = {};
      const vWalls: Record<number, {start: number, end: number}[]> = {};
      const maskVolumes = layerElements.filter(el => el.type === 'room' || el.type === 'interior');

      layerElements.filter(el => el.type === 'room').forEach(r => {
        const minX = Math.min(r.points[0].x, r.points[1].x);
        const maxX = Math.max(r.points[0].x, r.points[1].x);
        const minY = Math.min(r.points[0].y, r.points[1].y);
        const maxY = Math.max(r.points[0].y, r.points[1].y);

        if (maxX > minX && maxY > minY) {
          if (!hWalls[minY]) hWalls[minY] = [];
          hWalls[minY].push({start: minX, end: maxX});
          if (!hWalls[maxY]) hWalls[maxY] = [];
          hWalls[maxY].push({start: minX, end: maxX});
          if (!vWalls[minX]) vWalls[minX] = [];
          vWalls[minX].push({start: minY, end: maxY});
          if (!vWalls[maxX]) vWalls[maxX] = [];
          vWalls[maxX].push({start: minY, end: maxY});
        }
      });

      Object.keys(hWalls).forEach(yStr => {
        const y = Number(yStr);
        let intervals = hWalls[y];
        maskVolumes.forEach(vol => {
          const minX = Math.min(vol.points[0].x, vol.points[1].x);
          const maxX = Math.max(vol.points[0].x, vol.points[1].x);
          const minY = Math.min(vol.points[0].y, vol.points[1].y);
          const maxY = Math.max(vol.points[0].y, vol.points[1].y);
          
          if (minY < y && y < maxY) {
            const newIntervals: {start: number, end: number}[] = [];
            intervals.forEach(int => {
              if (maxX <= int.start || minX >= int.end) {
                newIntervals.push(int);
              } else {
                if (int.start < minX) newIntervals.push({start: int.start, end: minX});
                if (int.end > maxX) newIntervals.push({start: maxX, end: int.end});
              }
            });
            intervals = newIntervals;
          }
        });
        hWalls[y] = intervals;
      });

      Object.keys(vWalls).forEach(xStr => {
        const x = Number(xStr);
        let intervals = vWalls[x];
        maskVolumes.forEach(vol => {
          const minX = Math.min(vol.points[0].x, vol.points[1].x);
          const maxX = Math.max(vol.points[0].x, vol.points[1].x);
          const minY = Math.min(vol.points[0].y, vol.points[1].y);
          const maxY = Math.max(vol.points[0].y, vol.points[1].y);
          
          if (minX < x && x < maxX) {
            const newIntervals: {start: number, end: number}[] = [];
            intervals.forEach(int => {
              if (maxY <= int.start || minY >= int.end) {
                newIntervals.push(int);
              } else {
                if (int.start < minY) newIntervals.push({start: int.start, end: minY});
                if (int.end > maxY) newIntervals.push({start: maxY, end: int.end});
              }
            });
            intervals = newIntervals;
          }
        });
        vWalls[x] = intervals;
      });

      const mLines: {x1: number, y1: number, x2: number, y2: number}[] = [];
      Object.keys(hWalls).forEach(yStr => {
        const y = Number(yStr);
        mergeIntervals(hWalls[y]).forEach(int => mLines.push({x1: int.start, y1: y, x2: int.end, y2: y}));
      });
      Object.keys(vWalls).forEach(xStr => {
        const x = Number(xStr);
        mergeIntervals(vWalls[x]).forEach(int => mLines.push({x1: x, y1: int.start, x2: x, y2: int.end}));
      });

      const mPaths = mLines.map((line, i) => {
        const seed = Math.abs(Math.floor(line.x1 + line.y1 + line.x2 + line.y2 + i)) || 1;
        return getRoughPath(generator.line(line.x1, line.y1, line.x2, line.y2, { roughness: 1.5, strokeWidth: 2.5, seed }));
      });

      layerMLines[layer] = mLines;
      layerMPaths[layer] = mPaths;
    }

    return { layerMergedLines: layerMLines, layerMergedRoughPaths: layerMPaths };
  }, [elements]);
  // --------------------------

  const dysonDynamicPath = React.useMemo(() => {
    return segmentsToPath(dynamicSegments);
  }, [dynamicSegments]);

  const layerOrganicMaskElements = React.useMemo(() => {
    if (!hatchOrganic) return [[], [], [], []];
    const layerMasks: React.ReactNode[][] = [[], [], [], []];
    const chunkSize = 50 - (hatchSmoothness / 100) * 45;

    for (let layer = 0; layer < 4; layer++) {
      layerMergedLines[layer].forEach((line, i) => {
        const len = Math.hypot(line.x2 - line.x1, line.y2 - line.y1);
        const stepSize = 4;
        const steps = Math.max(1, Math.ceil(len / stepSize));
        
        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          const x = line.x1 + t * (line.x2 - line.x1);
          const y = line.y1 + t * (line.y2 - line.y1);
          
          const chunkX = Math.floor(x / chunkSize) * chunkSize;
          const chunkY = Math.floor(y / chunkSize) * chunkSize;

          const noise = (Math.sin(chunkX * 0.05) + Math.cos(chunkY * 0.05) + 2) / 4; // 0 to 1
          const radius = gridSize * 0.1 + noise * (gridSize * hatchWidth - gridSize * 0.1);
          
          layerMasks[layer].push(
            <rect 
              key={`om-${layer}-${i}-${s}`} 
              x={x - radius} 
              y={y - radius} 
              width={radius * 2} 
              height={radius * 2} 
              fill={hatchStyle === 'soft-border' ? softBorderColor : `url(#${hatchStyle})`} 
            />
          );
        }
      });
    }
    return layerMasks;
  }, [hatchOrganic, layerMergedLines, gridSize, hatchWidth, hatchStyle, hatchSmoothness]);

  const renderedElements = elements.map((el: MapElement) => {
    if (isResizing && resizeElementId === el.id) {
      const minX = Math.min(...el.points.map(p => p.x));
      const minY = Math.min(...el.points.map(p => p.y));
      return {
        ...el,
        points: el.points.map(p => ({
          x: minX + (p.x - minX) * resizeScale,
          y: minY + (p.y - minY) * resizeScale
        }))
      };
    }
    const isSelected = selectedElementIds.includes(el.id);
    if (isSelected && (dragOffset.dx !== 0 || dragOffset.dy !== 0)) {
      return {
        ...el,
        points: el.points.map((p: Point) => ({ x: p.x + dragOffset.dx, y: p.y + dragOffset.dy }))
      };
    }
    return el;
  });

  return (
    <div className="w-full h-full relative overflow-hidden bg-[#e9ecef]" id="canvas-container">
      <svg 
      id="map-svg"
      ref={svgRef}
      className="w-full h-full cursor-crosshair bg-slate-50"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      <defs>
        <pattern id="dyson-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M 0,0 L 0,8" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="square" />
        </pattern>
        <pattern id="dyson-dynamic" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
          <rect width={gridSize} height={gridSize} fill="white" />
          <path d={dysonDynamicPath} stroke="black" strokeWidth="1" fill="none" strokeLinecap="round" />
        </pattern>
        {[0, 1, 2, 3].map(i => (
          savedPatterns[i] && (
            <pattern key={`saved-${i}`} id={`saved-${i}`} width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
              <rect width={gridSize} height={gridSize} fill="white" />
              <path d={segmentsToPath(savedPatterns[i]!)} stroke="black" strokeWidth="1" fill="none" strokeLinecap="round" />
            </pattern>
          )
        ))}

        <filter id="soft-blur">
          <feGaussianBlur stdDeviation="5" />
        </filter>

        <pattern id="room-grid" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse" x="0" y="0">
          <path d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`} fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth={1 / viewState.zoom} />
        </pattern>

        <pattern id="global-grid" width={scaledGridSize} height={scaledGridSize} patternUnits="userSpaceOnUse"
                 x={viewState.x % scaledGridSize} y={viewState.y % scaledGridSize}>
          <path d={`M ${scaledGridSize} 0 L 0 0 0 ${scaledGridSize}`} fill="none" stroke="#e5e7eb" strokeWidth="1" />
        </pattern>
      </defs>


      <g id="map-container" transform={`translate(${viewState.x}, ${viewState.y}) scale(${viewState.zoom})`}>
        
        {[0, 1, 2, 3].map(layerIndex => {
          if (!layerVisibility[layerIndex]) return null;
          const layerRenderedElements = renderedElements.filter(el => (el.layer ?? 0) === layerIndex);

          return (
            <g key={`layer-${layerIndex}`} className={`map-layer-${layerIndex}`}>
              <defs>
                <mask id={`room-mask-${layerIndex}`}>
                  <rect x="-10000" y="-10000" width="20000" height="20000" fill="black" />
                  {layerRenderedElements.map((el: MapElement) => {
                    if (el.type === 'room' || el.type === 'interior') {
                      const w = el.points[1].x - el.points[0].x;
                      const h = el.points[1].y - el.points[0].y;
                      return <rect key={`mask-${el.id}`} x={el.points[0].x} y={el.points[0].y} width={w} height={h} fill="white" />;
                    }
                    return null;
                  })}
                </mask>

                <mask id={`fill-mask-${layerIndex}`}>
                  <rect x="-10000" y="-10000" width="20000" height="20000" fill="black" />
                  {layerRenderedElements.map((el: MapElement) => {
                    if (el.type === 'fill' || el.type === 'unfill') {
                      const w = el.points[1].x - el.points[0].x;
                      const h = el.points[1].y - el.points[0].y;
                      return <rect key={`fill-mask-${el.id}`} x={el.points[0].x} y={el.points[0].y} width={w} height={h} fill={el.type === 'fill' ? "white" : "black"} />;
                    }
                    return null;
                  })}
                </mask>
              </defs>

          {/* Layer 1: Dyson Hatch (All sides) */}
          {showHatch && (
            <g opacity={0.8} filter={hatchStyle === 'soft-border' ? 'url(#soft-blur)' : undefined}>
              {!hatchOrganic && layerRenderedElements.map((el: MapElement) => {
                if (el.type === 'room' || el.type === 'interior') {
                  const w = el.points[1].x - el.points[0].x;
                  const h = el.points[1].y - el.points[0].y;
                  return (
                    <rect 
                      key={`hatch-${el.id}`}
                      x={el.points[0].x} 
                      y={el.points[0].y} 
                      width={w} 
                      height={h} 
                      fill="none"
                      stroke={hatchStyle === 'soft-border' ? softBorderColor : `url(#${hatchStyle})`}
                      strokeWidth={gridSize * hatchWidth * 2} 
                      strokeLinejoin="round" 
                    />
                  );
                }
                if (el.type === 'wall') {
                  return (
                    <line
                      key={`hatch-${el.id}`}
                      x1={el.points[0].x} y1={el.points[0].y}
                      x2={el.points[1].x} y2={el.points[1].y}
                      stroke={hatchStyle === 'soft-border' ? softBorderColor : `url(#${hatchStyle})`}
                      strokeWidth={gridSize * hatchWidth * 2}
                      strokeLinecap="square"
                    />
                  );
                }
                return null;
              })}
              {hatchOrganic && layerOrganicMaskElements[layerIndex]}
            </g>
          )}

          {/* Layer 2: Room Floor (White rects) */}
          <g>
            {layerRenderedElements.map((el: MapElement) => {
              if (el.type === 'room' || el.type === 'interior') {
                const w = el.points[1].x - el.points[0].x;
                const h = el.points[1].y - el.points[0].y;
                return (
                  <rect 
                    key={`floor-${el.id}`}
                    x={el.points[0].x} 
                    y={el.points[0].y} 
                    width={w} 
                    height={h} 
                    fill="white" 
                  />
                );
              }
              return null;
            })}
          </g>

          {/* Layer 3: Room Grid */}
          <g>
            {layerRenderedElements.map((el: MapElement) => {
                if (el.type === 'room' || el.type === 'interior') {
                  const w = el.points[1].x - el.points[0].x;
                  const h = el.points[1].y - el.points[0].y;
                  return (
                    <rect 
                      key={`grid-${el.id}`}
                      x={el.points[0].x} 
                      y={el.points[0].y} 
                      width={w} 
                      height={h} 
                      fill="url(#room-grid)" 
                    />
                  );
                }
                return null;
              })}
            </g>

          {/* Layer 3.5: Fill Tool (Negative Space) */}
          <g mask={`url(#fill-mask-${layerIndex})`}>
            <rect x="-10000" y="-10000" width="20000" height="20000" fill="#f8fafc" />
            <rect x="-10000" y="-10000" width="20000" height="20000" fill={`url(#${hatchStyle})`} />
          </g>

          {/* Layer 3.8: Stairs */}
          <g>
            {layerRenderedElements.map((el: MapElement) => {
              if (el.type === 'stair' || el.type === 'stair-depth' || el.type === 'stair-perspective') {
                const start = el.points[0];
                const end = el.points[1];
                const minX = Math.min(start.x, end.x);
                const maxX = Math.max(start.x, end.x);
                const minY = Math.min(start.y, end.y);
                const maxY = Math.max(start.y, end.y);
                const fullW = maxX - minX;
                const fullH = maxY - minY;
                const isVertical = fullH > fullW; 
                
                if (el.type === 'stair') {
                  const lines = [];
                  const maxShrink = isVertical ? (fullW * 0.25) : (fullH * 0.25);
                  const currentSteps = el.properties?.stairSteps ?? stairSteps;
                  const stepSize = isVertical ? fullH / currentSteps : fullW / currentSteps;
                  
                  let pointsStr = '';
                  if (isVertical) {
                    pointsStr = `${minX},${start.y} ${maxX},${start.y} ${maxX - maxShrink},${end.y} ${minX + maxShrink},${end.y}`;
                    const dir = start.y < end.y ? 1 : -1;
                    for (let i = 1; i * stepSize < fullH; i++) {
                      const y = start.y + (i * stepSize * dir);
                      const progress = (i * stepSize) / fullH;
                      const shrink = progress * maxShrink;
                      lines.push(<line key={y} x1={minX + shrink} y1={y} x2={maxX - shrink} y2={y} stroke="black" strokeWidth="1.5" />);
                    }
                  } else {
                    pointsStr = `${start.x},${minY} ${start.x},${maxY} ${end.x},${maxY - maxShrink} ${end.x},${minY + maxShrink}`;
                    const dir = start.x < end.x ? 1 : -1;
                    for (let i = 1; i * stepSize < fullW; i++) {
                      const x = start.x + (i * stepSize * dir);
                      const progress = (i * stepSize) / fullW;
                      const shrink = progress * maxShrink;
                      lines.push(<line key={x} x1={x} y1={minY + shrink} x2={x} y2={maxY - shrink} stroke="black" strokeWidth="1.5" />);
                    }
                  }
                  
                  return (
                    <g key={`stair-${el.id}`}>
                      <polygon points={pointsStr} fill="white" stroke="black" strokeWidth="1.5" strokeLinejoin="round" />
                      {lines}
                    </g>
                  );
                } else if (el.type === 'stair-depth') {
                  const lines = [];
                  const currentSteps = el.properties?.stairSteps ?? stairSteps;
                  if (isVertical) {
                    const dir = start.y < end.y ? 1 : -1;
                    const numSteps = Math.max(2, currentSteps);
                    const a = fullH / (0.6 * numSteps);
                    const d = (0.8 * a) / (numSteps - 1);
                    let currentY = start.y;
                    const stepLines = [];
                    const shadowLines = [];
                    for (let i = 0; i < numSteps; i++) {
                      const prevY = currentY;
                      if (i === numSteps - 1) {
                        currentY = end.y;
                      } else {
                        const stepDepth = a - i * d;
                        currentY += stepDepth * dir;
                        stepLines.push(<line key={`hs-${i}`} x1={minX} y1={currentY + 3.75 * dir} x2={maxX} y2={currentY + 3.75 * dir} stroke="rgba(0,0,0,0.15)" strokeWidth="6" />);
                        stepLines.push(<line key={`h-${i}`} x1={minX} y1={currentY} x2={maxX} y2={currentY} stroke="black" strokeWidth="1.5" />);
                      }

                      if (i >= 1) {
                        const progress = i / (numSteps - 1);
                        const opacity = 0.05 + (progress * 0.45);
                        const shadowWidth = 6;
                        const halfW = shadowWidth / 2;
                        shadowLines.push(<line key={`sl-${i}`} x1={minX + halfW} y1={prevY} x2={minX + halfW} y2={currentY} stroke={`rgba(0,0,0,${opacity})`} strokeWidth={shadowWidth} />);
                        shadowLines.push(<line key={`sr-${i}`} x1={maxX - halfW} y1={prevY} x2={maxX - halfW} y2={currentY} stroke={`rgba(0,0,0,${opacity})`} strokeWidth={shadowWidth} />);
                      }
                    }
                    lines.push(...shadowLines, ...stepLines);
                  } else {
                    const dir = start.x < end.x ? 1 : -1;
                    const numSteps = Math.max(2, currentSteps);
                    const a = fullW / (0.6 * numSteps);
                    const d = (0.8 * a) / (numSteps - 1);
                    let currentX = start.x;
                    const stepLines = [];
                    const shadowLines = [];
                    for (let i = 0; i < numSteps; i++) {
                      const prevX = currentX;
                      if (i === numSteps - 1) {
                        currentX = end.x;
                      } else {
                        const stepDepth = a - i * d;
                        currentX += stepDepth * dir;
                        stepLines.push(<line key={`vs-${i}`} x1={currentX + 3.75 * dir} y1={minY} x2={currentX + 3.75 * dir} y2={maxY} stroke="rgba(0,0,0,0.15)" strokeWidth="6" />);
                        stepLines.push(<line key={`v-${i}`} x1={currentX} y1={minY} x2={currentX} y2={maxY} stroke="black" strokeWidth="1.5" />);
                      }

                      if (i >= 1) {
                        const progress = i / (numSteps - 1);
                        const opacity = 0.05 + (progress * 0.45);
                        const shadowWidth = 6;
                        const halfW = shadowWidth / 2;
                        shadowLines.push(<line key={`st-${i}`} x1={prevX} y1={minY + halfW} x2={currentX} y2={minY + halfW} stroke={`rgba(0,0,0,${opacity})`} strokeWidth={shadowWidth} />);
                        shadowLines.push(<line key={`sb-${i}`} x1={prevX} y1={maxY - halfW} x2={currentX} y2={maxY - halfW} stroke={`rgba(0,0,0,${opacity})`} strokeWidth={shadowWidth} />);
                      }
                    }
                    lines.push(...shadowLines, ...stepLines);
                  }
                  
                  return (
                    <g key={`stair-depth-${el.id}`}>
                      <rect x={minX} y={minY} width={fullW} height={fullH} fill="white" stroke="black" strokeWidth="1.5" />
                      {lines}
                    </g>
                  );
                } else if (el.type === 'stair-perspective') {
                  const lines = [];
                  const maxShrink = isVertical ? (fullW * 0.25) : (fullH * 0.25);
                  let pointsStr = '';

                  if (isVertical) {
                    pointsStr = `${minX},${start.y} ${maxX},${start.y} ${maxX - maxShrink},${end.y} ${minX + maxShrink},${end.y}`;
                    const dir = start.y < end.y ? 1 : -1;
                    const currentSteps = el.properties?.stairSteps ?? stairSteps;
                    const numSteps = Math.max(2, currentSteps);
                    const a = fullH / (0.6 * numSteps);
                    const d = (0.8 * a) / (numSteps - 1);
                    let currentY = start.y;
                    for (let i = 0; i < numSteps - 1; i++) {
                      const stepDepth = a - i * d;
                      currentY += stepDepth * dir;
                      const progress = Math.abs(currentY - start.y) / fullH;
                      const shrink = progress * maxShrink;
                      lines.push(<line key={`hs-${i}`} x1={minX + shrink} y1={currentY + 3.75 * dir} x2={maxX - shrink} y2={currentY + 3.75 * dir} stroke="rgba(0,0,0,0.15)" strokeWidth="6" />);
                      lines.push(<line key={`h-${i}`} x1={minX + shrink} y1={currentY} x2={maxX - shrink} y2={currentY} stroke="black" strokeWidth="1.5" />);
                    }
                  } else {
                    pointsStr = `${start.x},${minY} ${start.x},${maxY} ${end.x},${maxY - maxShrink} ${end.x},${minY + maxShrink}`;
                    const dir = start.x < end.x ? 1 : -1;
                    const currentSteps = el.properties?.stairSteps ?? stairSteps;
                    const numSteps = Math.max(2, currentSteps);
                    const a = fullW / (0.6 * numSteps);
                    const d = (0.8 * a) / (numSteps - 1);
                    let currentX = start.x;
                    for (let i = 0; i < numSteps - 1; i++) {
                      const stepDepth = a - i * d;
                      currentX += stepDepth * dir;
                      const progress = Math.abs(currentX - start.x) / fullW;
                      const shrink = progress * maxShrink;
                      lines.push(<line key={`vs-${i}`} x1={currentX + 3.75 * dir} y1={minY + shrink} x2={currentX + 3.75 * dir} y2={maxY - shrink} stroke="rgba(0,0,0,0.15)" strokeWidth="6" />);
                      lines.push(<line key={`v-${i}`} x1={currentX} y1={minY + shrink} x2={currentX} y2={maxY - shrink} stroke="black" strokeWidth="1.5" />);
                    }
                  }
                  
                  return (
                    <g key={`stair-perspective-${el.id}`}>
                      <polygon points={pointsStr} fill="white" stroke="black" strokeWidth="1.5" strokeLinejoin="round" />
                      {lines}
                    </g>
                  );
                }
              }
              return null;
            })}
          </g>

          {/* Layer 4: Shadow (Masked to room interior) */}
          <g mask={`url(#room-mask-${layerIndex})`}>
            {layerMergedLines[layerIndex].map((line, i) => (
              <line
                key={`merged-shadow-${i}`}
                x1={line.x1} y1={line.y1}
                x2={line.x2} y2={line.y2}
                stroke="rgba(0,0,0,0.15)"
                strokeWidth="8"
                strokeLinecap="round"
                transform="translate(4, 4)"
              />
            ))}
            {layerRenderedElements.map((el: MapElement) => {
              if (el.type === 'interior') {
                const w = el.points[1].x - el.points[0].x;
                const h = el.points[1].y - el.points[0].y;
                return (
                  <rect 
                    key={`shadow-${el.id}`}
                    x={el.points[0].x} 
                    y={el.points[0].y} 
                    width={w} 
                    height={h} 
                    fill="none"
                    stroke="rgba(0,0,0,0.15)"
                    strokeWidth="8"
                    strokeLinejoin="round"
                    transform="translate(4, 4)"
                  />
                );
              }
              if (el.type === 'wall') {
                return (
                  <line
                    key={`shadow-${el.id}`}
                    x1={el.points[0].x} y1={el.points[0].y}
                    x2={el.points[1].x} y2={el.points[1].y}
                    stroke="rgba(0,0,0,0.15)"
                    strokeWidth="8"
                    strokeLinecap="round"
                    transform="translate(4, 4)"
                  />
                );
              }
              return null;
            })}
          </g>

          {/* Layer 5: Walls (RoughJS) */}
          <g>
            {layerMergedRoughPaths[layerIndex].map((path, i) => (
              <path key={`merged-wall-${i}`} d={path} className="dyson-wall" fill="none" />
            ))}
            {layerRenderedElements.map((el: MapElement) => {
              if (el.type === 'wall') {
                const seedStr = el.id.toString();
                let hash = 0;
                for (let i = 0; i < seedStr.length; i++) hash = Math.imul(31, hash) + seedStr.charCodeAt(i) | 0;
                const seed = Math.abs(hash) || 1;
                const drawable = generator.line(el.points[0].x, el.points[0].y, el.points[1].x, el.points[1].y, { roughness: 1.5, strokeWidth: 2.5, seed });
                const path = getRoughPath(drawable);
                return <path key={`wall-${el.id}`} d={path} className="dyson-wall" fill="none" />;
              }
              return null;
            })}
          </g>

          {/* Layer 6: Doors */}
          <g>
            {layerRenderedElements.map((el: MapElement) => {
              if (el.type === 'door' || el.type === 'door-double' || el.type === 'door-secret') {
                const isHorizontal = el.points[0].y === el.points[1].y;
                const minX = Math.min(el.points[0].x, el.points[1].x);
                const maxX = Math.max(el.points[0].x, el.points[1].x);
                const minY = Math.min(el.points[0].y, el.points[1].y);
                const maxY = Math.max(el.points[0].y, el.points[1].y);
                
                const doorThickness = 16;
                const doorInset = 10;

                if (el.type === 'door-secret') {
                  const cx = minX + (maxX - minX) / 2;
                  const cy = minY + (maxY - minY) / 2;
                  return (
                    <g key={`door-${el.id}`}>
                      <circle cx={cx} cy={cy} r={12} fill="white" stroke="black" strokeWidth="1.5" strokeDasharray="2,2" />
                      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize="14" fontWeight="bold" fill="black">S</text>
                    </g>
                  );
                }

                return (
                  <g key={`door-${el.id}`}>
                    {/* Erase underlying wall and shadow only under the door */}
                    <line 
                      x1={isHorizontal ? minX + doorInset : minX} 
                      y1={isHorizontal ? minY : minY + doorInset} 
                      x2={isHorizontal ? maxX - doorInset : maxX} 
                      y2={isHorizontal ? maxY : maxY - doorInset} 
                      stroke="white" 
                      strokeWidth="12" 
                    />
                    {/* Draw door box */}
                    <rect 
                      x={isHorizontal ? minX + doorInset : minX - doorThickness/2} 
                      y={isHorizontal ? minY - doorThickness/2 : minY + doorInset} 
                      width={isHorizontal ? (maxX - minX) - (doorInset * 2) : doorThickness} 
                      height={isHorizontal ? doorThickness : (maxY - minY) - (doorInset * 2)} 
                      fill="white" 
                      stroke="black" 
                      strokeWidth="1.5" 
                    />
                    {el.type === 'door-double' && (
                      <line 
                        x1={isHorizontal ? minX + (maxX - minX) / 2 : minX - doorThickness/2} 
                        y1={isHorizontal ? minY - doorThickness/2 : minY + (maxY - minY) / 2}
                        x2={isHorizontal ? minX + (maxX - minX) / 2 : minX + doorThickness/2}
                        y2={isHorizontal ? minY + doorThickness/2 : minY + (maxY - minY) / 2}
                        stroke="black"
                        strokeWidth="1.5"
                      />
                    )}
                  </g>
                );
              }
              return null;
            })}
          </g>

          {/* Layer 7: Decorations */}
          <g>
            {layerRenderedElements.map((el: MapElement) => {
              if (el.type.startsWith('decoration-')) {
                const minX = Math.min(...el.points.map(p => p.x));
                const maxX = Math.max(...el.points.map(p => p.x));
                const minY = Math.min(...el.points.map(p => p.y));
                const maxY = Math.max(...el.points.map(p => p.y));
                const width = maxX - minX;
                const height = maxY - minY;
                
                if (width === 0 || height === 0) return null;
                
                if (el.type === 'decoration-circle') {
                  return (
                    <ellipse 
                      key={`deco-${el.id}`}
                      cx={minX + width/2}
                      cy={minY + height/2}
                      rx={width/2}
                      ry={height/2}
                      fill="white"
                      stroke="black"
                      strokeWidth="1.5"
                    />
                  );
                }
                
                return (
                  <rect 
                    key={`deco-${el.id}`}
                    x={minX}
                    y={minY}
                    width={width}
                    height={height}
                    fill="white"
                    stroke="black"
                    strokeWidth="1.5"
                  />
                );
              } else if (el.type === 'image') {
                const minX = Math.min(el.points[0].x, el.points[1].x);
                const minY = Math.min(el.points[0].y, el.points[1].y);
                const w = Math.abs(el.points[1].x - el.points[0].x);
                const h = Math.abs(el.points[1].y - el.points[0].y);
                const isSelected = selectedElementIds.includes(el.id);
                
                return (
                  <g 
                    key={el.id} 
                    style={{ cursor: isSelected ? 'move' : 'pointer' }}
                    transform={el.properties?.rotation ? `rotate(${el.properties.rotation} ${el.properties.pivot?.x} ${el.properties.pivot?.y})` : undefined}
                  >
                    <image 
                      href={el.properties?.dataUrl} 
                      x={minX} 
                      y={minY} 
                      width={w} 
                      height={h} 
                      preserveAspectRatio="none" 
                    />
                    {isSelected && (
                      <rect 
                        x={minX} y={minY} width={w} height={h} 
                        fill="none" stroke="rgb(59,130,246)" strokeWidth="2" strokeDasharray="4 4" 
                      />
                    )}
                  </g>
                );
              } else if (el.type === 'export-tile') {
                const minX = Math.min(el.points[0].x, el.points[1].x);
                const minY = Math.min(el.points[0].y, el.points[1].y);
                const isSelected = selectedElementIds.includes(el.id);
                return (
                  <g key={el.id} className="export-ignore" style={{ cursor: isSelected ? 'move' : 'pointer' }}>
                    <rect
                      x={minX}
                      y={minY}
                      width={144}
                      height={144}
                      fill={isSelected ? "rgba(59,130,246,0.1)" : "rgba(59,130,246,0.05)"}
                      stroke="rgb(59,130,246)"
                      strokeWidth="2"
                      strokeDasharray="8 4"
                    />
                    <text
                      x={minX + 4}
                      y={minY - 6}
                      fill="rgb(59,130,246)"
                      fontSize="12"
                      fontWeight="bold"
                      className="select-none"
                    >
                      Export Tile (144x144)
                    </text>
                  </g>
                );
              }
              return null;
            })}
          </g>

            </g>
          );
        })}

        {/* Current Drawing Overlay */}
        {isDrawing && tool === 'export-tile' && (
          <rect
            x={startDrawPoint.x}
            y={startDrawPoint.y}
            width={144}
            height={144}
            fill="rgba(59,130,246,0.1)"
            stroke="rgb(59,130,246)"
            strokeWidth="2"
            strokeDasharray="4 4"
          />
        )}
        {isDrawing && tool !== 'select' && tool !== 'rotate' && tool !== 'export-tile' && (
          <rect 
            className="export-ignore"
            x={tool.startsWith('decoration-') && snapToGrid ? startDrawPoint.x - Math.abs(currentDrawPoint.x - startDrawPoint.x) : Math.min(startDrawPoint.x, currentDrawPoint.x)} 
            y={tool.startsWith('decoration-') && snapToGrid ? startDrawPoint.y - Math.abs(currentDrawPoint.y - startDrawPoint.y) : Math.min(startDrawPoint.y, currentDrawPoint.y)} 
            width={tool.startsWith('decoration-') && snapToGrid ? Math.abs(currentDrawPoint.x - startDrawPoint.x) * 2 : Math.abs(currentDrawPoint.x - startDrawPoint.x)} 
            height={tool.startsWith('decoration-') && snapToGrid ? Math.abs(currentDrawPoint.y - startDrawPoint.y) * 2 : Math.abs(currentDrawPoint.y - startDrawPoint.y)} 
            fill={tool === 'fill' ? 'rgba(0,0,0,0.5)' : tool === 'unfill' ? 'rgba(255,255,255,0.8)' : tool === 'delete' ? 'rgba(239,68,68,0.2)' : tool === 'export-region' ? 'rgba(34,197,94,0.1)' : 'rgba(79, 70, 229, 0.1)'} 
            stroke={tool === 'delete' ? 'rgb(239,68,68)' : tool === 'export-region' ? 'rgb(34,197,94)' : '#4f46e5'} 
            strokeWidth="2" 
            strokeDasharray={tool === 'interior' || tool === 'unfill' || tool === 'delete' || tool === 'export-region' ? "4 4" : "none"}
          />
        )}
        
        {isDrawing && (tool === 'wall' || tool === 'door') && (
          <line 
            x1={startDrawPoint.x} y1={startDrawPoint.y}
            x2={currentDrawPoint.x} y2={currentDrawPoint.y}
            stroke="#aa3bff"
            strokeWidth="2"
            strokeDasharray="4 4"
          />
        )}
        {/* Selection Outlines */}
        {renderedElements.filter((el: MapElement) => selectedElementIds.includes(el.id)).map((el: MapElement) => {
          const minX = Math.min(...el.points.map((p: Point) => p.x));
          const maxX = Math.max(...el.points.map((p: Point) => p.x));
          const minY = Math.min(...el.points.map((p: Point) => p.y));
          const maxY = Math.max(...el.points.map((p: Point) => p.y));
          
          return (
            <g key={`sel-${el.id}`} className="export-ignore">
              <rect
                x={minX - 5}
                y={minY - 5}
                width={maxX - minX + 10}
                height={maxY - minY + 10}
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2"
                strokeDasharray="5,5"
                pointerEvents="none"
              />
              {selectedElementIds.length === 1 && el.type.startsWith('decoration-') && (
                <rect 
                  x={maxX - 5} 
                  y={maxY - 5} 
                  width={10} 
                  height={10} 
                  fill="#3b82f6" 
                  stroke="white" 
                  strokeWidth="1.5"
                  pointerEvents="all"
                  className="cursor-nwse-resize hover:fill-indigo-400 hover:stroke-indigo-600 transition-colors"
                />
              )}
            </g>
          );
        })}

        {/* Drag Selection Fence */}
        {isDrawingSelectionFence && (
          <rect
            x={Math.min(startDrawPoint.x, currentDrawPoint.x)}
            y={Math.min(startDrawPoint.y, currentDrawPoint.y)}
            width={Math.abs(currentDrawPoint.x - startDrawPoint.x)}
            height={Math.abs(currentDrawPoint.y - startDrawPoint.y)}
            fill="rgba(59, 130, 246, 0.2)"
            stroke="#3b82f6"
            strokeWidth="2"
            strokeDasharray="5,5"
            pointerEvents="none"
          />
        )}
      </g>
      
      {/* Global Grid Overlay */}
      {showGrid && (
        <rect width="100%" height="100%" fill="url(#global-grid)" pointerEvents="none" />
      )}
    </svg>
    </div>
  );
}
