export const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });

export interface Area {
  x: number;
  y: number;
  width: number;
  height: number;
}

function rotateSize(width: number, height: number, rotation: number) {
  const rotRad = (rotation * Math.PI) / 180;

  return {
    width:
      Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
    height:
      Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
  };
}

/**
 * Gets the cropped image blob from the canvas coordinates provided by react-easy-crop.
 */
export async function getCroppedImg(
  imageSrc: string,
  pixelCrop: Area,
  rotation = 0
): Promise<Blob> {
  const image = await createImage(imageSrc);
  
  if (process.env.NODE_ENV === 'development') {
    console.log('[CropUtils] Source Image:', {
      width: image.naturalWidth,
      height: image.naturalHeight,
      src: imageSrc.substring(0, 50) + '...'
    });
    console.log('[CropUtils] Crop Coordinates:', pixelCrop);
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Could not get canvas context');
  }

  const rotRad = (rotation * Math.PI) / 180;

  const { width: bBoxWidth, height: bBoxHeight } = rotateSize(
    image.naturalWidth,
    image.naturalHeight,
    rotation
  );

  canvas.width = bBoxWidth;
  canvas.height = bBoxHeight;

  ctx.translate(bBoxWidth / 2, bBoxHeight / 2);
  ctx.rotate(rotRad);
  ctx.translate(-image.naturalWidth / 2, -image.naturalHeight / 2);

  ctx.drawImage(image, 0, 0);

  const croppedCanvas = document.createElement('canvas');
  const croppedCtx = croppedCanvas.getContext('2d');

  if (!croppedCtx) {
    throw new Error('Could not get cropped canvas context');
  }

  // Ensure output is always 1:1 and matches pixelCrop
  croppedCanvas.width = pixelCrop.width;
  croppedCanvas.height = pixelCrop.height;

  croppedCtx.drawImage(
    canvas,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  if (process.env.NODE_ENV === 'development') {
    console.log('[CropUtils] Output Canvas:', {
      width: croppedCanvas.width,
      height: croppedCanvas.height
    });
  }

  return new Promise((resolve, reject) => {
    croppedCanvas.toBlob(
      (blob) => {
        if (blob && blob.size > 0) {
          if (process.env.NODE_ENV === 'development') {
            console.log('[CropUtils] Generated Blob:', {
              size: blob.size,
              type: blob.type
            });
          }
          resolve(blob);
        } else {
          reject(new Error('Generated crop is empty or invalid'));
        }
      },
      'image/jpeg',
      0.95 // Higher quality for profile images
    );
  });
}
