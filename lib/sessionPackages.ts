/** In-memory OBJ(+MTL/maps) packages for the current tab session. */

export type SessionPackageAsset = {
  fileName: string;
  blob: Blob;
};

export type SessionPackage = {
  primary: SessionPackageAsset;
  assets: SessionPackageAsset[];
};

const cache = new Map<string, SessionPackage>();

function toAsset(file: File | SessionPackageAsset): SessionPackageAsset {
  if (file instanceof File) {
    return { fileName: file.name, blob: file };
  }
  return { fileName: file.fileName, blob: file.blob };
}

export function setSessionPackage(
  id: string,
  primary: File | SessionPackageAsset,
  assets: Array<File | SessionPackageAsset> = [],
): void {
  cache.set(id, {
    primary: toAsset(primary),
    assets: assets.map(toAsset),
  });
}

export function getSessionPackage(id: string): SessionPackage | null {
  return cache.get(id) ?? null;
}

export function deleteSessionPackage(id: string): void {
  cache.delete(id);
}
