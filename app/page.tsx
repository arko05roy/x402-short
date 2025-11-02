'use client';

import { useState } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { wrapFetchWithPaymentBrowser } from '@/lib/x402-browser';
import { decodeXPaymentResponse } from 'x402/shared';

const RECEIVER_ADDRESS = '0xabaf59180e0209bdb8b3048bfbe64e855074c0c4';
const NETWORK = 'base-sepolia';

export default function Home() {
    const { address, isConnected } = useAccount();
    const { data: walletClient } = useWalletClient();
    
    const [url, setUrl] = useState('');
    const [shortUrl, setShortUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [needsPayment, setNeedsPayment] = useState(false);
    const [paymentDetails, setPaymentDetails] = useState<any>(null);

    const handleShorten = async () => {
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            setError('Please enter a valid URL starting with http:// or https://');
            return;
        }

        setLoading(true);
        setError('');
        setShortUrl('');
        setNeedsPayment(false);

        try {
            // First attempt without payment to trigger 402
            const response = await fetch('/api/create-short-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ originalUrl: url })
            });

            const data = await response.json();

            if (response.status === 402) {
                setNeedsPayment(true);
                // Extract payment requirements from the 402 response
                // x402 protocol uses 'accepts' field for the array of payment requirements
                const paymentReqs = data.accepts || data.paymentRequirements || data.payment;
                setPaymentDetails(paymentReqs);
                console.log('Payment requirements:', paymentReqs);
                setError('Payment required. Click "Pay & Create" to proceed.');
                setLoading(false);
                return;
            }

            if (!response.ok) {
                throw new Error(data.error || 'Failed to create short URL');
            }

            setShortUrl(data.shortUrl);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    const handlePayment = async () => {
        setLoading(true);
        setError('');

        try {
            if (!paymentDetails) {
                throw new Error('Payment details not available');
            }

            if (!isConnected || !walletClient) {
                throw new Error('Wallet not connected. Please connect your wallet first.');
            }

            console.log('Starting payment with wallet client');
            console.log('Wallet client:', walletClient);

            // x402-fetch needs a proper wallet client
            // Wagmi's useWalletClient returns a viem Client, but we need to verify it works
            if (!walletClient || typeof walletClient !== 'object') {
                throw new Error(`Invalid wallet client: ${typeof walletClient}`);
            }

            // Use our browser-compatible x402 wrapper
            const fetchWithPayment = wrapFetchWithPaymentBrowser(fetch, walletClient);
            
            console.log('Browser-compatible payment wrapper created successfully');

            // Make the request - x402-fetch will:
            // 1. Make initial request
            // 2. If 402 received, sign payment with wallet
            // 3. Retry with X-PAYMENT header
            const response = await fetchWithPayment('/api/create-short-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ originalUrl: url })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to create short URL');
            }

            const data = await response.json();

            // Check for payment response header
            const paymentResponseHeader = response.headers.get('x-payment-response');
            if (paymentResponseHeader) {
                try {
                    const paymentResponse = decodeXPaymentResponse(paymentResponseHeader);
                    console.log('✅ Payment completed:', {
                        success: paymentResponse.success,
                        transaction: paymentResponse.transaction,
                        network: paymentResponse.network,
                        payer: paymentResponse.payer,
                    });
                } catch (e) {
                    console.log('Payment response header received');
                }
            }

            setShortUrl(data.shortUrl);
            setNeedsPayment(false);
            setPaymentDetails(null);
        } catch (err: any) {
            console.error('❌ Payment error:', err);
            setError(err?.message || 'Payment failed');
        } finally {
            setLoading(false);
        }
    };


    const copyToClipboard = () => {
        navigator.clipboard.writeText(shortUrl);
        alert('Copied to clipboard!');
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-2xl">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-gray-800 mb-2">
                        URL Shortener
                    </h1>
                    <p className="text-gray-600">
                        Shorten your URLs with crypto payments
                    </p>
                </div>

                <div className="flex justify-end mb-4">
                    <ConnectButton />
                </div>

                <div className="space-y-4">

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Enter your long URL
                        </label>
                        <input
                            type="url"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="https://example.com/very/long/url"
                            className="w-full px-4 py-3 border text-gray-700 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                        />
                    </div>

                    {!needsPayment ? (
                        <button
                            onClick={handleShorten}
                            disabled={loading || !url || !isConnected}
                            className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                        >
                            {!isConnected ? 'Connect Wallet First' : loading ? 'Processing...' : 'Shorten URL'}
                        </button>
                    ) : (
                        <button
                            onClick={handlePayment}
                            disabled={loading || !isConnected}
                            className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                        >
                            {loading ? 'Processing Payment...' : '💳 Pay & Create (0.001 USDC on Base Sepolia)'}
                        </button>
                    )}

                    {error && (
                        <div className={`p-4 rounded-lg ${needsPayment ? 'bg-yellow-50 border border-yellow-200' : 'bg-red-50 border border-red-200'}`}>
                            <p className={needsPayment ? 'text-yellow-800' : 'text-red-800'}>
                                {error}
                            </p>
                        </div>
                    )}

                    {shortUrl && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <p className="text-sm font-medium text-green-800 mb-2">
                                Your shortened URL:
                            </p>
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={shortUrl}
                                    readOnly
                                    className="flex-1 px-4 py-2 bg-white border border-green-300 rounded-lg text-green-900 font-mono"
                                />
                                <button
                                    onClick={copyToClipboard}
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                                >
                                    Copy
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="mt-8 pt-6 border-t border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-800 mb-2">
                        How it works
                    </h2>
                    <ul className="space-y-2 text-sm text-gray-600">
                        <li>• Enter your long URL</li>
                        <li>• Pay 0.001 USDC on Base Sepolia via x402</li>
                        <li>• Get your shortened URL instantly</li>
                        <li>• Funds go to {RECEIVER_ADDRESS.slice(0, 6)}...{RECEIVER_ADDRESS.slice(-4)}</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}