'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function RedirectPage() {
    const params = useParams();
    const router = useRouter();
    const [error, setError] = useState(false);
    const code = params.code as string;

    useEffect(() => {
        const redirect = async () => {
            try {
                const response = await fetch(`/api/redirect/${code}`);
                const data = await response.json();

                if (!response.ok || !data.originalUrl) {
                    setError(true);
                    return;
                }

                // Redirect to original URL
                window.location.href = data.originalUrl;
            } catch (err) {
                console.error('Redirect error:', err);
                setError(true);
            }
        };

        redirect();
    }, [code]);

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
                    <div className="text-6xl mb-4">❌</div>
                    <h1 className="text-2xl font-bold text-gray-800 mb-2">
                        URL Not Found
                    </h1>
                    <p className="text-gray-600 mb-6">
                        The short URL you're looking for doesn't exist or has expired.
                    </p>
                    <button
                        onClick={() => router.push('/')}
                        className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700"
                    >
                        Create New Short URL
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <div className="text-center">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Redirecting...</p>
            </div>
        </div>
    );
}