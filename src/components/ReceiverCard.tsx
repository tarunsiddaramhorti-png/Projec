import React, { useState } from 'react';
import { ModemState, ReceivedPacket } from '../types/modem';
import { SystemHardwareState } from '../utils/commandProcessor';
import {
  Mic,
  MicOff,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Trash2,
  ArrowDownRight,
  Clock,
  ShieldCheck,
  PlayCircle,
  Sliders,
  Terminal,
  Zap,
  Volume2,
  VolumeX,
} from 'lucide-react';

interface ReceiverCardProps {
  isListening: boolean;
  onToggleListening: () => void;
  modemState: ModemState;
  micLevel: number;
  snrDb: number;
  dominantFreq: number;
  activeTone: string;
  receivedPackets: ReceivedPacket[];
  onClearPackets: () => void;
  onSelectPacketForInspection: (packet: ReceivedPacket) => void;
  onRunDecoderTest?: () => void;
  onSensitivityChange?: (level: 'high' | 'medium' | 'low') => void;
  hardwareState?: SystemHardwareState;
  soundChimeEnabled?: boolean;
  onToggleSoundChime?: () => void;
}

export const ReceiverCard: React.FC<ReceiverCardProps> = ({
  isListening,
  onToggleListening,
  modemState,
  micLevel,
  snrDb,
  dominantFreq,
  activeTone,
  receivedPackets,
  onClearPackets,
  onSelectPacketForInspection,
  onRunDecoderTest,
  onSensitivityChange,
  hardwareState = { relay1: false, relay2: false, ledActive: false, alarmActive: false },
  soundChimeEnabled = true,
  onToggleSoundChime,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sensitivity, setSensitivity] = useState<'high' | 'medium' | 'low'>('medium');

  const handleCopy = (packet: ReceivedPacket) => {
    navigator.clipboard.writeText(packet.rawText);
    setCopiedId(packet.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSetSensitivity = (level: 'high' | 'medium' | 'low') => {
    setSensitivity(level);
    if (onSensitivityChange) onSensitivityChange(level);
  };

  const getStateLabel = (state: ModemState) => {
    switch (state) {
      case 'idle':
        return { text: 'LISTENING FOR AUDIO TONES', color: 'text-slate-400 bg-slate-800' };
      case 'detecting_preamble':
        return { text: 'PILOT TONE A DETECTED · WAITING B', color: 'text-amber-400 bg-amber-950/80 animate-pulse' };
      case 'synced':
        return { text: 'PILOT TONE B LOCKED · AWAITING BITS', color: 'text-cyan-400 bg-cyan-950/80 font-bold' };
      case 'receiving_data':
        return { text: 'DEMODULATING PAYLOAD BITS (FSK)', color: 'text-sky-400 bg-sky-950/90 animate-pulse' };
      case 'packet_received':
        return { text: 'PACKET DECODED & VERIFIED (CRC OK)', color: 'text-emerald-400 bg-emerald-950/90 font-bold' };
      case 'error':
        return { text: 'FRAME RECEPTION ERROR', color: 'text-rose-400 bg-rose-950/80' };
    }
  };

  const stateInfo = getStateLabel(modemState);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div
              className={`p-2 rounded-lg ${
                isListening ? 'bg-emerald-500/10 text-emerald-400 animate-pulse' : 'bg-slate-800 text-slate-400'
              }`}
            >
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                Receiver & Command Engine
              </h2>
              <p className="text-xs text-slate-400">
                Captures acoustic tones, locks clock, demodulates FSK, and executes commands
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onToggleSoundChime && (
              <button
                type="button"
                onClick={onToggleSoundChime}
                className={`p-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${
                  soundChimeEnabled
                    ? 'bg-slate-800 border-slate-700 text-sky-400'
                    : 'bg-slate-950 border-slate-800 text-slate-500'
                }`}
                title={soundChimeEnabled ? 'Decode Audio Chime: ON' : 'Decode Audio Chime: OFF'}
              >
                {soundChimeEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              </button>
            )}

            {onRunDecoderTest && (
              <button
                onClick={onRunDecoderTest}
                className="py-1.5 px-2.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Runs an instant test packet (PING) through the demodulator"
              >
                <PlayCircle className="w-3.5 h-3.5 text-sky-400" />
                <span className="hidden sm:inline">Test Decoder</span>
              </button>
            )}

            <button
              onClick={onToggleListening}
              className={`py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                isListening
                  ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow'
              }`}
            >
              {isListening ? (
                <>
                  <MicOff className="w-3.5 h-3.5" /> Stop Mic
                </>
              ) : (
                <>
                  <Mic className="w-3.5 h-3.5" /> Start Mic
                </>
              )}
            </button>
          </div>
        </div>

        {/* Real-time Status / Signal Meters */}
        <div className="mt-4 p-3 bg-slate-950 border border-slate-800/80 rounded-lg space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Demodulator State</span>
            <span className={`text-[11px] font-mono px-2 py-0.5 rounded border border-slate-700/50 ${stateInfo.color}`}>
              {stateInfo.text}
            </span>
          </div>

          {/* VU / Mic Level & SNR */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                <span>Mic / Input Level</span>
                <span className="font-mono">{Math.round(micLevel * 100)}%</span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-75 ${
                    micLevel > 0.85 ? 'bg-rose-500' : micLevel > 0.6 ? 'bg-amber-400' : 'bg-emerald-400'
                  }`}
                  style={{ width: `${Math.min(100, micLevel * 100)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                <span>Signal SNR</span>
                <span className="font-mono text-sky-400">{snrDb} dB</span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-sky-400 transition-all duration-100"
                  style={{ width: `${Math.min(100, (snrDb / 30) * 100)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-1 border-t border-slate-900">
            <span>Carrier: {dominantFreq > 0 ? `${dominantFreq} Hz` : 'Quiet'}</span>
            <span className="text-slate-300">Active Tone: {activeTone}</span>
          </div>

          {/* Squelch Sensitivity Adjuster */}
          <div className="flex items-center justify-between pt-1 border-t border-slate-900 text-[11px]">
            <span className="text-slate-400 flex items-center gap-1">
              <Sliders className="w-3 h-3 text-slate-500" />
              Squelch Sensitivity:
            </span>
            <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded border border-slate-800">
              {(['high', 'medium', 'low'] as const).map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => handleSetSensitivity(lvl)}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium capitalize transition-colors cursor-pointer ${
                    sensitivity === lvl
                      ? 'bg-sky-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Virtual Hardware Relay / LED Control Board (Updated by Decoded Commands!) */}
        <div className="mt-3 p-2.5 bg-slate-950/80 border border-slate-800 rounded-lg">
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-400" />
              Air-Gapped Device Control State (Controlled via Audio)
            </span>
            <span className="text-slate-500">Live</span>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center text-xs font-mono">
            <div
              className={`p-1.5 rounded border ${
                hardwareState.relay1
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 font-bold'
                  : 'bg-slate-900 border-slate-800 text-slate-500'
              }`}
            >
              <div className="text-[9px]">RELAY #1</div>
              <div>{hardwareState.relay1 ? 'ACTIVE (ON)' : 'OPEN (OFF)'}</div>
            </div>
            <div
              className={`p-1.5 rounded border ${
                hardwareState.relay2
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 font-bold'
                  : 'bg-slate-900 border-slate-800 text-slate-500'
              }`}
            >
              <div className="text-[9px]">RELAY #2</div>
              <div>{hardwareState.relay2 ? 'ACTIVE (ON)' : 'OPEN (OFF)'}</div>
            </div>
            <div
              className={`p-1.5 rounded border ${
                hardwareState.ledActive
                  ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 font-bold'
                  : 'bg-slate-900 border-slate-800 text-slate-500'
              }`}
            >
              <div className="text-[9px]">OPTICAL LED</div>
              <div>{hardwareState.ledActive ? 'LIT (ON)' : 'OFF'}</div>
            </div>
            <div
              className={`p-1.5 rounded border ${
                hardwareState.alarmActive
                  ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 font-bold animate-pulse'
                  : 'bg-slate-900 border-slate-800 text-slate-500'
              }`}
            >
              <div className="text-[9px]">SIREN BEACON</div>
              <div>{hardwareState.alarmActive ? 'ALARM ACTIVE' : 'STANDBY'}</div>
            </div>
          </div>
        </div>

        {/* Decoded Packets & Command Execution Terminal */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <ArrowDownRight className="w-3.5 h-3.5 text-sky-400" />
              Decoded Signals & Commands ({receivedPackets.length})
            </h3>
            {receivedPackets.length > 0 && (
              <button
                onClick={onClearPackets}
                className="text-[11px] text-slate-500 hover:text-rose-400 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                Clear
              </button>
            )}
          </div>

          {receivedPackets.length === 0 ? (
            <div className="p-6 border border-dashed border-slate-800 rounded-lg text-center">
              <p className="text-xs text-slate-300 font-medium mb-1">No audio data decoded yet</p>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Type any command (e.g. <span className="text-sky-300 font-mono">PING</span> or <span className="text-amber-300 font-mono">SYS:STATUS</span>) on the left and click <strong className="text-sky-400">"Produce & Transmit Signal"</strong>.<br />
                With <strong className="text-amber-300 font-mono">Auto-Decode ON</strong>, the acoustic signal will produce and decode instantaneously!
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
              {receivedPackets.map((pkt) => (
                <div
                  key={pkt.id}
                  className="p-3 bg-slate-950 border border-slate-800 rounded-lg hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      {pkt.isValidCrc ? (
                        <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>CRC-8 PASS</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-[11px] font-medium text-rose-400">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>CRC FAIL</span>
                        </div>
                      )}
                      <span className="text-[11px] font-mono text-slate-500">
                        {pkt.length} bytes · {pkt.snrDb}dB SNR
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleCopy(pkt)}
                        className="p-1 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                        title="Copy message"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onSelectPacketForInspection(pkt)}
                        className="text-[10px] text-sky-400 hover:text-sky-300 font-mono underline cursor-pointer"
                      >
                        Inspect
                      </button>
                    </div>
                  </div>

                  {/* Decoded Command / Message Text */}
                  <div className="font-mono text-sm text-slate-100 bg-slate-900/70 p-2 rounded border border-slate-800/70 break-all select-all flex items-center justify-between gap-2">
                    <span>{pkt.rawText || '<empty/corrupt payload>'}</span>
                    <span className="text-[10px] text-slate-500 uppercase shrink-0 font-sans">
                      Raw Payload
                    </span>
                  </div>

                  {/* Executed Command Result Response */}
                  {pkt.commandResult && (
                    <div className="mt-2 p-2 bg-slate-900/90 rounded border border-sky-500/20 text-xs font-mono">
                      <div className="flex items-center gap-1.5 text-sky-300 font-semibold mb-0.5 text-[11px]">
                        <Terminal className="w-3 h-3 text-sky-400" />
                        <span>Command Execution Output:</span>
                      </div>
                      <div className="text-emerald-400 text-xs break-all">
                        {pkt.commandResult.response}
                      </div>
                    </div>
                  )}

                  <div className="mt-1.5 flex items-center justify-between text-[10px] font-mono text-slate-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {pkt.timestamp.toLocaleTimeString()}
                    </span>
                    <span>CRC: 0x{pkt.expectedCrc.toString(16).toUpperCase()}</span>
                    <span>Dur: {(pkt.durationMs / 1000).toFixed(1)}s</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-slate-500 flex items-center justify-between">
        <span className="flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
          Acoustic Air-Gap Isolation
        </span>
        <span>Continuous Phase FSK & CRC-8 Dallas/Maxim</span>
      </div>
    </div>
  );
};
