"use client";

const DB_NAME = "iso_tricks";
const DB_VERSION = 2;
const STORE_NAME = "user_models";

export type UserModelMeta = {
  id: string;
  fileName: string;
  size: number;
  createdAt: number;
  /** Extra sidecar files (mtl, maps) stored with the mesh. */
  assetCount: number;
};

export type UserModelAsset = {
  fileName: string;
  mimeType: string;
  data: ArrayBuffer;
};

type UserModelRecord = {
  id: string;
  fileName: string;
  size: number;
  createdAt: number;
  mimeType: string;
  data: ArrayBuffer;
  /** Optional package assets (v2). */
  assets?: UserModelAsset[];
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

function toMeta(record: UserModelRecord): UserModelMeta {
  return {
    id: record.id,
    fileName: record.fileName,
    size: record.size,
    createdAt: record.createdAt,
    assetCount: record.assets?.length ?? 0,
  };
}

export async function saveUserModelPackage(
  primary: File,
  sidecars: File[] = [],
  id: string = crypto.randomUUID(),
): Promise<UserModelMeta> {
  const data = await primary.arrayBuffer();
  const assets: UserModelAsset[] = [];
  let totalSize = primary.size;
  for (const file of sidecars) {
    const buf = await file.arrayBuffer();
    assets.push({
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      data: buf,
    });
    totalSize += file.size;
  }

  const record: UserModelRecord = {
    id,
    fileName: primary.name,
    size: totalSize,
    mimeType: primary.type || "application/octet-stream",
    data,
    assets: assets.length > 0 ? assets : undefined,
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

  return toMeta(record);
}

/** @deprecated Prefer saveUserModelPackage */
export async function saveUserModel(file: File): Promise<UserModelMeta> {
  return saveUserModelPackage(file, []);
}

export async function listUserModels(): Promise<UserModelMeta[]> {
  const db = await openDb();
  try {
    const records = await idbRequest<UserModelRecord[]>(
      db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll(),
    );
    return records.map(toMeta).sort((a, b) => b.createdAt - a.createdAt);
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
      meta: toMeta(record),
      blob: new Blob([record.data], { type: record.mimeType }),
    };
  } finally {
    db.close();
  }
}

export async function getUserModelPackage(
  id: string,
): Promise<{
  meta: UserModelMeta;
  primary: { fileName: string; blob: Blob };
  assets: { fileName: string; blob: Blob }[];
} | null> {
  const db = await openDb();
  try {
    const record = await idbRequest<UserModelRecord | undefined>(
      db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(id),
    );
    if (!record) return null;
    return {
      meta: toMeta(record),
      primary: {
        fileName: record.fileName,
        blob: new Blob([record.data], { type: record.mimeType }),
      },
      assets: (record.assets ?? []).map((a) => ({
        fileName: a.fileName,
        blob: new Blob([a.data], { type: a.mimeType }),
      })),
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
