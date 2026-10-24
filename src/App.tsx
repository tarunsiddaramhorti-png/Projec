/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FrequencyProfile, ModemState, ReceivedPacket, SpeedPreset, TransmissionProgress } from './types/modem';
import { PROFILES, SPEED_PRESETS } from './utils/modemConfig';
import { buildPacketSymbols, synthesizeAudioBuffer, audioBufferToWavBlob, playCommandAckChime } from './utils/audioModulator';
import { AcousticDemodulator } from './utils/audioDemodulator';
import { executeAcousticCommand, SystemHardwareState } from './utils/commandProcessor';
import { Navbar } from './components/Navbar';
import { TransmitterCard } from './components/TransmitterCard';
import { ReceiverCard } from './components/ReceiverCard';
import { SpectrumVisualizer } from './components/SpectrumVisualizer';
import { PacketInspectorModal } from './components/PacketInspectorModal';
import { ModemExplainer } from './components/ModemExplainer';
import { ShieldCheck } from 'lucide-react';

export default function App() {
  // Profiles and Presets
  const [currentProfile, setCurrentProfile] = useState<FrequencyProfile>(PROFILES.audible);
  const [currentSpeed, setCurrentSpeed] = useState<SpeedPreset>(SPEED_PRESETS[1]); // Standard (60ms)

  // Transmitter state
  const [payloadText, setPayloadText] = useState<string>('PING');
  const [volume, setVolume] = useState<number>(0.85);
  const [isSimulatedLoopback, setIsSimulatedLoopback] = useState<boolean>(true);
  const [progress, setProgress] = useState<TransmissionProgress>({
    isTransmitting: false,
    currentBitIndex: 0,
    totalBits: 0,
    percentage: 0,
    activeFrequency: 0,
    currentPhase: 'idle',
  });

  // Receiver state
  const [isListening, setIsListening] = useState<boolean>(false);
  const [modemState, setModemState] = useState<ModemState>('idle');
  const [micLevel, setMicLevel] = useState<number>(0);
  const [snrDb, setSnrDb] = useState<number>(0);
  const [dominantFreq, setDominantFreq] = useState<number>(0);
  const [activeTone, setActiveTone] = useState<string>('None');
  const [soundChimeEnabled, setSoundChimeEnabled] = useState<boolean>(true);

  // Virtual Hardware Devices controlled by acoustic commands
  const [hardwareState, setHardwareState] = useState<SystemHardwareState>({
    relay1: false,
    relay2: false,
    ledActive: false,
    alarmActive: false,
  });

  const [receivedPackets, setReceivedPackets] = useState<ReceivedPacket[]>(() => {
    try {
      const saved = localStorage.getItem('aerotone_packets_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.map((p: any) => ({
          ...p,
          timestamp: new Date(p.timestamp),
          commandResult: p.commandResult
            ? { ...p.commandResult, executedAt: new Date(p.commandResult.executedAt) }
            : undefined,
        }));
      }
    } catch {
      // ignore
    }
    return [];
  });
  const [inspectingPacket, setInspectingPacket] = useState<ReceivedPacket | null>(null);

  // Audio nodes and references
  const audioCtxRef = useRef<AudioContext | null>(null);
  const transmitterSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const transmitterGainRef = useRef<GainNode | null>(null);
  const transmitterAnalyserRef = useRef<AnalyserNode | null>(null);
  const demodulatorRef = useRef<AcousticDemodulator | null>(null);
  const progressIntervalRef = useRef<number | null>(null);
  const hardwareStateRef = useRef(hardwareState);

  useEffect(() => {
    hardwareStateRef.current = hardwareState;
  }, [hardwareState]);

  // Initialize or retrieve shared AudioContext
  const getAudioContext = useCallback((): AudioContext => {
    if (!audioCtxRef.current) {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtxRef.current = new AudioCtxClass();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  // Sync demodulator callbacks & packet execution
  const handlePacketReceived = useCallback((packet: ReceivedPacket) => {
    const ctx = getAudioContext();

    // Execute the command through the acoustic command processor
    const { result, nextState } = executeAcousticCommand(
      packet.rawText,
      hardwareStateRef.current,
      packet.snrDb,
      packet.durationMs
    );

    // Update virtual hardware states
    setHardwareState(nextState);

    // Play optional pleasant acknowledgment chime
    if (soundChimeEnabled) {
      playCommandAckChime(ctx, 0.12);
    }

    const enrichedPacket: ReceivedPacket = {
      ...packet,
      commandResult: result,
    };

    setReceivedPackets((prev) => {
      const next = [enrichedPacket, ...prev].slice(0, 50);
      try {
        localStorage.setItem('aerotone_packets_v2', JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }, [getAudioContext, soundChimeEnabled]);

  // Initialize Demodulator instance
  useEffect(() => {
    const demod = new AcousticDemodulator(currentProfile, currentSpeed, {
      onStateChange: (state) => setModemState(state),
      onPacketReceived: handlePacketReceived,
      onMetricsUpdate: (metrics) => {
        setMicLevel(metrics.micLevel);
        setSnrDb(metrics.snrDb);
        setDominantFreq(metrics.dominantFreq);
        setActiveTone(metrics.activeTone);
      },
    });

    demodulatorRef.current = demod;

    return () => {
      demod.stop();
    };
  }, [handlePacketReceived]);

  // Update demodulator when profile or speed changes
  useEffect(() => {
    if (demodulatorRef.current) {
      demodulatorRef.current.updateConfig(currentProfile, currentSpeed);
    }
  }, [currentProfile, currentSpeed]);

  // Start / Stop Microphone Listening
  const handleToggleListening = async () => {
    if (isListening) {
      if (demodulatorRef.current) {
        demodulatorRef.current.stop();
      }
      setIsListening(false);
      setModemState('idle');
      setMicLevel(0);
      setSnrDb(0);
    } else {
      try {
        const ctx = getAudioContext();
        if (demodulatorRef.current) {
          await demodulatorRef.current.startMicrophone(ctx);
          setIsListening(true);
        }
      } catch (err) {
        console.error('Microphone access failed:', err);
        alert('Could not access microphone. Please grant microphone permissions in your browser.');
      }
    }
  };

  // Transmit Audio Signal
  const handleTransmit = () => {
    if (!payloadText.trim()) return;

    const ctx = getAudioContext();

    // Stop any existing playback
    if (transmitterSourceRef.current) {
      try {
        transmitterSourceRef.current.stop();
        transmitterSourceRef.current.disconnect();
      } catch {
        // ignore
      }
      transmitterSourceRef.current = null;
    }

    if (progressIntervalRef.current) {
      window.clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }

    // Build tone sequence
    const encoded = buildPacketSymbols(payloadText, currentProfile, currentSpeed.symbolDurationMs);
    const audioBuffer = synthesizeAudioBuffer(ctx, encoded, volume);

    // Audio node pipeline: BufferSource -> GainNode -> Destination (Speaker) & AnalyserNode
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;

    const gainNode = ctx.createGain();
    gainNode.gain.value = volume;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.5;

    source.connect(gainNode);
    gainNode.connect(analyser);
    gainNode.connect(ctx.destination);

    // If loopback is enabled, directly route to receiver demodulator
    if (isSimulatedLoopback && demodulatorRef.current) {
      demodulatorRef.current.resetDecoder();
      demodulatorRef.current.attachDirectSource(gainNode, ctx);
      setIsListening(true);
    }

    transmitterSourceRef.current = source;
    transmitterGainRef.current = gainNode;
    transmitterAnalyserRef.current = analyser;

    const startTime = ctx.currentTime;
    const totalDurationSec = encoded.totalDurationMs / 1000;

    setProgress({
      isTransmitting: true,
      currentBitIndex: 0,
      totalBits: encoded.totalBits,
      percentage: 0,
      activeFrequency: encoded.symbols[0]?.freq || currentProfile.markFreq,
      currentPhase: 'preamble',
    });

    // Real-time progress tracker
    const interval = window.setInterval(() => {
      const elapsedSec = ctx.currentTime - startTime;
      const elapsedMs = elapsedSec * 1000;
      const pct = Math.min(100, Math.round((elapsedSec / totalDurationSec) * 100));

      // Find active symbol
      let accumulatedMs = 0;
      let activeSym = encoded.symbols[0];
      for (const sym of encoded.symbols) {
        accumulatedMs += sym.durationMs;
        if (accumulatedMs >= elapsedMs) {
          activeSym = sym;
          break;
        }
      }

      setProgress((prev) => ({
        ...prev,
        percentage: pct,
        currentBitIndex: activeSym.bitIndex !== undefined ? activeSym.bitIndex + 1 : prev.currentBitIndex,
        activeFrequency: activeSym.freq,
        currentPhase: activeSym.phaseType,
      }));

      if (elapsedSec >= totalDurationSec) {
        window.clearInterval(interval);
      }
    }, 40);

    progressIntervalRef.current = interval;

    source.onended = () => {
      if (progressIntervalRef.current) {
        window.clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      setProgress({
        isTransmitting: false,
        currentBitIndex: encoded.totalBits,
        totalBits: encoded.totalBits,
        percentage: 100,
        activeFrequency: 0,
        currentPhase: 'complete',
      });
      setTimeout(() => {
        setProgress((prev) => (prev.isTransmitting ? prev : { ...prev, currentPhase: 'idle', percentage: 0 }));
      }, 1000);
    };

    source.start(0);
  };

  // Stop / Cancel Transmission
  const handleStopTransmission = () => {
    if (transmitterSourceRef.current) {
      try {
        transmitterSourceRef.current.stop();
        transmitterSourceRef.current.disconnect();
      } catch {
        // ignore
      }
      transmitterSourceRef.current = null;
    }
    if (progressIntervalRef.current) {
      window.clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    setProgress({
      isTransmitting: false,
      currentBitIndex: 0,
      totalBits: 0,
      percentage: 0,
      activeFrequency: 0,
      currentPhase: 'idle',
    });
  };

  // Download Synthesized Signal as .WAV file
  const handleDownloadWav = () => {
    if (!payloadText.trim()) return;
    const ctx = getAudioContext();
    const encoded = buildPacketSymbols(payloadText, currentProfile, currentSpeed.symbolDurationMs);
    const buffer = synthesizeAudioBuffer(ctx, encoded, volume);
    const blob = audioBufferToWavBlob(buffer);

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aerotone_${currentProfile.id}_${Date.now()}.wav`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleClearPackets = () => {
    setReceivedPackets([]);
    localStorage.removeItem('aerotone_packets_v2');
  };

  // Instant Decoder Diagnostic Test
  const handleRunDecoderTest = () => {
    const ctx = getAudioContext();
    const testMsg = 'PING';
    const encoded = buildPacketSymbols(testMsg, currentProfile, currentSpeed.symbolDurationMs);
    const buffer = synthesizeAudioBuffer(ctx, encoded, volume);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gainNode = ctx.createGain();
    gainNode.gain.value = volume;

    source.connect(gainNode);
    gainNode.connect(ctx.destination);

    if (demodulatorRef.current) {
      demodulatorRef.current.attachDirectSource(gainNode, ctx);
      setIsListening(true);
    }

    transmitterSourceRef.current = source;
    source.start(0);
  };

  const handleSensitivityChange = (level: 'high' | 'medium' | 'low') => {
    demodulatorRef.current?.setSensitivity(level);
  };

  // Determine which analyser node to feed to the visualizer
  const activeAnalyser =
    progress.isTransmitting && transmitterAnalyserRef.current
      ? transmitterAnalyserRef.current
      : demodulatorRef.current?.getAnalyser() || null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-sky-500/30 selection:text-sky-200">
      {/* Top Navbar */}
      <Navbar
        currentProfile={currentProfile}
        onSelectProfile={setCurrentProfile}
        currentSpeed={currentSpeed}
        onSelectSpeed={setCurrentSpeed}
        isTransmitting={progress.isTransmitting}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Mission Notice Banner */}
        <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-sky-500/10 text-sky-400 rounded-lg shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                <span>Air-Gap Acoustic Data & Command Link Active</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Zero RF / Sound Wave I/O
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Type any command or message below. The system synthesizes continuous-phase acoustic signals, broadcasts them via speaker, and demodulates them with sample-accurate Goertzel filters.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setIsSimulatedLoopback(!isSimulatedLoopback)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-colors cursor-pointer ${
                isSimulatedLoopback
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-semibold'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              {isSimulatedLoopback ? '● Auto-Decode: ON (Direct Link)' : 'Enable Auto-Decode'}
            </button>
          </div>
        </div>

        {/* Real-time Spectrum, Waveform, and Waterfall Display */}
        <SpectrumVisualizer
          analyser={activeAnalyser}
          profile={currentProfile}
          isListening={isListening}
          isTransmitting={progress.isTransmitting}
          activeFrequency={progress.activeFrequency}
        />

        {/* Dual Panels: Transmitter and Receiver */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Transmitter Column */}
          <TransmitterCard
            text={payloadText}
            onTextChange={setPayloadText}
            profile={currentProfile}
            speed={currentSpeed}
            volume={volume}
            onVolumeChange={setVolume}
            progress={progress}
            onTransmit={handleTransmit}
            onStop={handleStopTransmission}
            onDownloadWav={handleDownloadWav}
            isSimulatedLoopback={isSimulatedLoopback}
            onToggleLoopback={setIsSimulatedLoopback}
          />

          {/* Receiver Column */}
          <ReceiverCard
            isListening={isListening}
            onToggleListening={handleToggleListening}
            modemState={modemState}
            micLevel={micLevel}
            snrDb={snrDb}
            dominantFreq={dominantFreq}
            activeTone={activeTone}
            receivedPackets={receivedPackets}
            onClearPackets={handleClearPackets}
            onSelectPacketForInspection={setInspectingPacket}
            onRunDecoderTest={handleRunDecoderTest}
            onSensitivityChange={handleSensitivityChange}
            hardwareState={hardwareState}
            soundChimeEnabled={soundChimeEnabled}
            onToggleSoundChime={() => setSoundChimeEnabled(!soundChimeEnabled)}
          />
        </div>

        {/* Architectural Explainer and Transmission Guide */}
        <ModemExplainer />
      </main>

      {/* Packet Inspection Modal */}
      <PacketInspectorModal
        packet={inspectingPacket}
        onClose={() => setInspectingPacket(null)}
      />

      {/* Clean Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>AeroTone Acoustic Data Modem · Air-Gapped Command & Data Transfer</span>
          <span className="font-mono text-[11px] text-slate-600">
            CPFSK · Web Audio API · CRC-8 Dallas/Maxim · Sample-Accurate Goertzel
          </span>
        </div>
      </footer>
    </div>
  );
}
