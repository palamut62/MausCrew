// Turning a file someone picked into an avatar the harness will accept.
//
// The record it lands in is broadcast on every bot patch and re-sent on every
// hydration, so a 4 MB phone photo would be paid for on every reconnect. It is
// squared and downscaled here, in the renderer, before it is ever sent: the
// server's size limit is the boundary, this is the thing that keeps it far
// away from it.

/** What the avatar is drawn at, at the largest call site (settings, 112px)
 * on a 2× display, rounded up to the next power of two. */
export const AVATAR_EDGE = 256;

export class AvatarImageError extends Error {}

/** Centre-cropped square PNG data URL. Rejects anything that is not an image
 * the browser can actually decode, which is also what keeps a renamed
 * executable from being stored as one. */
export async function avatarDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new AvatarImageError("Choose an image file.");
  // Generous: this is the decode ceiling, not the stored size. Anything under
  // it survives the downscale below into a few dozen KB.
  if (file.size > 20_000_000) throw new AvatarImageError("That image is over 20 MB.");

  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new AvatarImageError("That file could not be read as an image."));
      element.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_EDGE;
    canvas.height = AVATAR_EDGE;
    const context = canvas.getContext("2d");
    if (!context) throw new AvatarImageError("This browser cannot process images.");
    const edge = Math.min(image.naturalWidth, image.naturalHeight);
    if (!edge) throw new AvatarImageError("That image has no pixels.");
    context.drawImage(
      image,
      (image.naturalWidth - edge) / 2,
      (image.naturalHeight - edge) / 2,
      edge,
      edge,
      0,
      0,
      AVATAR_EDGE,
      AVATAR_EDGE,
    );
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}
