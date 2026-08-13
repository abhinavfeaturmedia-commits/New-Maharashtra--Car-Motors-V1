import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';

// Configure pdfjs worker dynamically
try {
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.10.38'}/pdf.worker.min.mjs`;
    }
} catch {
    // Fallback handled in code if needed
}

export interface PdfCompressionOptions {
    targetMaxMb?: number; // e.g. 1.5 MB
    quality?: number;     // 0.5 to 0.95 (default 0.75)
    maxDimension?: number;// Max width or height in px (default 1800)
    forceCompress?: boolean; // Force compression regardless of targetMaxMb
    onProgress?: (percent: number, statusText: string) => void;
}

export interface PdfCompressionResult {
    file: File;
    originalSizeMb: number;
    compressedSizeMb: number;
    reductionPercent: number;
    isCompressed: boolean;
}

/**
 * Compresses a PDF file completely client-side in the browser.
 * Renders pages onto high-DPI canvases and re-encodes image streams with visual-lossless JPEG compression.
 */
export async function compressPdf(
    file: File,
    options: PdfCompressionOptions = {}
): Promise<PdfCompressionResult> {
    const {
        targetMaxMb = 1.8,
        quality = 0.75,
        maxDimension = 1800,
        forceCompress = false,
        onProgress
    } = options;

    const originalSizeMb = parseFloat((file.size / (1024 * 1024)).toFixed(2));

    // If file is already smaller than target (and forceCompress is false), return original immediately
    if (!forceCompress && file.size <= targetMaxMb * 1024 * 1024) {
        onProgress?.(100, 'File already under target size');
        return {
            file,
            originalSizeMb,
            compressedSizeMb: originalSizeMb,
            reductionPercent: 0,
            isCompressed: false,
        };
    }

    onProgress?.(5, 'Reading PDF document…');

    try {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({
            data: new Uint8Array(arrayBuffer),
            useSystemFonts: true,
            disableFontFace: false
        });

        const pdfDoc = await loadingTask.promise;
        const numPages = pdfDoc.numPages;

        if (numPages === 0) {
            throw new Error('PDF has no pages');
        }

        // Create new pdf-lib document
        const newPdfDoc = await PDFDocument.create();

        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
            const pagePercent = Math.round(10 + ((pageNum - 1) / numPages) * 75);
            onProgress?.(pagePercent, `Processing page ${pageNum} of ${numPages}…`);

            const page = await pdfDoc.getPage(pageNum);
            const initialViewport = page.getViewport({ scale: 1.0 });

            // Calculate scale to limit max dimension while maintaining aspect ratio
            const largestDim = Math.max(initialViewport.width, initialViewport.height);
            let scale = 1.5; // default 1.5x scale for sharp text rendering
            if (largestDim * scale > maxDimension) {
                scale = maxDimension / largestDim;
            }

            const viewport = page.getViewport({ scale });

            // Create offscreen canvas
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = Math.floor(viewport.width);
            canvas.height = Math.floor(viewport.height);

            if (!context) {
                throw new Error('Failed to get 2D canvas context');
            }

            // Fill white background for transparent PDFs
            context.fillStyle = '#FFFFFF';
            context.fillRect(0, 0, canvas.width, canvas.height);

            // Render PDF page onto canvas
            const renderContext = {
                canvasContext: context,
                viewport: viewport,
                canvas: canvas,
            };
            await page.render(renderContext as any).promise;

            // Convert canvas to JPEG Data URL with specified quality compression
            const jpegDataUrl = canvas.toDataURL('image/jpeg', quality);

            // Embed into new pdf-lib document
            const jpegImage = await newPdfDoc.embedJpg(jpegDataUrl);

            // Add page matching viewport aspect ratio
            const newPage = newPdfDoc.addPage([initialViewport.width, initialViewport.height]);
            newPage.drawImage(jpegImage, {
                x: 0,
                y: 0,
                width: initialViewport.width,
                height: initialViewport.height,
            });
        }

        onProgress?.(90, 'Finalizing compressed document…');

        const compressedBytes = await newPdfDoc.save();
        const compressedBlob = new Blob([compressedBytes.buffer as ArrayBuffer], { type: 'application/pdf' });

        // If compressed version is somehow larger than original, return original
        if (compressedBlob.size >= file.size) {
            onProgress?.(100, 'Original file is already optimal');
            return {
                file,
                originalSizeMb,
                compressedSizeMb: originalSizeMb,
                reductionPercent: 0,
                isCompressed: false,
            };
        }

        const compressedFile = new File([compressedBlob], file.name, {
            type: 'application/pdf',
            lastModified: Date.now(),
        });

        const compressedSizeMb = parseFloat((compressedFile.size / (1024 * 1024)).toFixed(2));
        const reductionPercent = Math.round(((file.size - compressedFile.size) / file.size) * 100);

        onProgress?.(100, `Done! Reduced by ${reductionPercent}% (${originalSizeMb} MB → ${compressedSizeMb} MB)`);

        return {
            file: compressedFile,
            originalSizeMb,
            compressedSizeMb,
            reductionPercent,
            isCompressed: true,
        };

    } catch (err: any) {
        console.error('PDF Compression failed:', err);
        // Fallback to original file on any processing error
        return {
            file,
            originalSizeMb,
            compressedSizeMb: originalSizeMb,
            reductionPercent: 0,
            isCompressed: false,
        };
    }
}

/**
 * Automatically applies high-quality compression to any PDF file prior to upload.
 * Non-PDF files or files already optimized are returned as-is safely.
 */
export async function autoCompressPdf(
    file: File,
    onProgress?: (pct: number, statusText: string) => void
): Promise<File> {
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) return file;

    try {
        const result = await compressPdf(file, {
            quality: 0.85,
            maxDimension: 1800,
            forceCompress: true,
            onProgress
        });
        return result.file;
    } catch (e) {
        console.warn('Auto PDF compression fallback to original:', e);
        return file;
    }
}

