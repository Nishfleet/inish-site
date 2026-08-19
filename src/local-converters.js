export function convertImageInBrowser(file, format) {
  return new Promise((resolve, reject) => {
    if (!file?.type?.startsWith("image/")) {
      reject(new Error("Choose a PNG, JPG, or WEBP image."));
      return;
    }

    const imageUrl = URL.createObjectURL(file);
    const image = new window.Image();
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth || image.width;
        canvas.height = image.naturalHeight || image.height;
        const context = canvas.getContext("2d");
        if (!context || !canvas.width || !canvas.height) throw new Error("The browser could not read this image.");

        if (format === "jpeg") {
          context.fillStyle = "#ffffff";
          context.fillRect(0, 0, canvas.width, canvas.height);
        }
        context.drawImage(image, 0, 0);

        const mimeType = format === "jpeg" ? "image/jpeg" : `image/${format}`;
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(imageUrl);
            if (!blob) {
              reject(new Error("This browser could not export that image format."));
              return;
            }
            const extension = format === "jpeg" ? "jpg" : format;
            const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
            resolve({
              url: URL.createObjectURL(blob),
              fileName: `${baseName}.${extension}`
            });
          },
          mimeType,
          0.92
        );
      } catch (error) {
        URL.revokeObjectURL(imageUrl);
        reject(error);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(imageUrl);
      reject(new Error("This browser could not decode the image."));
    };
    image.src = imageUrl;
  });
}

export function convertRasterToSvgInBrowser(file) {
  return new Promise((resolve, reject) => {
    if (!file?.type?.startsWith("image/")) {
      reject(new Error("Choose a PNG, JPG, or WEBP image."));
      return;
    }

    const imageUrl = URL.createObjectURL(file);
    const image = new window.Image();
    image.onload = () => {
      try {
        const maxSide = 128;
        const scale = Math.min(1, maxSide / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
        const width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
        const height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) throw new Error("The browser could not read this image.");

        context.drawImage(image, 0, 0, width, height);
        const pixels = context.getImageData(0, 0, width, height).data;
        const block = Math.max(1, Math.round(Math.max(width, height) / 72));
        const svg = buildPosterizedSvg(pixels, width, height, block);
        URL.revokeObjectURL(imageUrl);
        const blob = new Blob([svg], { type: "image/svg+xml" });
        const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
        resolve({
          url: URL.createObjectURL(blob),
          fileName: `${baseName}.svg`
        });
      } catch (error) {
        URL.revokeObjectURL(imageUrl);
        reject(error);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(imageUrl);
      reject(new Error("This browser could not decode the image."));
    };
    image.src = imageUrl;
  });
}

export function buildPosterizedSvg(pixels, width, height, block) {
  const rects = [];
  for (let y = 0; y < height; y += block) {
    for (let x = 0; x < width; x += block) {
      const color = averageBlockColor(pixels, width, height, x, y, block);
      if (color.a < 18) continue;
      rects.push(
        `<rect x="${x}" y="${y}" width="${Math.min(block, width - x)}" height="${Math.min(block, height - y)}" fill="rgba(${color.r},${color.g},${color.b},${(color.a / 255).toFixed(3)})"/>`
      );
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges">\n${rects.join("\n")}\n</svg>\n`;
}

function averageBlockColor(pixels, width, height, startX, startY, block) {
  let r = 0;
  let g = 0;
  let b = 0;
  let a = 0;
  let count = 0;
  for (let y = startY; y < Math.min(height, startY + block); y += 1) {
    for (let x = startX; x < Math.min(width, startX + block); x += 1) {
      const offset = (y * width + x) * 4;
      r += pixels[offset];
      g += pixels[offset + 1];
      b += pixels[offset + 2];
      a += pixels[offset + 3];
      count += 1;
    }
  }
  return {
    r: Math.round(r / count),
    g: Math.round(g / count),
    b: Math.round(b / count),
    a: Math.round(a / count)
  };
}
