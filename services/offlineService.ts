
// Implementação nativa de um wrapper leve para IndexedDB (similar ao idb-keyval)
// Isso evita bloquear a thread principal (como o localStorage faz) e permite armazenar objetos complexos.

const DB_NAME = 'EscalaGestaoDB';
const STORE_NAME = 'app_state';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

const openDB = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
        dbPromise = null; // Reset promise on error
        reject(request.error);
    };
  });

  return dbPromise;
};

export const saveOfflineData = async (key: string, data: any): Promise<void> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      // IndexedDB suporta Structured Clone, não precisa de JSON.stringify
      const request = store.put(data, key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error: any) {
    if (error.name === 'QuotaExceededError') {
      console.error("Erro Crítico: Limite de armazenamento do dispositivo excedido.");
      // Opcional: Limpar dados antigos aqui
    } else {
      console.error("Erro ao salvar dados offline:", error);
    }
    // Não lança erro para não quebrar o fluxo da UI, apenas loga
  }
};

export const loadOfflineData = async <T>(key: string): Promise<T | null> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result as T);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn("Falha ao ler cache offline:", error);
    return null;
  }
};

export const clearOfflineData = async (key: string): Promise<void> => {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(key);
    } catch(e) { console.error(e); }
};
