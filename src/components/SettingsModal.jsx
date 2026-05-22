import React, { useState, useEffect } from 'react';
import { X, Volume2, Vibrate, Mic, Globe, Settings as SettingsIcon, Sun, Moon } from 'lucide-react';
import { 
  getLegalPath, 
  FULL_COMPANY_NAME, 
  COMPANY_NUMBER, 
  PLACE_OF_REGISTRATION, 
  REGISTERED_OFFICE_ADDRESS, 
  SUPPORT_EMAIL 
} from '../constants/legal';

const SettingsModal = ({ isOpen, onClose, isVoiceEnabled, setIsVoiceEnabled }) => {
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isHapticEnabled, setIsHapticEnabled] = useState(true);
  const [theme, setTheme] = useState(() => localStorage.getItem('ufstats_theme') || 'dark');

  // Load initial settings
  useEffect(() => {
    if (isOpen) {
      setIsAudioEnabled(localStorage.getItem('ufstats_audio_enabled') !== 'false');
      setIsHapticEnabled(localStorage.getItem('ufstats_haptic_enabled') !== 'false');
      setTheme(localStorage.getItem('ufstats_theme') || 'dark');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('ufstats_theme', nextTheme);
    
    // Smoothly transition theme
    document.documentElement.classList.add('theme-transition');
    const themeColorMetaTags = document.querySelectorAll('meta[name="theme-color"]');
    const manifestEl = document.getElementById('manifest-link');
    if (nextTheme === 'light') {
      document.documentElement.classList.add('light-mode');
      themeColorMetaTags.forEach(tag => tag.setAttribute('content', '#ffffff'));
      if (manifestEl) manifestEl.setAttribute('href', '/manifest.json');
    } else {
      document.documentElement.classList.remove('light-mode');
      themeColorMetaTags.forEach(tag => tag.setAttribute('content', '#080c14'));
      if (manifestEl) manifestEl.setAttribute('href', '/manifest_dark.json');
    }
    
    setTimeout(() => {
      document.documentElement.classList.remove('theme-transition');
    }, 300);
  };

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
            
            {/* Theme Toggle */}
            <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50">
              <div className="flex items-center gap-4">
                <div className={`p-2 rounded-xl bg-indigo-500/20 text-indigo-400`}>
                  {theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                </div>
                <div>
                  <div className="text-sm font-bold text-white">Dark Theme</div>
                  <div className="text-xs text-slate-400">Switch between light and dark grey interface</div>
                </div>
              </div>
              <button 
                onClick={toggleTheme}
                aria-label="Toggle dark theme"
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${theme === 'dark' ? 'bg-indigo-500' : 'bg-slate-600'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${theme === 'dark' ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

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

          </div>

          {/* Legal & Disclosures Section */}
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Legal & Disclosures</h3>
            
            {/* Compliance Policy Quick Links */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <button
                onClick={() => {
                  onClose();
                  window.history.pushState({}, '', getLegalPath('/legal/privacy'));
                }}
                className="py-2 px-1 bg-slate-800/40 hover:bg-slate-800/80 active:bg-slate-700/50 rounded-xl border border-slate-700/30 text-[10px] font-bold text-slate-300 hover:text-white transition-all uppercase tracking-wider"
              >
                Privacy
              </button>
              <button
                onClick={() => {
                  onClose();
                  window.history.pushState({}, '', getLegalPath('/legal/terms'));
                }}
                className="py-2 px-1 bg-slate-800/40 hover:bg-slate-800/80 active:bg-slate-700/50 rounded-xl border border-slate-700/30 text-[10px] font-bold text-slate-300 hover:text-white transition-all uppercase tracking-wider"
              >
                Terms
              </button>
              <button
                onClick={() => {
                  onClose();
                  window.history.pushState({}, '', getLegalPath('/legal/ai'));
                }}
                className="py-2 px-1 bg-slate-800/40 hover:bg-slate-800/80 active:bg-slate-700/50 rounded-xl border border-slate-700/30 text-[10px] font-bold text-slate-300 hover:text-white transition-all uppercase tracking-wider"
              >
                AI Info
              </button>
            </div>

            {/* Corporate Registration Details */}
            <div className="p-3 bg-slate-950/40 rounded-2xl border border-slate-800/60 space-y-1 text-[9px] leading-relaxed text-slate-500 font-medium">
              <div className="font-extrabold text-slate-400 uppercase tracking-wider text-[10px]">{FULL_COMPANY_NAME}</div>
              <div>Company Number: {COMPANY_NUMBER} • {PLACE_OF_REGISTRATION}</div>
              <div>Registered Office: {REGISTERED_OFFICE_ADDRESS}</div>
              <div>
                Contact: <a href={`mailto:${SUPPORT_EMAIL}`} className="text-indigo-400 hover:text-indigo-300 transition-colors underline">{SUPPORT_EMAIL}</a>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
