'use client';

import { useState, useCallback } from 'react';
import { Upload, Download, Zap, Image as ImageIcon, CheckCircle, FileJson, Music, Code, FileArchive } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface FileTypeStats {
  count: number;
  optimized: number;
  saved: number;
}

interface OptimizationStats {
  originalSize: number;
  optimizedSize: number;
  compressionRatio: number;
  totalFiles: number;
  optimizedFiles: number;
  bytesSaved: number;
  actualBytesSaved: number;
  fileTypes: {
    png: FileTypeStats;
    json: FileTypeStats;
    ogg: FileTypeStats;
    shader: FileTypeStats;
    other: { count: number };
  };
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [quality, setQuality] = useState(85);
  const [maxSize, setMaxSize] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [stats, setStats] = useState<OptimizationStats | null>(null);
  const [downloadBlob, setDownloadBlob] = useState<Blob | null>(null);
  const [downloadFilename, setDownloadFilename] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null); // ✅ FIX

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      const ext = droppedFile.name.split('.').pop()?.toLowerCase();
      const supportedFormats = ['zip', 'rar', '7z', 'tar', 'gz'];

      if (ext && supportedFormats.includes(ext)) {
        setFile(droppedFile);
        setError(null);
      } else {
        setError('Please upload a supported archive file (ZIP, RAR, 7Z, TAR, GZ)');
      }
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      const ext = selectedFile.name.split('.').pop()?.toLowerCase();
      const supportedFormats = ['zip', 'rar', '7z', 'tar', 'gz'];

      if (ext && supportedFormats.includes(ext)) {
        setFile(selectedFile);
        setError(null);
      } else {
        setError('Please upload a supported archive file (ZIP, RAR, 7Z, TAR, GZ)');
      }
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const handleOptimize = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setStats(null);
    setDownloadBlob(null);
    setDownloadFilename('');
    setDownloadUrl(null);

    const formData = new FormData();
    formData.append('file', file);

    const params = new URLSearchParams({
      quality: quality.toString(),
    });

    if (maxSize) {
      params.append('max_size', maxSize);
    }

    try {
      const response = await fetch(`${API_URL}/optimize?${params}`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Optimization failed');
      }

      const headers = response.headers;
      const fileTypesStr = headers.get('X-File-Types');
      const fileTypes = fileTypesStr ? JSON.parse(fileTypesStr) : {};

      const optimizationStats: OptimizationStats = {
        originalSize: parseInt(headers.get('X-Original-Size') || '0'),
        optimizedSize: parseInt(headers.get('X-Optimized-Size') || '0'),
        compressionRatio: parseFloat(headers.get('X-Compression-Ratio') || '0'),
        totalFiles: parseInt(headers.get('X-Total-Files') || '0'),
        optimizedFiles: parseInt(headers.get('X-Optimized-Files') || '0'),
        bytesSaved: parseInt(headers.get('X-Bytes-Saved') || '0'),
        actualBytesSaved: parseInt(headers.get('X-Actual-Bytes-Saved') || '0'),
        fileTypes: fileTypes,
      };

      setStats(optimizationStats);

      const contentDisposition = headers.get('Content-Disposition');
      let filename = 'optimized_pack.zip';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i);
        if (filenameMatch) filename = filenameMatch[1];
      }
      setDownloadFilename(filename);

      const blob = await response.blob();
      setDownloadBlob(blob);

      // ✅ FIX — generate and store download URL
      const url = window.URL.createObjectURL(blob);
      setDownloadUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (downloadUrl && downloadFilename) {
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = downloadFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
    }
  };

  const resetForm = () => {
    setFile(null);
    setStats(null);
    setDownloadBlob(null);
    setDownloadFilename('');
    setError(null);
    setDownloadUrl(null);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 flex flex-col items-center justify-center p-6">
      <div className="bg-white/80 backdrop-blur-lg shadow-2xl rounded-2xl p-8 w-full max-w-3xl transition-all duration-300 border border-emerald-100">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
            Minecraft Pack Optimizer
          </h1>
          <p className="text-gray-600 mt-2">
            Compress and optimize your Minecraft resource packs effortlessly.
          </p>
        </div>

        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
            dragActive
              ? 'border-emerald-500 bg-emerald-50'
              : 'border-gray-300 hover:border-emerald-400'
          }`}
        >
          <input type="file" accept=".zip,.rar,.7z,.tar,.gz" onChange={handleFileChange} className="hidden" id="file-upload" />
          <label htmlFor="file-upload" className="flex flex-col items-center justify-center space-y-3">
            <Upload className="w-12 h-12 text-emerald-500" />
            <span className="text-gray-700">
              {file ? (
                <span className="font-medium text-emerald-600">{file.name}</span>
              ) : (
                <>
                  Drag & drop your archive here, or <span className="text-emerald-600 underline">browse</span>
                </>
              )}
            </span>
          </label>
        </div>

        {error && <p className="text-red-500 text-sm mt-3 text-center">{error}</p>}

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Image Quality (%)</label>
            <input
              type="number"
              min="1"
              max="100"
              value={quality}
              onChange={(e) => setQuality(parseInt(e.target.value))}
              className="mt-1 w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Max Image Size (px)</label>
            <input
              type="number"
              placeholder="Optional"
              value={maxSize}
              onChange={(e) => setMaxSize(e.target.value)}
              className="mt-1 w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div className="flex justify-center mt-8 space-x-4">
          <button
            onClick={handleOptimize}
            disabled={isProcessing || !file}
            className={`flex items-center space-x-2 px-6 py-3 rounded-xl text-white transition-all ${
              isProcessing || !file
                ? 'bg-emerald-300 cursor-not-allowed'
                : 'bg-emerald-500 hover:bg-emerald-600'
            }`}
          >
            <Zap className="w-5 h-5" />
            <span>{isProcessing ? 'Optimizing...' : 'Optimize Pack'}</span>
          </button>
          <button onClick={resetForm} className="text-gray-600 hover:text-gray-900 transition-colors">
            Reset
          </button>
        </div>

        {stats && (
          <div className="mt-10 bg-emerald-50 border border-emerald-100 rounded-xl p-6">
            <h2 className="text-lg font-bold text-emerald-700 mb-3 flex items-center">
              <CheckCircle className="w-5 h-5 mr-2 text-emerald-500" />
              Optimization Summary
            </h2>
            <ul className="text-gray-700 space-y-1">
              <li>Original Size: <strong>{formatBytes(stats.originalSize)}</strong></li>
              <li>Optimized Size: <strong>{formatBytes(stats.optimizedSize)}</strong></li>
              <li>Files Optimized: <strong>{stats.optimizedFiles}/{stats.totalFiles}</strong></li>
              <li>Bytes Saved: <strong>{formatBytes(stats.actualBytesSaved)}</strong></li>
            </ul>

            <div className="mt-5 flex flex-wrap gap-3">
              {Object.entries(stats.fileTypes).map(([type, info]) => (
                <div
                  key={type}
                  className="flex items-center bg-white border rounded-lg px-4 py-2 shadow-sm text-sm text-gray-700"
                >
                  {type === 'png' && <ImageIcon className="w-4 h-4 mr-2 text-emerald-500" />}
                  {type === 'json' && <FileJson className="w-4 h-4 mr-2 text-emerald-500" />}
                  {type === 'ogg' && <Music className="w-4 h-4 mr-2 text-emerald-500" />}
                  {type === 'shader' && <Code className="w-4 h-4 mr-2 text-emerald-500" />}
                  {type === 'other' && <FileArchive className="w-4 h-4 mr-2 text-emerald-500" />}
                  <span className="capitalize">{type}</span>: {info.count}
                </div>
              ))}
            </div>
          </div>
        )}

        {downloadBlob && (
          <div className="mt-8 text-center">
            <button
              onClick={handleDownload}
              className="inline-flex items-center space-x-2 bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-xl shadow-md transition-all"
            >
              <Download className="w-5 h-5" />
              <span>Download Optimized Pack</span>
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
