'use client'

import React, { useState } from 'react';
import { Send, CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';

type FormData = {
  fids: string;
  title: string;
  body: string;
  targetUrl: string;
  notificationId: string;
};

type NotificationResponse = {
  error?: string;
  details?: string;
  stats?: {
    successful?: number;
  };
};

type Result = {
  fid: number;
  success: boolean;
  status: number;
  data: NotificationResponse;
};

type Summary = {
  total: number;
  successful: number;
  failed: number;
  successRate: number;
};

const NotificationSenderForm = () => {
  const [formData, setFormData] = useState<FormData>({
    fids: '',
    title: '',
    body: '',
    targetUrl: '',
    notificationId: ''
  });

  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const validateForm = () => {
    const errors: string[] = [];

    if (!formData.fids.trim()) {
      errors.push('FIDs are required');
    } else {
      const fidLines = formData.fids.trim().split('\n');
      if (fidLines.length > 99) {
        errors.push('Maximum 99 FIDs allowed');
      }

      const invalidFids = fidLines.filter(line => {
        const fid = parseInt(line.trim());
        return isNaN(fid) || fid <= 0;
      });

      if (invalidFids.length > 0) {
        errors.push(
          `Invalid FIDs found: ${invalidFids.slice(0, 3).join(', ')}${
            invalidFids.length > 3 ? '...' : ''
          }`
        );
      }
    }

    if (!formData.title.trim()) {
      errors.push('Title is required');
    }

    if (!formData.body.trim()) {
      errors.push('Message body is required');
    }

    if (!formData.targetUrl.trim()) {
      errors.push('Target URL is required');
    } else {
      try {
        new URL(formData.targetUrl);
      } catch {
        errors.push('Target URL must be a valid URL');
      }
    }

    return errors;
  };

  const sendNotification = async (fid: string): Promise<Result> => {
    const response = await fetch('/api/send-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fid: parseInt(fid),
        title: formData.title,
        body: formData.body,
        targetUrl: formData.targetUrl,
        notificationId: formData.notificationId || undefined,
      }),
    });

    const result: NotificationResponse = await response.json();

    return {
      fid: parseInt(fid),
      success: response.ok,
      status: response.status,
      data: result,
    };
  };

  const handleSubmit = async () => {
    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
      alert(
        'Please fix the following errors:\n' + validationErrors.join('\n')
      );
      return;
    }

    setIsLoading(true);
    setResults([]);
    setSummary(null);

    const fids = formData.fids
      .trim()
      .split('\n')
      .map(line => line.trim())
      .filter(line => line);

    const allResults: Result[] = [];

    try {
      for (const fid of fids) {
        try {
          const result = await sendNotification(fid);
          allResults.push(result);
          setResults([...allResults]);
        } catch (error: unknown) {
          const message =
            error instanceof Error ? error.message : String(error);

          allResults.push({
            fid: parseInt(fid),
            success: false,
            status: 0,
            data: { error: 'Network error: ' + message },
          });
          setResults([...allResults]);
        }
      }

      const successful = allResults.filter(r => r.success).length;
      const failed = allResults.filter(r => !r.success).length;
      const total = allResults.length;

      setSummary({
        total,
        successful,
        failed,
        successRate: Math.round((successful / total) * 100),
      });
    } catch (error) {
      console.error('Unexpected error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (result: Result) => {
    if (result.success) {
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    } else if (result.status === 422) {
      return <Clock className="w-4 h-4 text-yellow-500" />;
    } else {
      return <XCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const getStatusText = (result: Result) => {
    if (result.success) {
      return `Success (${result.data.stats?.successful || 0} sent)`;
    } else if (result.status === 404) {
      return 'No notification details found';
    } else if (result.status === 422) {
      return 'Delivery failed (invalid/rate limited tokens)';
    } else {
      return `Error (${result.status}): ${
        result.data.error || 'Unknown error'
      }`;
    }
  };

  const fidCount = formData.fids.trim()
    ? formData.fids.trim().split('\n').filter(line => line.trim()).length
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <Send className="w-6 h-6" />
            Notification Sender
          </h1>

          <div className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              {/* FIDs */}
              <div className="md:col-span-2">
                <label
                  htmlFor="fids"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  FIDs ({fidCount}/99) <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="fids"
                  name="fids"
                  rows={6}
                  value={formData.fids}
                  onChange={handleInputChange}
                  placeholder="Enter FIDs, one per line&#10;708707&#10;123456&#10;789012"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  disabled={isLoading}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter up to 99 FIDs, one per line. Each must be a positive
                  number.
                </p>
              </div>

              {/* Title */}
              <div>
                <label
                  htmlFor="title"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  placeholder="Test Notification"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isLoading}
                />
              </div>

              {/* Target URL */}
              <div>
                <label
                  htmlFor="targetUrl"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Target URL <span className="text-red-500">*</span>
                </label>
                <input
                  type="url"
                  id="targetUrl"
                  name="targetUrl"
                  value={formData.targetUrl}
                  onChange={handleInputChange}
                  placeholder="https://enb-crushers.vercel.app/"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isLoading}
                />
              </div>

              {/* Body */}
              <div className="md:col-span-2">
                <label
                  htmlFor="body"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Message Body <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="body"
                  name="body"
                  rows={3}
                  value={formData.body}
                  onChange={handleInputChange}
                  placeholder="This is a test message"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isLoading}
                />
              </div>

              {/* Notification ID */}
              <div>
                <label
                  htmlFor="notificationId"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Notification ID (optional)
                </label>
                <input
                  type="text"
                  id="notificationId"
                  name="notificationId"
                  value={formData.notificationId}
                  onChange={handleInputChange}
                  placeholder="test-123"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Submit Button + Summary */}
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isLoading || fidCount === 0}
                className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {isLoading
                  ? 'Sending...'
                  : `Send to ${fidCount} FID${fidCount !== 1 ? 's' : ''}`}
              </button>

              {summary && (
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-green-600 font-medium">
                    ✓ {summary.successful} successful
                  </span>
                  {summary.failed > 0 && (
                    <span className="text-red-600 font-medium">
                      ✗ {summary.failed} failed
                    </span>
                  )}
                  <span className="text-gray-600">
                    ({summary.successRate}% success rate)
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Results */}
        {(results.length > 0 || isLoading) && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Results {results.length > 0 && `(${results.length})`}
            </h2>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {results.map((result, index) => (
                <div
                  key={index}
                  className={`flex items-center justify-between p-3 rounded-md border ${
                    result.success
                      ? 'bg-green-50 border-green-200'
                      : result.status === 422
                      ? 'bg-yellow-50 border-yellow-200'
                      : 'bg-red-50 border-red-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(result)}
                    <span className="font-mono text-sm font-medium">
                      FID {result.fid}
                    </span>
                    <span className="text-sm text-gray-600">
                      {getStatusText(result)}
                    </span>
                  </div>

                  {result.data.details && (
                    <span className="text-xs text-gray-500 italic">
                      {result.data.details}
                    </span>
                  )}
                </div>
              ))}

              {isLoading && results.length < fidCount && (
                <div className="flex items-center gap-3 p-3 rounded-md border border-blue-200 bg-blue-50">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                  <span className="text-sm text-blue-700">
                    Processing remaining FIDs... ({results.length}/{fidCount})
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationSenderForm;
