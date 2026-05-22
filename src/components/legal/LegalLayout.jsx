import React, { useState, useEffect } from 'react';
import { Shield, BookOpen, Cpu, ArrowLeft, Sun, Moon } from 'lucide-react';
import PrivacyPolicy from './PrivacyPolicy';
import TermsOfService from './TermsOfService';
import AiDisclosure from './AiDisclosure';
import StandardFooter from '../StandardFooter';
import { getLegalPath } from '../../constants/legal';

const LegalLayout = ({ currentPath }) => {
  const [beachMode, setBeachMode] = useState(() => {
    return localStorage.getItem('ufstats_beach_mode') === 'true';
  });

  useEffect(() => {
    if (beachMode) {
      document.documentElement.classList.add('beach-mode');
    } else {
      document.documentElement.classList.remove('beach-mode');
    }
    localStorage.setItem('ufstats_beach_mode', beachMode.toString());
  }, [beachMode]);

  // Sync state if changed in footer
  useEffect(() => {
    const handleStorageChange = () => {
      setBeachMode(localStorage.getItem('ufstats_beach_mode') === 'true');
    };
    window.addEventListener('storage', handleStorageChange);
    // Poll local state briefly as a backup
    const interval = setInterval(handleStorageChange, 1000);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  const getActiveTab = () => {
    if (currentPath.includes('/legal/terms')) return 'terms';
    if (currentPath.includes('/legal/ai-disclosure')) return 'ai-disclosure';
    return 'privacy'; // default
  };

  const activeTab = getActiveTab();

  const handleTabChange = (tab) => {
    window.history.pushState({}, '', getLegalPath(`/legal/${tab}`));
  };

  const handleGoBack = () => {
    window.history.pushState({}, '', getLegalPath('/'));
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans transition-colors duration-300 selection:bg-indigo-500 selection:text-white">
      
      {/* Top Navbar */}
      <header className="w-full bg-slate-950/80 backdrop-blur-md border-b border-slate-800/60 sticky top-0 z-50 px-4 sm:px-8 py-4 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-4">
          <button 
            onClick={handleGoBack}
            className="flex items-center gap-2 p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            aria-label="Return to landing page"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="hidden sm:inline text-sm font-bold uppercase tracking-wider">Back to App</span>
          </button>
          
          <div className="h-6 w-px bg-slate-800 hidden sm:block"></div>
          
          <div className="flex items-center gap-2.5">
            <img src="/logo_icon.png" alt="ustats.pro" className="w-7 h-7 rounded-lg" />
            <span className="text-base font-black tracking-widest lowercase">
              ustats<span className="text-indigo-400 font-light">.pro</span>
              <span className="text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded ml-2 uppercase tracking-wide">Legal</span>
            </span>
          </div>
        </div>

        {/* Contrast / Accessibility shortcut */}
        <button
          onClick={() => setBeachMode(!beachMode)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-200 border ${
            beachMode 
              ? 'bg-amber-400 text-slate-950 border-amber-500 shadow-md' 
              : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
          } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500`}
          aria-pressed={beachMode}
          title="Toggle High Contrast Beach Mode"
        >
          {beachMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          <span className="hidden sm:inline">Beach Mode</span>
        </button>
      </header>

      {/* Main content body */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-8 py-12 flex flex-col md:flex-row gap-8">
        
        {/* Sidebar/Navigation */}
        <aside className="w-full md:w-64 flex-shrink-0">
          <nav className="flex flex-row md:flex-col gap-2 bg-slate-950/40 p-2 rounded-2xl border border-slate-800/40 md:sticky md:top-24" aria-label="Legal document tabs">
            <button
              onClick={() => handleTabChange('privacy')}
              className={`flex-1 md:flex-none flex items-center justify-center md:justify-start gap-3 px-4 py-3 rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider transition-all duration-200 ${
                activeTab === 'privacy' 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500`}
              aria-selected={activeTab === 'privacy'}
            >
              <Shield className="w-4 h-4 flex-shrink-0" />
              <span>Privacy Policy</span>
            </button>

            <button
              onClick={() => handleTabChange('terms')}
              className={`flex-1 md:flex-none flex items-center justify-center md:justify-start gap-3 px-4 py-3 rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider transition-all duration-200 ${
                activeTab === 'terms' 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500`}
              aria-selected={activeTab === 'terms'}
            >
              <BookOpen className="w-4 h-4 flex-shrink-0" />
              <span>Terms of Service</span>
            </button>

            <button
              onClick={() => handleTabChange('ai-disclosure')}
              className={`flex-1 md:flex-none flex items-center justify-center md:justify-start gap-3 px-4 py-3 rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider transition-all duration-200 ${
                activeTab === 'ai-disclosure' 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500`}
              aria-selected={activeTab === 'ai-disclosure'}
            >
              <Cpu className="w-4 h-4 flex-shrink-0" />
              <span>AI Disclosure</span>
            </button>
          </nav>
        </aside>

        {/* Legal Text content container */}
        <section 
          className="flex-1 bg-slate-950/30 border border-slate-800/40 rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden transition-colors duration-300"
          aria-labelledby="document-content-title"
        >
          {/* Subtle gradient background decoration */}
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none"></div>
          
          <div className="relative z-10">
            {activeTab === 'privacy' && <PrivacyPolicy />}
            {activeTab === 'terms' && <TermsOfService />}
            {activeTab === 'ai-disclosure' && <AiDisclosure />}
          </div>
        </section>

      </main>

      {/* Compliance Footer */}
      <StandardFooter />

    </div>
  );
};

export default LegalLayout;
