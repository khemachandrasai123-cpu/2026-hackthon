/**
 * Robust Client-Side Media Storage using IndexedDB
 * Allows elders to record voice and video stories with persistent local playback
 */

const DB_NAME = 'LivingFamilyMentorMediaDB';
const STORE_NAME = 'media_recordings';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const req = window.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// In-memory cache of object URLs created in this browser session
const urlCache = new Map<string, string>();

/**
 * Check if a URL is currently usable (not an expired blob URL from a previous page session)
 */
export function isBlobUrlValid(url?: string): boolean {
  if (!url) return false;
  if (!url.startsWith('blob:')) return true; // HTTP, HTTPS, or Data URLs are not session-ephemeral
  for (const cached of urlCache.values()) {
    if (cached === url) return true;
  }
  return false;
}

/**
 * Save an Audio or Video Blob by reference ID
 */
export async function saveMediaBlob(mediaId: string, blob: Blob, mimeType: string): Promise<string> {
  // Create an object URL immediately for active session playback
  const objectUrl = URL.createObjectURL(blob);
  urlCache.set(mediaId, objectUrl);

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put({
        id: mediaId,
        blob,
        mimeType,
        createdAt: new Date().toISOString()
      });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Could not persist media blob to IndexedDB, fallback to memory URL:', err);
  }

  return objectUrl;
}

/**
 * Retrieve an Audio or Video URL by reference ID or media ID from IndexedDB
 */
export async function getMediaUrl(mediaId: string): Promise<string | null> {
  if (!mediaId) return null;

  if (urlCache.has(mediaId)) {
    return urlCache.get(mediaId)!;
  }

  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(mediaId);
      req.onsuccess = () => {
        if (req.result && req.result.blob) {
          const url = URL.createObjectURL(req.result.blob);
          urlCache.set(mediaId, url);
          resolve(url);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch (err) {
    return null;
  }
}

/**
 * Resolves a reliable, playable media URL for a given audio or video source.
 * Revives expired session blob URLs by pulling the blob from IndexedDB via referenceId.
 */
export async function resolveMediaUrl(url?: string, referenceId?: string): Promise<string | null> {
  if (url && isBlobUrlValid(url)) {
    return url;
  }
  if (referenceId) {
    const fromDb = await getMediaUrl(referenceId);
    if (fromDb) return fromDb;
  }
  if (url && !url.startsWith('blob:')) {
    return url;
  }
  return null;
}
