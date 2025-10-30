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
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }
      setDownloadFilename(filename);

      // Store blob for download
      const blob = await response.blob();
      setDownloadBlob(blob);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
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

        {/* Upload Section, Options, Error, Buttons, and Results */}
        {/* (same as your original — no changes besides bug fix) */}

      </div>
    </main>
  );
}
