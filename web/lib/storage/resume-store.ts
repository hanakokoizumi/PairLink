import { openDB, type DBSchema, type IDBPDatabase } from "idb";

const DB_NAME = "pairlink-resume";
const STORE_NAME = "transfers";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type ResumeRecord = {
  transferId: string;
  roomId: string;
  name: string;
  size: number;
  mime: string;
  receivedBytes: number;
  chunks: ArrayBuffer[];
  direction: "send" | "recv";
  updatedAt: number;
};

interface ResumeDB extends DBSchema {
  transfers: {
    key: string;
    value: ResumeRecord;
  };
}

let dbPromise: Promise<IDBPDatabase<ResumeDB>> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<ResumeDB>(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "transferId" });
        }
      },
    });
  }
  return dbPromise;
}

export async function saveResumeRecord(record: ResumeRecord): Promise<void> {
  const db = await getDb();
  await db.put(STORE_NAME, {
    ...record,
    updatedAt: record.updatedAt ?? Date.now(),
  });
}

export async function getResumeRecord(
  transferId: string,
): Promise<ResumeRecord | undefined> {
  const db = await getDb();
  return db.get(STORE_NAME, transferId);
}

export async function deleteResumeRecord(transferId: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE_NAME, transferId);
}

export async function listResumeRecords(roomId: string): Promise<ResumeRecord[]> {
  const db = await getDb();
  const all = await db.getAll(STORE_NAME);
  return all.filter((r) => r.roomId === roomId);
}

export async function purgeExpiredRecords(): Promise<number> {
  const db = await getDb();
  const all = await db.getAll(STORE_NAME);
  const cutoff = Date.now() - MAX_AGE_MS;
  let removed = 0;
  for (const record of all) {
    if (record.updatedAt < cutoff) {
      await db.delete(STORE_NAME, record.transferId);
      removed++;
    }
  }
  return removed;
}

export async function purgeOtherRooms(roomId: string): Promise<void> {
  const db = await getDb();
  const all = await db.getAll(STORE_NAME);
  for (const record of all) {
    if (record.roomId !== roomId) {
      await db.delete(STORE_NAME, record.transferId);
    }
  }
}

export function assembleBlob(record: ResumeRecord): Blob {
  return new Blob(record.chunks, { type: record.mime });
}

export async function appendChunk(
  transferId: string,
  chunk: ArrayBuffer,
  receivedBytes: number,
): Promise<void> {
  const db = await getDb();
  const record = await db.get(STORE_NAME, transferId);
  if (!record) return;
  record.chunks.push(chunk);
  record.receivedBytes = receivedBytes;
  record.updatedAt = Date.now();
  await db.put(STORE_NAME, record);
}

export function resetResumeDbForTests() {
  dbPromise = null;
}
