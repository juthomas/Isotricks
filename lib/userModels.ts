"use client";

const DB_NAME = "iso_tricks";
const DB_VERSION = 1;
const STORE_NAME = "user_models";

export type UserModelMeta = {
  id: string;
  fileName: string;
  size: number;
  createdAt: number;
};

type UserModelRecord = UserModelMeta & {
  mimeType: string;
  data: ArrayBuffer;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Failed to open IndexedDB"));
  });
}

function idbRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

export async function saveUserModel(file: File): Promise<UserModelMeta> {
  const data = await file.arrayBuffer();
  const record: UserModelRecord = {
    id: crypto.randomUUID(),
    fileName: file.name,
    size: file.size,
    mimeType: file.type || "application/octet-stream",
    data,
    createdAt: Date.now(),
  };

  const db = await openDb();
  try {
    await idbRequest(
      db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(record),
    );
  } finally {
    db.close();
  }

  return {
    id: record.id,
    fileName: record.fileName,
    size: record.size,
    createdAt: record.createdAt,
  };
}

export async function listUserModels(): Promise<UserModelMeta[]> {
  const db = await openDb();
  try {
    const records = await idbRequest<UserModelRecord[]>(
      db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll(),
    );
    return records
      .map(({ id, fileName, size, createdAt }) => ({
        id,
        fileName,
        size,
        createdAt,
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
  } finally {
    db.close();
  }
}

export async function getUserModelBlob(
  id: string,
): Promise<{ meta: UserModelMeta; blob: Blob } | null> {
  const db = await openDb();
  try {
    const record = await idbRequest<UserModelRecord | undefined>(
      db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(id),
    );
    if (!record) return null;
    return {
      meta: {
        id: record.id,
        fileName: record.fileName,
        size: record.size,
        createdAt: record.createdAt,
      },
      blob: new Blob([record.data], { type: record.mimeType }),
    };
  } finally {
    db.close();
  }
}

export async function deleteUserModel(id: string): Promise<void> {
  const db = await openDb();
  try {
    await idbRequest(
      db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).delete(id),
    );
  } finally {
    db.close();
  }
}
