/**
 * Compress an image file client-side before upload.
 * Resizes to maxWidth/maxHeight and compresses to target JPEG quality.
 * Honors EXIF orientation so that landscape photos stay landscape
 * and portrait photos stay portrait once stored.
 */
export async function compressImage(
  file: File,
  options: { maxWidth?: number; maxHeight?: number; quality?: number } = {}
): Promise<File> {
  const { maxWidth = 1600, maxHeight = 1600, quality = 0.85 } = options;

  // Skip non-image files
  if (!file.type.startsWith('image/')) return file;

  // Try the modern path: createImageBitmap honors EXIF orientation natively.
  // We ALWAYS go through this path (even for small files) so the stored image
  // is rotated correctly — otherwise landscape photos appear portrait everywhere.
  try {
    if (typeof createImageBitmap === 'function') {
      const bitmap = await createImageBitmap(file, {
        imageOrientation: 'from-image',
      } as ImageBitmapOptions);

      let { width, height } = bitmap;
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        bitmap.close?.();
        return file;
      }
      ctx.drawImage(bitmap, 0, 0, width, height);
      bitmap.close?.();

      const blob: Blob | null = await new Promise((res) =>
        canvas.toBlob(res, 'image/jpeg', quality)
      );
      if (!blob) return file;

      const compressed = new File(
        [blob],
        file.name.replace(/\.\w+$/, '.jpg'),
        { type: 'image/jpeg', lastModified: Date.now() }
      );
      console.log(
        `Image compressed (EXIF-aware): ${(file.size / 1024).toFixed(0)}KB → ${(compressed.size / 1024).toFixed(0)}KB, ${width}x${height}`
      );
      return compressed;
    }
  } catch (e) {
    console.warn('createImageBitmap path failed, falling back to <img>', e);
  }

  // Fallback: use <img>. Some browsers auto-apply EXIF on <img> (image-orientation: from-image is the CSS default since 2021),
  // but drawImage to canvas may NOT honor it. We accept this best-effort path.
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          const compressed = new File([blob], file.name.replace(/\.\w+$/, '.jpg'), {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          console.log(`Image compressed (fallback): ${(file.size / 1024).toFixed(0)}KB → ${(compressed.size / 1024).toFixed(0)}KB`);
          resolve(compressed);
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };

    img.src = url;
  });
}
