/**
 * Audio Modulator for AeroTone FSK Data Transmission
 * Continuous Phase Frequency-Shift Keying (CPFSK) with Hann Window Shaping
 */

import { FrequencyProfile } from '../types/modem';
import { calculateCRC8, SFD_BYTE, stringToBytes } from './crc';

export interface ToneSymbol {
  freq: number;
  durationMs: number;
  phaseType: 'preamble' | 'sfd' | 'payload' | 'crc' | 'stop';
  bitIndex?: number;
  bitValue?: number;
}

export interface EncodedSignal {
  symbols: ToneSymbol[];
  totalDurationMs: number;
  totalBits: number;
  dataBytes: number[];
  crc: number;
}

/**
 * Builds the sequence of tone symbols for the packet
 */
export function buildPacketSymbols(
  text: string,
  profile: FrequencyProfile,
  symbolDurationMs: number
): EncodedSignal {
  const allBytes = stringToBytes(text);
  // Cap at 255 bytes (maximum uint8 frame size)
  const dataBytes = allBytes.length > 255 ? allBytes.slice(0, 255) : allBytes;
  const lengthByte = dataBytes.length;
  const crc = calculateCRC8([lengthByte, ...dataBytes]);

  const symbols: ToneSymbol[] = [];

  // 1. Preamble: Tone A (250ms) + Tone B (200ms) for clear transition clock sync
  symbols.push({ freq: profile.syncFreq1, durationMs: 250, phaseType: 'preamble' });
  symbols.push({ freq: profile.syncFreq2, durationMs: 200, phaseType: 'preamble' });

  // 2. Start Frame Delimiter (SFD: 0xAB)
  let bitCounter = 0;
  for (let i = 7; i >= 0; i--) {
    const bit = (SFD_BYTE >> i) & 1;
    symbols.push({
      freq: bit ? profile.markFreq : profile.spaceFreq,
      durationMs: symbolDurationMs,
      phaseType: 'sfd',
      bitIndex: bitCounter++,
      bitValue: bit,
    });
  }

  // 3. Length byte (1 byte, supports up to 255 bytes payload)
  for (let i = 7; i >= 0; i--) {
    const bit = (lengthByte >> i) & 1;
    symbols.push({
      freq: bit ? profile.markFreq : profile.spaceFreq,
      durationMs: symbolDurationMs,
      phaseType: 'payload',
      bitIndex: bitCounter++,
      bitValue: bit,
    });
  }

  // 4. Data payload bytes
  for (const byte of dataBytes) {
    for (let i = 7; i >= 0; i--) {
      const bit = (byte >> i) & 1;
      symbols.push({
        freq: bit ? profile.markFreq : profile.spaceFreq,
        durationMs: symbolDurationMs,
        phaseType: 'payload',
        bitIndex: bitCounter++,
        bitValue: bit,
      });
    }
  }

  // 5. CRC-8 byte
  for (let i = 7; i >= 0; i--) {
    const bit = (crc >> i) & 1;
    symbols.push({
      freq: bit ? profile.markFreq : profile.spaceFreq,
      durationMs: symbolDurationMs,
      phaseType: 'crc',
      bitIndex: bitCounter++,
      bitValue: bit,
    });
  }

  // 6. Stop tone guard
  symbols.push({
    freq: profile.syncFreq1,
    durationMs: Math.max(60, symbolDurationMs * 1.5),
    phaseType: 'stop',
  });

  const totalDurationMs = symbols.reduce((acc, s) => acc + s.durationMs, 0);

  return {
    symbols,
    totalDurationMs,
    totalBits: bitCounter,
    dataBytes,
    crc,
  };
}

/**
 * Synthesizes PCM audio buffer with Continuous Phase FSK and smooth envelope shaping
 */
export function synthesizeAudioBuffer(
  audioCtx: AudioContext,
  encoded: EncodedSignal,
  volume = 0.85
): AudioBuffer {
  const sampleRate = audioCtx.sampleRate;
  const totalSamples = Math.ceil((encoded.totalDurationMs / 1000) * sampleRate);
  const audioBuffer = audioCtx.createBuffer(1, totalSamples, sampleRate);
  const channelData = audioBuffer.getChannelData(0);

  let currentSample = 0;
  let phase = 0; // Continuous phase accumulator to prevent clicks

  for (const sym of encoded.symbols) {
    const symSamples = Math.floor((sym.durationMs / 1000) * sampleRate);
    const angularFreq = (2 * Math.PI * sym.freq) / sampleRate;

    // Smooth envelope shaping (12% ramp-up and ramp-down)
    const rampSamples = Math.max(8, Math.floor(symSamples * 0.12));

    for (let s = 0; s < symSamples; s++) {
      if (currentSample >= totalSamples) break;

      // Calculate envelope multiplier (0.0 to 1.0)
      let env = 1.0;
      if (s < rampSamples) {
        // Raised cosine ramp up
        env = 0.5 * (1 - Math.cos((Math.PI * s) / rampSamples));
      } else if (s > symSamples - rampSamples) {
        // Raised cosine ramp down
        const rampOut = s - (symSamples - rampSamples);
        env = 0.5 * (1 + Math.cos((Math.PI * rampOut) / rampSamples));
      }

      channelData[currentSample] = Math.sin(phase) * env * volume;
      phase += angularFreq;
      // Keep phase wrapped between -2pi and 2pi
      if (phase > 2 * Math.PI) {
        phase -= 2 * Math.PI;
      }

      currentSample++;
    }
  }

  return audioBuffer;
}

/**
 * Plays a subtle two-tone acoustic confirmation chime when a command/packet is successfully decoded
 */
export function playCommandAckChime(audioCtx: AudioContext, volume = 0.15) {
  try {
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    const now = audioCtx.currentTime;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';
    // 880Hz (A5) -> 1760Hz (A6)
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.setValueAtTime(1760, now + 0.08);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.02);
    gain.gain.setValueAtTime(volume, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(now);
    osc.stop(now + 0.23);
  } catch {
    // ignore audio context errors
  }
}

/**
 * Generates a standard WAV file blob from an AudioBuffer
 */
export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = 1;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const channelData = buffer.getChannelData(0);
  const numSamples = channelData.length;

  const byteRate = (sampleRate * numChannels * bitDepth) / 8;
  const blockAlign = (numChannels * bitDepth) / 8;
  const dataSize = numSamples * numChannels * (bitDepth / 8);
  const bufferLength = 44 + dataSize;

  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);

  function writeString(offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  // RIFF identifier
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // SubChunk1Size
  view.setUint16(20, format, true); // AudioFormat
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Write PCM samples
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, channelData[i]));
    const intSample = s < 0 ? s * 0x8000 : s * 0x7fff;
    view.setInt16(offset, intSample, true);
    offset += 2;
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}
