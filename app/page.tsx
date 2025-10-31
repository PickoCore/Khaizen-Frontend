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

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
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
      validateAndSetFile(selectedFile);
    }
  };

  const validateAndSetFile = async (selectedFile: File) => {
    const ext = selectedFile.name.split('.').pop()?.toLowerCase();
    const supportedFormats = ['zip', 'rar', '7z', 'tar', 'gz'];
    
    if (!ext || !supportedFormats.includes(ext)) {
      setError('Please upload a supported archive file (ZIP, RAR, 7Z, TAR, GZ)');
      return;
    }

    // Check file size client-side
    if (selectedFile.size === 0) {
      setError('File is empty');
      return;
    }

    if (selectedFile.size > 100 * 1024 * 1024) {
      setError('File too large (max 100MB)');
      return;
    }

    setFile(selectedFile);
    setError(null);

    // Optional: Validate with backend
    if (ext === 'zip' || ext === 'rar' || ext === '7z') {
      try {
        const formData = new FormData();
        formData.append('file', selectedFile);
        
        const response = await fetch(`${API_URL}/validate`, {
          method: 'POST',
          body: formData,
        });

        const result = await response.json();
        
        if (!result.valid) {
          setError(`Invalid file: ${result.error}`);
          setFile(null);
        }
      } catch (err) {
        // Validation failed, but allow upload anyway
        console.warn('File validation failed:', err);
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

    const formData = new FormData();
    formData.append('file', file);

    const params = new URLSearchParams({
      quality: quality.toString(),
    });

    if (maxSize) {
      params.append('max_size', maxSize);
    }

    try {
      // Extended timeout for large files (5 minutes)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000);

      const response = await fetch(`${API_URL}/optimize?${params}`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMessage = 'Optimization failed';
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorMessage;
        } catch {
          errorMessage = `Server error: ${response.status}`;
        }
        throw new Error(errorMessage);
      }

      // Extract stats from headers
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
        fileTypes: fileTypes
      };

      setStats(optimizationStats);

      // Get filename from Content-Disposition header
      const contentDisposition = headers.get('Content-Disposition');
      let filename = 'optimized_pack.zip';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, '');
        }
      }
      setDownloadFilename(filename);

      // Store blob for download
      const blob = await response.blob();
      
      // Verify blob has content
      if (blob.size === 0) {
        throw new Error('Downloaded file is empty');
      }
      
      setDownloadBlob(blob);

    } catch (err) {
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          setError('Request timeout - file is too large or server is busy. Please try again.');
        } else {
          setError(err.message);
        }
      } else {
        setError('An unexpected error occurred');
      }
      console.error('Optimization error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (downloadBlob && downloadFilename) {
      const url = window.URL.createObjectURL(downloadBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = downloadFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }
  };

  const resetForm = () => {
    setFile(null);
    setStats(null);
    setDownloadBlob(null);
    setDownloadFilename('');
    setError(null);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50">
      <div className="container mx-auto px-4 py-12 max-w-5xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-4">
            <Zap className="w-12 h-12 text-emerald-600" />
          </div>
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Minecraft Texture Pack Optimizer
          </h1>
          <p className="text-gray-600 text-lg mb-2">
            Optimize your texture packs for better performance and smaller file sizes
          </p>
          <p className="text-sm text-gray-500">
            Supports: PNG, JSON, OGG, Shaders • Archive formats: ZIP, RAR, 7Z
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          {/* Upload Area */}
          <div
            className={`border-2 border-dashed rounded-xl p-12 text-center transition-all ${
              dragActive
                ? 'border-emerald-500 bg-emerald-50'
                : 'border-gray-300 hover:border-emerald-400'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <Upload className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              {file ? file.name : 'Drop your texture pack here'}
            </h3>
            <p className="text-gray-500 mb-4">ZIP, RAR, 7Z, TAR, or GZ files</p>
            <input
              type="file"
              accept=".zip,.rar,.7z,.tar,.gz"
              onChange={handleFileChange}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="inline-block px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 cursor-pointer transition-colors"
            >
              Select Archive File
            </label>
            {file && (
              <p className="mt-4 text-sm text-gray-600">
                Size: {formatBytes(file.size)}
              </p>
            )}
          </div>

          {/* Options */}
          <div className="grid md:grid-cols-2 gap-6 mt-8">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quality: {quality}%
              </label>
              <input
                type="range"
                min="1"
                max="100"
                value={quality}
                onChange={(e) => setQuality(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
              />
              <p className="text-xs text-gray-500 mt-1">
                Higher = Better quality, larger file size
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Max Texture Size (optional)
              </label>
              <select
                value={maxSize}
                onChange={(e) => setMaxSize(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                <option value="">Original Size</option>
                <option value="16">16x16 pixels</option>
                <option value="32">32x32 pixels</option>
                <option value="64">64x64 pixels</option>
                <option value="128">128x128 pixels</option>
                <option value="256">256x256 pixels</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Resize large textures to this dimension
              </p>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          {/* Action Button */}
          <button
            onClick={handleOptimize}
            disabled={!file || isProcessing}
            className="w-full mt-8 px-6 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-semibold text-lg hover:from-emerald-700 hover:to-teal-700 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
          >
            {isProcessing ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Optimizing... (This may take 1-2 minutes for large files)
              </span>
            ) : (
              'Optimize Texture Pack'
            )}
          </button>
          
          {isProcessing && (
            <div className="mt-4 text-center text-sm text-gray-600">
              <p>⏳ Processing your texture pack...</p>
              <p className="text-xs mt-1">Large files (20MB+) may take 1-2 minutes. Please wait.</p>
            </div>
          )}
        </div>

        {/* Results */}
        {stats && (
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="flex items-center mb-6">
              <CheckCircle className="w-8 h-8 text-green-600 mr-3" />
              <h2 className="text-2xl font-bold text-gray-900">
                Optimization Complete!
              </h2>
            </div>

            {/* Main Stats */}
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl">
                <FileArchive className="w-8 h-8 text-blue-600 mb-2" />
                <p className="text-sm text-gray-600 mb-1">Files Processed</p>
                <p className="text-3xl font-bold text-gray-900">
                  {stats.optimizedFiles}/{stats.totalFiles}
                </p>
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl">
                <Download className="w-8 h-8 text-purple-600 mb-2" />
                <p className="text-sm text-gray-600 mb-1">Size Reduced</p>
                <p className="text-3xl font-bold text-gray-900">
                  {stats.compressionRatio}%
                </p>
              </div>

              <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl">
                <Zap className="w-8 h-8 text-green-600 mb-2" />
                <p className="text-sm text-gray-600 mb-1">New Size</p>
                <p className="text-3xl font-bold text-gray-900">
                  {formatBytes(stats.optimizedSize)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  from {formatBytes(stats.originalSize)}
                </p>
              </div>
            </div>

            {/* Detailed File Type Stats */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Optimization Details</h3>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* PNG Stats */}
                <div className="bg-gradient-to-br from-pink-50 to-pink-100 p-4 rounded-lg">
                  <div className="flex items-center mb-2">
                    <ImageIcon className="w-5 h-5 text-pink-600 mr-2" />
                    <span className="font-semibold text-gray-900">PNG Images</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    {stats.fileTypes.png.optimized} of {stats.fileTypes.png.count} optimized
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Saved: {formatBytes(stats.fileTypes.png.saved)}
                  </p>
                </div>

                {/* JSON Stats */}
                <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 p-4 rounded-lg">
                  <div className="flex items-center mb-2">
                    <FileJson className="w-5 h-5 text-yellow-600 mr-2" />
                    <span className="font-semibold text-gray-900">JSON Files</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    {stats.fileTypes.json.optimized} of {stats.fileTypes.json.count} optimized
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Saved: {formatBytes(stats.fileTypes.json.saved)}
                  </p>
                </div>

                {/* OGG Stats */}
                <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-4 rounded-lg">
                  <div className="flex items-center mb-2">
                    <Music className="w-5 h-5 text-indigo-600 mr-2" />
                    <span className="font-semibold text-gray-900">Audio (OGG)</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    {stats.fileTypes.ogg.optimized} of {stats.fileTypes.ogg.count} optimized
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Saved: {formatBytes(stats.fileTypes.ogg.saved)}
                  </p>
                </div>

                {/* Shader Stats */}
                <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 p-4 rounded-lg">
                  <div className="flex items-center mb-2">
                    <Code className="w-5 h-5 text-cyan-600 mr-2" />
                    <span className="font-semibold text-gray-900">Shaders</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    {stats.fileTypes.shader.optimized} of {stats.fileTypes.shader.count} optimized
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Saved: {formatBytes(stats.fileTypes.shader.saved)}
                  </p>
                </div>
              </div>

              {stats.fileTypes.other.count > 0 && (
                <p className="text-sm text-gray-500 mt-4">
                  + {stats.fileTypes.other.count} other files (no optimization needed)
                </p>
              )}
            </div>

            {/* Savings Summary */}
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 p-6 rounded-xl mb-6">
              <h4 className="font-semibold text-gray-900 mb-2">Total Savings</h4>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">From file optimization:</p>
                  <p className="text-xl font-bold text-emerald-600">
                    {formatBytes(stats.bytesSaved)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Total size reduction:</p>
                  <p className="text-xl font-bold text-emerald-600">
                    {formatBytes(stats.actualBytesSaved)}
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <button
                onClick={handleDownload}
                disabled={!downloadBlob}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-semibold hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg hover:shadow-xl disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed"
              >
                Download Optimized Pack
              </button>
              <button
                onClick={resetForm}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition-colors"
              >
                New Optimization
              </button>
            </div>
          </div>
        )}

        {/* Features */}
        <div className="mt-12 grid md:grid-cols-4 gap-6 text-center">
          <div className="bg-white/50 backdrop-blur p-6 rounded-xl">
            <ImageIcon className="w-10 h-10 text-emerald-600 mx-auto mb-3" />
            <h3 className="font-semibold text-gray-900 mb-2">PNG Optimize</h3>
            <p className="text-sm text-gray-600">
              Compress & resize images
            </p>
          </div>
          <div className="bg-white/50 backdrop-blur p-6 rounded-xl">
            <FileJson className="w-10 h-10 text-emerald-600 mx-auto mb-3" />
            <h3 className="font-semibold text-gray-900 mb-2">JSON Minify</h3>
            <p className="text-sm text-gray-600">
              Remove comments & spaces
            </p>
          </div>
          <div className="bg-white/50 backdrop-blur p-6 rounded-xl">
            <Music className="w-10 h-10 text-emerald-600 mx-auto mb-3" />
            <h3 className="font-semibold text-gray-900 mb-2">Audio Clean</h3>
            <p className="text-sm text-gray-600">
              Strip OGG metadata
            </p>
          </div>
          <div className="bg-white/50 backdrop-blur p-6 rounded-xl">
            <Code className="w-10 h-10 text-emerald-600 mx-auto mb-3" />
            <h3 className="font-semibold text-gray-900 mb-2">Shader Trim</h3>
            <p className="text-sm text-gray-600">
              Optimize shader code
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
