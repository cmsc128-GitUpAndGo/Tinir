import { ImageMagick, initializeImageMagick, MagickFormat, MagickImageInfo, ResourceLimits } from '@imagemagick/magick-wasm';
let ready: Promise<void> | undefined;
export class ImageError extends Error {}
export async function optimizeImage(bytes: Uint8Array, declaredType: string): Promise<Uint8Array> {
  const png = [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v);
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp = new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP';
  const expected = png ? 'image/png' : jpeg ? 'image/jpeg' : webp ? 'image/webp' : null;
  if (!expected || expected !== declaredType || bytes.length > 5 * 1024 * 1024) throw new ImageError('Use a valid JPEG, PNG, or WebP image of 5 MB or less.');
  ready ??= Deno.readFile(new URL('./magick.wasm', import.meta.url)).then((bytes) => initializeImageMagick(bytes)).then(() => {
    ResourceLimits.memory = 96n * 1024n * 1024n;
    ResourceLimits.maxMemoryRequest = 64n * 1024n * 1024n;
    ResourceLimits.disk = 0n;
    ResourceLimits.width = 6000n; ResourceLimits.height = 6000n;
    ResourceLimits.listLength = 8n; ResourceLimits.time = 10n;
  });
  await ready;
  try {
    const info = MagickImageInfo.create(bytes);
    if (info.width * info.height > 8_000_000) throw new ImageError('Photos must contain at most 8 million pixels.');
    return ImageMagick.read(bytes, png ? MagickFormat.Png : jpeg ? MagickFormat.Jpeg : MagickFormat.WebP, (image) => {
      image.autoOrient();
      const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
      if (scale < 1) image.resize(Math.max(1, Math.round(image.width * scale)), Math.max(1, Math.round(image.height * scale)));
      image.strip(); image.quality = 80;
      return image.write(MagickFormat.WebP, (output) => new Uint8Array(output));
    });
  } catch (error) {
    if (error instanceof ImageError) throw error;
    throw new ImageError('The image could not be decoded within the supported limits.');
  }
}
