/**
 * Audio Demodulator for AeroTone Acoustic Data Modem
 * High-Reliability Sample-Accurate Goertzel Filter Bank,
 * Continuous Phase Lock, and Frame Synchronization State Machine
 */

import { FrequencyProfile, ModemState, ReceivedPacket, SpeedPreset } from '../types/modem';
import { calculateCRC8, SFD_BYTE } from './crc';

/**
 * Exact continuous-frequency Goertzel algorithm
 * Computes precise spectral energy at targetFreq without FFT bin quantization error
 */
export function goertzelPower(samples: Float32Array, targetFreq: number, sampleRate: number): number {
  const n = samples.length;
  if (n === 0) return 0;

  const omega = (2 * Math.PI * targetFreq) / sampleRate;
  const coeff = 2 * Math.cos(omega);

  let q0 = 0;
  let q1 = 0;
  let q2 = 0;

  for (let i = 0; i < n; i++) {
    q0 = coeff * q1 - q2 + samples[i];
    q2 = q1;
    q1 = q0;
  }

  const real = q1 - q2 * Math.cos(omega);
  const imag = q2 * Math.sin(omega);
  return (real * real + imag * imag) / (n * n);
}

/**
 * Calculates bitwise Hamming distance between two bytes
 */
function hammingDistance(a: number, b: number): number {
  let v = (a ^ b) & 0xff;
  let count = 0;
  while (v > 0) {
    count += v & 1;
    v >>= 1;
  }
  return count;
}

export interface DemodulatorCallbacks {
  onStateChange: (state: ModemState) => void;
  onPacketReceived: (packet: ReceivedPacket) => void;
  onMetricsUpdate: (metrics: {
    micLevel: number;
    snrDb: number;
    dominantFreq: number;
    state: ModemState;
    activeTone: string;
  }) => void;
  onBitDetected?: (bit: number, bitIndex: number) => void;
}

export class AcousticDemodulator {
  private audioCtx: AudioContext | null = null;
  private inputGainNode: GainNode | null = null;
  private scriptNode: ScriptProcessorNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private silentSinkNode: GainNode | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | AudioNode | null = null;
  private connectedSources: Set<AudioNode> = new Set();

  private profile: FrequencyProfile;
  private speedPreset: SpeedPreset;
  private callbacks: DemodulatorCallbacks;

  // Sample-level ring buffer (holds up to 10 seconds of 48kHz audio)
  private ringBuffer: Float32Array = new Float32Array(48000 * 10);
  private writeIndex = 0;
  private totalReceivedSamples = 0;
  private samplesPerSymbol = 0;

  // State Machine
  private state: ModemState = 'idle';
  private pilotACount = 0;
  private pilotBCount = 0;
  private toneBStartSample = 0;
  private peakB = 0;
  private stateStartTime = Date.now();
  private noiseFloor = 0.0001;
  private sensitivityMultiplier = 1.6;
  private ignoreUntilSample = 0;

  // Bit & Frame Decoding
  private bitClockStart = 0;
  private nextBitSample = 0;
  private receivedBits: number[] = [];
  private receivedBytes: number[] = [];
  private expectedLength = 0;
  private snrHistory: number[] = [];
  private packetStartTime = 0;

  constructor(
    profile: FrequencyProfile,
    speedPreset: SpeedPreset,
    callbacks: DemodulatorCallbacks
  ) {
    this.profile = profile;
    this.speedPreset = speedPreset;
    this.callbacks = callbacks;
  }

  public setSensitivity(level: 'high' | 'medium' | 'low') {
    if (level === 'high') this.sensitivityMultiplier = 1.2;
    else if (level === 'medium') this.sensitivityMultiplier = 1.6;
    else this.sensitivityMultiplier = 2.2;
  }

  public updateConfig(profile: FrequencyProfile, speedPreset: SpeedPreset) {
    this.profile = profile;
    this.speedPreset = speedPreset;
    if (this.audioCtx) {
      this.samplesPerSymbol = Math.round((this.speedPreset.symbolDurationMs / 1000) * this.audioCtx.sampleRate);
    }
  }

  public async startMicrophone(audioCtx?: AudioContext): Promise<void> {
    this.stop();

    const AudioCtxClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.audioCtx = audioCtx || new AudioCtxClass();

    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }

    this.samplesPerSymbol = Math.round((this.speedPreset.symbolDurationMs / 1000) * this.audioCtx.sampleRate);

    // Request microphone without browser aggressive filtering
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });

    this.mediaStream = stream;
    this.sourceNode = this.audioCtx.createMediaStreamSource(stream);
    this.setupAudioGraph();
    this.sourceNode.connect(this.inputGainNode!);
  }

  public attachDirectSource(source: AudioNode, audioCtx: AudioContext) {
    this.audioCtx = audioCtx;
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    this.samplesPerSymbol = Math.round((this.speedPreset.symbolDurationMs / 1000) * this.audioCtx.sampleRate);

    if (!this.inputGainNode || !this.scriptNode) {
      this.setupAudioGraph();
    }

    // Connect source to shared input
    if (!this.connectedSources.has(source)) {
      try {
        source.connect(this.inputGainNode!);
        this.connectedSources.add(source);
      } catch {
        // ignore reconnect errors
      }
    }
    this.resetToIdle('Direct source connected');
  }

  public resetDecoder() {
    this.resetToIdle('Manual reset');
  }

  public getAnalyser(): AnalyserNode | null {
    return this.analyserNode;
  }

  private setupAudioGraph() {
    if (!this.audioCtx) return;

    // Input gain node where all audio feeds merge
    this.inputGainNode = this.audioCtx.createGain();
    this.inputGainNode.gain.value = 1.0;

    // Analyser node for FFT and visualizer
    this.analyserNode = this.audioCtx.createAnalyser();
    this.analyserNode.fftSize = 2048;
    this.analyserNode.smoothingTimeConstant = 0.4;
    this.inputGainNode.connect(this.analyserNode);

    // Script processor for continuous sample stream
    const bufferSize = 1024;
    this.scriptNode = this.audioCtx.createScriptProcessor(bufferSize, 1, 1);
    this.inputGainNode.connect(this.scriptNode);

    // CRITICAL: Connect through a zero-gain node to audioCtx.destination
    // This is required by Web Audio specification so the browser's render thread
    // considers the ScriptProcessorNode active and continuously pulls onaudioprocess
    this.silentSinkNode = this.audioCtx.createGain();
    this.silentSinkNode.gain.value = 0.0;
    this.scriptNode.connect(this.silentSinkNode);
    this.silentSinkNode.connect(this.audioCtx.destination);

    this.scriptNode.onaudioprocess = (e) => {
      const channelData = e.inputBuffer.getChannelData(0);
      this.feedPcmChunk(channelData);
    };

    this.setState('idle');
  }

  public feedPcmChunk(chunk: Float32Array) {
    if (!this.audioCtx) return;
    const sampleRate = this.audioCtx.sampleRate || 48000;

    // Update RMS mic level
    let sumSq = 0;
    for (let i = 0; i < chunk.length; i++) {
      const s = chunk[i];
      sumSq += s * s;

      // Push into ring buffer
      this.ringBuffer[this.writeIndex] = s;
      this.writeIndex = (this.writeIndex + 1) % this.ringBuffer.length;
      this.totalReceivedSamples++;

      // Check tone detection every 256 samples (approx 5.3ms at 48kHz)
      if (this.totalReceivedSamples % 256 === 0) {
        this.stepDemodulator(sampleRate);
      }
    }

    const rms = Math.sqrt(sumSq / chunk.length);
    const micLevel = Math.min(1, rms * 5);

    // Compute metrics
    const win = this.getRecentWindow(512);
    const pA = goertzelPower(win, this.profile.syncFreq1, sampleRate);
    const pB = goertzelPower(win, this.profile.syncFreq2, sampleRate);
    const pM = goertzelPower(win, this.profile.markFreq, sampleRate);
    const pS = goertzelPower(win, this.profile.spaceFreq, sampleRate);

    const maxTone = Math.max(pA, pB, pM, pS);
    const snr = maxTone / Math.max(1e-9, this.noiseFloor);
    const snrDb = Math.max(0, Math.round(10 * Math.log10(Math.max(1, snr))));

    let dominantFreq = 0;
    let activeTone = 'None';
    if (maxTone === pA) { dominantFreq = this.profile.syncFreq1; activeTone = 'Sync 1 (Tone A)'; }
    else if (maxTone === pB) { dominantFreq = this.profile.syncFreq2; activeTone = 'Sync 2 (Tone B)'; }
    else if (maxTone === pM) { dominantFreq = this.profile.markFreq; activeTone = 'Mark 1'; }
    else if (maxTone === pS) { dominantFreq = this.profile.spaceFreq; activeTone = 'Space 0'; }

    this.callbacks.onMetricsUpdate({
      micLevel,
      snrDb,
      dominantFreq,
      state: this.state,
      activeTone,
    });
  }

  private getRecentWindow(windowSize = 512, offsetSamplesFromNow = 0): Float32Array {
    const out = new Float32Array(windowSize);
    const len = this.ringBuffer.length;
    const start = (this.writeIndex - windowSize - offsetSamplesFromNow + len * 2) % len;
    for (let i = 0; i < windowSize; i++) {
      out[i] = this.ringBuffer[(start + i) % len];
    }
    return out;
  }

  private setState(newState: ModemState) {
    if (this.state !== newState) {
      this.state = newState;
      this.stateStartTime = Date.now();
      this.callbacks.onStateChange(newState);
    }
  }

  private stepDemodulator(sampleRate: number) {
    if (this.totalReceivedSamples < this.ignoreUntilSample) {
      return;
    }

    const win = this.getRecentWindow(512);
    const pA = goertzelPower(win, this.profile.syncFreq1, sampleRate);
    const pB = goertzelPower(win, this.profile.syncFreq2, sampleRate);
    const pM = goertzelPower(win, this.profile.markFreq, sampleRate);
    const pS = goertzelPower(win, this.profile.spaceFreq, sampleRate);

    // Track baseline noise floor
    const baseline = (pA + pB + pM + pS) * 0.25;
    if (this.state === 'idle') {
      this.noiseFloor = this.noiseFloor * 0.98 + baseline * 0.02;
    }

    const threshold = Math.max(0.00005, this.noiseFloor * this.sensitivityMultiplier);
    const now = Date.now();

    // 1. IDLE / READY: Listening for Tone A
    if (this.state === 'idle' || this.state === 'packet_received' || this.state === 'error') {
      if (pA > threshold && pA > pB * 1.5 && pA > pM * 1.3 && pA > pS * 1.3) {
        this.pilotACount++;
        if (this.pilotACount >= 5) { // Tone A heard for ~26ms
          this.setState('detecting_preamble');
          this.pilotBCount = 0;
        }
      } else {
        this.pilotACount = Math.max(0, this.pilotACount - 1);
      }
    }

    // 2. DETECTING_PREAMBLE: Heard Tone A, waiting for Tone B
    else if (this.state === 'detecting_preamble') {
      if (now - this.stateStartTime > 800) {
        this.resetToIdle('Tone B timeout');
        return;
      }

      if (pB > threshold && pB > pA * 1.4) {
        this.pilotBCount++;
        if (this.pilotBCount >= 4) { // Tone B heard
          this.setState('synced');
          this.toneBStartSample = this.totalReceivedSamples;
          this.peakB = pB;
        }
      }
    }

    // 3. SYNCED: Tone B is active (duration ~200ms).
    // Transition to data when Tone B finishes and symbol 0 begins.
    else if (this.state === 'synced') {
      if (pB > this.peakB) this.peakB = pB;

      if (now - this.stateStartTime > 700) {
        this.resetToIdle('Tone B too long');
        return;
      }

      const elapsedToneBSamples = this.totalReceivedSamples - this.toneBStartSample;
      const minToneBSamples = Math.round(0.130 * sampleRate); // At least 130ms into Tone B
      const maxToneBSamples = Math.round(0.220 * sampleRate); // Max 220ms

      if (elapsedToneBSamples >= minToneBSamples) {
        // Look for Tone B power collapse or Mark/Space start
        const isToneBEnd =
          pB < this.peakB * 0.45 ||
          (pM > pB * 1.3 && pM > threshold) ||
          (pS > pB * 1.3 && pS > threshold) ||
          elapsedToneBSamples >= maxToneBSamples;

        if (isToneBEnd) {
          this.setState('receiving_data');
          this.bitClockStart = this.totalReceivedSamples;
          // Center of the first data symbol
          this.nextBitSample = this.totalReceivedSamples + Math.round(this.samplesPerSymbol * 0.5);
          this.receivedBits = [];
          this.receivedBytes = [];
          this.expectedLength = 0;
          this.packetStartTime = Date.now();
          this.snrHistory = [];
        }
      }
    }

    // 4. RECEIVING_DATA: Sample bits at the center of each symbol
    else if (this.state === 'receiving_data') {
      if (now - this.stateStartTime > 25000) {
        this.resetToIdle('Packet receive timeout');
        return;
      }

      while (this.totalReceivedSamples >= this.nextBitSample) {
        const offset = this.totalReceivedSamples - this.nextBitSample;
        // Use optimal window for symbol integration (~60% of symbol duration)
        const winSize = Math.min(1024, Math.max(256, Math.floor(this.samplesPerSymbol * 0.65)));
        const bitWin = this.getRecentWindow(winSize, offset);
        const m = goertzelPower(bitWin, this.profile.markFreq, sampleRate);
        const s = goertzelPower(bitWin, this.profile.spaceFreq, sampleRate);

        const bit = m >= s ? 1 : 0;
        this.receivedBits.push(bit);

        const currentTonePower = Math.max(m, s);
        const snr = currentTonePower / Math.max(1e-9, this.noiseFloor);
        this.snrHistory.push(Math.round(10 * Math.log10(Math.max(1, snr))));

        if (this.callbacks.onBitDetected) {
          this.callbacks.onBitDetected(bit, this.receivedBits.length);
        }

        // Advance to next symbol midpoint
        this.nextBitSample += this.samplesPerSymbol;

        // Check if an 8-bit byte is completed
        if (this.receivedBits.length % 8 === 0) {
          const byteBits = this.receivedBits.slice(-8);
          let byteVal = 0;
          for (let b = 0; b < 8; b++) {
            if (byteBits[b]) byteVal |= (1 << (7 - b));
          }
          this.receivedBytes.push(byteVal);

          const byteIndex = this.receivedBytes.length - 1;

          // Byte 0: SFD (0xAB) - allow Hamming distance <= 1 for acoustic noise resilience
          if (byteIndex === 0) {
            const dist = hammingDistance(byteVal, SFD_BYTE);
            if (dist > 1) {
              this.resetToIdle(`SFD mismatch: 0x${byteVal.toString(16).toUpperCase()} (dist=${dist})`);
              return;
            }
          }
          // Byte 1: Length byte (supports 1 up to 255 bytes payload)
          else if (byteIndex === 1) {
            this.expectedLength = byteVal;
            if (this.expectedLength <= 0 || this.expectedLength > 255) {
              this.resetToIdle(`Invalid length: ${this.expectedLength}`);
              return;
            }
          }
          // All bytes received: SFD (1) + Length (1) + Payload (L) + CRC (1)
          else if (this.expectedLength > 0 && byteIndex === 1 + this.expectedLength + 1) {
            this.finalizePacket();
            return;
          }
        }
      }
    }
  }

  private finalizePacket() {
    const payloadBytes = this.receivedBytes.slice(2, 2 + this.expectedLength);
    const expectedCrc = this.receivedBytes[2 + this.expectedLength];
    const calculatedCrc = calculateCRC8([this.expectedLength, ...payloadBytes]);
    const isValidCrc = calculatedCrc === expectedCrc;

    let rawText = '';
    try {
      const decoder = new TextDecoder('utf-8', { fatal: false });
      rawText = decoder.decode(new Uint8Array(payloadBytes));
    } catch {
      rawText = String.fromCharCode(...payloadBytes);
    }

    const avgSnr =
      this.snrHistory.length > 0
        ? Math.round(this.snrHistory.reduce((a, b) => a + b, 0) / this.snrHistory.length)
        : 16;

    const packet: ReceivedPacket = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date(),
      rawText,
      rawBytes: payloadBytes,
      length: payloadBytes.length,
      expectedCrc,
      calculatedCrc,
      isValidCrc,
      profileId: this.profile.id,
      snrDb: avgSnr,
      durationMs: Date.now() - this.packetStartTime,
    };

    this.setState('packet_received');
    this.callbacks.onPacketReceived(packet);

    // Cooldown: ignore triggers for 300ms to avoid re-triggering on the stop tone
    if (this.audioCtx) {
      this.ignoreUntilSample = this.totalReceivedSamples + Math.round(0.3 * this.audioCtx.sampleRate);
    }

    setTimeout(() => {
      this.resetToIdle('Packet complete');
    }, 1200);
  }

  private resetToIdle(reason?: string) {
    this.pilotACount = 0;
    this.pilotBCount = 0;
    this.toneBStartSample = 0;
    this.peakB = 0;
    this.receivedBits = [];
    this.receivedBytes = [];
    this.expectedLength = 0;
    this.setState('idle');
  }

  public stop() {
    if (this.scriptNode) {
      this.scriptNode.onaudioprocess = null;
      this.scriptNode.disconnect();
      this.scriptNode = null;
    }
    if (this.silentSinkNode) {
      this.silentSinkNode.disconnect();
      this.silentSinkNode = null;
    }
    if (this.inputGainNode) {
      this.inputGainNode.disconnect();
      this.inputGainNode = null;
    }
    if (this.analyserNode) {
      this.analyserNode.disconnect();
      this.analyserNode = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
    this.connectedSources.clear();
    this.setState('idle');
  }
}
