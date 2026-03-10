export const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("خواندن فایل انجام نشد."));
    reader.readAsDataURL(file);
  });

export const resizeDataUrlImage = (dataUrl: string, maxSize = 256, quality = 0.82) =>
  new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const width = Math.max(1, Math.round(img.width * scale));
      const height = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("پردازش تصویر انجام نشد."));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => reject(new Error("فایل تصویر معتبر نیست."));
    img.src = dataUrl;
  });

export const fileToOptimizedAvatar = async (file: File) => {
  const dataUrl = await fileToDataUrl(file);
  return resizeDataUrlImage(dataUrl);
};
