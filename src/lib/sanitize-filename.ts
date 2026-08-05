/**
 * Nettoie un nom de fichier pour l'utiliser comme clé de stockage.
 * Supabase Storage refuse les accents, apostrophes et certains caractères spéciaux.
 */
export function sanitizeFileName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .slice(-100);
}
