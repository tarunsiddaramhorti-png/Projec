import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Cpu, Volume2, Shield, Radio, CheckCircle, Info } from 'lucide-react';

export const ModemExplainer: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-slate-850 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2.5">
          <Info className="w-4 h-4 text-sky-400" />
          <span className="text-sm font-semibold text-slate-200">
            Acoustic Modem Architecture & Transmission Guide
          </span>
          <span className="text-xs text-slate-500 hidden sm:inline">
            · Physical layer FSK, Goertzel demodulation, and air-gap security
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs text-slate-400 font-medium">
          <span>{isOpen ? 'Hide Details' : 'Read Guide'}</span>
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {isOpen && (
        <div className="p-5 border-t border-slate-800 bg-slate-950/60 text-xs text-slate-300 space-y-6 leading-relaxed">
          {/* 3 Main Principles */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-lg">
              <div className="flex items-center gap-2 mb-2 text-sky-400 font-semibold">
                <Radio className="w-4 h-4" />
                <span>1. Frequency-Shift Keying (FSK)</span>
              </div>
              <p className="text-slate-400 text-[11px] leading-normal">
                Digital data is mapped into acoustic tones. Binary 1 is transmitted as the Mark frequency (e.g. 2000 Hz), and Binary 0 as Space (e.g. 1500 Hz). AeroTone uses Continuous Phase FSK (CPFSK) with Hann envelope shaping to eliminate spectral leakage and clicks.
              </p>
            </div>

            <div className="p-4 bg-slate-900 border border-slate-800 rounded-lg">
              <div className="flex items-center gap-2 mb-2 text-emerald-400 font-semibold">
                <Cpu className="w-4 h-4" />
                <span>2. Clock Sync & Preamble</span>
              </div>
              <p className="text-slate-400 text-[11px] leading-normal">
                Speakers and microphones lack shared timing. A dual-tone alternating preamble wakes up the receiver's AGC and locks the symbol clock phase. A Start Frame Delimiter (SFD: 0xAB) aligns byte boundaries with zero bit-slip.
              </p>
            </div>

            <div className="p-4 bg-slate-900 border border-slate-800 rounded-lg">
              <div className="flex items-center gap-2 mb-2 text-amber-400 font-semibold">
                <Shield className="w-4 h-4" />
                <span>3. CRC-8 Integrity & Squelch</span>
              </div>
              <p className="text-slate-400 text-[11px] leading-normal">
                Acoustic channels suffer from room reverberation and background noise. An adaptive squelch measures ambient noise, and a polynomial CRC-8 checksum guarantees packets are verified without false decodes.
              </p>
            </div>
          </div>

          {/* Quick Step-by-Step for Users */}
          <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-lg">
            <h4 className="text-xs font-semibold text-slate-200 mb-2 flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              How to Test Audio Transmission Between Devices
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-400 text-[11px]">
              <div>
                <span className="font-semibold text-slate-200">Across 2 Separate Devices (Laptop & Phone):</span>
                <ol className="list-decimal list-inside space-y-1 mt-1">
                  <li>Open this URL on both devices.</li>
                  <li>On Device A (Receiver), click <strong className="text-emerald-400">"Start Mic"</strong>.</li>
                  <li>On Device B (Transmitter), pick <strong className="text-sky-400">"Audible Voice-Band"</strong> and click <strong className="text-sky-400">"Transmit via Sound"</strong>.</li>
                  <li>Hold devices 0.5 to 2 meters apart. The message decodes in real time!</li>
                </ol>
              </div>
              <div>
                <span className="font-semibold text-slate-200">On a Single Device (Instant Self-Test):</span>
                <ol className="list-decimal list-inside space-y-1 mt-1">
                  <li>Turn on the <strong className="text-amber-400">"Self-Test: Loopback ON"</strong> switch in the transmitter.</li>
                  <li>Click <strong className="text-sky-400">"Transmit via Sound"</strong>.</li>
                  <li>The synthesized audio feeds directly through the demodulator pipeline and verifies end-to-end framing!</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Audible vs Ultrasonic Comparison */}
          <div className="text-[11px] text-slate-400">
            <span className="font-semibold text-slate-300">Audible vs Ultrasonic:</span> Audible Voice-Band (1.0 - 2.5 kHz) provides the highest physical acoustic resilience and works through inexpensive smartphone speakers. Ultrasonic (16.5 - 19.8 kHz) operates beyond typical adult human hearing threshold (~16 kHz), making it stealthy and silent for sensitive air-gapped environments.
          </div>
        </div>
      )}
    </div>
  );
};
