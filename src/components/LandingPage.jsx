import React, { useState, useEffect } from 'react';
import { Zap, Battery, WifiOff, Smartphone, BarChart3, Wind, CloudUpload, Dumbbell, Users, ChevronRight, Menu, X, ArrowRight, Lock, Mic, Check, Star } from 'lucide-react';
import StandardFooter from './StandardFooter';

const LandingPage = ({ onLogin, onSignUp, onDemo }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [isYearly, setIsYearly] = useState(false);

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
          <div className="flex items-center gap-3.5 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <img src="/logo_icon.png" alt="ustats.pro" className="w-9 h-9 rounded-xl shadow-lg shadow-indigo-500/20" />
            <div className="flex flex-col">
              <span className="text-base font-black text-white lowercase tracking-widest leading-none">ustats.pro</span>
              <span className="text-[7.5px] font-black text-slate-400 uppercase tracking-[0.25em] mt-1 leading-none">sideline intelligence</span>
            </div>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            <button onClick={() => scrollTo('features')} className="text-sm text-slate-400 hover:text-white font-semibold tracking-wide transition-colors">Features</button>
            <button onClick={() => scrollTo('pwa')} className="text-sm text-slate-400 hover:text-white font-semibold tracking-wide transition-colors">Why PWA</button>
            <button onClick={() => scrollTo('pricing')} className="text-sm text-slate-400 hover:text-white font-semibold tracking-wide transition-colors">Pricing</button>
            <div className="h-5 w-px bg-slate-700"></div>
            <button onClick={onLogin} className="text-sm font-bold text-indigo-400 hover:text-indigo-300 transition-colors tracking-wide">Login</button>
            <button onClick={onSignUp} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-black rounded-xl transition-all shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 active:scale-95 tracking-wider uppercase">
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
            <button onClick={() => scrollTo('pricing')} className="block w-full text-left text-slate-300 hover:text-white font-semibold py-2">Pricing</button>
            <div className="h-px bg-slate-800 my-2"></div>
            <button onClick={onLogin} className="block w-full text-left text-indigo-400 font-bold py-2">Login</button>
            <button onClick={onSignUp} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl transition-all uppercase tracking-widest text-sm">
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
          <div className="mb-10 flex justify-center">
            <div className="relative">
              <img src="/logo_dark.png" alt="ustats.pro Scientific Logo" className="w-80 h-80 sm:w-[28rem] sm:h-[28rem] rounded-[4rem] shadow-2xl shadow-indigo-500/30" />
              <div className="absolute inset-0 rounded-[4rem] bg-gradient-to-br from-indigo-500/20 to-transparent pointer-events-none"></div>
            </div>
          </div>

          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full mb-6">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-xs font-bold text-indigo-300 tracking-widest uppercase">7-Day Free Coach Pro Trial</span>
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
            <button onClick={onSignUp} id="hero-signup-btn" className="group w-full sm:w-auto px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl transition-all shadow-xl shadow-indigo-500/25 hover:shadow-indigo-500/40 active:scale-[0.97] uppercase tracking-widest text-sm flex items-center justify-center gap-3">
              Sign Up Free
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <button 
              onClick={onDemo}
              id="hero-demo-btn"
              className="group w-full sm:w-auto px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-slate-300 hover:text-white font-bold rounded-2xl transition-all active:scale-[0.97] uppercase tracking-widest text-sm flex items-center justify-center gap-3"
            >
              View Demo
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
            <FeatureCard icon={<Smartphone className="w-7 h-7" />} title="Implicit Flow" subtitle="50% FEWER TAPS" description="Tap players, not actions. The system infers passes from the possession chain. Score a point in two taps, not five." gradient="from-indigo-600/20 to-indigo-600/5" borderColor="border-indigo-500/20" />
            <FeatureCard icon={<BarChart3 className="w-7 h-7" />} title="NIS Analytics" subtitle="NET IMPACT SCORES" description="Real-time Net Impact Scores for every player on your roster. Know who's lifting the team and who needs rotation — instantly." gradient="from-violet-600/20 to-violet-600/5" borderColor="border-violet-500/20" />
            <FeatureCard icon={<Wind className="w-7 h-7" />} title="Pull Quality" subtitle="MEASURABLE PRESSURE" description="Track distance and pressure to find your best puller. Quantify what used to be gut feeling with real pull analytics." gradient="from-emerald-600/20 to-emerald-600/5" borderColor="border-emerald-500/20" />
            <FeatureCard icon={<CloudUpload className="w-7 h-7" />} title="Smart-Sync" subtitle="ALL TIERS — ZERO DATA LOSS" description="Automatic background sync with 100% offline reliability, included for every user. Track in airplane mode — data uploads the moment you find Wi-Fi." gradient="from-amber-600/20 to-amber-600/5" borderColor="border-amber-500/20" />
          </div>
        </div>
      </section>

      {/* ========== PRICING TIERS ========== */}
      <section id="pricing" className="relative py-24 sm:py-32 px-4 sm:px-8">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900/40 to-slate-950 pointer-events-none"></div>
        <div className="relative z-10 max-w-5xl mx-auto">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full mb-4">
              <Star className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-xs font-bold text-indigo-300 tracking-widest uppercase">Pricing</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight mb-4">
              Simple, <span className="text-indigo-400">Transparent</span> Pricing.
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto text-lg mb-6">Start free. Upgrade when you're ready to go deeper.</p>
          </div>

          {/* Billing Cycle Toggle */}
          <div className="flex items-center justify-center gap-4 mb-12">
            <span className={`text-sm font-semibold transition-colors duration-200 ${!isYearly ? 'text-white' : 'text-slate-400'}`}>Monthly</span>
            <button 
              onClick={() => setIsYearly(!isYearly)}
              className="relative w-14 h-8 bg-indigo-950/40 hover:bg-indigo-950/60 border border-indigo-500/30 rounded-full transition-all duration-300 focus:outline-none p-1 flex items-center"
              aria-label="Toggle billing cycle"
            >
              <div 
                className={`w-6 h-6 bg-indigo-500 rounded-full transition-transform duration-300 shadow-md shadow-indigo-500/30 ${isYearly ? 'translate-x-6' : 'translate-x-0'}`}
              />
            </button>
            <span className={`text-sm font-semibold transition-colors duration-200 flex items-center gap-1.5 ${isYearly ? 'text-white' : 'text-slate-400'}`}>
              Annually
              <span className="px-2 py-0.5 text-[10px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full uppercase tracking-wider">
                Save 17%
              </span>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Starter */}
            <div className="bg-slate-900/60 border border-white/10 rounded-3xl p-8 flex flex-col">
              <div className="mb-6">
                <div className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Starter</div>
                <div className="text-5xl font-black text-white mb-1">Free</div>
                <div className="text-slate-500 text-sm">Includes 7-day Coach Pro trial.</div>
              </div>
              <div className="space-y-3 flex-1 mb-8">
                <TierFeature text="1 Club / up to 3 Teams" />
                <TierFeature text="Basic Points & Score Tracking" />
                <TierFeature text="Implicit Flow — 50% fewer taps" />
                <TierFeature text="Smart-Sync — Universal offline reliability" />
              </div>
              <button onClick={onSignUp} className="w-full py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white font-black rounded-xl transition-all uppercase tracking-widest text-sm">
                Get Started Free
              </button>
            </div>
            {/* Coach Pro */}
            <div className="relative bg-gradient-to-br from-indigo-600/20 to-violet-600/10 border border-indigo-500/30 rounded-3xl p-8 flex flex-col shadow-2xl shadow-indigo-500/10">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <div className="px-4 py-1 bg-indigo-500 text-white text-xs font-black uppercase tracking-widest rounded-full shadow-lg">Most Popular</div>
              </div>
              <div className="mb-6">
                <div className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-2">Coach Pro</div>
                <div className="flex items-end gap-1 mb-1">
                  <span className="text-5xl font-black text-white transition-all duration-300">
                    {isYearly ? '£50' : '£5'}
                  </span>
                  <span className="text-slate-400 text-lg mb-1 transition-all duration-300">
                    {isYearly ? '/year' : '/month'}
                  </span>
                </div>
                <div className="text-slate-500 text-sm">
                  Per club. 7-day free trial on signup!
                </div>
              </div>
              <div className="space-y-3 flex-1 mb-8">
                <TierFeature text="Unlimited Clubs & Teams" pro />
                <TierFeature text="Advanced NIS (Net Impact Score) Analytics" pro />
                <TierFeature text="Pull Quality Tracking & Pressure Reports" pro />
                <TierFeature text="Coach Pro Data Analytics Page" pro />
                <TierFeature text="Season-long performance trends" pro />
                <TierFeature text="Smart-Sync — Universal offline reliability" pro />
              </div>
              <button onClick={onSignUp} className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl transition-all uppercase tracking-widest text-sm shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40">
                Upgrade to Coach Pro
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ========== COMING SOON TEASER ========== */}
      <section className="relative py-24 sm:py-32 px-4 sm:px-8">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-violet-600/8 rounded-full blur-[140px] pointer-events-none"></div>
        <div className="relative z-10 max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full mb-4">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
              <span className="text-xs font-bold text-amber-300 tracking-widest uppercase">Coming Soon</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight mb-4">
              The Future of <span className="bg-gradient-to-r from-amber-400 to-violet-400 bg-clip-text text-transparent">Sideline Intelligence.</span>
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto text-lg">The roadmap for what's coming next to Coach Pro.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <ComingSoonCard
              icon={<Mic className="w-7 h-7" />}
              title="Voice Pro"
              description="Eyes on the disc, not the device. Voice Pro will leverage offline AI to track every pass, D, and goal using simple voice commands — no screen interaction required."
            />
            <ComingSoonCard
              icon={<Dumbbell className="w-7 h-7" />}
              title="Training Mode Pro"
              description="Switch from game-day to practice-mode and coach every rep. Track individual drills, manage rotations, and measure training efficiency across your entire club hierarchy — with deep-dive analytics including rep-speed tracking, heat maps, and season-long trends to bridge the gap between practice and gameday."
            />
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
              View Demo
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </section>

      {/* ========== FOOTER ========== */}
      <StandardFooter />
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

const TierFeature = ({ text, pro }) => (
  <div className="flex items-center gap-3">
    <Check className={`w-4 h-4 flex-shrink-0 ${pro ? 'text-indigo-400' : 'text-emerald-500'}`} />
    <span className="text-slate-300 text-sm font-medium">{text}</span>
  </div>
);

const ComingSoonCard = ({ icon, title, description }) => (
  <div className="relative bg-slate-900/40 border border-white/5 rounded-2xl p-8 overflow-hidden group">
    <div className="absolute inset-0 bg-gradient-to-br from-slate-800/30 to-transparent pointer-events-none"></div>
    <div className="absolute top-4 right-4">
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full">
        <Lock className="w-3 h-3 text-amber-400" />
        <span className="text-[10px] font-black text-amber-400 tracking-widest uppercase">Coming Soon</span>
      </div>
    </div>
    <div className="flex items-start gap-5 opacity-70 grayscale group-hover:opacity-90 group-hover:grayscale-0 transition-all duration-500">
      <div className="flex-shrink-0 p-3 bg-white/5 rounded-xl text-slate-400">{icon}</div>
      <div>
        <h3 className="text-xl font-black text-white mb-2 tracking-tight">{title}</h3>
        <p className="text-slate-400 text-sm leading-relaxed">{description}</p>
      </div>
    </div>
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
