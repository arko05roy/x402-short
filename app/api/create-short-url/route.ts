import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyPayment, getPaymentRequest, RECEIVER_ADDRESS, PAYMENT_AMOUNT_USDC, NETWORK, FACILITATOR_URL } from '@/lib/x402';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Generate random short code
function generateShortCode(length = 6): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

export async function POST(request: NextRequest) {
    try {
        const { originalUrl } = await request.json();

        // Validate URL
        if (!originalUrl || !originalUrl.startsWith('http')) {
            return NextResponse.json(
                { error: 'Invalid URL provided' },
                { status: 400 }
            );
        }

        // Check for X-PAYMENT header (x402 payment proof)
        const paymentProof = request.headers.get('X-PAYMENT');

        // Construct the full resource URL from the request
        const protocol = request.headers.get('x-forwarded-proto') || 'http';
        const host = request.headers.get('host') || 'localhost:3000';
        const resourceUrl = `${protocol}://${host}/api/create-short-url`;
        
        // Define payment requirements (used for both 402 response and verification)
        const paymentRequirement = {
            scheme: 'exact',
            description: 'URL Shortening Service',
            asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // USDC on Base
            maxAmountRequired: '1000', // 0.001 USDC in smallest units (6 decimals)
            network: 'base-sepolia',
            resource: resourceUrl, // Full URL required by x402 Zod validation
            mimeType: 'application/json',
            payTo: RECEIVER_ADDRESS,
            maxTimeoutSeconds: 60,
            extra: {
                name: 'USD Coin',
                version: '2',
            },
        };
        
        // If no payment proof, return 402 with payment details
        if (!paymentProof) {
            // Create proper x402 402 response with required format
            const response = new NextResponse(
                JSON.stringify({
                    x402Version: 1,
                    accepts: [paymentRequirement], // Array of payment requirements
                    error: 'Payment required'
                }),
                { 
                    status: 402,
                    headers: {
                        'Content-Type': 'application/json',
                    }
                }
            );
            
            return response;
        }

        // Verify the X402 payment proof with Coinbase facilitator
        console.log('Starting payment verification...');
        console.log('Payment proof (first 100 chars):', paymentProof.substring(0, 100));
        console.log('Payment requirement:', {
            scheme: paymentRequirement.scheme,
            network: paymentRequirement.network,
            asset: paymentRequirement.asset,
            payTo: paymentRequirement.payTo,
            maxAmountRequired: paymentRequirement.maxAmountRequired,
        });
        
        const isPaymentValid = await verifyPayment(paymentProof, paymentRequirement);

        console.log('Payment verification result:', isPaymentValid);

        if (!isPaymentValid) {
            console.error('Payment verification failed for proof:', paymentProof.substring(0, 50));
            return NextResponse.json(
                { error: 'Invalid or expired payment proof' },
                { status: 403 }
            );
        }
        
        console.log('Payment verified successfully!');

        // Generate unique short code
        let shortCode = generateShortCode();
        let attempts = 0;

        while (attempts < 5) {
            const { data: existing } = await supabase
                .from('urls')
                .select('short_code')
                .eq('short_code', shortCode)
                .single();

            if (!existing) break;
            shortCode = generateShortCode();
            attempts++;
        }

        // Store in database
        const { data, error } = await supabase
            .from('urls')
            .insert([
                {
                    original_url: originalUrl,
                    short_code: shortCode,
                    payment_hash: paymentProof,
                    receiver_address: RECEIVER_ADDRESS,
                    payment_amount: PAYMENT_AMOUNT_USDC,
                    payment_currency: 'USDC',
                    network: NETWORK
                }
            ])
            .select()
            .single();

        if (error) {
            console.error('Supabase error:', error);
            return NextResponse.json(
                { error: 'Failed to create short URL' },
                { status: 500 }
            );
        }

        const shortUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/${shortCode}`;

        // Return success response with payment confirmation headers
        const successResponse = new NextResponse(
            JSON.stringify({
                success: true,
                shortUrl,
                shortCode,
                originalUrl,
                payment: {
                    verified: true,
                    receiver: RECEIVER_ADDRESS,
                    amount: PAYMENT_AMOUNT_USDC,
                    currency: 'USDC',
                    network: NETWORK
                }
            }),
            {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    // Include payment response header for x402-fetch
                    'X-Payment-Response': JSON.stringify({
                        success: true,
                        transaction: paymentProof,
                        network: NETWORK,
                        payer: RECEIVER_ADDRESS
                    })
                }
            }
        );

        return successResponse;

    } catch (error) {
        console.error('Error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}