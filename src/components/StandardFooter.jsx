import React, { useState, useEffect } from 'react';
import { Shield, Mail, Compass } from 'lucide-react';
import { 
  FULL_COMPANY_NAME, 
  COMPANY_NUMBER, 
  PLACE_OF_REGISTRATION, 
  REGISTERED_OFFICE_ADDRESS, 
  SUPPORT_EMAIL,
  getLegalPath
} from '../constants/legal';

const StandardFooter = () => {
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

  const navigateToLegal = (e, targetPath) => {
    e.preventDefault();
    window.history.pushState({}, '', getLegalPath(targetPath));
  };

  return (
    <footer 
      className="w-full border-t border-slate-800 bg-slate-950/90 text-slate-400 py-12 px-6 sm:px-8 transition-colors duration-300 print:hidden"
      role="contentinfo"
      aria-label="Compliance Footer"
    >
      <div className="max-w-7xl mx-auto flex flex-col gap-8">
        
        {/* Top Row: Links & Brand */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 border-b border-slate-800/60 pb-8">
          <div className="flex items-center gap-3.5">
            <img src="/logo_icon.png" alt="ustats.pro logo" className="w-8 h-8 rounded-full opacity-75" />
            <div className="flex flex-col">
              <span className="text-base font-black text-white lowercase tracking-widest leading-none">ustats.pro</span>
              <span className="text-[7.5px] font-black text-slate-400 uppercase tracking-[0.25em] mt-1 leading-none">sideline intelligence</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-wrap justify-center gap-6 text-sm font-bold" aria-label="Legal navigation">
            <a 
              href={getLegalPath('/guide')}
              onClick={(e) => navigateToLegal(e, '/guide')}
              className="hover:text-white transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-md px-2 py-1 border-r border-slate-800 pr-6 mr-1"
            >
              How-to Guide
            </a>
            <a 
              href={getLegalPath('/legal/privacy')}
              onClick={(e) => navigateToLegal(e, '/legal/privacy')}
              className="hover:text-white transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-md px-2 py-1"
            >
              Privacy Policy
            </a>
            <a 
              href={getLegalPath('/legal/terms')}
              onClick={(e) => navigateToLegal(e, '/legal/terms')}
              className="hover:text-white transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-md px-2 py-1"
            >
              Terms of Service
            </a>
            <a 
              href={getLegalPath('/legal/ai-disclosure')}
              onClick={(e) => navigateToLegal(e, '/legal/ai-disclosure')}
              className="hover:text-white transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-md px-2 py-1"
            >
              AI Transparency
            </a>
          </nav>

          {/* Accessibility Toggle */}
          <button
            onClick={() => setBeachMode(!beachMode)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 border ${
              beachMode 
                ? 'bg-amber-400 text-slate-950 border-amber-500 shadow-md' 
                : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
            } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500`}
            aria-pressed={beachMode}
            title="Toggle High Contrast Mode for Outdoor Readability"
          >
            <Compass className={`w-4 h-4 ${beachMode ? 'animate-spin' : ''}`} />
            <span>High Contrast: {beachMode ? 'ON' : 'OFF'}</span>
          </button>
        </div>

        {/* Bottom Row: Corporate Compliance Disclosures */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-500 leading-relaxed font-extrabold tracking-wide">
          
          {/* Companies House Disclosures */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-slate-300 font-black">
              <Shield className="w-4 h-4 text-indigo-400 flex-shrink-0" />
              <span className="uppercase tracking-widest text-[10px]">Corporate Disclosures (UK Companies Act 2006)</span>
            </div>
            <p className="font-black text-slate-200">
              {FULL_COMPANY_NAME}
            </p>
            <p>
              Company Registration Number (CRN): <span className="font-black text-slate-300">{COMPANY_NUMBER}</span>
            </p>
            <p>
              {PLACE_OF_REGISTRATION}
            </p>
            <p className="max-w-md">
              Registered Office Address: <span className="font-black text-slate-300">{REGISTERED_OFFICE_ADDRESS}</span>
            </p>
          </div>

          {/* Copyright & Support info */}
          <div className="flex flex-col md:items-end justify-between gap-4">
            <div className="flex flex-col md:items-end gap-2">
              <div className="flex items-center gap-2 text-slate-300 font-black">
                <Mail className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                <span className="uppercase tracking-widest text-[10px]">Legal Enquiries</span>
              </div>
              <a 
                href={`mailto:${SUPPORT_EMAIL}`}
                className="hover:text-indigo-400 font-black text-slate-300 underline transition-colors"
              >
                {SUPPORT_EMAIL}
              </a>
            </div>

            <div className="text-[10px] text-slate-600 font-black tracking-widest uppercase md:text-right">
              &copy; {new Date().getFullYear()} ustats.pro. All rights reserved.
            </div>
          </div>
          
        </div>
      </div>
    </footer>
  );
};

export default StandardFooter;
