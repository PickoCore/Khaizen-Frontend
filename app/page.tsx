'use client';

import { useState, useCallback } from 'react';
import { Upload, Download, Zap, Image as ImageIcon, CheckCircle } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface OptimizationStats {
  originalSize: number;
  optimizedSize: number;
  compressionRatio: number;
  totalFiles: number;
  optimizedFiles: number;
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [quality, setQuality] = useState(85);
  const [maxSize, setMaxSize] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [stats, setStats] = useState<OptimizationStats | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
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
      if (droppedFile.name.endsWith('.zip')) {
        setFile(droppedFile);
        setError(null);
      } else {
        setError('Please upload a ZIP file');
      }
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.name.endsWith('.zip')) {
        setFile(selectedFile);
        setError(null);
      } else {
        setError('Please upload a ZIP file');
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

      // Extract stats from headers
      const headers = response.headers;
      const optimizationStats: OptimizationStats = {
        originalSize: parseInt(headers.get('X-Original-Size') || '0'),
        optimizedSize: parseInt(headers.get('X-Optimized-Size') || '0'),
        compressionRatio: parseFloat(headers.get('X-Compression-Ratio') || '0'),
        totalFiles: parseInt(headers.get('X-Total-Files') || '0'),
        optimizedFiles: parseInt(headers.get('X-Optimized-Files') || '0'),
      };

      setStats(optimizationStats);

      // Create download URL
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      setDownloadUrl(url);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (downloadUrl && file) {
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `optimized_${file.name}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const resetForm = () => {
    setFile(null);
    setStats(null);
    setDownloadUrl(null);
    setError(null);
    if (downloadUrl) {
      window.URL.revokeObjectURL(downloadUrl);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-4">
            <Zap className="w-12 h-12 text-emerald-600" />
          </div>
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Minecraft Texture Pack Optimizer
          </h1>
          <p className="text-gray-600 text-lg">
            Optimize your texture packs for better performance and smaller file sizes
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
            <p className="text-gray-500 mb-4">or click to browse</p>
            <input
              type="file"
              accept=".zip"
              onChange={handleFileChange}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="inline-block px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 cursor-pointer transition-colors"
            >
              Select ZIP File
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
                Optimizing...
              </span>
            ) : (
              'Optimize Texture Pack'
            )}
          </button>
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

            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl">
                <ImageIcon className="w-8 h-8 text-blue-600 mb-2" />
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
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={handleDownload}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-semibold hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg hover:shadow-xl"
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
        <div className="mt-12 grid md:grid-cols-3 gap-6 text-center">
          <div className="bg-white/50 backdrop-blur p-6 rounded-xl">
            <Zap className="w-10 h-10 text-emerald-600 mx-auto mb-3" />
            <h3 className="font-semibold text-gray-900 mb-2">Fast Processing</h3>
            <p className="text-sm text-gray-600">
              Optimize hundreds of textures in seconds
            </p>
          </div>
          <div className="bg-white/50 backdrop-blur p-6 rounded-xl">
            <ImageIcon className="w-10 h-10 text-emerald-600 mx-auto mb-3" />
            <h3 className="font-semibold text-gray-900 mb-2">Quality Preserved</h3>
            <p className="text-sm text-gray-600">
              Maintain visual quality while reducing size
            </p>
          </div>
          <div className="bg-white/50 backdrop-blur p-6 rounded-xl">
            <Download className="w-10 h-10 text-emerald-600 mx-auto mb-3" />
            <h3 className="font-semibold text-gray-900 mb-2">Easy Download</h3>
            <p className="text-sm text-gray-600">
              Get your optimized pack instantly
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
