const maxProfileImageDimension = 320;
const profileImageQuality = 0.82;

export async function compressProfileImage(source: Blob | string): Promise<string> {
  const objectUrl = typeof source === "string" ? "" : URL.createObjectURL(source);
  const image = new Image();

  try {
    image.decoding = "async";
    image.src = typeof source === "string" ? source : objectUrl;
    await waitForImage(image);

    const scale = Math.min(
      1,
      maxProfileImageDimension / Math.max(image.naturalWidth, image.naturalHeight),
    );
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Браузер не поддерживает подготовку изображения.");
    }

    canvas.width = width;
    canvas.height = height;
    context.drawImage(image, 0, 0, width, height);

    return canvas.toDataURL("image/webp", profileImageQuality);
  } finally {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
  }
}

function waitForImage(image: HTMLImageElement): Promise<void> {
  return new Promise((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Не удалось прочитать изображение."));
  });
}
