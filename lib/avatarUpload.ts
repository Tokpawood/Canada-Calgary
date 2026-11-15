import { createClient } from "@/lib/supabase/client";

const SIZE = 320;

/** Recadre la photo au carré (centre) et la réduit à 320 px, en JPEG : léger et lisible partout (iPad compris). */
export async function squareJpeg(file: Blob, mode: "cover" | "contain" = "cover"): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Lecture de l'image impossible.");
  ctx.imageSmoothingQuality = "high";
  if (mode === "contain") {
    // Logo : l'image entière, centrée sur fond blanc (rien n'est coupé).
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, SIZE, SIZE);
    const scale = Math.min((SIZE * 0.86) / bitmap.width, (SIZE * 0.86) / bitmap.height);
    const w = bitmap.width * scale;
    const h = bitmap.height * scale;
    ctx.drawImage(bitmap, (SIZE - w) / 2, (SIZE - h) / 2, w, h);
  } else {
    const side = Math.min(bitmap.width, bitmap.height);
    ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  }
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Conversion impossible."))), "image/jpeg", 0.88));
}

/** Enregistre la photo de profil et la mémorise sur le compte. Renvoie un message d'erreur, ou null. */
export async function uploadAvatar(file: File): Promise<string | null> {
  if (!file.type.startsWith("image/")) return "Choisissez une image (photo JPEG, PNG, HEIC…).";
  if (file.size > 25 * 1024 * 1024) return "Image trop lourde (25 Mo maximum).";
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return "Session expirée : reconnectez-vous.";
  let blob: Blob;
  try {
    blob = await squareJpeg(file);
  } catch {
    return "Format d'image non lisible par ce navigateur.";
  }
  const path = `${auth.user.id}/avatar.jpg`;
  const { error } = await supabase.storage.from("avatars").upload(path, blob, { upsert: true, contentType: "image/jpeg", cacheControl: "3600" });
  if (error) return error.message;
  const { error: metaErr } = await supabase.auth.updateUser({ data: { avatar_path: path, avatar_v: Date.now() } });
  return metaErr ? metaErr.message : null;
}

export async function removeAvatar(path: string | null): Promise<string | null> {
  const supabase = createClient();
  if (path) await supabase.storage.from("avatars").remove([path]);
  const { error } = await supabase.auth.updateUser({ data: { avatar_path: null, avatar_v: Date.now() } });
  return error ? error.message : null;
}
