/**
 * Command Processor for AeroTone Acoustic Modem
 * Parses incoming acoustic packets as commands and executes actions
 */

import { CommandExecutionResult } from '../types/modem';

export interface SystemHardwareState {
  relay1: boolean;
  relay2: boolean;
  ledActive: boolean;
  alarmActive: boolean;
}

export function executeAcousticCommand(
  rawText: string,
  currentState: SystemHardwareState,
  snrDb = 18,
  durationMs = 0
): { result: CommandExecutionResult; nextState: SystemHardwareState } {
  const trimmed = rawText.trim();
  const upper = trimmed.toUpperCase();
  const nextState = { ...currentState };

  // 1. PING
  if (upper === 'PING' || upper.startsWith('PING ') || upper.startsWith('PING:')) {
    return {
      result: {
        command: trimmed,
        isRecognized: true,
        response: `PONG [Acoustic Link OK · SNR: ${snrDb} dB · Transmit Time: ${(durationMs / 1000).toFixed(1)}s]`,
        executedAt: new Date(),
        status: 'success',
      },
      nextState,
    };
  }

  // 2. SYSTEM STATUS
  if (upper === 'STATUS' || upper === 'SYS:STATUS' || upper === 'SYSTEM:STATUS' || upper === 'CMD::STATUS_OK') {
    return {
      result: {
        command: trimmed,
        isRecognized: true,
        response: `SYSTEM NOMINAL · Relay 1: ${currentState.relay1 ? 'ON' : 'OFF'} · Relay 2: ${currentState.relay2 ? 'ON' : 'OFF'} · LED: ${currentState.ledActive ? 'ON' : 'OFF'} · Carrier: LOCKED`,
        executedAt: new Date(),
        status: 'success',
      },
      nextState,
    };
  }

  // 3. SYSTEM TIME
  if (upper === 'TIME' || upper === 'SYS:TIME' || upper === 'DATE') {
    return {
      result: {
        command: trimmed,
        isRecognized: true,
        response: `SYSTEM CLOCK: ${new Date().toISOString()} · Synchronized`,
        executedAt: new Date(),
        status: 'info',
      },
      nextState,
    };
  }

  // 4. SYSTEM INFO
  if (upper === 'INFO' || upper === 'SYS:INFO' || upper === 'VERSION') {
    return {
      result: {
        command: trimmed,
        isRecognized: true,
        response: `AeroTone Acoustic Modem v2.4 · CPFSK Modulation · CRC-8 Dallas/Maxim · Sample-Accurate Goertzel Filter`,
        executedAt: new Date(),
        status: 'info',
      },
      nextState,
    };
  }

  // 5. RELAYS
  if (upper === 'RELAY:1:ON' || upper === 'RELAY:ON' || upper === 'RELAY 1 ON') {
    nextState.relay1 = true;
    return {
      result: {
        command: trimmed,
        isRecognized: true,
        response: `RELAY 1 ENERGIZED [STATE: CLOSED / ON]`,
        executedAt: new Date(),
        status: 'success',
        stateChange: { relay1: true },
      },
      nextState,
    };
  }

  if (upper === 'RELAY:1:OFF' || upper === 'RELAY:OFF' || upper === 'RELAY 1 OFF') {
    nextState.relay1 = false;
    return {
      result: {
        command: trimmed,
        isRecognized: true,
        response: `RELAY 1 DE-ENERGIZED [STATE: OPEN / OFF]`,
        executedAt: new Date(),
        status: 'success',
        stateChange: { relay1: false },
      },
      nextState,
    };
  }

  if (upper === 'RELAY:2:ON' || upper === 'RELAY 2 ON') {
    nextState.relay2 = true;
    return {
      result: {
        command: trimmed,
        isRecognized: true,
        response: `RELAY 2 ENERGIZED [STATE: CLOSED / ON]`,
        executedAt: new Date(),
        status: 'success',
        stateChange: { relay2: true },
      },
      nextState,
    };
  }

  if (upper === 'RELAY:2:OFF' || upper === 'RELAY 2 OFF') {
    nextState.relay2 = false;
    return {
      result: {
        command: trimmed,
        isRecognized: true,
        response: `RELAY 2 DE-ENERGIZED [STATE: OPEN / OFF]`,
        executedAt: new Date(),
        status: 'success',
        stateChange: { relay2: false },
      },
      nextState,
    };
  }

  // 6. LED
  if (upper === 'LED:ON' || upper === 'LIGHT:ON') {
    nextState.ledActive = true;
    return {
      result: {
        command: trimmed,
        isRecognized: true,
        response: `OPTICAL LED BEACON: ACTIVATED (STEADY)`,
        executedAt: new Date(),
        status: 'success',
        stateChange: { led: true },
      },
      nextState,
    };
  }

  if (upper === 'LED:OFF' || upper === 'LIGHT:OFF') {
    nextState.ledActive = false;
    return {
      result: {
        command: trimmed,
        isRecognized: true,
        response: `OPTICAL LED BEACON: DEACTIVATED`,
        executedAt: new Date(),
        status: 'success',
        stateChange: { led: false },
      },
      nextState,
    };
  }

  // 7. ALARM / BEACON
  if (upper === 'ALERT' || upper === 'ALARM' || upper === 'BEEP' || upper === 'ALERT:ON') {
    nextState.alarmActive = true;
    return {
      result: {
        command: trimmed,
        isRecognized: true,
        response: `ACOUSTIC SIREN BEACON TRIGGERED · Priority Alert Active`,
        executedAt: new Date(),
        status: 'warning',
        stateChange: { beacon: true },
      },
      nextState,
    };
  }

  if (upper === 'ALERT:OFF' || upper === 'ALARM:OFF') {
    nextState.alarmActive = false;
    return {
      result: {
        command: trimmed,
        isRecognized: true,
        response: `ACOUSTIC SIREN BEACON SILENCED · Standby Mode`,
        executedAt: new Date(),
        status: 'info',
        stateChange: { beacon: false },
      },
      nextState,
    };
  }

  // 8. ECHO
  if (upper.startsWith('ECHO ') || upper.startsWith('ECHO:')) {
    const textToEcho = trimmed.substring(trimmed.indexOf(trimmed.includes(':') ? ':' : ' ') + 1).trim();
    return {
      result: {
        command: trimmed,
        isRecognized: true,
        response: `ECHO RESPONSE: "${textToEcho}"`,
        executedAt: new Date(),
        status: 'info',
      },
      nextState,
    };
  }

  // 9. HELP
  if (upper === 'HELP' || upper === '?') {
    return {
      result: {
        command: trimmed,
        isRecognized: true,
        response: `COMMANDS: PING · STATUS · TIME · INFO · RELAY:1:ON|OFF · RELAY:2:ON|OFF · LED:ON|OFF · ALERT:ON|OFF · ECHO <msg>`,
        executedAt: new Date(),
        status: 'info',
      },
      nextState,
    };
  }

  // 10. General Text or Custom Command Payload
  return {
    result: {
      command: trimmed,
      isRecognized: false,
      response: `PAYLOAD RECEIVED & VERIFIED: "${trimmed.length > 50 ? trimmed.substring(0, 47) + '...' : trimmed}" · Saved to buffer`,
      executedAt: new Date(),
      status: 'info',
    },
    nextState,
  };
}
