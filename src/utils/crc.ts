/**
 * CRC-8 and Bit Utilities for Acoustic Data Transfer
 * Uses CRC-8 Dallas/Maxim polynomial: x^8 + x^5 + x^4 + 1 (0x8C reversed / 0x31 normal)
 */

export const CRC8_POLYNOMIAL = 0x31;
export const SFD_BYTE = 0xab; // Start Frame Delimiter (10101011)
export const STOP_BYTE = 0x55; // End Delimiter (01010101)

/**
 * Calculates CRC-8 checksum over an array of bytes
 */
export function calculateCRC8(data: number[] | Uint8Array): number {
  let crc = 0x00;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let bit = 0; bit < 8; bit++) {
      if ((crc & 0x80) !== 0) {
        crc = ((crc << 1) ^ CRC8_POLYNOMIAL) & 0xff;
      } else {
        crc = (crc << 1) & 0xff;
      }
    }
  }
  return crc;
}

/**
 * Encodes string to UTF-8 byte array
 */
export function stringToBytes(str: string): number[] {
  const encoder = new TextEncoder();
  const uint8 = encoder.encode(str);
  return Array.from(uint8);
}

/**
 * Decodes byte array to UTF-8 string with fallback
 */
export function bytesToString(bytes: number[] | Uint8Array): string {
  try {
    const decoder = new TextDecoder('utf-8', { fatal: false });
    return decoder.decode(new Uint8Array(bytes));
  } catch {
    return String.fromCharCode(...bytes);
  }
}

/**
 * Converts a byte array into an array of bits (MSB first)
 */
export function bytesToBits(bytes: number[]): number[] {
  const bits: number[] = [];
  for (const byte of bytes) {
    for (let i = 7; i >= 0; i--) {
      bits.push((byte >> i) & 1);
    }
  }
  return bits;
}

/**
 * Converts an array of bits (length multiple of 8) into byte array
 */
export function bitsToBytes(bits: number[]): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let b = 0; b < 8; b++) {
      if (bits[i + b]) {
        byte |= 1 << (7 - b);
      }
    }
    bytes.push(byte);
  }
  return bytes;
}

/**
 * Formats a byte as a two-character uppercase hex string
 */
export function byteToHex(b: number): string {
  return ('0' + (b & 0xff).toString(16).toUpperCase()).slice(-2);
}

/**
 * Formats byte array into spaced hex string
 */
export function bytesToHexString(bytes: number[]): string {
  return bytes.map(byteToHex).join(' ');
}
