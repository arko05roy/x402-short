import { wrapFetchWithPayment, decodeXPaymentResponse } from 'x402-fetch';
import { createWalletClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';

const FACILITATOR_URL = 'https://x402.org/facilitator';
const RECEIVER_ADDRESS = '0xabaf59180e0209bdb8b3048bfbe64e855074c0c4';
const PAYMENT_AMOUNT_USDC = '0.001';
const NETWORK = 'base-sepolia';

/**
 * Create a wallet client for signing transactions
 */
export async function createPaymentWalletClient(privateKey: string) {
    return createWalletClient({
        account: privateKey as `0x${string}`,
        chain: baseSepolia,
        transport: http(),
    });
}

/**
 * Get wrapped fetch with x402 payment support
 */
export function getPaymentFetch(account: any) {
    return wrapFetchWithPayment(fetch, account, {
        facilitatorUrl: FACILITATOR_URL,
    });
}

/**
 * Make a paid request using x402
 */
export async function makePaidRequest(
    url: string,
    options: RequestInit & { account?: any } = {}
) {
    const { account, ...fetchOptions } = options;

    if (!account) {
        throw new Error('Account is required for paid requests');
    }

    const fetchWithPayment = getPaymentFetch(account);

    try {
        const response = await fetchWithPayment(url, {
            ...fetchOptions,
            method: fetchOptions.method || 'POST',
        });

        // Check if payment was successful
        if (response.ok) {
            const paymentResponse = response.headers.get('x-payment-response');
            if (paymentResponse) {
                const decoded = decodeXPaymentResponse(paymentResponse);
                console.log('Payment successful:', decoded);
            }
        }

        return response;
    } catch (error) {
        console.error('Payment request failed:', error);
        throw error;
    }
}

export { RECEIVER_ADDRESS, PAYMENT_AMOUNT_USDC, NETWORK, FACILITATOR_URL };
