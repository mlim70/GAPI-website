// frontend/src/utils/s3ImageUtils.ts
import { fetchS3Image } from '../api/s3';
import { useState, useEffect } from 'react';
import { logger } from './logger';

// Get bucket names from environment variables
const EVENTS_BUCKET = import.meta.env.VITE_EVENTS_BUCKET;
const NEWS_BUCKET = import.meta.env.VITE_NEWS_BUCKET;

// Fallback placeholder image (GAPI branded)
const FALLBACK_IMAGE = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDQwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iMzAwIiBmaWxsPSJ1cmwoI2dyYWRpZW50KSIvPgo8ZGVmcz4KPGxpbmVhckdyYWRpZW50IGlkPSJncmFkaWVudCIgeDE9IjAiIHkxPSIwIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPgo8c3RvcCBvZmZzZXQ9IjAlIiBzdHlsZT0ic3RvcC1jb2xvcjojQTA1MjJEO3N0b3Atb3BhY2l0eToxIiAvPgo8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiNBMDUyMkQ7c3RvcC1vcGFjaXR5OjEiIC8+CjwvbGluZWFyR3JhZGllbnQ+CjwvZGVmcz4KPHN2ZyB4PSI1MCUiIHk9IjUwJSIgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoLTUwJSwtNTAlKSIgZmlsbD0id2hpdGUiIG9wYWNpdHk9IjAuMyIgdmlld0JveD0iMCAwIDI0IDI0Ij4KPHBhdGggc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBzdHJva2UtbGluZXdpZHRoPSIyIiBkPSJNMTIgNnZsNCA0IDQtNHYtNkgxMnoiLz4KPC9zdmc+Cjwvc3ZnPgo=";

/**
 * Get event image URL from S3 using imageKey
 */
export async function getEventImageUrl(imageKey?: string): Promise<string> {
  if (!imageKey || !EVENTS_BUCKET) {
    return FALLBACK_IMAGE;
  }
  
  try {
    const s3Image = await fetchS3Image(EVENTS_BUCKET, imageKey);
    return s3Image?.url || FALLBACK_IMAGE;
  } catch (error) {
    logger.warn(`Failed to fetch event image for key: ${imageKey}`, error);
    return FALLBACK_IMAGE;
  }
}

/**
 * Get news image URL from S3 using imageKey
 */
export async function getNewsImageUrl(imageKey?: string): Promise<string> {
  if (!imageKey || !NEWS_BUCKET) {
    return FALLBACK_IMAGE;
  }
  
  try {
    const s3Image = await fetchS3Image(NEWS_BUCKET, imageKey);
    return s3Image?.url || FALLBACK_IMAGE;
  } catch (error) {
    logger.warn(`Failed to fetch news image for key: ${imageKey}`, error);
    return FALLBACK_IMAGE;
  }
}

/**
 * Get event image URL synchronously (for immediate use, returns placeholder)
 * Use this when you need an immediate return value
 */
export function getEventImageUrlSync(imageKey?: string): string {
  if (!imageKey || !EVENTS_BUCKET) {
    return FALLBACK_IMAGE;
  }
  
  // Return a placeholder that will be replaced when the async function loads
  return FALLBACK_IMAGE;
}

/**
 * Get news image URL synchronously (for immediate use, returns placeholder)
 * Use this when you need an immediate return value
 */
export function getNewsImageUrlSync(imageKey?: string): string {
  if (!imageKey || !NEWS_BUCKET) {
    return FALLBACK_IMAGE;
  }
  
  // Return a placeholder that will be replaced when the async function loads
  return FALLBACK_IMAGE;
}

/**
 * React hook for loading event images asynchronously
 */
export function useEventImage(imageKey?: string) {
  const [imageUrl, setImageUrl] = useState<string>(FALLBACK_IMAGE);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!imageKey || !EVENTS_BUCKET) {
      setImageUrl(FALLBACK_IMAGE);
      return;
    }

    setIsLoading(true);
    getEventImageUrl(imageKey)
      .then(url => {
        setImageUrl(url);
      })
      .catch(error => {
        logger.warn(`Failed to load event image for key: ${imageKey}`, error);
        setImageUrl(FALLBACK_IMAGE);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [imageKey]);

  return { imageUrl, isLoading };
}

/**
 * React hook for loading news images asynchronously
 */
export function useNewsImage(imageKey?: string) {
  const [imageUrl, setImageUrl] = useState<string>(FALLBACK_IMAGE);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!imageKey || !NEWS_BUCKET) {
      setImageUrl(FALLBACK_IMAGE);
      return;
    }

    setIsLoading(true);
    getNewsImageUrl(imageKey)
      .then(url => {
        setImageUrl(url);
      })
      .catch(error => {
        logger.warn(`Failed to load news image for key: ${imageKey}`, error);
        setImageUrl(FALLBACK_IMAGE);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [imageKey]);

  return { imageUrl, isLoading };
}
