import { create } from 'zustand'
import type { Segment } from './utils/dysonGenerator'

export type ElementType = 'room' | 'interior' | 'fill' | 'unfill' | 'wall' | 'door' | 'stair' | 'stair-depth' | 'stair-perspective' | 'image';
export type Tool = 'select' | 'room' | 'interior' | 'fill' | 'unfill' | 'wall' | 'door' | 'door-double' | 'door-secret' | 'stair' | 'stair-depth' | 'stair-perspective' | 'delete' | 'export-region' | 'export-tile' | 'rotate' | 'decoration-square' | 'decoration-circle' | 'decoration-rectangle' | 'image';

export interface Point {
  x: number;
  y: number;
}

export interface MapElement {
  id: string;
  type: Tool;
  points: Point[]; // For rooms: top-left, bottom-right. For walls: line segments.
  layer?: number;
  properties?: any;
}

interface MapState {
  tool: Tool;
  setTool: (tool: Tool) => void;
  activeLayer: number;
  setActiveLayer: (layer: number) => void;
  layerVisibility: boolean[];
  toggleLayerVisibility: (layer: number) => void;
  layerLock: boolean[];
  toggleLayerLock: (layer: number) => void;
  hatchStyle: any;
  setHatchStyle: (style: any) => void;
  softBorderColor: string;
  setSoftBorderColor: (color: string) => void;
  hatchDensity: number;
  setHatchDensity: (density: number) => void;
  hatchWidth: number;
  setHatchWidth: (width: number) => void;
  hatchOrganic: boolean;
  setHatchOrganic: (organic: boolean) => void;
  hatchSmoothness: number;
  setHatchSmoothness: (smoothness: number) => void;
  stairSteps: number;
  setStairSteps: (steps: number) => void;
  snapToGrid: boolean;
  setSnapToGrid: (snap: boolean) => void;
  savedPatterns: (Segment[] | null)[];
  setSavedPattern: (index: number, segments: Segment[] | null) => void;
  dynamicSegments: Segment[];
  setDynamicSegments: (segments: Segment[]) => void;
  elements: MapElement[];
  pastElements: MapElement[][];
  futureElements: MapElement[][];
  selectedElementIds: string[];
  setSelectedElementIds: (ids: string[]) => void;
  setElements: (elements: MapElement[]) => void;
  addElement: (element: MapElement) => void;
  updateElement: (id: string, element: Partial<MapElement>) => void;
  removeElement: (id: string) => void;
  undo: () => void;
  redo: () => void;
  viewState: { x: number, y: number, zoom: number };
  setViewState: (viewState: Partial<{x: number, y: number, zoom: number}>) => void;
  gridSize: number;
  showHatch: boolean;
  setShowHatch: (show: boolean) => void;
  showGrid: boolean;
  toggleGrid: () => void;
  setGridSize: (gridSize: number) => void;
}

export const useMapStore = create<MapState>((set) => ({
  tool: 'room',
  setTool: (tool) => set({ tool }),
  activeLayer: 0,
  setActiveLayer: (activeLayer) => set({ activeLayer }),
  layerVisibility: [true, true, true, true],
  toggleLayerVisibility: (layer) => set((state) => {
    const newVis = [...state.layerVisibility];
    newVis[layer] = !newVis[layer];
    return { layerVisibility: newVis };
  }),
  layerLock: [false, false, false, false],
  toggleLayerLock: (layer) => set((state) => {
    const newLock = [...state.layerLock];
    newLock[layer] = !newLock[layer];
    return { layerLock: newLock };
  }),
  hatchStyle: 'dyson-hatch',
  setHatchStyle: (hatchStyle) => set({ hatchStyle }),
  softBorderColor: 'rgba(0,0,0,0.625)',
  setSoftBorderColor: (color) => set({ softBorderColor: color }),
  hatchDensity: 50,
  setHatchDensity: (density) => set({ hatchDensity: density }),
  hatchWidth: 0.5,
  setHatchWidth: (width) => set({ hatchWidth: width }),
  hatchOrganic: false,
  setHatchOrganic: (organic) => set({ hatchOrganic: organic }),
  hatchSmoothness: 50,
  setHatchSmoothness: (smoothness) => set({ hatchSmoothness: smoothness }),
  stairSteps: 10,
  setStairSteps: (stairSteps) => set({ stairSteps }),
  snapToGrid: true,
  setSnapToGrid: (snap) => set({ snapToGrid: snap }),
  savedPatterns: [null, null, null, null],
  setSavedPattern: (index, segments) => set((state) => {
    const newPatterns = [...state.savedPatterns];
    newPatterns[index] = segments;
    return { savedPatterns: newPatterns };
  }),
  dynamicSegments: [],
  setDynamicSegments: (segments) => set({ dynamicSegments: segments }),
  elements: [],
  pastElements: [],
  futureElements: [],
  selectedElementIds: [],
  setSelectedElementIds: (ids) => set({ selectedElementIds: ids }),
  setElements: (elements) => set((state) => ({ 
    pastElements: [...state.pastElements, state.elements],
    futureElements: [],
    elements 
  })),
  addElement: (element) => set((state) => ({ 
    pastElements: [...state.pastElements, state.elements],
    futureElements: [],
    elements: [...state.elements, { layer: state.activeLayer, ...element }] 
  })),
  updateElement: (id, updated) => set((state) => ({
    pastElements: [...state.pastElements, state.elements],
    futureElements: [],
    elements: state.elements.map(e => e.id === id ? { ...e, ...updated } : e)
  })),
  removeElement: (id) => set((state) => ({
    pastElements: [...state.pastElements, state.elements],
    futureElements: [],
    elements: state.elements.filter(e => e.id !== id)
  })),
  undo: () => set((state) => {
    if (state.pastElements.length === 0) return state;
    const newPast = [...state.pastElements];
    const previous = newPast.pop()!;
    return {
      pastElements: newPast,
      futureElements: [...state.futureElements, state.elements],
      elements: previous
    };
  }),
  redo: () => set((state) => {
    if (state.futureElements.length === 0) return state;
    const newFuture = [...state.futureElements];
    const next = newFuture.pop()!;
    return {
      pastElements: [...state.pastElements, state.elements],
      futureElements: newFuture,
      elements: next
    };
  }),
  viewState: { x: 0, y: 0, zoom: 1 },
  setViewState: (viewState) => set((state) => ({ viewState: { ...state.viewState, ...viewState } })),
  gridSize: 50,
  setGridSize: (gridSize) => set({ gridSize }),
  showHatch: true,
  setShowHatch: (showHatch) => set({ showHatch }),
  showGrid: true,
  toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
}))
