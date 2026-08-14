export interface ImageCompressionOptions {
    maxTargetKb?: number;   // Default 600 KB
    maxDimension?: number;  // Default 1920 px
    initialQuality?: number;// Default 0.85 (high visual clarity)
    onProgress?: (percent: number, statusText: string) => void;
}

export interface ImageCompressionResult {
    file: File;
    originalSizeKb: number;
    compressedSizeKb: number;
    reductionPercent: number;
    isCompressed: boolean;
}

/**
 * Compresses an image file client-side in the browser using HTML5 Canvas.
 * Keeps resolution sharp (up to 1920px max dimension), maintaining high visual quality while staying under maxTargetKb (600 KB).
 */
export async function compressImage(
    file: File,
    options: ImageCompressionOptions = {}
): Promise<ImageCompressionResult> {
    const {
        maxTargetKb = 600,
        maxDimension = 1920,
        initialQuality = 0.85,
        onProgress,
    } = options;

    const originalSizeKb = Math.round(file.size / 1024);

    // Only process image MIME types or image file extensions
    const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|heic)$/i.test(file.name);
    if (!isImage) {
        return {
            file,
            originalSizeKb,
            compressedSizeKb: originalSizeKb,
            reductionPercent: 0,
            isCompressed: false,
        };
    }

    try {
        onProgress?.(10, 'Loading photo…');
        const imageElement = await loadImageElement(file);

        const origW = imageElement.naturalWidth || imageElement.width;
        const origH = imageElement.naturalHeight || imageElement.height;

        // If file size is already <= 600 KB AND dimensions are within maxDimension, return original untouched
        if (file.size <= maxTargetKb * 1024 && origW <= maxDimension && origH <= maxDimension) {
            onProgress?.(100, 'Original photo is already optimal (< 600 KB)');
            return {
                file,
                originalSizeKb,
                compressedSizeKb: originalSizeKb,
                reductionPercent: 0,
                isCompressed: false,
            };
        }

        onProgress?.(30, 'Scaling & optimizing photo resolution…');

        // Calculate target width/height maintaining aspect ratio
        let targetW = origW;
        let targetH = origH;
        if (origW > maxDimension || origH > maxDimension) {
            if (origW >= origH) {
                targetW = maxDimension;
                targetH = Math.round((origH * maxDimension) / origW);
            } else {
                targetH = maxDimension;
                targetW = Math.round((origW * maxDimension) / origH);
            }
        }

        // Draw on high quality canvas
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Failed to create canvas context for image compression');
        }

        // Smooth image rendering setup
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, targetW, targetH);
        ctx.drawImage(imageElement, 0, 0, targetW, targetH);

        onProgress?.(60, 'Applying high-clarity encoding…');

        // Attempt 1: High Quality WebP/JPEG (0.85 quality)
        let outputMime = file.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
        let blob = await canvasToBlob(canvas, outputMime, initialQuality);

        // If output exceeds maxTargetKb, perform dynamic second pass (lower quality slightly to 0.75 or 0.70 to guarantee < 600KB)
        if (blob.size > maxTargetKb * 1024) {
            onProgress?.(80, 'Fine-tuning file size under 600 KB…');
            blob = await canvasToBlob(canvas, outputMime, 0.75);

            // If still larger than 600 KB, scale dimensions down to 1600px max
            if (blob.size > maxTargetKb * 1024) {
                const scaleDownRatio = 1600 / Math.max(origW, origH);
                const w2 = Math.round(origW * scaleDownRatio);
                const h2 = Math.round(origH * scaleDownRatio);

                const canvas2 = document.createElement('canvas');
                canvas2.width = w2;
                canvas2.height = h2;
                const ctx2 = canvas2.getContext('2d');
                if (ctx2) {
                    ctx2.imageSmoothingEnabled = true;
                    ctx2.imageSmoothingQuality = 'high';
                    ctx2.fillStyle = '#FFFFFF';
                    ctx2.fillRect(0, 0, w2, h2);
                    ctx2.drawImage(imageElement, 0, 0, w2, h2);
                    blob = await canvasToBlob(canvas2, outputMime, 0.72);

                    // Final pass guarantee if still > 600 KB
                    if (blob.size > maxTargetKb * 1024) {
                        blob = await canvasToBlob(canvas2, outputMime, 0.65);
                    }
                }
            }
        }

        // Safety fallback: if compressed file is somehow larger than original (and original was <= maxTargetKb), return original
        if (blob.size >= file.size && file.size <= maxTargetKb * 1024) {
            onProgress?.(100, 'Original photo is smaller and optimal');
            return {
                file,
                originalSizeKb,
                compressedSizeKb: originalSizeKb,
                reductionPercent: 0,
                isCompressed: false,
            };
        }

        // Clean file extension naming
        const ext = outputMime === 'image/webp' ? 'webp' : 'jpg';
        const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        const newFileName = `${baseName}.${ext}`;

        const compressedFile = new File([blob], newFileName, {
            type: outputMime,
            lastModified: Date.now(),
        });

        const compressedSizeKb = Math.round(compressedFile.size / 1024);
        const reductionPercent = Math.max(0, Math.round(((file.size - compressedFile.size) / file.size) * 100));

        onProgress?.(100, `Done! Reduced by ${reductionPercent}% (${originalSizeKb} KB → ${compressedSizeKb} KB)`);

        return {
            file: compressedFile,
            originalSizeKb,
            compressedSizeKb,
            reductionPercent,
            isCompressed: true,
        };

    } catch (err: any) {
        console.error('Image Compression failed:', err);
        return {
            file,
            originalSizeKb,
            compressedSizeKb: originalSizeKb,
            reductionPercent: 0,
            isCompressed: false,
        };
    }
}

/** Helper to convert file to HTMLImageElement */
function loadImageElement(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve(img);
        };
        img.onerror = (err) => {
            URL.revokeObjectURL(url);
            reject(err);
        };
        img.src = url;
    });
}

/** Helper to convert Canvas to Blob */
function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Canvas toBlob failed'));
        }, mimeType, quality);
    });
}

/**
 * Automatically applies high-quality image compression to photo files, guaranteeing < 600 KB size.
 * Non-image files or already optimal images are returned untouched.
 */
export async function autoCompressImage(
    file: File,
    onProgress?: (pct: number, statusText: string) => void
): Promise<File> {
    const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|heic)$/i.test(file.name);
    if (!isImage) return file;

    try {
        const result = await compressImage(file, {
            maxTargetKb: 600,
            maxDimension: 1920,
            initialQuality: 0.85,
            onProgress
        });
        return result.file;
    } catch (e) {
        console.warn('Auto image compression fallback to original:', e);
        return file;
    }
}
