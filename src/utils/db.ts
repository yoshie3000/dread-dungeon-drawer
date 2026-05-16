export type FinalTileSize = 'small' | 'medium' | 'large';
export type FinalTileType = 'Room' | 'Corridor' | 'Sanctuary' | 'Unique';
export type SegmentKind = 'wall' | 'connector';
export type ConnectorSubtype = 'hall' | 'door' | 'stairs';

export interface FinalTileSegment {
  kind: SegmentKind;
  width: number;
  subtype?: ConnectorSubtype;
}

// Ensure at least 1 item per side in UI, but technically an array of segments.
export type FinalTileSide = FinalTileSegment[];

export interface FinalTile {
  id: number;
  name: string;
  size: FinalTileSize;
  type: FinalTileType;
  // Edges in [Bottom, Left, Top, Right] order.
  sides: [FinalTileSide, FinalTileSide, FinalTileSide, FinalTileSide];
  image?: string;
  imageSource?: 'file' | 'drawn';
  imageFilename?: string;
  drawingData?: any;
  quantity: number;
}

const DB_NAME = 'DreadDungeonDB';
const DB_VERSION = 2; // Incremented for backgrounds
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



