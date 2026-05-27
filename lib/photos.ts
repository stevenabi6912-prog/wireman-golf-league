import type { SupabaseClient } from "@supabase/supabase-js";
import { PHOTO_BUCKET } from "./supabase/client";
import { photoPublicUrl } from "./storage/supabase-store";

export const MAX_PHOTO_EDGE = 1600;
export const PHOTO_QUALITY = 0.8;

/** Scale dimensions so the longest edge is at most `maxEdge` (pure). */
export function computeTargetDimensions(
  width: number,
  height: number,
  maxEdge = MAX_PHOTO_EDGE,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const scale = maxEdge / longest;
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

/** Canvas-based JPEG compression. Browser only. */
export async function compressImage(
  file: File,
  maxEdge = MAX_PHOTO_EDGE,
  quality = PHOTO_QUALITY,
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = computeTargetDimensions(
    bitmap.width,
    bitmap.height,
    maxEdge,
  );
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close?.();
    return file; // fall back to the original on an unexpected failure
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality),
  );
  return blob ?? file;
}

function uuid(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export interface UploadedPhoto {
  storagePath: string;
  url: string;
}

/** Compress and upload a photo, returning its storage path and public URL. */
export async function uploadPhoto(
  client: SupabaseClient,
  familyId: string,
  roundId: string,
  file: File,
): Promise<UploadedPhoto> {
  const blob = await compressImage(file);
  const storagePath = `${familyId}/round-${roundId}/photo-${uuid()}.jpg`;
  const { error } = await client.storage
    .from(PHOTO_BUCKET)
    .upload(storagePath, blob, { contentType: "image/jpeg", upsert: false });
  if (error) throw error;
  return { storagePath, url: photoPublicUrl(client, storagePath) };
}
