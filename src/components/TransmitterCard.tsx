import React, { useState, useMemo } from 'react';
import { FrequencyProfile, SpeedPreset, TransmissionProgress } from '../types/modem';
import { COMMAND_PRESETS } from '../utils/modemConfig';
import { stringToBytes, calculateCRC8, byteToHex } from '../utils/crc';
import {
  Radio,
  Play,
  Square,
  Download,
  Volume2,
  Terminal,
  Send,
  Binary,
  Layers,
  Sparkles,
  Zap,
} from 'lucide-react';

interface TransmitterCardProps {
  text: string;
  onTextChange: (text: string) => void;
  profile: FrequencyProfile;
  speed: SpeedPreset;
  volume: number;
  onVolumeChange: (vol: number) => void;
  progress: TransmissionProgress;
  onTransmit: () => void;
  onStop: () => void;
  onDownloadWav: () => void;
  isSimulatedLoopback: boolean;
  onToggleLoopback: (enabled: boolean) => void;
}

export const TransmitterCard: React.FC<TransmitterCardProps> = ({
  text,
  onTextChange,
  profile,
  speed,
  volume,
  onVolumeChange,
  progress,
  onTransmit,
  onStop,
  onDownloadWav,
  isSimulatedLoopback,
  onToggleLoopback,
}) => {
  const [showBitInspector, setShowBitInspector] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'system' | 'control' | 'telemetry'>('all');

  const byteData = useMemo(() => {
    const bytes = stringToBytes(text);
    const safeBytes = bytes.length > 255 ? bytes.slice(0, 255) : bytes;
    const len = safeBytes.length;
    const crc = calculateCRC8([len, ...safeBytes]);
    return {
      bytes: safeBytes,
      length: len,
      crc,
      hex: safeBytes.map(byteToHex),
      binary: safeBytes.map((b) => b.toString(2).padStart(8, '0')),
    };
  }, [text]);

  // Duration: Preamble (450ms) + (8 SFD + 8 Len + payload*8 + 8 CRC) * symbolMs + guard
  const estimatedSeconds = (
    (450 + (24 + byteData.length * 8) * speed.symbolDurationMs + 100) /
    1000
  ).toFixed(1);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!progress.isTransmitting && text.trim()) {
        onTransmit();
      }
    }
  };

  const filteredPresets = COMMAND_PRESETS.filter(
    (p) => selectedCategory === 'all' || p.category === selectedCategory
  );

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div
              className={`p-2 rounded-lg ${
                progress.isTransmitting ? 'bg-amber-500/20 text-amber-400 animate-pulse' : 'bg-sky-500/10 text-sky-400'
              }`}
            >
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                Command Transmitter (Audio Out)
              </h2>
              <p className="text-xs text-slate-400">
                Encodes any text or command into acoustic CPFSK audio signals
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <span
              className={`w-2 h-2 rounded-full ${
                progress.isTransmitting ? 'bg-amber-400 animate-ping' : 'bg-emerald-500'
              }`}
            />
            <span className="text-slate-300 font-mono text-[11px]">
              {progress.isTransmitting ? 'TRANSMITTING' : 'READY'}
            </span>
          </div>
        </div>

        {/* Input Bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-sky-400" />
              Type Command or Message:
            </label>
            <span className="text-[11px] font-mono text-slate-400">
              {byteData.length} bytes · Press <span className="text-sky-300 font-bold">Enter ↵</span> to transmit
            </span>
          </div>

          <div className="relative">
            <input
              type="text"
              value={text}
              onChange={(e) => onTextChange(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={progress.isTransmitting}
              placeholder="Type any command (e.g. PING, SYS:STATUS, RELAY:1:ON, or custom text)..."
              className="w-full bg-slate-950 border border-slate-700/80 focus:border-sky-500 rounded-lg py-2.5 pl-3 pr-24 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none transition-colors font-mono disabled:opacity-50"
            />
            <button
              onClick={onTransmit}
              disabled={!text.trim() || progress.isTransmitting}
              className="absolute right-1.5 top-1.5 bottom-1.5 px-3 bg-sky-500 hover:bg-sky-400 active:bg-sky-600 text-slate-950 font-semibold rounded text-xs flex items-center gap-1 transition-colors disabled:opacity-40 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              Send
            </button>
          </div>

          {/* Quick Command Category Selector & Preset Chips */}
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1.5 text-[11px]">
              <span className="text-slate-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" />
                Quick Commands:
              </span>
              <div className="flex gap-1 text-[10px]">
                {(['all', 'system', 'control', 'telemetry'] as const).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-1.5 py-0.5 rounded capitalize transition-colors cursor-pointer ${
                      selectedCategory === cat
                        ? 'bg-sky-500/20 text-sky-300 font-semibold'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
              {filteredPresets.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => onTextChange(preset.command)}
                  disabled={progress.isTransmitting}
                  title={preset.description}
                  className={`px-2 py-1 text-xs rounded border transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1 ${
                    text === preset.command
                      ? 'bg-sky-500/20 border-sky-500/50 text-sky-200 font-semibold'
                      : 'bg-slate-800/80 hover:bg-slate-700/80 border-slate-700/60 text-slate-300'
                  }`}
                >
                  <Zap className="w-2.5 h-2.5 text-amber-400" />
                  <span>{preset.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Binary & Frame Signal Inspector Toggle */}
        <div className="mt-3 pt-2.5 border-t border-slate-800/70">
          <button
            type="button"
            onClick={() => setShowBitInspector(!showBitInspector)}
            className="text-[11px] font-mono text-slate-400 hover:text-sky-300 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Binary className="w-3.5 h-3.5 text-sky-400" />
            <span>{showBitInspector ? 'Hide Signal Bitstream' : 'View Generated Signal Bits & Frame'}</span>
            <span className="text-[10px] text-slate-500">
              ({byteData.length * 8} payload bits · CRC: 0x{byteToHex(byteData.crc)})
            </span>
          </button>

          {showBitInspector && (
            <div className="mt-2 p-2.5 bg-slate-950 rounded-lg border border-slate-800 space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Physical Frame:</span>
                <span className="text-emerald-400">
                  Preamble → SFD(0xAB) → Len({byteData.length}) → Data → CRC-8(0x{byteToHex(byteData.crc)})
                </span>
              </div>
              <div className="max-h-20 overflow-y-auto text-[11px] text-slate-300 break-all bg-slate-900/60 p-2 rounded border border-slate-800">
                <span className="text-amber-400">[SFD: 10101011]</span>{' '}
                <span className="text-cyan-400">[LEN: {byteData.length.toString(2).padStart(8, '0')}]</span>{' '}
                <span className="text-slate-200">{byteData.binary.join(' ')}</span>{' '}
                <span className="text-emerald-400">[CRC: {byteData.crc.toString(2).padStart(8, '0')}]</span>
              </div>
            </div>
          )}
        </div>

        {/* Transmission Settings & Volume */}
        <div className="mt-3 pt-3 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="flex items-center gap-1">
                <Volume2 className="w-3.5 h-3.5" />
                Audio Output Volume
              </span>
              <span className="font-mono text-slate-300">{Math.round(volume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={volume}
              onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
              disabled={progress.isTransmitting}
              className="w-full accent-sky-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>

          <div className="flex flex-col justify-center">
            <div className="text-slate-400 mb-0.5">Signal Duration</div>
            <div className="font-mono text-slate-200">
              ~{estimatedSeconds}s <span className="text-slate-500">(@ {speed.baudRate} baud, {speed.symbolDurationMs}ms/sym)</span>
            </div>
          </div>
        </div>

        {/* Real-time Progress Bar During Transmission */}
        {progress.isTransmitting && (
          <div className="mt-4 p-3 bg-slate-950 border border-amber-500/40 rounded-lg">
            <div className="flex items-center justify-between text-xs mb-1.5 font-mono">
              <span className="text-amber-400 uppercase tracking-wider font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                Phase: {progress.currentPhase}
              </span>
              <span className="text-emerald-400 font-bold">
                {progress.activeFrequency > 0 ? `${progress.activeFrequency} Hz` : '---'}
              </span>
              <span className="text-slate-300">{progress.percentage}%</span>
            </div>
            <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-amber-400 to-sky-400 h-full transition-all duration-75"
                style={{ width: `${progress.percentage}%` }}
              />
            </div>
            <div className="mt-2 text-[11px] text-slate-400 flex justify-between font-mono">
              <span>
                Symbol: {progress.currentBitIndex} / {progress.totalBits}
              </span>
              <span>CPFSK Hann Shaping</span>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="mt-5 pt-4 border-t border-slate-800 flex flex-wrap items-center gap-2">
        {!progress.isTransmitting ? (
          <button
            onClick={onTransmit}
            disabled={!text.trim()}
            className="flex-1 py-2.5 px-4 bg-sky-500 hover:bg-sky-400 active:bg-sky-600 text-slate-950 font-semibold rounded-lg text-sm flex items-center justify-center gap-2 shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            Produce & Transmit Signal
          </button>
        ) : (
          <button
            onClick={onStop}
            className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-lg text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Square className="w-4 h-4 fill-current" />
            Cancel Transmission
          </button>
        )}

        <button
          onClick={onDownloadWav}
          disabled={!text.trim() || progress.isTransmitting}
          title="Export synthesized FSK audio file as .WAV"
          className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 border border-slate-700/80 transition-colors disabled:opacity-50 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          Export WAV
        </button>

        {/* Auto-Decode Loopback Toggle Button */}
        <button
          type="button"
          onClick={() => onToggleLoopback(!isSimulatedLoopback)}
          className={`py-2.5 px-3 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
            isSimulatedLoopback
              ? 'bg-amber-500/15 border-amber-500/50 text-amber-300 font-semibold'
              : 'bg-slate-800/80 border-slate-700/60 text-slate-400 hover:text-slate-200'
          }`}
          title="When enabled, every transmitted command is automatically routed to the receiver and decoded in real time"
        >
          {isSimulatedLoopback ? 'Auto-Decode: ON' : 'Auto-Decode: OFF'}
        </button>
      </div>
    </div>
  );
};
