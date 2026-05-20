import React, { useState, useEffect } from 'react';
import { X, Volume2, Vibrate, Mic, Globe, Settings as SettingsIcon } from 'lucide-react';

const SettingsModal = ({ isOpen, onClose, isVoiceEnabled, setIsVoiceEnabled }) => {
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isHapticEnabled, setIsHapticEnabled] = useState(true);
  const [language, setLanguage] = useState('en');

  // Load initial settings
  useEffect(() => {
    if (isOpen) {
      setIsAudioEnabled(localStorage.getItem('ufstats_audio_enabled') !== 'false');
      setIsHapticEnabled(localStorage.getItem('ufstats_haptic_enabled') !== 'false');
      setLanguage(localStorage.getItem('ufstats_language') || 'en');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleAudio = () => {
    const newValue = !isAudioEnabled;
    setIsAudioEnabled(newValue);
    localStorage.setItem('ufstats_audio_enabled', newValue.toString());
  };

  const toggleHaptic = () => {
    const newValue = !isHapticEnabled;
    setIsHapticEnabled(newValue);
    localStorage.setItem('ufstats_haptic_enabled', newValue.toString());
  };

  const toggleVoice = () => {
    setIsVoiceEnabled(!isVoiceEnabled);
  };

  const handleLanguageChange = (e) => {
    const newLang = e.target.value;
    setLanguage(newLang);
    localStorage.setItem('ufstats_language', newLang);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-center items-center px-4 pt-10 pb-20 sm:p-6 sm:items-center">
      <div 
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity" 
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-700/50 shadow-2xl rounded-3xl overflow-hidden flex flex-col max-h-[85vh] transform transition-all">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500/20 text-indigo-400 rounded-xl flex items-center justify-center border border-indigo-500/30">
              <SettingsIcon className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-black text-white uppercase tracking-widest">Settings</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          
          {/* Preferences Section */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Preferences</h3>
            
            {/* Audio Toggle */}
            <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50">
              <div className="flex items-center gap-4">
                <div className={`p-2 rounded-xl ${isAudioEnabled ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-700/50 text-slate-500'}`}>
                  <Volume2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white">Audio Feedback</div>
                  <div className="text-xs text-slate-400">Play sounds on point start and actions</div>
                </div>
              </div>
              <button 
                onClick={toggleAudio}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isAudioEnabled ? 'bg-indigo-500' : 'bg-slate-600'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isAudioEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            {/* Haptic Toggle */}
            <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50">
              <div className="flex items-center gap-4">
                <div className={`p-2 rounded-xl ${isHapticEnabled ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700/50 text-slate-500'}`}>
                  <Vibrate className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white">Haptic Feedback</div>
                  <div className="text-xs text-slate-400">Vibrate on point start (supported devices)</div>
                </div>
              </div>
              <button 
                onClick={toggleHaptic}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isHapticEnabled ? 'bg-amber-500' : 'bg-slate-600'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isHapticEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            {/* Voice Commands Toggle */}
            <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50">
              <div className="flex items-center gap-4">
                <div className={`p-2 rounded-xl ${isVoiceEnabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700/50 text-slate-500'}`}>
                  <Mic className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white flex items-center gap-2">
                    Voice Commands 
                    {/* Coming Soon note per guide */}
                  </div>
                  <div className="text-xs text-slate-400">Basic start/undo. Voice Pro coming soon!</div>
                </div>
              </div>
              <button 
                onClick={toggleVoice}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isVoiceEnabled ? 'bg-emerald-500' : 'bg-slate-600'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isVoiceEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            {/* Language Selection */}
            <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50">
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white">Language</div>
                  <div className="text-xs text-slate-400">App interface language</div>
                </div>
              </div>
              <select 
                value={language}
                onChange={handleLanguageChange}
                className="bg-slate-900 border border-slate-700 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 p-2 outline-none"
              >
                <option value="en">English (Default)</option>
                <option value="de" disabled>German (Coming Soon)</option>
                <option value="es" disabled>Spanish (Coming Soon)</option>
                <option value="fr" disabled>French (Coming Soon)</option>
              </select>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
