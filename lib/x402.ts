import { useFacilitator } from 'x402/verify';

const RECEIVER_ADDRESS = '0xabaf59180e0209bdb8b3048bfbe64e855074c0c4';
const FACILITATOR_URL = 'https://x402.org/facilitator';
const NETWORK = 'base-sepolia';
const PAYMENT_AMOUNT_USDC = '0.001'; // $0.001 USDC

// Testnet facilitator config (no auth required)
const testnetFacilitator = {
    url: FACILITATOR_URL as `${string}://${string}`,
};

export interface PaymentRequest {
    destinationAddress: string;
    purchaseCurrency: string;
    destinationNetwork: string;
    paymentAmount: string;
    paymentCurrency: string;
}

export async function getPaymentRequest(): Promise<PaymentRequest> {
    return {
        destinationAddress: RECEIVER_ADDRESS,
        purchaseCurrency: 'USDC',
        destinationNetwork: NETWORK,
        paymentAmount: PAYMENT_AMOUNT_USDC,
        paymentCurrency: 'USDC',
    };
}

export async function verifyPayment(
    paymentProof: string,
    paymentRequirements: {
        scheme: 'exact';
        network: 'base-sepolia' | 'base' | 'avalanche-fuji' | 'avalanche' | 'iotex';
        maxAmountRequired: string;
        resource: string;
        description: string;
        mimeType: string;
        payTo: string;
        maxTimeoutSeconds: number;
        asset: string;
        extra?: Record<string, any>;
    }
): Promise<boolean> {
    try {
        if (!paymentProof) {
            console.error('No payment proof provided');
            return false;
        }

        console.log('Verifying payment proof (first 100 chars):', paymentProof.substring(0, 100));
        
        // Decode the payment header
        let decodedPayload: any;
        try {
            const decoded = Buffer.from(paymentProof, 'base64').toString();
            decodedPayload = JSON.parse(decoded);
            console.log('Decoded payment header:', JSON.stringify(decodedPayload, null, 2));
        } catch (e) {
            console.error('Failed to decode payment proof:', e);
            return false;
        }

        // Validate the decoded payload has required fields
        if (!decodedPayload.x402Version || !decodedPayload.scheme || !decodedPayload.network || !decodedPayload.payload) {
            console.error('Invalid payment payload structure:', decodedPayload);
            return false;
        }

        // Use the facilitator to verify payment
        // The verify function expects (payload, paymentRequirements)
        // Use testnet facilitator (no auth required for Base Sepolia)
        const { verify } = useFacilitator(testnetFacilitator);
        
        console.log('Calling facilitator verify with:', {
            x402Version: decodedPayload.x402Version,
            scheme: decodedPayload.scheme,
            network: decodedPayload.network,
            paymentRequirements: {
                scheme: paymentRequirements.scheme,
                network: paymentRequirements.network,
                maxAmountRequired: paymentRequirements.maxAmountRequired,
                asset: paymentRequirements.asset,
                payTo: paymentRequirements.payTo,
            }
        });
        
        // Verify the payment proof with the facilitator
        const result = await verify(decodedPayload, paymentRequirements);

        console.log('Payment verification result:', result);
        return result?.isValid === true;
    } catch (error) {
        console.error('Payment verification failed:', error);
        if (error instanceof Error) {
            console.error('Error details:', error.message);
            console.error('Error stack:', error.stack);
        }
        return false;
    }
}

export { RECEIVER_ADDRESS, PAYMENT_AMOUNT_USDC, NETWORK, FACILITATOR_URL };