import React, { useState } from 'react';
import { compressPdf, PdfCompressionResult } from '../../lib/pdfCompressor';

interface ProcessingState {
    fileName: string;
    progress: number;
    statusText: string;
    result?: PdfCompressionResult;
    error?: string;
}

export default function PdfCompressorTool() {
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [qualityMode, setQualityMode] = useState<'high' | 'balanced' | 'small'>('balanced');
    const [processingQueue, setProcessingQueue] = useState<ProcessingState[]>([]);
    const [isCompressing, setIsCompressing] = useState(false);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const filesArray = Array.from(e.target.files).filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'));
            setSelectedFiles(prev => [...prev, ...filesArray]);
        }
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const filesArray = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'));
            setSelectedFiles(prev => [...prev, ...filesArray]);
        }
    };

    const handleRemoveFile = (index: number) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    };

    const startCompression = async () => {
        if (selectedFiles.length === 0 || isCompressing) return;
        setIsCompressing(true);

        const targetMaxMb = qualityMode === 'high' ? 1.8 : qualityMode === 'balanced' ? 1.0 : 0.5;
        const quality = qualityMode === 'high' ? 0.85 : qualityMode === 'balanced' ? 0.75 : 0.60;
        const maxDimension = qualityMode === 'high' ? 1800 : qualityMode === 'balanced' ? 1500 : 1200;

        const queue: ProcessingState[] = selectedFiles.map(f => ({
            fileName: f.name,
            progress: 0,
            statusText: 'Queued…',
        }));
        setProcessingQueue(queue);

        for (let i = 0; i < selectedFiles.length; i++) {
            const file = selectedFiles[i];

            setProcessingQueue(prev => prev.map((item, idx) => idx === i ? { ...item, progress: 10, statusText: 'Compressing…' } : item));

            try {
                const res = await compressPdf(file, {
                    targetMaxMb,
                    quality,
                    maxDimension,
                    onProgress: (percent, text) => {
                        setProcessingQueue(prev => prev.map((item, idx) => idx === i ? { ...item, progress: percent, statusText: text } : item));
                    }
                });

                setProcessingQueue(prev => prev.map((item, idx) => idx === i ? {
                    ...item,
                    progress: 100,
                    statusText: res.isCompressed ? 'Done' : 'Already Optimal',
                    result: res
                } : item));
            } catch (err: any) {
                setProcessingQueue(prev => prev.map((item, idx) => idx === i ? {
                    ...item,
                    progress: 100,
                    statusText: 'Failed',
                    error: err.message || 'Compression error'
                } : item));
            }
        }

        setIsCompressing(false);
    };

    const handleDownload = (result: PdfCompressionResult) => {
        const url = URL.createObjectURL(result.file);
        const a = document.createElement('a');
        a.href = url;
        const nameParts = result.file.name.split('.');
        const ext = nameParts.pop();
        const base = nameParts.join('.');
        a.download = `${base}_compressed.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-3xl">compress</span>
                        PDF Compressor Utility
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Reduce PDF document file sizes to under 1–2 MB while maintaining high visual quality. 100% private in-browser compression.
                    </p>
                </div>
                <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-xl border border-emerald-200 text-xs font-semibold">
                    <span className="material-symbols-outlined text-sm">lock</span>
                    Client-Side Processing (Private & Secure)
                </div>
            </div>

            {/* Quality Preset Selectors */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">1. Select Target Quality Preset</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <button
                        type="button"
                        onClick={() => setQualityMode('high')}
                        className={`p-4 rounded-xl border text-left transition-all ${qualityMode === 'high'
                            ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                            : 'border-slate-200 hover:border-slate-300'
                            }`}
                    >
                        <div className="flex items-center justify-between">
                            <span className="font-bold text-sm text-slate-800">High Quality</span>
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">~1.8 MB Max</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Best for legal contracts & official documents where original resolution is priority.</p>
                    </button>

                    <button
                        type="button"
                        onClick={() => setQualityMode('balanced')}
                        className={`p-4 rounded-xl border text-left transition-all ${qualityMode === 'balanced'
                            ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                            : 'border-slate-200 hover:border-slate-300'
                            }`}
                    >
                        <div className="flex items-center justify-between">
                            <span className="font-bold text-sm text-slate-800">Balanced (Recommended)</span>
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">~1.0 MB Max</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Ideal for scanned RC copies, Aadhaar, PAN cards, and insurance papers.</p>
                    </button>

                    <button
                        type="button"
                        onClick={() => setQualityMode('small')}
                        className={`p-4 rounded-xl border text-left transition-all ${qualityMode === 'small'
                            ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                            : 'border-slate-200 hover:border-slate-300'
                            }`}
                    >
                        <div className="flex items-center justify-between">
                            <span className="font-bold text-sm text-slate-800">Compact</span>
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">~500 KB Max</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Maximum compression for fast WhatsApp sharing & low mobile bandwidth.</p>
                    </button>
                </div>
            </div>

            {/* Drop Zone */}
            <div
                onDragOver={e => e.preventDefault()}
                onDrop={handleDrop}
                className="bg-slate-50 border-2 border-dashed border-slate-300 hover:border-primary/50 rounded-2xl p-8 text-center transition-all cursor-pointer group"
            >
                <input
                    type="file"
                    accept=".pdf"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                    id="pdf-upload-input"
                />
                <label htmlFor="pdf-upload-input" className="cursor-pointer block space-y-3">
                    <div className="size-14 mx-auto rounded-full bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                        <span className="material-symbols-outlined text-3xl">upload_file</span>
                    </div>
                    <div>
                        <p className="text-base font-semibold text-slate-700">Click to upload or drag & drop PDF files here</p>
                        <p className="text-xs text-slate-400 mt-1">Supports multiple PDF files up to 50 MB each</p>
                    </div>
                </label>
            </div>

            {/* Selected Files & Action Button */}
            {selectedFiles.length > 0 && (
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                            <span className="material-symbols-outlined text-slate-400">description</span>
                            Selected PDFs ({selectedFiles.length})
                        </h3>
                        <button
                            type="button"
                            onClick={startCompression}
                            disabled={isCompressing}
                            className="bg-primary hover:bg-primary-dark text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-md shadow-primary/20 flex items-center gap-2 disabled:opacity-50"
                        >
                            {isCompressing ? (
                                <>
                                    <span className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Compressing…
                                </>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined text-sm">play_arrow</span>
                                    Compress Selected PDFs
                                </>
                            )}
                        </button>
                    </div>

                    <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
                        {selectedFiles.map((f, i) => (
                            <div key={i} className="py-2.5 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="material-symbols-outlined text-red-500">picture_as_pdf</span>
                                    <div>
                                        <p className="text-sm font-medium text-slate-700 truncate max-w-md">{f.name}</p>
                                        <p className="text-xs text-slate-400">Original Size: {(f.size / (1024 * 1024)).toFixed(2)} MB</p>
                                    </div>
                                </div>
                                {!isCompressing && (
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveFile(i)}
                                        className="text-slate-400 hover:text-red-500 p-1 transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-sm">close</span>
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Results Queue */}
            {processingQueue.length > 0 && (
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                    <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                        <span className="material-symbols-outlined text-emerald-500">analytics</span>
                        Compression Results
                    </h3>

                    <div className="space-y-3">
                        {processingQueue.map((item, idx) => (
                            <div key={idx} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 space-y-2">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <div className="flex items-center gap-3">
                                        <span className="material-symbols-outlined text-primary">picture_as_pdf</span>
                                        <div>
                                            <p className="text-sm font-bold text-slate-800">{item.fileName}</p>
                                            <p className="text-xs text-slate-500">{item.statusText}</p>
                                        </div>
                                    </div>

                                    {item.result && (
                                        <div className="flex items-center gap-3">
                                            <div className="text-right">
                                                <span className="text-xs text-slate-400 line-through mr-2">{item.result.originalSizeMb} MB</span>
                                                <span className="text-sm font-bold text-emerald-600">{item.result.compressedSizeMb} MB</span>
                                                {item.result.reductionPercent > 0 && (
                                                    <span className="ml-2 text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                                                        -{item.result.reductionPercent}%
                                                    </span>
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleDownload(item.result!)}
                                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all shadow-sm"
                                            >
                                                <span className="material-symbols-outlined text-sm">download</span>
                                                Download
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Progress Bar */}
                                {item.progress < 100 && (
                                    <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden mt-2">
                                        <div
                                            className="bg-primary h-1.5 rounded-full transition-all duration-300"
                                            style={{ width: `${item.progress}%` }}
                                        />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
