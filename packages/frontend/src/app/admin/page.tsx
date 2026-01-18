'use client';

import { useState } from 'react';
import { useWallet } from '@/context/WalletContext';
import axios from 'axios';
import Link from 'next/link';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export default function AdminPage() {
  const { address, isConnected } = useWallet();
  const [formData, setFormData] = useState({
    question: '',
    description: '',
    category: 'Crypto',
    resolutionSource: '',
    endDate: '',
    endTime: '',
    image: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setResult(null);

    try {
      // Combine date and time into Unix timestamp
      const endDateTime = new Date(`${formData.endDate}T${formData.endTime || '23:59:59'}`);
      const endTime = Math.floor(endDateTime.getTime() / 1000);

      // Validate end time is in the future
      if (endTime <= Math.floor(Date.now() / 1000)) {
        throw new Error('End time must be in the future');
      }

      console.log('[Admin] Creating market with data:', {
        ...formData,
        endTime,
      });

      const response = await axios.post(`${BACKEND_URL}/api/admin/create-market`, {
        question: formData.question,
        description: formData.description,
        category: formData.category,
        resolutionSource: formData.resolutionSource || undefined,
        endTime,
        image: formData.image || undefined,
      }, {
        timeout: 60000, // 60 seconds for blockchain transaction
      });

      console.log('[Admin] Market created:', response.data);
      setResult(response.data);

      // Reset form on success
      setFormData({
        question: '',
        description: '',
        category: 'Crypto',
        resolutionSource: '',
        endDate: '',
        endTime: '',
        image: '',
      });
    } catch (err: any) {
      console.error('[Admin] Error creating market:', err);
      const errorMsg = err.response?.data?.error || err.message || 'Failed to create market';
      setError(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="mb-6">
            <Link href="/" className="text-blue-600 hover:text-blue-700 text-sm">
              ← Back to Markets
            </Link>
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-8 text-center">
            <h2 className="text-xl font-bold text-amber-900 dark:text-amber-300 mb-2">
              Wallet Not Connected
            </h2>
            <p className="text-amber-800 dark:text-amber-400">
              Please connect your wallet to access the admin panel.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/" className="text-blue-600 hover:text-blue-700 text-sm mb-4 inline-block">
            ← Back to Markets
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Create New Market
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Deploy a new prediction market on-chain
          </p>
        </div>

        {/* Success Message */}
        {result && result.success && (
          <div className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-green-900 dark:text-green-300 mb-3">
              ✓ Market Created Successfully!
            </h3>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium text-green-800 dark:text-green-400">Question ID:</span>
                <code className="ml-2 bg-green-100 dark:bg-green-900/40 px-2 py-1 rounded text-xs">
                  {result.questionId}
                </code>
              </div>
              <div>
                <span className="font-medium text-green-800 dark:text-green-400">Condition ID:</span>
                <code className="ml-2 bg-green-100 dark:bg-green-900/40 px-2 py-1 rounded text-xs">
                  {result.conditionId}
                </code>
              </div>
              <div>
                <span className="font-medium text-green-800 dark:text-green-400">YES Token:</span>
                <code className="ml-2 bg-green-100 dark:bg-green-900/40 px-2 py-1 rounded text-xs break-all">
                  {result.tokenIds?.yesTokenId}
                </code>
              </div>
              <div>
                <span className="font-medium text-green-800 dark:text-green-400">NO Token:</span>
                <code className="ml-2 bg-green-100 dark:bg-green-900/40 px-2 py-1 rounded text-xs break-all">
                  {result.tokenIds?.noTokenId}
                </code>
              </div>
              {result.market?.txHash && (
                <div>
                  <span className="font-medium text-green-800 dark:text-green-400">Transaction:</span>
                  <a
                    href={`https://www.oklink.com/amoy/tx/${result.market.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 text-blue-600 hover:text-blue-700 underline text-xs"
                  >
                    View on Explorer
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-700 dark:text-red-400 text-sm">
              <strong>Error:</strong> {error}
            </p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg p-6 space-y-6">
          {/* Question */}
          <div>
            <label htmlFor="question" className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
              Market Question <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="question"
              name="question"
              value={formData.question}
              onChange={handleChange}
              required
              placeholder="Will BTC hit $150K by end of July 31, 2026?"
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
              Description & Resolution Criteria <span className="text-red-500">*</span>
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              required
              rows={4}
              placeholder="This market will resolve to 'Yes' if Bitcoin's price reaches $150,000 USD at any point before or on July 31, 2026, 11:59 PM UTC. The price will be determined by major cryptocurrency exchanges (Coinbase, Binance, Kraken average). Otherwise, it resolves to 'No'."
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Category and Image */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                id="category"
                name="category"
                value={formData.category}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Crypto">Crypto</option>
                <option value="Politics">Politics</option>
                <option value="Sports">Sports</option>
                <option value="Finance">Finance</option>
                <option value="Geopolitics">Geopolitics</option>
                <option value="Tech">Tech</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label htmlFor="image" className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                Emoji/Icon
              </label>
              <input
                type="text"
                id="image"
                name="image"
                value={formData.image}
                onChange={handleChange}
                placeholder="₿"
                maxLength={4}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Resolution Source */}
          <div>
            <label htmlFor="resolutionSource" className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
              Resolution Source (Optional)
            </label>
            <input
              type="text"
              id="resolutionSource"
              name="resolutionSource"
              value={formData.resolutionSource}
              onChange={handleChange}
              placeholder="https://coinmarketcap.com"
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* End Date and Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="endDate" className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                Resolution Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                id="endDate"
                name="endDate"
                value={formData.endDate}
                onChange={handleChange}
                required
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="endTime" className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                Time (UTC)
              </label>
              <input
                type="time"
                id="endTime"
                name="endTime"
                value={formData.endTime}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Defaults to 23:59:59 if not specified
              </p>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 flex items-center justify-center"
            >
              {isSubmitting ? (
                <>
                  <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Creating Market... (This may take 30-60 seconds)
                </>
              ) : (
                'Create Market on Blockchain'
              )}
            </button>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
              This will submit a transaction to Polygon Amoy testnet
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
