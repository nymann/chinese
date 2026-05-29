import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'mockingbird';
const DB_VERSION = 1;

export const STORE_CALIBRATION = 'calibration';
export const STORE_MASTERY = 'mastery';
export const STORE_TRIALS = 'trials';

let dbPromise: Promise<IDBPDatabase> | null = null;

export function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_CALIBRATION)) {
          db.createObjectStore(STORE_CALIBRATION);
        }
        if (!db.objectStoreNames.contains(STORE_MASTERY)) {
          db.createObjectStore(STORE_MASTERY);
        }
        if (!db.objectStoreNames.contains(STORE_TRIALS)) {
          db.createObjectStore(STORE_TRIALS, {
            keyPath: 'id',
            autoIncrement: true,
          });
        }
      },
    });
  }
  return dbPromise;
}
