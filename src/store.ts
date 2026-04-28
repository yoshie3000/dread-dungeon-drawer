import { create } from 'zustand'

export type ElementType = 'room' | 'interior' | 'fill' | 'unfill' | 'wall' | 'door' | 'stair' | 'stair-depth' | 'stair-perspective';
export type Tool = 'select' | 'room' | 'interior' | 'fill' | 'unfill' | 'wall' | 'door' | 'stair' | 'stair-depth' | 'stair-perspective' | 'delete';

export interface Point {
  x: number;
  y: number;
}

export interface MapElement {
  id: string;
  type: Tool;
  points: Point[]; // For rooms: top-left, bottom-right. For walls: line segments.
  properties?: any;
}

interface MapState {
  tool: Tool;
  setTool: (tool: Tool) => void;
  hatchStyle: HatchStyle;
  setHatchStyle: (style: HatchStyle) => void;
  elements: MapElement[];
  setElements: (elements: MapElement[]) => void;
  addElement: (element: MapElement) => void;
  updateElement: (id: string, element: Partial<MapElement>) => void;
  removeElement: (id: string) => void;
  viewState: { x: number, y: number, zoom: number };
  setViewState: (viewState: Partial<{x: number, y: number, zoom: number}>) => void;
  gridSize: number;
  showGrid: boolean;
  toggleGrid: () => void;
  setGridSize: (gridSize: number) => void;
}

export const useMapStore = create<MapState>((set) => ({
  tool: 'room',
  setTool: (tool) => set({ tool }),
  hatchStyle: 'dyson-hatch',
  setHatchStyle: (hatchStyle) => set({ hatchStyle }),
  elements: [],
  setElements: (elements) => set({ elements }),
  addElement: (element) => set((state) => ({ elements: [...state.elements, element] })),
  updateElement: (id, updated) => set((state) => ({
    elements: state.elements.map(e => e.id === id ? { ...e, ...updated } : e)
  })),
  removeElement: (id) => set((state) => ({
    elements: state.elements.filter(e => e.id !== id)
  })),
  viewState: { x: 0, y: 0, zoom: 1 },
  setViewState: (viewState) => set((state) => ({ viewState: { ...state.viewState, ...viewState } })),
  gridSize: 50,
  setGridSize: (gridSize) => set({ gridSize }),
  showGrid: true,
  toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
}))
