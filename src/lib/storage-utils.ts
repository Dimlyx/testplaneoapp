import { supabase } from "@/integrations/supabase/client";

const BUCKET_NAME = "intervention-photos";

/**
 * Extract the file path from a stored URL (public URL format).
 * Handles URLs like: https://xxx.supabase.co/storage/v1/object/public/intervention-photos/path/to/file.jpg
 */
export function extractStoragePath(url: string): string | null {
  const marker = `/${BUCKET_NAME}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(url.substring(idx + marker.length));
}

/**
 * Create a signed URL from a stored public URL.
 * Returns the signed URL or the original URL as fallback.
 */
export async function getSignedUrl(storedUrl: string, expiresIn = 3600): Promise<string> {
  const path = extractStoragePath(storedUrl);
  if (!path) return storedUrl;

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(path, expiresIn);

  if (error || !data?.signedUrl) {
    console.warn("Failed to create signed URL:", error?.message);
    return storedUrl;
  }

  return data.signedUrl;
}

/**
 * Create signed URLs for multiple stored URLs.
 */
export async function getSignedUrls(storedUrls: string[], expiresIn = 3600): Promise<string[]> {
  if (storedUrls.length === 0) return [];

  const paths = storedUrls
    .map((url, i) => ({ path: extractStoragePath(url), index: i, original: url }))
    .filter((item): item is { path: string; index: number; original: string } => item.path !== null);

  if (paths.length === 0) return storedUrls;

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrls(
      paths.map((p) => p.path),
      expiresIn
    );

  if (error || !data) {
    console.warn("Failed to create signed URLs:", error?.message);
    return storedUrls;
  }

  // Map back to original array order
  const result = [...storedUrls];
  data.forEach((item, i) => {
    if (item.signedUrl) {
      result[paths[i].index] = item.signedUrl;
    }
  });

  return result;
}
