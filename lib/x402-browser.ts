/**
 * Browser-compatible x402 payment wrapper
 * This bypasses the crypto.getRandomValues issue in x402-fetch by using native browser crypto
 */

import { toHex, type WalletClient } from 'viem';
import { PaymentRequirementsSchema } from 'x402/types';

interface PaymentRequirements {
  scheme: string;
  network: string;
  maxAmountRequired: string;
  resource: string;
  description: string;
  mimeType: string;
  payTo: string;
  maxTimeoutSeconds: number;
  asset: string;
  extra?: any;
}

/**
 * Create a nonce using browser's native crypto
 */
function createBrowserNonce(): string {
  if (typeof window === 'undefined' || !window.crypto) {
    throw new Error('Browser crypto not available');
  }
  const buffer = new Uint8Array(32);
  window.crypto.getRandomValues(buffer);
  return toHex(buffer);
}

/**
 * Create payment header for x402 protocol
 */
async function createPaymentHeader(
  walletClient: WalletClient,
  x402Version: number,
  paymentRequirements: PaymentRequirements
): Promise<string> {
  const { scheme, network, asset, payTo, maxAmountRequired, maxTimeoutSeconds, extra } = paymentRequirements;

  if (scheme !== 'exact') {
    throw new Error(`Unsupported payment scheme: ${scheme}`);
  }

  // Create authorization using browser-safe nonce
  const nonce = createBrowserNonce();
  // validAfter: 5 seconds before current time to account for block timestamping
  const validAfter = BigInt(Math.floor(Date.now() / 1000) - 5);
  // validBefore: current time + maxTimeoutSeconds
  const validBefore = BigInt(Math.floor(Date.now() / 1000) + maxTimeoutSeconds);

  // Authorization object for signing (using BigInt)
  const authorization = {
    from: walletClient.account?.address,
    to: payTo,
    value: BigInt(maxAmountRequired),
    validAfter,
    validBefore,
    nonce: nonce as `0x${string}`,
  };

  // Get the USDC version from the contract if not provided in extra
  // For Base Sepolia USDC, it's typically version "2"
  const usdcName = extra?.name || 'USD Coin';
  const usdcVersion = extra?.version || '2';
  
  // Sign the authorization using EIP-3009
  const domain = {
    name: usdcName,
    version: usdcVersion,
    chainId: walletClient.chain?.id,
    verifyingContract: asset as `0x${string}`,
  };
  
  console.log('Signing with domain:', {
    name: usdcName,
    version: usdcVersion,
    chainId: walletClient.chain?.id,
    verifyingContract: asset,
  });

  const types = {
    TransferWithAuthorization: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'validAfter', type: 'uint256' },
      { name: 'validBefore', type: 'uint256' },
      { name: 'nonce', type: 'bytes32' },
    ],
  };

  const signature = await walletClient.signTypedData({
    account: walletClient.account!,
    domain,
    types,
    primaryType: 'TransferWithAuthorization',
    message: authorization,
  });

  // Create the payment payload matching x402 library format exactly
  // The authorization object should have the original structure for the payload
  const payload = {
    signature,
    authorization: {
      from: authorization.from,
      to: authorization.to,
      value: maxAmountRequired, // Keep as string (already a string from paymentRequirements)
      validAfter: authorization.validAfter.toString(),
      validBefore: authorization.validBefore.toString(),
      nonce: authorization.nonce,
    },
  };

  // Create the payment header
  const paymentHeader = {
    x402Version,
    scheme,
    network,
    payload,
  };

  // Use browser-native base64 encoding with proper JSON serialization
  const jsonString = JSON.stringify(paymentHeader);
  const base64Header = btoa(jsonString);
  
  console.log('Created payment header:', {
    x402Version,
    scheme,
    network,
    payTo,
    amount: maxAmountRequired,
    headerLength: base64Header.length,
    samplePayload: JSON.stringify(payload).substring(0, 200),
  });
  
  return base64Header;
}

/**
 * Select the first payment requirement (simple selector)
 */
function selectPaymentRequirements(requirements: PaymentRequirements[]): PaymentRequirements {
  if (requirements.length === 0) {
    throw new Error('No payment requirements available');
  }
  return requirements[0];
}

/**
 * Browser-compatible wrapper for fetch with x402 payment support
 */
export function wrapFetchWithPaymentBrowser(
  fetchFn: typeof fetch,
  walletClient: WalletClient,
  maxValue: bigint = BigInt(0.1 * 10 ** 6)
) {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    // Make initial request
    const response = await fetchFn(input, init);

    // If not 402, return as-is
    if (response.status !== 402) {
      return response;
    }

    // Parse 402 response
    const responseData = await response.json();
    const { x402Version, accepts } = responseData;

    if (!accepts || !Array.isArray(accepts)) {
      throw new Error('Invalid 402 response: missing accepts field');
    }

    // Parse and select payment requirements
    const parsedPaymentRequirements = accepts.map((x: any) => 
      PaymentRequirementsSchema.parse(x)
    );
    const selectedPaymentRequirements = selectPaymentRequirements(parsedPaymentRequirements);

    // Check if amount is within max value
    if (BigInt(selectedPaymentRequirements.maxAmountRequired) > maxValue) {
      throw new Error('Payment amount exceeds maximum allowed');
    }

    // Create payment header
    const paymentHeader = await createPaymentHeader(
      walletClient,
      x402Version,
      selectedPaymentRequirements
    );

    // Retry request with payment header
    const newInit: RequestInit & { __is402Retry?: boolean } = {
      ...init,
      headers: {
        ...(init?.headers || {}),
        'X-PAYMENT': paymentHeader,
        'Access-Control-Expose-Headers': 'X-PAYMENT-RESPONSE',
      },
      __is402Retry: true,
    };

    const secondResponse = await fetchFn(input, newInit);
    return secondResponse;
  };
}
