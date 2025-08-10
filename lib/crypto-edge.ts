// Edge-compatible crypto utilities using Web Crypto API

// Convert string to ArrayBuffer
function stringToArrayBuffer(str: string): ArrayBuffer {
  return new TextEncoder().encode(str).buffer;
}



// Convert ArrayBuffer to base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

// Convert base64 to ArrayBuffer
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Generate a secure random UUID
export function generateUUID(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  
  // Set version (4) and variant bits
  array[6] = (array[6]! & 0x0f) | 0x40;
  array[8] = (array[8]! & 0x3f) | 0x80;
  
  const hex = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

// Hash password using PBKDF2
export async function hashPassword(password: string, salt?: string): Promise<string> {
  const passwordBuffer = stringToArrayBuffer(password);
  const saltBuffer = salt ? base64ToArrayBuffer(salt) : crypto.getRandomValues(new Uint8Array(16));
  
  const key = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  
  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: 100000,
      hash: 'SHA-256'
    },
    key,
    256
  );
  
  const saltBase64 = arrayBufferToBase64(saltBuffer as ArrayBuffer);
  const _hashBase64 = arrayBufferToBase64(hashBuffer);
  
  return `${saltBase64}:${_hashBase64}`;
}

// Verify password
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  try {
    const [saltBase64, _hashBase64] = hashedPassword.split(':');
    const newHash = await hashPassword(password, saltBase64);
    return newHash === hashedPassword;
  } catch (error) {
    console.error('Password verification error:', error);
    return false;
  }
}

// Simple JWT implementation using Web Crypto API
export async function signJWT(payload: Record<string, unknown>, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const exp = now + (7 * 24 * 60 * 60); // 7 days
  
  const jwtPayload = {
    ...payload,
    iat: now,
    exp: exp
  };
  
  const headerBase64 = btoa(JSON.stringify(header));
  const payloadBase64 = btoa(JSON.stringify(jwtPayload));
  
  const data = `${headerBase64}.${payloadBase64}`;
  const dataBuffer = stringToArrayBuffer(data);
  const secretBuffer = stringToArrayBuffer(secret);
  
  const key = await crypto.subtle.importKey(
    'raw',
    secretBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, dataBuffer);
  const signatureBase64 = arrayBufferToBase64(signatureBuffer);
  
  return `${data}.${signatureBase64}`;
}

// Verify JWT
export async function verifyJWT(token: string, secret: string): Promise<Record<string, unknown> | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    
    const [headerBase64, payloadBase64, signatureBase64] = parts;
    const data = `${headerBase64}.${payloadBase64}`;
    
    const dataBuffer = stringToArrayBuffer(data);
    const secretBuffer = stringToArrayBuffer(secret);
    const signatureBuffer = base64ToArrayBuffer(signatureBase64!);
    
    const key = await crypto.subtle.importKey(
      'raw',
      secretBuffer,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    
    const isValid = await crypto.subtle.verify('HMAC', key, signatureBuffer, dataBuffer);
    if (!isValid) {
      return null;
    }
    
    const payload = JSON.parse(atob(payloadBase64!));
    const now = Math.floor(Date.now() / 1000);
    
    if (payload.exp && payload.exp < now) {
      return null; // Token expired
    }
    
    return payload;
  } catch (error) {
    console.error('JWT verification error:', error);
    return null;
  }
}
