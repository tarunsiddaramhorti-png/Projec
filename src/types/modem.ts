/**
 * Type definitions for AeroTone acoustic data modem
 */

export interface FrequencyProfile {
  id: 'audible' | 'ultrasonic' | 'retro';
  name: string;
  description: string;
  tag: string;
  markFreq: number;       // Logic 1
  spaceFreq: number;      // Logic 0
  syncFreq1: number;      // Preamble tone A
  syncFreq2: number;      // Preamble tone B
  isInaudible: boolean;
  recommendedDurationMs: number;
}

export interface SpeedPreset {
  id: 'robust' | 'standard' | 'fast';
  name: string;
  symbolDurationMs: number;
  baudRate: number;
  description: string;
}

export type ModemState =
  | 'idle'
  | 'detecting_preamble'
  | 'synced'
  | 'receiving_data'
  | 'packet_received'
  | 'error';

export interface CommandExecutionResult {
  command: string;
  isRecognized: boolean;
  response: string;
  executedAt: Date;
  status: 'success' | 'warning' | 'info';
  stateChange?: {
    relay1?: boolean;
    relay2?: boolean;
    led?: boolean;
    beacon?: boolean;
  };
}

export interface ReceivedPacket {
  id: string;
  timestamp: Date;
  rawText: string;
  rawBytes: number[];
  length: number;
  expectedCrc: number;
  calculatedCrc: number;
  isValidCrc: boolean;
  profileId: string;
  snrDb: number;
  durationMs: number;
  commandResult?: CommandExecutionResult;
}

export interface TransmissionProgress {
  isTransmitting: boolean;
  currentBitIndex: number;
  totalBits: number;
  percentage: number;
  activeFrequency: number;
  currentPhase: 'idle' | 'preamble' | 'sfd' | 'payload' | 'crc' | 'stop' | 'complete';
}

export interface AudioSignalMetrics {
  micLevel: number;        // 0 to 1
  snrDb: number;           // estimated Signal-to-Noise Ratio
  peakFrequency: number;   // dominant frequency detected in Hz
  noiseFloor: number;      // background ambient noise level
  isCarrierPresent: boolean;
}
