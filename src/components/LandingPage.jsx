import React, { useState, useEffect } from 'react';
import { Target, Zap, Battery, WifiOff, Smartphone, BarChart3, Wind, CloudUpload, Dumbbell, Users, ChevronRight, Menu, X, ArrowRight } from 'lucide-react';

const LandingPage = ({ onLogin, onDemo }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 overflow-x-hidden">

      {/* ========== STICKY NAV ========== */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-slate-950/95 backdrop-blur-xl border-b border-white/5 shadow-2xl' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <img src="/logo.png" alt="ustats.pro" className="w-9 h-9 rounded-xl shadow-lg shadow-indigo-500/20" />
            <span className="text-xl font-black text-white lowercase tracking-widest">
              ustats<span className="text-indigo-400 font-light">.pro</span>
            </span>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            <button onClick={() => scrollTo('features')} className="text-sm text-slate-400 hover:text-white font-semibold tracking-wide transition-colors">Features</button>
            <button onClick={() => scrollTo('pwa')} className="text-sm text-slate-400 hover:text-white font-semibold tracking-wide transition-colors">Why PWA</button>
            <button onClick={() => scrollTo('training')} className="text-sm text-slate-400 hover:text-white font-semibold tracking-wide transition-colors">Training</button>
            <div className="h-5 w-px bg-slate-700"></div>
            <button 
              onClick={onLogin}
              className="text-sm font-bold text-indigo-400 hover:text-indigo-300 transition-colors tracking-wide"
            >
              Login
            </button>
            <button 
              onClick={onLogin}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-black rounded-xl transition-all shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 active:scale-95 tracking-wider uppercase"
            >
              Sign Up
            </button>
          </div>

          {/* Mobile hamburger */}
          <button className="md:hidden text-slate-400 hover:text-white" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-slate-950/98 backdrop-blur-xl border-t border-white/5 px-6 py-6 space-y-4 animate-in">
            <button onClick={() => scrollTo('features')} className="block w-full text-left text-slate-300 hover:text-white font-semibold py-2">Features</button>
            <button onClick={() => scrollTo('pwa')} className="block w-full text-left text-slate-300 hover:text-white font-semibold py-2">Why PWA</button>
            <button onClick={() => scrollTo('training')} className="block w-full text-left text-slate-300 hover:text-white font-semibold py-2">Training</button>
            <div className="h-px bg-slate-800 my-2"></div>
            <button onClick={onLogin} className="block w-full text-left text-indigo-400 font-bold py-2">Login</button>
            <button onClick={onLogin} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl transition-all uppercase tracking-widest text-sm">
              Sign Up Free
            </button>
          </div>
        )}
      </nav>

      {/* ========== HERO SECTION ========== */}
      <section className="relative min-h-screen flex items-center justify-center px-4 sm:px-8 pt-20">
        {/* Gradient orbs */}
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-indigo-600/15 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-20 right-1/4 w-80 h-80 bg-violet-600/10 rounded-full blur-[100px] pointer-events-none"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-[150px] pointer-events-none"></div>

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          {/* Logo */}
          <div className="mb-8 flex justify-center">
            <div className="relative">
              <img src="/logo.png" alt="ustats.pro Scientific Logo" className="w-28 h-28 sm:w-36 sm:h-36 rounded-3xl shadow-2xl shadow-indigo-500/30" />
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-indigo-500/20 to-transparent pointer-events-none"></div>
            </div>
          </div>

          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full mb-6">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-xs font-bold text-indigo-300 tracking-widest uppercase">Beta — Invite Only</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-white leading-[1.05] tracking-tight mb-6">
            Sideline Intelligence
            <br />
            <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">
              for Elite Ultimate.
            </span>
          </h1>

          {/* Sub-headline */}
          <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed font-medium">
            Track Grass, Beach, and Indoor games with 100% offline reliability.
            <br className="hidden sm:block" />
            Built by coaches, for coaches.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button 
              onClick={onLogin}
              id="hero-signup-btn"
              className="group w-full sm:w-auto px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl transition-all shadow-xl shadow-indigo-500/25 hover:shadow-indigo-500/40 active:scale-[0.97] uppercase tracking-widest text-sm flex items-center justify-center gap-3"
            >
              Sign Up / Login
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <button 
              onClick={onDemo}
              id="hero-demo-btn"
              className="group w-full sm:w-auto px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-slate-300 hover:text-white font-bold rounded-2xl transition-all active:scale-[0.97] uppercase tracking-widest text-sm flex items-center justify-center gap-3"
            >
              View Live Demo
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          {/* Social proof */}
          <div className="mt-14 flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-slate-500 text-xs font-bold tracking-widest uppercase">
            <span className="flex items-center gap-2">
              <span className="text-indigo-400 text-lg font-black">100%</span> Offline
            </span>
            <span className="hidden sm:block w-px h-4 bg-slate-700"></span>
            <span className="flex items-center gap-2">
              <span className="text-indigo-400 text-lg font-black">50%</span> Fewer Taps
            </span>
            <span className="hidden sm:block w-px h-4 bg-slate-700"></span>
            <span className="flex items-center gap-2">
              <span className="text-indigo-400 text-lg font-black">0</span> Install Required
            </span>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 border-2 border-slate-700 rounded-full flex items-start justify-center p-1.5">
            <div className="w-1.5 h-2.5 bg-indigo-500 rounded-full animate-pulse"></div>
          </div>
        </div>
      </section>

      {/* ========== PWA ADVANTAGE ========== */}
      <section id="pwa" className="relative py-24 sm:py-32 px-4 sm:px-8">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900/50 to-slate-950 pointer-events-none"></div>
        
        <div className="relative z-10 max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight mb-4">
              No App Store. <span className="text-indigo-400">No Friction.</span>
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto text-lg leading-relaxed">
              ustats.pro is a Progressive Web App (PWA). Add it to your home screen in seconds for a full-screen, native-feeling experience on iOS and Android. One account, every device.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <AdvantageCard 
              icon={<Zap className="w-6 h-6" />}
              emoji="🚀"
              title="Zero Install"
              description="Instant access via your browser. No waiting for downloads, no storage bloat. Open the URL and you're coaching."
              accent="from-amber-500 to-orange-500"
            />
            <AdvantageCard 
              icon={<Battery className="w-6 h-6" />}
              emoji="🔋"
              title="Battery Efficient"
              description="Optimized for long tournament days. No background GPS drain, no unnecessary push notifications eating your battery."
              accent="from-emerald-500 to-teal-500"
            />
            <AdvantageCard 
              icon={<WifiOff className="w-6 h-6" />}
              emoji="📶"
              title="Offline First"
              description="Data is safe even without signal. Every stat is stored locally and auto-syncs the moment you find Wi-Fi."
              accent="from-indigo-500 to-violet-500"
            />
          </div>
        </div>
      </section>

      {/* ========== FEATURE GRID ========== */}
      <section id="features" className="relative py-24 sm:py-32 px-4 sm:px-8">
        <div className="absolute top-0 right-0 w-96 h-96 bg-violet-600/8 rounded-full blur-[120px] pointer-events-none"></div>
        
        <div className="relative z-10 max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-violet-500/10 border border-violet-500/20 rounded-full mb-4">
              <BarChart3 className="w-3.5 h-3.5 text-violet-400" />
              <span className="text-xs font-bold text-violet-300 tracking-widest uppercase">Core Features</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight mb-4">
              Built for the <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">Sideline.</span>
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto text-lg">
              Every feature designed around a single principle: eyes on the field, not on the screen.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <FeatureCard
              icon={<Smartphone className="w-7 h-7" />}
              title="Implicit Flow"
              subtitle="50% FEWER TAPS"
              description="Tap players, not actions. The system infers passes from the possession chain. Score a point in two taps, not five."
              gradient="from-indigo-600/20 to-indigo-600/5"
              borderColor="border-indigo-500/20"
            />
            <FeatureCard
              icon={<BarChart3 className="w-7 h-7" />}
              title="NIS Analytics"
              subtitle="NET IMPACT SCORES"
              description="Real-time Net Impact Scores for every player on your roster. Know who's lifting the team and who needs rotation — instantly."
              gradient="from-violet-600/20 to-violet-600/5"
              borderColor="border-violet-500/20"
            />
            <FeatureCard
              icon={<Wind className="w-7 h-7" />}
              title="Pull Quality"
              subtitle="MEASURABLE PRESSURE"
              description="Track distance and pressure to find your best puller. Quantify what used to be gut feeling with real pull analytics."
              gradient="from-emerald-600/20 to-emerald-600/5"
              borderColor="border-emerald-500/20"
            />
            <FeatureCard
              icon={<CloudUpload className="w-7 h-7" />}
              title="Smart-Sync"
              subtitle="ZERO DATA LOSS"
              description="Auto-syncs to the cloud the moment you find Wi-Fi. Track in airplane mode at a field tournament — data uploads later."
              gradient="from-amber-600/20 to-amber-600/5"
              borderColor="border-amber-500/20"
            />
          </div>
        </div>
      </section>

      {/* ========== TRAINING MODE ========== */}
      <section id="training" className="relative py-24 sm:py-32 px-4 sm:px-8">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-indigo-950/20 to-slate-950 pointer-events-none"></div>
        
        <div className="relative z-10 max-w-5xl mx-auto">
          <div className="bg-gradient-to-br from-slate-900/80 to-slate-800/40 border border-white/10 rounded-3xl p-8 sm:p-12 lg:p-16 backdrop-blur-sm shadow-2xl">
            <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16">
              {/* Left: Content */}
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-3 mb-5">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                    <Dumbbell className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-xs font-bold text-emerald-300 tracking-widest uppercase">Training Mode</span>
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                    <span className="text-xs font-black text-amber-400 tracking-widest uppercase">Coming Soon</span>
                  </div>
                </div>
                
                <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-5 leading-tight">
                  Coach Every Rep.
                </h2>
                
                <p className="text-slate-400 text-lg leading-relaxed mb-8">
                  Switch from game-day to practice-mode. Track individual drills, manage rotations, and measure training efficiency across your entire club hierarchy.
                </p>

                <div className="space-y-4">
                  <TrainingBullet text="Individual drill tracking with per-rep metrics" />
                  <TrainingBullet text="Rotation management across multiple squads" />
                  <TrainingBullet text="Club hierarchy: manage Juniors → Development → First Team" />
                  <TrainingBullet text="Compare training stats against game-day performance" />
                </div>
              </div>

              {/* Right: Visual */}
              <div className="flex-shrink-0 w-full lg:w-72">
                <div className="bg-slate-950/60 border border-white/10 rounded-2xl p-6 space-y-4">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Practice Session</div>
                  <div className="space-y-3">
                    <StatBar label="Completion %" value={87} color="bg-emerald-500" />
                    <StatBar label="Huck Accuracy" value={64} color="bg-violet-500" />
                    <StatBar label="Break Throws" value={42} color="bg-amber-500" />
                    <StatBar label="Reset Rate" value={91} color="bg-indigo-500" />
                  </div>
                  <div className="pt-3 border-t border-white/5 flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-semibold">12 Athletes</span>
                    <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                      <Users className="w-3 h-3" /> Active
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========== CTA SECTION ========== */}
      <section className="relative py-24 sm:py-32 px-4 sm:px-8">
        <div className="absolute inset-0 bg-gradient-to-t from-indigo-950/30 to-transparent pointer-events-none"></div>
        
        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight mb-5">
            Ready to upgrade your <span className="text-indigo-400">sideline?</span>
          </h2>
          <p className="text-slate-400 text-lg mb-10 max-w-xl mx-auto">
            Join the coaches already using data to make smarter decisions — in real time, from the field.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button 
              onClick={onLogin}
              id="cta-signup-btn"
              className="group w-full sm:w-auto px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl transition-all shadow-xl shadow-indigo-500/25 hover:shadow-indigo-500/40 active:scale-[0.97] uppercase tracking-widest text-sm flex items-center justify-center gap-3"
            >
              Get Started
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <button 
              onClick={onDemo}
              id="cta-demo-btn"
              className="group w-full sm:w-auto px-10 py-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-slate-300 hover:text-white font-bold rounded-2xl transition-all active:scale-[0.97] uppercase tracking-widest text-sm flex items-center justify-center gap-3"
            >
              Live Demo
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </section>

      {/* ========== FOOTER ========== */}
      <footer className="border-t border-white/5 bg-slate-950/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="ustats.pro" className="w-8 h-8 rounded-lg opacity-60" />
              <span className="text-sm font-bold text-slate-500 lowercase tracking-widest">
                ustats<span className="text-slate-600">.pro</span>
              </span>
            </div>

            <div className="flex items-center gap-6 text-xs font-semibold text-slate-500">
              <a href="#" className="hover:text-slate-300 transition-colors">Contact</a>
              <a href="#" className="hover:text-slate-300 transition-colors">Privacy</a>
              <a href="#" className="hover:text-slate-300 transition-colors">Terms</a>
            </div>

            <div className="text-xs text-slate-600 font-medium">
              Copyright 2026 ustats.pro
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};


/* ========== SUB-COMPONENTS ========== */

const AdvantageCard = ({ emoji, title, description, accent }) => (
  <div className="group relative bg-slate-900/60 border border-white/5 hover:border-white/10 rounded-2xl p-8 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/5">
    <div className="text-4xl mb-5">{emoji}</div>
    <h3 className="text-lg font-black text-white mb-3 tracking-tight">{title}</h3>
    <p className="text-slate-400 text-sm leading-relaxed">{description}</p>
    <div className={`absolute bottom-0 left-8 right-8 h-px bg-gradient-to-r ${accent} opacity-0 group-hover:opacity-40 transition-opacity duration-300`}></div>
  </div>
);

const FeatureCard = ({ icon, title, subtitle, description, gradient, borderColor }) => (
  <div className={`group relative bg-gradient-to-br ${gradient} border ${borderColor} hover:border-white/15 rounded-2xl p-8 transition-all duration-300 hover:shadow-xl`}>
    <div className="flex items-start gap-5">
      <div className="flex-shrink-0 p-3 bg-white/5 rounded-xl text-indigo-400 group-hover:scale-110 transition-transform duration-300">
        {icon}
      </div>
      <div>
        <div className="text-[10px] font-black text-indigo-400/70 uppercase tracking-[0.2em] mb-1">{subtitle}</div>
        <h3 className="text-xl font-black text-white mb-2 tracking-tight">{title}</h3>
        <p className="text-slate-400 text-sm leading-relaxed">{description}</p>
      </div>
    </div>
  </div>
);

const TrainingBullet = ({ text }) => (
  <div className="flex items-start gap-3">
    <div className="mt-1 w-5 h-5 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
    </div>
    <span className="text-slate-300 text-sm font-medium">{text}</span>
  </div>
);

const StatBar = ({ label, value, color }) => (
  <div>
    <div className="flex items-center justify-between mb-1">
      <span className="text-xs text-slate-400 font-semibold">{label}</span>
      <span className="text-xs text-white font-black">{value}%</span>
    </div>
    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full transition-all duration-1000`} style={{ width: `${value}%` }}></div>
    </div>
  </div>
);

export default LandingPage;
