import { blank, type Workspace } from './gtd';

let connection: Promise<IDBDatabase> | undefined;
export const changes = new BroadcastChannel('nextharbor-workspace-v1');

function open() {
  connection ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('nextharbor', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('workspace');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
  return connection;
}

export async function load(): Promise<Workspace> {
  const database = await open();
  return new Promise((resolve, reject) => {
    const request = database.transaction('workspace').objectStore('workspace').get('current');
    request.onsuccess = () => resolve(request.result ?? blank());
    request.onerror = () => reject(request.error);
  });
}

// Read and write in one transaction so separate tabs cannot silently clobber unrelated changes.
export async function update(change: (previous: Workspace) => Workspace): Promise<Workspace> {
  const database = await open();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('workspace', 'readwrite');
    const store = transaction.objectStore('workspace');
    const request = store.get('current');
    let result: Workspace;
    request.onsuccess = () => {
      try {
        result = change(request.result ?? blank());
        store.put(result, 'current');
      } catch (error) {
        reject(error);
        transaction.abort();
      }
    };
    transaction.onabort = () => reject(transaction.error ?? new Error('The save was canceled.'));
    transaction.oncomplete = () => {
      changes.postMessage('updated');
      resolve(result);
    };
  });
}
