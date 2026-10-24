import { FrequencyProfile, SpeedPreset } from '../types/modem';

export const PROFILES: Record<string, FrequencyProfile> = {
  audible: {
    id: 'audible',
    name: 'Audible Voice-Band',
    description: '1.0 kHz – 2.5 kHz range. Highly robust, immune to ambient low-frequency rumble, audible verification.',
    tag: 'Recommended for Testing',
    markFreq: 2000,
    spaceFreq: 1500,
    syncFreq1: 2500,
    syncFreq2: 1200,
    isInaudible: false,
    recommendedDurationMs: 60,
  },
  ultrasonic: {
    id: 'ultrasonic',
    name: 'Ultrasonic / Covert Air-Gap',
    description: '16.5 kHz – 19.8 kHz range. Near-silent to human ears. Perfect for silent data transfer between devices.',
    tag: 'Silent Air-Gap',
    markFreq: 18800,
    spaceFreq: 17600,
    syncFreq1: 19800,
    syncFreq2: 16500,
    isInaudible: true,
    recommendedDurationMs: 60,
  },
  retro: {
    id: 'retro',
    name: 'Acoustic Coupler Modem',
    description: '0.9 kHz – 2.2 kHz classic acoustic modem sounds reminiscent of 1980s telephone couplers.',
    tag: 'Vintage Audio Tone',
    markFreq: 1800,
    spaceFreq: 1300,
    syncFreq1: 2200,
    syncFreq2: 900,
    isInaudible: false,
    recommendedDurationMs: 80,
  },
};

export const SPEED_PRESETS: SpeedPreset[] = [
  {
    id: 'robust',
    name: 'Robust (Long Range / Noise)',
    symbolDurationMs: 90,
    baudRate: Math.round(1000 / 90),
    description: 'Longer symbol window resists room reverb, echoes, and background noise.',
  },
  {
    id: 'standard',
    name: 'Standard (Balanced)',
    symbolDurationMs: 60,
    baudRate: Math.round(1000 / 60),
    description: 'Optimal balance of transmission speed and acoustic decoding accuracy.',
  },
  {
    id: 'fast',
    name: 'Fast (Close Range)',
    symbolDurationMs: 35,
    baudRate: Math.round(1000 / 35),
    description: 'Fastest bit transfer rate for low-noise environments within 1-2 meters.',
  },
];

export interface PresetCommand {
  label: string;
  command: string;
  category: 'system' | 'control' | 'telemetry';
  description: string;
}

export const COMMAND_PRESETS: PresetCommand[] = [
  {
    label: 'PING',
    command: 'PING',
    category: 'system',
    description: 'Acoustic link round-trip diagnostic test',
  },
  {
    label: 'SYS:STATUS',
    command: 'SYS:STATUS',
    category: 'system',
    description: 'Requests status of virtual relays, LEDs, and modem state',
  },
  {
    label: 'SYS:TIME',
    command: 'SYS:TIME',
    category: 'system',
    description: 'Requests synchronized system timestamp',
  },
  {
    label: 'RELAY 1: ON',
    command: 'RELAY:1:ON',
    category: 'control',
    description: 'Energizes air-gapped Virtual Relay #1',
  },
  {
    label: 'RELAY 1: OFF',
    command: 'RELAY:1:OFF',
    category: 'control',
    description: 'De-energizes air-gapped Virtual Relay #1',
  },
  {
    label: 'LED: ON',
    command: 'LED:ON',
    category: 'control',
    description: 'Activates virtual optical beacon LED',
  },
  {
    label: 'ALERT BEACON',
    command: 'ALERT',
    category: 'control',
    description: 'Triggers emergency priority acoustic alarm state',
  },
  {
    label: 'ECHO TEST',
    command: 'ECHO Acoustic link 100% operational',
    category: 'telemetry',
    description: 'Echo back transmitted text payload',
  },
  {
    label: 'AUTH TOKEN',
    command: 'AUTH: #8834_DELTA',
    category: 'telemetry',
    description: 'Transmit air-gap authentication key',
  },
];

export const PRESET_MESSAGES = COMMAND_PRESETS.map((c) => ({
  label: c.label,
  text: c.command,
}));
