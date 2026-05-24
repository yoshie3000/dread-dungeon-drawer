export type FinalTileSize = 'small' | 'medium' | 'large';
export type FinalTileType = 'Room' | 'Corridor' | 'Sanctuary' | 'Unique';
export type ConnectorSubtype = 'hall' | 'door' | 'stairs';
export type TileEdge = 'top' | 'right' | 'bottom' | 'left';

export const EXPORT_TILE_PX_BY_SIZE: Record<FinalTileSize, number> = {
  small: 500,
  medium: 1000,
  large: 2000,
};

// cellIndex is 0-based per tile-local convention (canvas-natural):
//   top/bottom: index 0 at left, increases rightward
//   left/right: index 0 at top, increases downward
export interface TileConnector {
  side: TileEdge;
  cellIndex: number;
  type: ConnectorSubtype;
}

export interface FinalTile {
  id: number;
  name: string;
  size: FinalTileSize;
  type: FinalTileType;
  edgeLengthCells: number;
  connectors: TileConnector[];
  image?: string;
  imageSource?: 'file' | 'drawn';
  imageFilename?: string;
  drawingData?: any;
  quantity: number;
}

const DB_NAME = 'DreadDungeonDB';
const DB_VERSION = 3; // Incremented for connector metadata schema change
const STORE_NAME = 'finalTiles';
const BG_STORE_NAME = 'backgrounds';

export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(BG_STORE_NAME)) {
        db.createObjectStore(BG_STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

// ... FinalTile functions ...
export async function saveFinalTile(tile: FinalTile): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readwrite');
    const request = tx.objectStore(STORE_NAME).put(tile);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getFinalTiles(): Promise<FinalTile[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readonly');
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result as FinalTile[]);
    request.onerror = () => reject(request.error);
  });
}



