import React from 'react';
import { FrequencyProfile, SpeedPreset } from '../types/modem';
import { PROFILES, SPEED_PRESETS } from '../utils/modemConfig';
import { Radio, Zap, ShieldCheck } from 'lucide-react';

interface NavbarProps {
  currentProfile: FrequencyProfile;
  onSelectProfile: (profile: FrequencyProfile) => void;
  currentSpeed: SpeedPreset;
  onSelectSpeed: (speed: SpeedPreset) => void;
  isTransmitting: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentProfile,
  onSelectProfile,
  currentSpeed,
  onSelectSpeed,
  isTransmitting,
}) => {
  return (
    <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-sky-500 to-indigo-600 rounded-xl shadow-md text-white">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-white">AeroTone</h1>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                Acoustic Modem
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Air-gap data communication over sound waves without Wi-Fi or Bluetooth
            </p>
          </div>
        </div>

        {/* Profile & Speed Selector Controls */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Profile segmented selector */}
          <div className="flex items-center p-1 bg-slate-900 border border-slate-800 rounded-lg">
            {Object.values(PROFILES).map((prof) => {
              const active = currentProfile.id === prof.id;
              return (
                <button
                  key={prof.id}
                  onClick={() => onSelectProfile(prof)}
                  disabled={isTransmitting}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer disabled:opacity-50 ${
                    active
                      ? 'bg-sky-500 text-slate-950 font-semibold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title={prof.description}
                >
                  {prof.id === 'ultrasonic' ? 'Ultrasonic (Silent)' : prof.id === 'retro' ? 'Retro Modem' : 'Audible'}
                </button>
              );
            })}
          </div>

          {/* Speed Preset Selector */}
          <div className="flex items-center p-1 bg-slate-900 border border-slate-800 rounded-lg">
            {SPEED_PRESETS.map((spd) => {
              const active = currentSpeed.id === spd.id;
              return (
                <button
                  key={spd.id}
                  onClick={() => onSelectSpeed(spd)}
                  disabled={isTransmitting}
                  className={`px-2 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer disabled:opacity-50 ${
                    active
                      ? 'bg-slate-750 text-white font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title={`${spd.name} - ${spd.baudRate} baud (${spd.symbolDurationMs}ms/symbol)`}
                >
                  <span className="capitalize">{spd.id}</span>
                  <span className="text-[10px] text-slate-400 ml-1">({spd.baudRate}b)</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </header>
  );
};
