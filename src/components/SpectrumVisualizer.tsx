import React, { useEffect, useRef, useState } from 'react';
import { FrequencyProfile } from '../types/modem';
import { Activity, Waves, Flame, Radio } from 'lucide-react';

interface SpectrumVisualizerProps {
  analyser: AnalyserNode | null;
  profile: FrequencyProfile;
  isListening: boolean;
  isTransmitting: boolean;
  activeFrequency: number;
}

export const SpectrumVisualizer: React.FC<SpectrumVisualizerProps> = ({
  analyser,
  profile,
  isListening,
  isTransmitting,
  activeFrequency,
}) => {
  const spectrumCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const waveformCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const waterfallCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [viewMode, setViewMode] = useState<'triple' | 'spectrum' | 'waveform' | 'waterfall'>('triple');

  useEffect(() => {
    const sCanvas = spectrumCanvasRef.current;
    const wCanvas = waveformCanvasRef.current;
    const wfCanvas = waterfallCanvasRef.current;

    const dpr = window.devicePixelRatio || 1;
    const width = sCanvas?.parentElement?.clientWidth || 700;

    const sCtx = sCanvas?.getContext('2d');
    const wCtx = wCanvas?.getContext('2d');
    const wfCtx = wfCanvas?.getContext('2d');

    if (sCanvas && sCtx) {
      sCanvas.width = width * dpr;
      sCanvas.height = 110 * dpr;
      sCanvas.style.width = `${width}px`;
      sCanvas.style.height = `110px`;
      sCtx.scale(dpr, dpr);
    }

    if (wCanvas && wCtx) {
      wCanvas.width = width * dpr;
      wCanvas.height = 80 * dpr;
      wCanvas.style.width = `${width}px`;
      wCanvas.style.height = `80px`;
      wCtx.scale(dpr, dpr);
    }

    if (wfCanvas && wfCtx) {
      wfCanvas.width = width * dpr;
      wfCanvas.height = 80 * dpr;
      wfCanvas.style.width = `${width}px`;
      wfCanvas.style.height = `80px`;
      wfCtx.scale(dpr, dpr);
    }

    const bufferLength = analyser ? analyser.frequencyBinCount : 1024;
    const freqData = new Uint8Array(bufferLength);
    const timeData = new Uint8Array(bufferLength);
    const sampleRate = analyser?.context.sampleRate || 48000;
    const maxFreq = 22000;

    const render = () => {
      animationFrameRef.current = requestAnimationFrame(render);
      const w = width;

      // 1. RENDER FFT SPECTRUM
      if (sCanvas && sCtx && (viewMode === 'triple' || viewMode === 'spectrum')) {
        const h = 110;
        sCtx.fillStyle = '#060911';
        sCtx.fillRect(0, 0, w, h);

        // Frequency Grid lines
        sCtx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        sCtx.lineWidth = 1;
        const gridFrequencies = [1000, 3000, 6000, 10000, 15000, 18000, 20000];
        gridFrequencies.forEach((freq) => {
          const x = (freq / maxFreq) * w;
          sCtx.beginPath();
          sCtx.moveTo(x, 0);
          sCtx.lineTo(x, h);
          sCtx.stroke();

          sCtx.fillStyle = 'rgba(148, 163, 184, 0.35)';
          sCtx.font = '9px monospace';
          sCtx.fillText(`${freq >= 1000 ? freq / 1000 + 'k' : freq}`, x + 3, h - 5);
        });

        // Modem target frequency channels
        const highlightChannel = (freq: number, label: string, color: string, active: boolean) => {
          const x = (freq / maxFreq) * w;
          sCtx.fillStyle = active ? color : 'rgba(255, 255, 255, 0.08)';
          sCtx.fillRect(x - 2, 0, 4, h);

          sCtx.fillStyle = active ? '#ffffff' : color;
          sCtx.font = '10px monospace';
          sCtx.fillText(label, Math.min(w - 45, Math.max(5, x - 12)), 14);
        };

        highlightChannel(profile.markFreq, 'M:1', '#10b981', activeFrequency === profile.markFreq);
        highlightChannel(profile.spaceFreq, 'S:0', '#06b6d4', activeFrequency === profile.spaceFreq);
        highlightChannel(profile.syncFreq1, 'SYNC', '#f59e0b', activeFrequency === profile.syncFreq1);

        if (analyser && (isListening || isTransmitting)) {
          analyser.getByteFrequencyData(freqData);

          sCtx.beginPath();
          sCtx.moveTo(0, h);

          const binsToDraw = Math.floor((maxFreq / (sampleRate / 2)) * bufferLength);
          const sliceWidth = w / binsToDraw;

          const grad = sCtx.createLinearGradient(0, 0, 0, h);
          grad.addColorStop(0, '#38bdf8');
          grad.addColorStop(0.5, '#6366f1');
          grad.addColorStop(1, 'rgba(15, 23, 42, 0.15)');

          for (let i = 0; i < binsToDraw; i++) {
            const v = freqData[i] / 255.0;
            const y = h - v * (h - 20);
            const x = i * sliceWidth;
            if (i === 0) sCtx.moveTo(x, y);
            else sCtx.lineTo(x, y);
          }

          sCtx.lineTo(w, h);
          sCtx.fillStyle = grad;
          sCtx.fill();

          sCtx.strokeStyle = '#38bdf8';
          sCtx.lineWidth = 1.5;
          sCtx.stroke();
        } else {
          sCtx.strokeStyle = 'rgba(148, 163, 184, 0.15)';
          sCtx.beginPath();
          sCtx.moveTo(0, h - 15);
          sCtx.lineTo(w, h - 15);
          sCtx.stroke();
        }
      }

      // 2. RENDER TIME-DOMAIN OSCILLOSCOPE (CARRIER WAVEFORM)
      if (wCanvas && wCtx && (viewMode === 'triple' || viewMode === 'waveform')) {
        const h = 80;
        wCtx.fillStyle = '#060911';
        wCtx.fillRect(0, 0, w, h);

        // Center line
        wCtx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        wCtx.lineWidth = 1;
        wCtx.beginPath();
        wCtx.moveTo(0, h / 2);
        wCtx.lineTo(w, h / 2);
        wCtx.stroke();

        if (analyser && (isListening || isTransmitting)) {
          analyser.getByteTimeDomainData(timeData);

          wCtx.lineWidth = 1.5;
          wCtx.strokeStyle = isTransmitting ? '#34d399' : '#38bdf8';
          wCtx.beginPath();

          const sliceWidth = w / bufferLength;
          let x = 0;

          for (let i = 0; i < bufferLength; i++) {
            const v = timeData[i] / 128.0;
            const y = (v * h) / 2;

            if (i === 0) wCtx.moveTo(x, y);
            else wCtx.lineTo(x, y);

            x += sliceWidth;
          }

          wCtx.stroke();
        } else {
          wCtx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
          wCtx.beginPath();
          wCtx.moveTo(0, h / 2);
          wCtx.lineTo(w, h / 2);
          wCtx.stroke();
        }
      }

      // 3. RENDER WATERFALL SPECTROGRAM
      if (wfCanvas && wfCtx && (viewMode === 'triple' || viewMode === 'waterfall')) {
        const h = 80;
        if (analyser && (isListening || isTransmitting)) {
          analyser.getByteFrequencyData(freqData);

          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = wfCanvas.width;
          tempCanvas.height = wfCanvas.height;
          const tempCtx = tempCanvas.getContext('2d');
          if (tempCtx) {
            tempCtx.drawImage(wfCanvas, 0, 0);
            wfCtx.drawImage(tempCanvas, 0, 2);

            const binsToDraw = Math.floor((maxFreq / (sampleRate / 2)) * bufferLength);
            const imgData = wfCtx.createImageData(Math.floor(w), 2);

            for (let x = 0; x < Math.floor(w); x++) {
              const binIndex = Math.min(binsToDraw - 1, Math.floor((x / w) * binsToDraw));
              const val = freqData[binIndex] || 0;

              let r = 0, g = 0, b = 0;
              if (val > 180) {
                r = 255;
                g = 255;
                b = (val - 180) * 3;
              } else if (val > 100) {
                r = (val - 100) * 3;
                g = 220;
                b = 255;
              } else if (val > 30) {
                r = 15;
                g = val * 1.8;
                b = 180;
              } else {
                r = 6;
                g = 9;
                b = 17;
              }

              for (let row = 0; row < 2; row++) {
                const pixelIndex = (row * Math.floor(w) + x) * 4;
                imgData.data[pixelIndex] = r;
                imgData.data[pixelIndex + 1] = g;
                imgData.data[pixelIndex + 2] = b;
                imgData.data[pixelIndex + 3] = 255;
              }
            }
            wfCtx.putImageData(imgData, 0, 0);
          }
        } else {
          wfCtx.fillStyle = '#060911';
          wfCtx.fillRect(0, 0, w, h);
        }
      }
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [analyser, profile, isListening, isTransmitting, activeFrequency, viewMode]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
      {/* Top Banner / Controls */}
      <div className="px-4 py-2.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 font-mono">
          <Activity className="w-4 h-4 text-sky-400" />
          <span className="font-semibold text-slate-100">Live Acoustic Signal Visualizer</span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-300">{profile.name}</span>
          <span className="text-slate-600">|</span>
          <span className="text-emerald-400">Mark 1: {profile.markFreq}Hz</span>
          <span className="text-slate-600">/</span>
          <span className="text-cyan-400">Space 0: {profile.spaceFreq}Hz</span>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
          <button
            onClick={() => setViewMode('triple')}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
              viewMode === 'triple' ? 'bg-slate-800 text-sky-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Triple View
          </button>
          <button
            onClick={() => setViewMode('waveform')}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
              viewMode === 'waveform' ? 'bg-slate-800 text-sky-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Oscilloscope
          </button>
          <button
            onClick={() => setViewMode('spectrum')}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
              viewMode === 'spectrum' ? 'bg-slate-800 text-sky-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            FFT Spectrum
          </button>
          <button
            onClick={() => setViewMode('waterfall')}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
              viewMode === 'waterfall' ? 'bg-slate-800 text-sky-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Waterfall
          </button>
        </div>
      </div>

      {/* Signal Status Bar */}
      <div className="px-4 py-1.5 bg-slate-950/70 border-b border-slate-800/60 flex items-center justify-between text-[11px] font-mono text-slate-400">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                isTransmitting ? 'bg-amber-400 animate-ping' : isListening ? 'bg-emerald-400' : 'bg-slate-600'
              }`}
            />
            <span className="text-slate-200 font-semibold">
              {isTransmitting ? 'PRODUCING AUDIO SIGNAL' : isListening ? 'LISTENING & DECODING' : 'AUDIO STANDBY'}
            </span>
          </span>
          {activeFrequency > 0 && (
            <span className="text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
              Active Carrier: {activeFrequency} Hz
            </span>
          )}
        </div>
        <div className="hidden sm:flex items-center gap-3 text-slate-500 text-[10px]">
          <span>Sampling: 48.0 kHz</span>
          <span>Window: Hann CPFSK</span>
          <span>Band: 0 – 22 kHz</span>
        </div>
      </div>

      {/* Canvases */}
      <div className="p-3 bg-slate-950 flex flex-col gap-2">
        {/* Oscilloscope Waveform */}
        {(viewMode === 'triple' || viewMode === 'waveform') && (
          <div className="relative">
            <div className="text-[10px] font-mono text-slate-400 mb-1 flex items-center justify-between px-1">
              <span className="flex items-center gap-1 text-slate-300">
                <Waves className="w-3 h-3 text-emerald-400" />
                Time-Domain Oscilloscope (Acoustic Sine Waveform)
              </span>
              <span className="text-slate-500">Continuous Phase FSK</span>
            </div>
            <canvas ref={waveformCanvasRef} className="w-full rounded-lg block border border-slate-800/50" />
          </div>
        )}

        {/* FFT Spectrum */}
        {(viewMode === 'triple' || viewMode === 'spectrum') && (
          <div className="relative">
            <div className="text-[10px] font-mono text-slate-400 mb-1 flex items-center justify-between px-1">
              <span className="flex items-center gap-1 text-slate-300">
                <Activity className="w-3 h-3 text-sky-400" />
                Frequency Spectrum (FFT Power Distribution)
              </span>
              <span className="text-slate-500">0 Hz – 22.0 kHz</span>
            </div>
            <canvas ref={spectrumCanvasRef} className="w-full rounded-lg block border border-slate-800/50" />
          </div>
        )}

        {/* Waterfall Spectrogram */}
        {(viewMode === 'triple' || viewMode === 'waterfall') && (
          <div className="relative">
            <div className="text-[10px] font-mono text-slate-400 mb-1 flex items-center justify-between px-1">
              <span className="flex items-center gap-1 text-slate-300">
                <Flame className="w-3 h-3 text-amber-400" />
                Acoustic Waterfall Spectrogram (Time-Frequency Thermal Map)
              </span>
              <span className="text-slate-500">Rolling Waterfall</span>
            </div>
            <canvas ref={waterfallCanvasRef} className="w-full rounded-lg block border border-slate-800/50" />
          </div>
        )}
      </div>
    </div>
  );
};
