// Google OAuth 2.0 Service Account Authentication for Cloudflare Workers
// Uses Web Crypto API to sign JWT tokens

interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
  project_id: string;
}

/**
 * Load service account credentials from environment variable
 * credentialsJson parameter should be the raw JSON string from environment
 */
export async function loadServiceAccountCredentials(
  credentialsJson: string
): Promise<ServiceAccountCredentials> {
  // In Cloudflare Workers, we cannot use fs.readFileSync
  // Instead, we parse credentials directly from environment variable
  
  if (!credentialsJson) {
    throw new Error('Service account credentials JSON not provided');
  }
  
  try {
    const credentials = JSON.parse(credentialsJson);
    
    // Validate required fields
    if (!credentials.client_email || !credentials.private_key || !credentials.project_id) {
      throw new Error('Invalid credentials: missing required fields (client_email, private_key, project_id)');
    }
    
    return credentials;
  } catch (error) {
    throw new Error(`Failed to parse service account credentials: ${error}`);
  }
}

/**
 * Generate JWT token for Google API authentication
 */
async function createJWT(
  credentials: ServiceAccountCredentials,
  scope: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600; // 1 hour

  // JWT Header
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  // JWT Payload
  const payload = {
    iss: credentials.client_email,
    scope: scope,
    aud: 'https://oauth2.googleapis.com/token',
    exp: expiry,
    iat: now,
  };

  // Encode header and payload
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  // Import private key
  const privateKey = await importPrivateKey(credentials.private_key);

  // Sign the token
  const signature = await signData(privateKey, unsignedToken);
  const encodedSignature = base64UrlEncode(signature);

  return `${unsignedToken}.${encodedSignature}`;
}

/**
 * Get access token from Google OAuth 2.0
 */
export async function getAccessToken(
  credentials: ServiceAccountCredentials,
  scope: string = 'https://www.googleapis.com/auth/cloud-vision'
): Promise<string> {
  const jwt = await createJWT(credentials, scope);

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get access token: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * Import private key for signing
 */
async function importPrivateKey(privateKeyPem: string): Promise<CryptoKey> {
  // Remove PEM headers and whitespace
  const pemContents = privateKeyPem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\\n/g, '')
    .replace(/\s/g, '');

  // Convert base64 to ArrayBuffer
  const binaryDer = base64Decode(pemContents);

  // Import the key
  return await crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );
}

/**
 * Sign data with private key
 */
async function signData(
  privateKey: CryptoKey,
  data: string
): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);

  return await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    dataBuffer
  );
}

/**
 * Base64 URL encoding
 */
function base64UrlEncode(data: string | ArrayBuffer): string {
  let base64: string;
  
  if (typeof data === 'string') {
    base64 = btoa(data);
  } else {
    const bytes = new Uint8Array(data);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    base64 = btoa(binary);
  }

  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Base64 decoding
 */
function base64Decode(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}
