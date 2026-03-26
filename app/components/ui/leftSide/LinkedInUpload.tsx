'use client';

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileText, CheckCircle, XCircle, X } from 'lucide-react';

interface LinkedInUploadProps {
  onDataParsed: (data: any) => void;
}

export default function LinkedInUpload({ onDataParsed }: LinkedInUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (file.type !== 'application/pdf') {
      setUploadStatus('error');
      setStatusMessage('Please upload a PDF file');
      setTimeout(() => setUploadStatus('idle'), 3000);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setUploadStatus('error');
      setStatusMessage('File size must be less than 10MB');
      setTimeout(() => setUploadStatus('idle'), 3000);
      return;
    }

    setIsUploading(true);
    setUploadStatus('idle');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/parse-linkedin', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to parse PDF');
      }

      if (result.success && result.data) {
        setUploadStatus('success');
        setStatusMessage('LinkedIn profile imported successfully!');
        onDataParsed(result.data);
        
        setTimeout(() => {
          setIsCollapsed(true);
        }, 2000);
      } else {
        throw new Error('No data received from server');
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus('error');
      setStatusMessage(
        error instanceof Error ? error.message : 'Failed to parse PDF. Please try again.'
      );
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  if (isCollapsed) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4"
      >
        <button
          onClick={() => setIsCollapsed(false)}
          className="w-full flex items-center justify-between p-3 bg-green-600/10 border border-green-600/30 rounded hover:bg-green-600/20 transition-all duration-200 shadow-sm"
        >
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="text-sm font-medium text-green-700 title-font">
              LinkedIn profile imported
            </span>
          </div>
          <span className="text-xs text-green-600">Click to upload again</span>
        </button>
      </motion.div>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="mb-6 relative"
      >
        <div className="bg-white/50 backdrop-blur-sm border border-gray-300 rounded-lg p-4 shadow-md hover:shadow-lg transition-all duration-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold mb-4 title-font">
                Import from LinkedIn
              </h1>
            </div>
            {uploadStatus === 'success' && (
              <button
                onClick={() => setIsCollapsed(true)}
                className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
                title="Collapse"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          <p className="text-sm text-gray-600 mb-4">
            Download your LinkedIn profile as PDF and upload it here to auto-fill your resume
          </p>

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              relative border-2 border-dashed rounded p-6 transition-all duration-200
              ${
                isDragging
                  ? 'border-green-600 bg-green-600/10'
                  : 'border-gray-300 bg-white hover:border-green-600/50 hover:bg-gray-50'
              }
              ${isUploading ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}
            `}
            onClick={handleBrowseClick}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={handleFileSelect}
              className="hidden"
            />

            <div className="flex flex-col items-center justify-center text-center">
              {isUploading ? (
                <>
                  <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin mb-3" />
                  <p className="text-sm text-gray-600 title-font">Parsing your LinkedIn profile...</p>
                </>
              ) : (
                <>
                  <Upload
                    className={`w-12 h-12 mb-3 transition-colors ${
                      isDragging ? 'text-green-600' : 'text-gray-400'
                    }`}
                  />
                  <p className="text-sm font-medium text-gray-700 mb-1">
                    Drop your LinkedIn PDF here or click to browse
                  </p>
                  <p className="text-xs text-gray-500">PDF files only (max 10MB)</p>
                </>
              )}
            </div>
          </div>

          <AnimatePresence mode="wait">
            {uploadStatus === 'success' && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-3 flex items-center gap-2 p-3 bg-green-600/10 border border-green-600/30 rounded shadow-sm"
              >
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                <p className="text-sm text-green-700 title-font">{statusMessage}</p>
              </motion.div>
            )}

            {uploadStatus === 'error' && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-3 flex items-center gap-2 p-3 bg-red-50 border border-red-300 rounded shadow-sm"
              >
                <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                <p className="text-sm text-red-700">{statusMessage}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-4 p-3 bg-gray-50 border border-gray-300 rounded shadow-sm">
            <p className="text-xs text-gray-800 font-semibold mb-2 title-font">
              How to get your LinkedIn PDF:
            </p>
            <ol className="text-xs text-gray-700 space-y-1 list-decimal list-inside">
              <li>Go to your LinkedIn profile</li>
              <li>Click &quot;More&quot; button below your profile picture</li>
              <li>Select &quot;Save to PDF&quot;</li>
              <li>Upload the downloaded PDF here</li>
            </ol>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
