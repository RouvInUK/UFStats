import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, ArrowLeft, Sun, Moon, Search, Download, Menu, X, ChevronRight, Compass } from 'lucide-react';
import { marked } from 'marked';
import StandardFooter from '../StandardFooter';
import { getLegalPath } from '../../constants/legal';

const HelpLayout = ({ currentPath }) => {
  const [markdown, setMarkdown] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [headings, setHeadings] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeHeadingId, setActiveHeadingId] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [beachMode, setBeachMode] = useState(() => {
    return localStorage.getItem('ufstats_beach_mode') === 'true';
  });

  const contentRef = useRef(null);

  // Sync Beach Mode
  useEffect(() => {
    if (beachMode) {
      document.documentElement.classList.add('beach-mode');
    } else {
      document.documentElement.classList.remove('beach-mode');
    }
    localStorage.setItem('ufstats_beach_mode', beachMode.toString());
  }, [beachMode]);

  // Load user manual markdown
  useEffect(() => {
    const fetchManual = async () => {
      setLoading(true);
      try {
        const response = await fetch('/ustats_pro_User_Manual.md');
        if (!response.ok) throw new Error('Failed to load user manual');
        const text = await response.text();
        
        // Strip the top center aligned logo block from rendering in HTML content
        // since the HelpLayout already features a beautiful premium header
        const cleanMarkdown = text.replace(/<div align="center">[\s\S]*?<\/div>\s*---\s*/i, '');
        
        setMarkdown(cleanMarkdown);

        // Customize marked rendering to inject IDs for scrolling
        const customRenderer = new marked.Renderer();
        customRenderer.heading = function({ text, depth }) {
          const id = text.toLowerCase()
            .replace(/<[^>]*>/g, '') // remove HTML tags
            .replace(/[^a-z0-9]+/g, '-') // convert spaces/symbols
            .replace(/(^-|-$)/g, ''); // trim hyphens
          return `<h${depth} id="${id}" class="scroll-mt-24">${text}</h${depth}>`;
        };

        const parsedHtml = marked(cleanMarkdown, { renderer: customRenderer });
        setHtmlContent(parsedHtml);

        // Extract Headings for Table of Contents
        const lines = cleanMarkdown.split('\n');
        const extractedHeadings = [];
        lines.forEach((line) => {
          if (line.startsWith('## ')) {
            const title = line.substring(3).trim();
            const id = title.toLowerCase()
              .replace(/<[^>]*>/g, '')
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/(^-|-$)/g, '');
            extractedHeadings.push({ depth: 2, title, id });
          } else if (line.startsWith('### ')) {
            const title = line.substring(4).trim();
            const id = title.toLowerCase()
              .replace(/<[^>]*>/g, '')
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/(^-|-$)/g, '');
            extractedHeadings.push({ depth: 3, title, id });
          }
        });
        setHeadings(extractedHeadings);
      } catch (err) {
        console.error(err);
        setHtmlContent('<p class="text-rose-400 font-bold p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl">Could not load the User Manual. Please check your internet connection or reload the page.</p>');
      } finally {
        setLoading(false);
      }
    };

    fetchManual();
  }, []);

  // Monitor scroll position to update active heading inside the sidebar
  useEffect(() => {
    const handleScroll = () => {
      if (headings.length === 0) return;

      const scrollPosition = window.scrollY + 120; // offset for sticky navbar
      let currentActiveId = headings[0].id;

      for (let i = 0; i < headings.length; i++) {
        const el = document.getElementById(headings[i].id);
        if (el && el.offsetTop <= scrollPosition) {
          currentActiveId = headings[i].id;
        } else {
          break;
        }
      }

      setActiveHeadingId(currentActiveId);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [headings]);

  const handleGoBack = () => {
    // Return to dashboard if user has session tokens, otherwise return to home landing
    const hasSession = localStorage.getItem('sb-ustats-pro-auth-token') || localStorage.getItem('ufstats_team');
    window.history.pushState({}, '', getLegalPath(hasSession ? '/dashboard' : '/'));
  };

  const scrollToHeading = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setMobileMenuOpen(false);
    }
  };

  // Simple client-side text filtering
  const filteredHeadings = headings.filter(h => 
    h.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans transition-colors duration-300 selection:bg-indigo-500 selection:text-white">
      
      {/* ========== NAVBAR ========== */}
      <header className="w-full bg-slate-950/80 backdrop-blur-md border-b border-slate-800/60 sticky top-0 z-50 px-4 sm:px-8 py-4 flex items-center justify-between shadow-md print:hidden">
        <div className="flex items-center gap-4">
          <button 
            onClick={handleGoBack}
            className="flex items-center gap-2 p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-all duration-200 focus-visible:outline-none"
            aria-label="Return to app"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="hidden sm:inline text-sm font-bold uppercase tracking-wider">Back</span>
          </button>
          
          <div className="h-6 w-px bg-slate-800 hidden sm:block"></div>
          
          <div className="flex items-center gap-2.5">
            <img src="/logo_icon.png" alt="ustats.pro" className="w-7 h-7 rounded-lg shadow-lg shadow-indigo-500/20" />
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-white lowercase tracking-widest leading-none">ustats.pro</span>
                <span className="text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded uppercase tracking-wide leading-none">Help Hub</span>
              </div>
              <span className="text-[6.5px] font-black text-slate-400 uppercase tracking-[0.2em] mt-0.5 leading-none">sideline intelligence</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* PDF Download Action */}
          <a
            href="/ustats_pro_User_Manual.pdf"
            download="ustats_pro_User_Manual.pdf"
            className="flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 shadow-md shadow-indigo-500/10"
            title="Download PDF version of user manual for offline access"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Download PDF</span>
          </a>

          {/* Beach Mode Toggle */}
          <button
            onClick={() => setBeachMode(!beachMode)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 border ${
              beachMode 
                ? 'bg-amber-400 text-slate-950 border-amber-500 shadow-md' 
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
            title="Toggle high contrast mode for daylight readability"
          >
            {beachMode ? <Sun className="w-4 h-4" /> : <Compass className="w-4 h-4" />}
            <span className="hidden sm:inline">Beach Mode</span>
          </button>

          {/* Mobile Hamburguer */}
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-slate-400 hover:text-white"
            aria-label="Toggle table of contents menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {/* ========== DYNAMIC LAYOUT BODY ========== */}
      <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-8 py-10 flex flex-col md:flex-row gap-8">
        
        {/* ========== SIDEBAR NAVIGATION ========== */}
        <aside className={`w-full md:w-72 flex-shrink-0 md:block ${mobileMenuOpen ? 'block' : 'hidden'} print:hidden`}>
          <div className="bg-slate-950/40 border border-slate-800/40 p-4 rounded-2xl sticky top-24 flex flex-col gap-4 max-h-[80vh] overflow-y-auto">
            
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
              <input 
                type="text" 
                placeholder="Search guide..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700/50 rounded-xl py-2 pl-9 pr-4 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-500"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-2.5 text-xs text-slate-500 hover:text-white"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="h-px bg-slate-800/60"></div>
            
            {/* Navigation Headings Links */}
            <nav className="flex flex-col gap-1.5" aria-label="User manual table of contents">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-3 mb-1">Table of Contents</span>
              {filteredHeadings.length === 0 ? (
                <span className="text-xs text-slate-500 px-3 py-2">No matching topics found.</span>
              ) : (
                filteredHeadings.map((h, i) => (
                  <button
                    key={i}
                    onClick={() => scrollToHeading(h.id)}
                    className={`flex items-center gap-2 px-3 py-2 text-left rounded-xl transition-all duration-200 text-xs sm:text-sm font-bold ${
                      activeHeadingId === h.id 
                        ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20' 
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/30 border border-transparent'
                    } ${h.depth === 3 ? 'pl-6 font-semibold opacity-90' : ''}`}
                  >
                    {h.depth === 2 ? (
                      <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${activeHeadingId === h.id ? 'rotate-90 text-indigo-400' : 'text-slate-500'}`} />
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-700 flex-shrink-0 ml-1"></span>
                    )}
                    <span className="truncate">{h.title}</span>
                  </button>
                ))
              )}
            </nav>
          </div>
        </aside>

        {/* ========== MANUAL DYNAMIC TEXT CONTAINER ========== */}
        <main className="flex-1 min-w-0">
          <article 
            ref={contentRef}
            className="bg-slate-950/20 border border-slate-800/40 rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden transition-colors duration-300"
          >
            {/* Background design gradient glow */}
            <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none"></div>

            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-4 text-center">
                <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                <span className="text-slate-400 font-bold uppercase tracking-widest text-xs animate-pulse">Loading User Manual...</span>
              </div>
            ) : (
              <div className="relative z-10">
                {/* Premium Banner */}
                <div className="flex flex-col items-center justify-center text-center pb-8 mb-8 border-b border-slate-800/80">
                  <img src="/logo_dark.png" alt="ustats.pro Logo" className="w-56 mb-6" />
                  <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight tracking-tight uppercase">
                    User Manual & Getting Started Guide
                  </h1>
                  <p className="text-slate-400 text-sm font-semibold max-w-lg mt-3">
                    The ultimate sideline companion app manual. Learn game setup, Live stat tracking, lineup calling, and how to read the advanced True Impact Analytics Dashboard.
                  </p>
                </div>

                {/* Markdown Parsed Content */}
                <div 
                  className="manual-content max-w-none text-slate-300 leading-relaxed font-sans"
                  dangerouslySetInnerHTML={{ __html: htmlContent }}
                />
              </div>
            )}
          </article>
        </main>
      </div>

      {/* ========== COMPLIANCE FOOTER ========== */}
      <StandardFooter />

    </div>
  );
};

export default HelpLayout;
