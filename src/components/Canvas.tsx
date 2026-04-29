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

export default function Canvas() {
  const { viewState, setViewState, gridSize, showGrid, tool, hatchStyle, hatchWidth, hatchOrganic, hatchSmoothness, elements, addElement, setElements, dynamicSegments, savedPatterns } = useMapStore();
  const svgRef = useRef<SVGSVGElement>(null);
  
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState<Point>({ x: 0, y: 0 });

  const [isDrawing, setIsDrawing] = useState(false);
  const [startDrawPoint, setStartDrawPoint] = useState<Point>({ x: 0, y: 0 });
  const [currentDrawPoint, setCurrentDrawPoint] = useState<Point>({ x: 0, y: 0 });

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

  const snapToGrid = (point: Point): Point => {
    return {
      x: Math.round(point.x / gridSize) * gridSize,
      y: Math.round(point.y / gridSize) * gridSize
    };
  };

  const handleMouseDown = (e: MouseEvent<SVGSVGElement>) => {
    if (e.button === 1 || e.button === 2 || e.altKey || tool === 'select') {
      setIsPanning(true);
      setStartPan({ x: e.clientX, y: e.clientY });
      return;
    }

    if (e.button === 0) {
      if (tool === 'room' || tool === 'interior' || tool === 'fill' || tool === 'unfill' || tool === 'wall' || tool === 'door' || tool === 'stair' || tool === 'stair-depth' || tool === 'stair-perspective' || tool === 'delete') {
        const point = snapToGrid(getMapCoordinates(e));
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

    if (isDrawing) {
      const point = snapToGrid(getMapCoordinates(e));
      setCurrentDrawPoint(point);
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);

    if (isDrawing) {
      setIsDrawing(false);
      
      if (startDrawPoint.x !== currentDrawPoint.x || startDrawPoint.y !== currentDrawPoint.y) {
        if (tool === 'room' || tool === 'interior' || tool === 'fill' || tool === 'unfill') {
          const minX = Math.min(startDrawPoint.x, currentDrawPoint.x);
          const minY = Math.min(startDrawPoint.y, currentDrawPoint.y);
          const maxX = Math.max(startDrawPoint.x, currentDrawPoint.x);
          const maxY = Math.max(startDrawPoint.y, currentDrawPoint.y);
          
          if (maxX - minX > 0 && maxY - minY > 0) {
             addElement({
               id: Math.random().toString(36).substring(2, 9),
               type: tool,
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
              return !intersect;
            });
            setElements(newElements);
          }
        } else if (tool === 'wall' || tool === 'door') {
          addElement({
            id: Math.random().toString(36).substring(2, 9),
            type: tool,
            points: [startDrawPoint, currentDrawPoint]
          });
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

  // --- MERGE ROOM WALLS ---
  const hWalls: Record<number, {start: number, end: number}[]> = {};
  const vWalls: Record<number, {start: number, end: number}[]> = {};

  const maskVolumes = elements.filter(el => el.type === 'room' || el.type === 'interior');

  elements.filter(el => el.type === 'room').forEach(r => {
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

  const mergedLines: {x1: number, y1: number, x2: number, y2: number}[] = [];
  Object.keys(hWalls).forEach(yStr => {
    const y = Number(yStr);
    mergeIntervals(hWalls[y]).forEach(int => mergedLines.push({x1: int.start, y1: y, x2: int.end, y2: y}));
  });
  Object.keys(vWalls).forEach(xStr => {
    const x = Number(xStr);
    mergeIntervals(vWalls[x]).forEach(int => mergedLines.push({x1: x, y1: int.start, x2: x, y2: int.end}));
  });

  const mergedRoughPaths = mergedLines.map(line => getRoughPath(generator.line(line.x1, line.y1, line.x2, line.y2, { roughness: 1.5, strokeWidth: 2.5 })));
  // --------------------------

  const dysonDynamicPath = React.useMemo(() => {
    return segmentsToPath(dynamicSegments);
  }, [dynamicSegments]);

  const organicMaskElements = React.useMemo(() => {
    if (!hatchOrganic) return null;
    const elementsList: React.ReactNode[] = [];
    
    const chunkSize = 50 - (hatchSmoothness / 100) * 45;

    mergedLines.forEach((line, i) => {
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
        
        // Using rects naturally creates an angular, blocky mask that aligns with orthogonal walls
        elementsList.push(
          <rect 
            key={`om-${i}-${s}`} 
            x={x - radius} 
            y={y - radius} 
            width={radius * 2} 
            height={radius * 2} 
            fill={`url(#${hatchStyle})`} 
          />
        );
      }
    });
    return elementsList;
  }, [hatchOrganic, mergedLines, gridSize, hatchWidth, hatchStyle, hatchSmoothness]);

  return (
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

        <pattern id="dyson-scrumb" width="50" height="250" patternUnits="userSpaceOnUse">
          <path d="M 32.1 -6.6 L 33.9 19.3 M 28.6 -6.0 L 30.2 15.8 M 24.5 -5.1 L 26.1 16.6 M 11.2 10.9 L 39.1 12.3 M 10.8 11.5 L 38.6 12.9 M 12.6 18.3 L 43.4 19.9 M 19.6 35.9 L 42.5 8.8 M 19.6 37.2 L 42.8 9.7 M 23.0 40.0 L 44.3 14.6 M 27.0 44.3 L 47.5 20.0 M 16.3 6.8 L 32.3 24.2 M 14.2 10.6 L 28.8 26.4 M 12.0 12.0 L 28.1 29.5 M 9.9 12.9 L 26.7 31.1 M 5.2 15.8 L 19.4 31.2 M 4.5 26.7 L 31.3 50.6 M 2.5 29.4 L 26.0 50.3 M 1.5 32.6 L 26.6 55.1 M -0.5 35.8 L 22.8 56.6 M 15.5 -3.7 L 14.2 17.4 M 11.4 -2.0 L 10.2 18.5 M 5.8 -2.5 L 4.5 19.9 M 4.5 -4.9 L 3.2 17.8 M 13.8 2.6 L 25.5 16.8 M 9.1 3.1 L 21.9 18.6 M 9.3 7.7 L 21.2 22.1 M 28.8 71.1 L 54.6 73.3 M 29.5 78.0 L 58.0 80.5 M 26.5 80.1 L 53.9 82.5 M 26.4 82.9 L 56.0 85.5 M 36.5 77.0 L 35.0 111.9 M 31.1 76.1 L 29.8 107.4 M 26.7 75.4 L 25.2 109.9 M 23.8 75.3 L 22.5 106.2 M 47.5 78.9 L 48.3 98.4 M 43.5 80.0 L 44.5 100.9 M 37.5 78.7 L 38.4 98.4 M 35.6 80.0 L 36.6 100.7 M 21.5 98.8 L 36.4 85.2 M 23.0 103.3 L 38.2 89.5 M 27.7 104.3 L 43.4 90.0 M -10.1 90.0 L 22.3 92.7 M -9.7 95.5 L 19.9 98.1 M -8.3 96.6 L 22.6 99.3 M 7.6 101.4 L 28.5 77.4 M 7.4 105.3 L 29.5 79.9 M 11.8 105.8 L 36.7 77.2 M 15.6 108.0 L 38.6 81.6 M 12.2 76.6 L 11.8 102.2 M 6.7 77.3 L 6.3 105.6 M 3.6 77.1 L 3.2 101.8 M -1.2 109.1 L 33.1 105.7 M 2.7 116.2 L 32.4 113.3 M 0.9 117.8 L 34.4 114.5 M 2.7 124.1 L 35.9 120.8 M 2.9 126.2 L 37.1 122.8 M 40.2 100.7 L 41.5 128.5 M 37.7 103.4 L 39.1 132.4 M 31.9 103.8 L 33.3 133.8 M -8.5 128.2 L 22.2 125.2 M -11.1 130.3 L 20.7 127.1 M -7.1 136.1 L 27.7 132.6 M 45.3 118.2 L 47.5 141.7 M 38.5 115.4 L 40.4 136.3 M 36.7 117.1 L 38.9 140.4 M 29.5 119.6 L 31.6 142.2 M 22.2 151.5 L 43.9 125.3 M 25.0 152.3 L 46.4 126.3 M 28.9 154.6 L 50.2 128.8 M 31.5 160.9 L 51.9 136.3 M 37.4 163.5 L 57.3 139.5 M 10.1 119.5 L 27.2 139.2 M 4.9 121.9 L 21.3 140.9 M 4.4 124.7 L 20.6 143.4 M 1.8 124.4 L 17.2 142.3 M 18.7 116.4 L 50.3 115.6 M 19.8 121.3 L 56.6 120.5 M 17.9 122.6 L 54.3 121.7 M 20.8 126.6 L 58.7 125.8 M 17.7 131.0 L 53.6 130.2 M 19.9 171.9 L 38.8 191.2 M 15.8 173.0 L 33.6 191.2 M 13.1 175.0 L 28.8 191.1 M 14.5 183.6 L 35.8 163.8 M 15.9 188.2 L 34.0 171.3 M 19.6 191.4 L 38.7 173.6 M 19.8 191.9 L 40.2 172.9 M 22.4 195.7 L 40.2 179.1 M 45.8 143.1 L 44.7 167.9 M 42.5 143.3 L 41.3 170.8 M 36.4 146.6 L 35.3 172.4 M 32.2 143.6 L 31.0 169.9 M 33.2 158.5 L 54.6 184.2 M 31.8 160.7 L 52.5 185.5 M 26.2 161.2 L 46.6 185.7 M 25.2 164.8 L 46.3 190.1 M 24.2 154.0 L 40.1 168.2 M 24.2 155.9 L 40.5 170.6 M 21.2 159.9 L 36.7 173.8 M 18.4 164.4 L 33.2 177.7 M 14.7 192.2 L 37.3 169.4 M 16.5 194.5 L 39.8 171.0 M 18.0 194.8 L 42.9 169.6 M 20.0 198.8 L 43.1 175.5 M 44.8 166.4 L 41.7 198.2 M 40.1 167.9 L 36.8 201.3 M 38.0 166.6 L 35.2 196.1 M 36.5 167.0 L 33.5 198.3 M 33.8 166.2 L 30.5 200.3 M 1.6 195.1 L 23.2 214.4 M -4.1 195.0 L 15.6 212.6 M -4.3 199.8 L 15.1 217.1 M 20.9 216.6 L 20.2 249.9 M 19.8 217.6 L 19.2 249.6 M 13.6 219.0 L 12.8 253.1 M 10.3 218.5 L 9.7 248.1 M 6.7 216.3 L 6.1 246.1 M 16.8 229.8 L 46.0 228.9 M 16.3 235.4 L 47.7 234.5 M 18.0 239.5 L 49.1 238.6 M 15.3 243.8 L 45.0 242.9 M 12.6 237.9 L 35.5 214.7 M 16.2 239.9 L 38.9 216.9 M 19.8 241.0 L 43.9 216.6 M 21.2 244.3 L 44.9 220.3 M 23.7 246.2 L 46.8 222.9 M 33.8 225.4 L 36.2 253.9 M 31.1 223.9 L 33.5 253.3 M 27.3 225.1 L 29.5 252.1 M 23.6 226.6 L 26.0 255.8 M 22.5 226.9 L 24.7 254.2 M 23.4 211.4 L 25.4 237.1 M 19.1 210.0 L 20.8 233.0 M 15.7 211.5 L 17.6 236.5 M 35.9 225.4 L 52.9 240.3 M 36.8 230.8 L 54.4 246.3 M 30.8 231.3 L 50.1 248.3" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" />
        </pattern>

        <pattern id="room-grid" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse" x="0" y="0">
          <path d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`} fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth={1 / viewState.zoom} />
        </pattern>

        <pattern id="global-grid" width={scaledGridSize} height={scaledGridSize} patternUnits="userSpaceOnUse"
                 x={viewState.x % scaledGridSize} y={viewState.y % scaledGridSize}>
          <path d={`M ${scaledGridSize} 0 L 0 0 0 ${scaledGridSize}`} fill="none" stroke="#e5e7eb" strokeWidth="1" />
        </pattern>

        <mask id="room-mask">
          <rect x="-10000" y="-10000" width="20000" height="20000" fill="black" />
          {elements.map(el => {
            if (el.type === 'room' || el.type === 'interior') {
              const w = el.points[1].x - el.points[0].x;
              const h = el.points[1].y - el.points[0].y;
              return (
                <rect 
                  key={`mask-${el.id}`}
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
        </mask>

        <mask id="fill-mask">
          <rect x="-10000" y="-10000" width="20000" height="20000" fill="black" />
          {elements.map(el => {
            if (el.type === 'fill' || el.type === 'unfill') {
              const w = el.points[1].x - el.points[0].x;
              const h = el.points[1].y - el.points[0].y;
              return (
                <rect 
                  key={`fill-mask-${el.id}`}
                  x={el.points[0].x} 
                  y={el.points[0].y} 
                  width={w} 
                  height={h} 
                  fill={el.type === 'fill' ? "white" : "black"} 
                />
              );
            }
            return null;
          })}
        </mask>
      </defs>

      {showGrid && (
        <rect width="100%" height="100%" fill="url(#global-grid)" />
      )}

      <g transform={`translate(${viewState.x}, ${viewState.y}) scale(${viewState.zoom})`}>
        
        {/* Layer 1: Dyson Hatch (All sides) */}
        <g opacity={0.8}>
          {!hatchOrganic && elements.map(el => {
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
                  stroke={`url(#${hatchStyle})`}
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
                  stroke={`url(#${hatchStyle})`}
                  strokeWidth={gridSize * hatchWidth * 2}
                  strokeLinecap="square"
                />
              );
            }
            return null;
          })}
          {hatchOrganic && organicMaskElements}
        </g>

        {/* Layer 2: Room Floor (White rects) */}
        <g>
          {elements.map(el => {
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
          {elements.map(el => {
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
        <g mask="url(#fill-mask)">
          <rect x="-10000" y="-10000" width="20000" height="20000" fill="#f8fafc" />
          <rect x="-10000" y="-10000" width="20000" height="20000" fill={`url(#${hatchStyle})`} />
        </g>

        {/* Layer 3.8: Stairs */}
        <g>
          {elements.map(el => {
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
                const stepSize = 10;
                const maxShrink = isVertical ? (fullW * 0.25) : (fullH * 0.25);
                
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
                if (isVertical) {
                  const dir = start.y < end.y ? 1 : -1;
                  const numSteps = Math.max(2, Math.floor(fullH / 10));
                  const a = fullH / (0.6 * numSteps);
                  const d = (0.8 * a) / (numSteps - 1);
                  let currentY = start.y;
                  for (let i = 0; i < numSteps - 1; i++) {
                    const stepDepth = a - i * d;
                    currentY += stepDepth * dir;
                    lines.push(<line key={`hs-${i}`} x1={minX} y1={currentY + 3.75 * dir} x2={maxX} y2={currentY + 3.75 * dir} stroke="rgba(0,0,0,0.15)" strokeWidth="6" />);
                    lines.push(<line key={`h-${i}`} x1={minX} y1={currentY} x2={maxX} y2={currentY} stroke="black" strokeWidth="1.5" />);
                  }
                } else {
                  const dir = start.x < end.x ? 1 : -1;
                  const numSteps = Math.max(2, Math.floor(fullW / 10));
                  const a = fullW / (0.6 * numSteps);
                  const d = (0.8 * a) / (numSteps - 1);
                  let currentX = start.x;
                  for (let i = 0; i < numSteps - 1; i++) {
                    const stepDepth = a - i * d;
                    currentX += stepDepth * dir;
                    lines.push(<line key={`vs-${i}`} x1={currentX + 3.75 * dir} y1={minY} x2={currentX + 3.75 * dir} y2={maxY} stroke="rgba(0,0,0,0.15)" strokeWidth="6" />);
                    lines.push(<line key={`v-${i}`} x1={currentX} y1={minY} x2={currentX} y2={maxY} stroke="black" strokeWidth="1.5" />);
                  }
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
                  const numSteps = Math.max(2, Math.floor(fullH / 10));
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
                  const numSteps = Math.max(2, Math.floor(fullW / 10));
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
        <g mask="url(#room-mask)">
          {mergedLines.map((line, i) => (
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
          {elements.map(el => {
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
          {mergedRoughPaths.map((path, i) => (
            <path key={`merged-wall-${i}`} d={path} className="dyson-wall" fill="none" />
          ))}
          {elements.map(el => {
            if (el.type === 'wall') {
              const drawable = generator.line(el.points[0].x, el.points[0].y, el.points[1].x, el.points[1].y, { roughness: 1.5, strokeWidth: 2.5 });
              const path = getRoughPath(drawable);
              return <path key={`wall-${el.id}`} d={path} className="dyson-wall" fill="none" />;
            }
            return null;
          })}
        </g>

        {/* Layer 6: Doors */}
        <g>
          {elements.map(el => {
            if (el.type === 'door') {
              const isHorizontal = el.points[0].y === el.points[1].y;
              const minX = Math.min(el.points[0].x, el.points[1].x);
              const maxX = Math.max(el.points[0].x, el.points[1].x);
              const minY = Math.min(el.points[0].y, el.points[1].y);
              const maxY = Math.max(el.points[0].y, el.points[1].y);
              
              const doorThickness = 16;
              const doorInset = 10;

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
                </g>
              );
            }
            return null;
          })}
        </g>

        {/* Current Drawing Overlay */}
        {isDrawing && (tool === 'room' || tool === 'interior' || tool === 'fill' || tool === 'unfill' || tool === 'stair' || tool === 'stair-depth' || tool === 'stair-perspective' || tool === 'delete') && (
          <rect 
            x={Math.min(startDrawPoint.x, currentDrawPoint.x)} 
            y={Math.min(startDrawPoint.y, currentDrawPoint.y)} 
            width={Math.abs(currentDrawPoint.x - startDrawPoint.x)} 
            height={Math.abs(currentDrawPoint.y - startDrawPoint.y)} 
            fill={tool === 'fill' ? 'rgba(0,0,0,0.5)' : tool === 'unfill' ? 'rgba(255,255,255,0.8)' : tool === 'delete' ? 'rgba(239,68,68,0.2)' : 'rgba(79, 70, 229, 0.1)'} 
            stroke={tool === 'delete' ? 'rgb(239,68,68)' : '#4f46e5'} 
            strokeWidth="2" 
            strokeDasharray={tool === 'interior' || tool === 'unfill' || tool === 'delete' ? "4 4" : "none"}
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
      </g>
    </svg>
  );
}
