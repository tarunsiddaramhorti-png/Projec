import React from 'react';
import { ReceivedPacket } from '../types/modem';
import { byteToHex } from '../utils/crc';
import { X, CheckCircle, AlertCircle, Copy, Download, Hash } from 'lucide-react';

interface PacketInspectorModalProps {
  packet: ReceivedPacket | null;
  onClose: () => void;
}

export const PacketInspectorModal: React.FC<PacketInspectorModalProps> = ({ packet, onClose }) => {
  if (!packet) return null;

  const hexBytes = packet.rawBytes.map(byteToHex);

  const downloadJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(packet, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `packet_${packet.id}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full p-6 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-sky-500/10 text-sky-400 rounded-lg">
              <Hash className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-100">
                Acoustic Frame Inspector
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Packet ID: #{packet.id} · Captured at {packet.timestamp.toLocaleTimeString()}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="py-4 space-y-4 overflow-y-auto">
          {/* Integrity status banner */}
          <div
            className={`p-3 rounded-lg border flex items-center justify-between text-xs font-mono ${
              packet.isValidCrc
                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {packet.isValidCrc ? (
                <CheckCircle className="w-4 h-4 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400" />
              )}
              <span>
                {packet.isValidCrc
                  ? 'CRC-8 Integrity Validated (Zero Bit Errors)'
                  : 'CRC-8 Checksum Mismatch (Corrupted bits or acoustic noise)'}
              </span>
            </div>
            <span>Poly: 0x31</span>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
            <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-slate-500 block text-[10px]">PAYLOAD LENGTH</span>
              <span className="text-slate-200 font-bold">{packet.length} Bytes</span>
            </div>
            <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-slate-500 block text-[10px]">ESTIMATED SNR</span>
              <span className="text-sky-400 font-bold">{packet.snrDb} dB</span>
            </div>
            <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-slate-500 block text-[10px]">TRANSMIT TIME</span>
              <span className="text-slate-200 font-bold">{(packet.durationMs / 1000).toFixed(2)}s</span>
            </div>
            <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-slate-500 block text-[10px]">CHECKSUM (EXP/CALC)</span>
              <span className="text-amber-400 font-bold">
                0x{byteToHex(packet.expectedCrc)} / 0x{byteToHex(packet.calculatedCrc)}
              </span>
            </div>
          </div>

          {/* Decoded Text */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Decoded ASCII/UTF-8 Text
            </label>
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg font-mono text-sm text-slate-100 break-all select-all">
              {packet.rawText}
            </div>
          </div>

          {/* Hex & Byte View */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Raw Hex Dump ({packet.rawBytes.length} bytes)
            </label>
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg font-mono text-xs text-sky-400 space-x-1 break-all overflow-x-auto">
              {hexBytes.map((h, i) => (
                <span
                  key={i}
                  className="inline-block px-1 py-0.5 rounded bg-slate-900 border border-slate-800/80 mb-1"
                >
                  {h}
                </span>
              ))}
            </div>
          </div>

          {/* Protocol Framing Diagram */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Acoustic Frame Structure (Physical Layer)
            </label>
            <div className="grid grid-cols-5 text-center text-[10px] font-mono border border-slate-800 rounded-lg overflow-hidden">
              <div className="bg-amber-950/40 p-2 border-r border-slate-800 text-amber-300">
                <div className="font-bold">PREAMBLE</div>
                <div className="text-[9px] text-amber-400/70">4 Tone Chirps</div>
              </div>
              <div className="bg-cyan-950/40 p-2 border-r border-slate-800 text-cyan-300">
                <div className="font-bold">SFD</div>
                <div className="text-[9px] text-cyan-400/70">0xAB (8 bits)</div>
              </div>
              <div className="bg-slate-800/60 p-2 border-r border-slate-800 text-slate-300">
                <div className="font-bold">LENGTH</div>
                <div className="text-[9px] text-slate-400">{packet.length} bytes</div>
              </div>
              <div className="bg-sky-950/40 p-2 border-r border-slate-800 text-sky-300">
                <div className="font-bold">PAYLOAD</div>
                <div className="text-[9px] text-sky-400/70">{packet.length * 8} bits</div>
              </div>
              <div className="bg-emerald-950/40 p-2 text-emerald-300">
                <div className="font-bold">CRC-8</div>
                <div className="text-[9px] text-emerald-400/70">0x{byteToHex(packet.expectedCrc)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="pt-4 border-t border-slate-800 flex justify-end gap-2">
          <button
            onClick={downloadJson}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export JSON
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
