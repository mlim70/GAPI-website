// frontend/src/utils/imagePaths.ts
//
// Resolves image keys stored in the JSON data files to static paths under
// frontend/public/images/. Replaces the old presigned-S3-URL helpers.
//
// A key may be either:
//   - an absolute public path already ("/images/hero/foo.jpg", "/flyers/bar.png")
//   - a manifest key ("hero/gapi-savannah25-1.jpg" or just "gapi-savannah25-1.jpg")

import heroImagePaths from '../data/heroImages.json';
import galleryImagePaths from '../data/galleryImages.json';
import clinicImagePaths from '../data/clinicImages.json';
import execImagePaths from '../data/execImages.json';

/** Builds a lookup of "<folder>/<file>" and "<file>" → public path. */
function indexManifest(paths: string[], target: Map<string, string>) {
  for (const path of paths) {
    const segments = path.split('/');
    const filename = segments[segments.length - 1];
    const folder = segments[segments.length - 2];
    target.set(`${folder}/${filename}`, path);
    if (!target.has(filename)) target.set(filename, path);
  }
}

const imageIndex = new Map<string, string>();
indexManifest(heroImagePaths, imageIndex);
indexManifest(galleryImagePaths, imageIndex);
indexManifest(clinicImagePaths, imageIndex);
indexManifest(execImagePaths, imageIndex);

/**
 * Resolve an image key to a static path, or null when no such image exists.
 */
export function resolveImagePath(imageKey?: string): string | null {
  if (!imageKey) return null;
  if (imageKey.startsWith('/') || imageKey.startsWith('http')) return imageKey;
  return imageIndex.get(imageKey) ?? null;
}

/** Resolve every key in a list, dropping the ones that don't resolve. */
export function resolveImagePaths(imageKeys?: string[]): string[] {
  if (!imageKeys) return [];
  return imageKeys
    .map(resolveImagePath)
    .filter((path): path is string => path !== null);
}

/** Event images may be a single key or a list; returns the first resolvable one. */
export function getEventImageUrl(imageKey?: string | string[]): string | null {
  if (Array.isArray(imageKey)) {
    return resolveImagePaths(imageKey)[0] ?? null;
  }
  return resolveImagePath(imageKey);
}

export function getNewsImageUrl(imageKey?: string): string | null {
  return resolveImagePath(imageKey);
}
