import React, { useState, useEffect } from 'react';
import { Brain, RefreshCw, Activity, Target, Users, Zap, ShieldAlert } from 'lucide-react';

const FormatText = ({ text }) => {
  if (!text) return null;
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} className="text-white font-black">{part.slice(2, -2)}</strong>;
        }
        return <React.Fragment key={i}>
           {part.split('\n\n').map((subpart, j, arr) => (
              <React.Fragment key={`${i}-${j}`}>
                {subpart}
                {j < arr.length - 1 && <><br/><br/></>}
              </React.Fragment>
           ))}
        </React.Fragment>;
      })}
    </>
  );
};

const AiAdvisorModule = ({ playerStats, rawStats, gameType, score }) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [insights, setInsights] = useState(null);

  const generateInsights = () => {
    setIsAnalyzing(true);
    setInsights(null);

    setTimeout(() => {
      const generated = {
        offensiveFlow: "Insufficient data to analyze offensive patterns.",
        defensivePressure: "Insufficient data to analyze defensive pressure.",
        personnel: "No personnel anomalies detected.",
        deepGame: "No deep throws attempted yet."
      };

      if (playerStats && playerStats.length > 0) {
        
        // --- Aggregates ---
        const totalTurnovers = playerStats.reduce((sum, p) => sum + p.turnovers, 0);
        const totalBlocks = playerStats.reduce((sum, p) => sum + p.blocks, 0);
        
        // --- 1. Offensive Flow ---
        let possessions = [];
        let currentPossession = { passes: 0, scored: false };
        if (rawStats && rawStats.length > 0) {
            rawStats.forEach(stat => {
               if (stat.stat_type === 'Pass') {
                  currentPossession.passes += 1;
               } else if (stat.stat_type === 'Point') {
                  currentPossession.passes += 1;
                  currentPossession.scored = true;
                  possessions.push(currentPossession);
                  currentPossession = { passes: 0, scored: false };
               } else if (['Throwaway', 'Drop', 'Stall Out', 'Opponent Turnover', 'Opponent Point'].includes(stat.stat_type)) {
                  if (stat.stat_type !== 'Opponent Turnover' && stat.stat_type !== 'Opponent Point') {
                     possessions.push(currentPossession);
                  }
                  currentPossession = { passes: 0, scored: false };
               }
            });
        }
        
        const longPossessions = possessions.filter(p => p.passes > 6);
        const shortPossessions = possessions.filter(p => p.passes <= 6 && p.passes > 0);
        const longConvRate = longPossessions.length > 0 ? (longPossessions.filter(p => p.scored).length / longPossessions.length) * 100 : 0;
        const shortConvRate = shortPossessions.length > 0 ? (shortPossessions.filter(p => p.scored).length / shortPossessions.length) * 100 : 0;

        if (longPossessions.length > 0 && longConvRate < shortConvRate - 20) {
           generated.offensiveFlow = `Possessions longer than 6 passes have a **${longConvRate.toFixed(0)}%** conversion rate, compared to **${shortConvRate.toFixed(0)}%** for shorter drives. The offense is 'choking' in the red zone.\n\n**Strategic Adjustment:** Increase horizontal resets and swing the disc earlier.`;
        } else if (shortPossessions.length > 0 && shortConvRate < 50) {
           generated.offensiveFlow = `Short possessions (≤6 passes) are converting at only **${shortConvRate.toFixed(0)}%**. We are forcing throws early in the stall count.\n\n**Strategic Adjustment:** Be patient and establish the dump before looking downfield.`;
        } else if (longPossessions.length === 0 && shortPossessions.length === 0) {
           generated.offensiveFlow = "Insufficient data to analyze possession length.";
        } else {
           generated.offensiveFlow = `Offense is flowing well. Overall conversion is stable across drive lengths.\n\n**Strategic Adjustment:** Maintain current spacing and keep the disc moving to prevent the defense from setting.`;
        }

        // --- 2. Defensive Pressure ---
        if (totalBlocks > 0 && totalBlocks < totalTurnovers * 0.3) {
           generated.defensivePressure = `Opponents are completing passes too easily; we only have **${totalBlocks}** blocks compared to unforced errors. Your D-Line is giving up the open side too easily.\n\n**Strategic Adjustment:** Tighten the force and clamp down on the open side.`;
        } else if (totalBlocks > (score?.them || 0) * 1.5) {
           generated.defensivePressure = `Defense is generating massive pressure with **${totalBlocks}** blocks.\n\n**Strategic Adjustment:** Ensure we are capitalizing on break opportunities.`;
        } else if (totalBlocks === 0 && (score?.them || 0) > 2) {
           generated.defensivePressure = `Zero defensive blocks recorded. The opponent's offense is too comfortable.\n\n**Strategic Adjustment:** Consider switching marks or changing the defensive force to disrupt their primary look.`;
        } else {
           generated.defensivePressure = `Defensive pressure is standard with **${totalBlocks}** blocks.\n\n**Strategic Adjustment:** Try varying the mark (e.g., flash flat occasionally) to bait high-stall throwaways.`;
        }

        // --- 3. Personnel Mapping ---
        const topPerformers = [...playerStats].sort((a,b) => b.nis - a.nis).slice(0, 2).filter(p => p.nis > 0);
        const fatiguedLiability = playerStats.find(p => (p.pp || 0) >= 4 && p.nis < 0);
        
        if (fatiguedLiability) {
           const pp = fatiguedLiability.pp || 4;
           generated.personnel = `**${fatiguedLiability.name}** (${fatiguedLiability.nis > 0 ? '+' : ''}${fatiguedLiability.nis.toFixed(1)}) has played **${pp}** points. Their efficiency is dropping.\n\n**Strategic Adjustment:** Rotate **${fatiguedLiability.name}** to the bench for the next D-Line transition.`;
        } else if (topPerformers.length > 0) {
           const top = topPerformers[0];
           generated.personnel = `**${top.name}** (+${top.nis.toFixed(1)}) is anchoring the team efficiently with high touches and completions.\n\n**Strategic Adjustment:** Keep running offensive sets through **${top.name}** while monitoring their point count to avoid fatigue.`;
        } else {
           generated.personnel = `No extreme personnel anomalies detected. Impact is distributed evenly.\n\n**Strategic Adjustment:** Maintain standard line rotations and ensure players get adequate rest.`;
        }

        // --- 4. Deep Game Analysis ---
        const totalHuckAttemptsGlobal = playerStats.reduce((sum, p) => sum + (p.totalHuckAttempts || 0), 0);
        const totalHuckCompletionsGlobal = playerStats.reduce((sum, p) => sum + (p.huckCompletions || 0), 0);
        
        if (totalHuckAttemptsGlobal > 0) {
            const huckCompPct = (totalHuckCompletionsGlobal / totalHuckAttemptsGlobal) * 100;
            if (huckCompPct < 40) {
                generated.deepGame = `Deep shots are **${totalHuckCompletionsGlobal}/${totalHuckAttemptsGlobal}** today. The 'Huck' intent is there, but execution is failing.\n\n**Strategic Adjustment:** Hold the deep look for the 'under' cut to open the lane.`;
            } else if (huckCompPct > 60) {
                generated.deepGame = `The deep game is highly efficient (**${totalHuckCompletionsGlobal}/${totalHuckAttemptsGlobal}**). \n\n**Strategic Adjustment:** Continue stretching the field to keep the defense honest.`;
            } else {
                generated.deepGame = `Deep shots are converting at an average rate (**${totalHuckCompletionsGlobal}/${totalHuckAttemptsGlobal}**). \n\n**Strategic Adjustment:** Pick deep targets carefully and ensure throwers have their feet set.`;
            }
        } else {
            generated.deepGame = `No deep throws attempted yet.\n\n**Strategic Adjustment:** If the defense is playing tight underneath, look for isolated deep cuts to open up the field.`;
        }
      }

      setInsights(generated);
      setIsAnalyzing(false);
    }, 2500);
  };

  useEffect(() => {
    generateInsights();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameType, score?.us, score?.them]);

  return (
    <div className="w-full bg-slate-900 border border-slate-700/50 rounded-3xl p-6 shadow-xl relative overflow-hidden mb-8">
      {isAnalyzing && (
        <div className="absolute inset-0 bg-indigo-500/5 animate-pulse rounded-3xl pointer-events-none" />
      )}
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 relative z-10">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 ${isAnalyzing ? 'animate-spin-slow' : ''}`}>
            <Brain className={`w-6 h-6 ${isAnalyzing ? 'text-indigo-400' : 'text-indigo-500'}`} />
          </div>
          <div>
            <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
              Advanced Team Analytics
              <span className="text-[10px] uppercase tracking-widest bg-indigo-600 px-2 py-0.5 rounded-full text-white font-bold">AI Pro</span>
            </h2>
            <p className="text-xs text-slate-400 uppercase tracking-widest font-bold mt-1">Deep Tactical & Systems Review</p>
          </div>
        </div>
        
        <button 
          onClick={generateInsights}
          disabled={isAnalyzing}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 text-sm font-bold rounded-xl transition-all shadow-md disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
          {isAnalyzing ? 'Processing...' : 'Run Analysis'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
        
        {/* Offensive Flow Card */}
        <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-5 flex flex-col gap-3 group hover:border-emerald-500/30 transition-colors">
          <div className="flex items-center gap-2 text-emerald-400">
            <Activity className="w-4 h-4" />
            <h3 className="font-bold text-sm uppercase tracking-wider">Offensive Flow</h3>
          </div>
          {isAnalyzing ? (
            <div className="space-y-2 mt-2">
              <div className="h-3 bg-slate-800 rounded animate-pulse w-full"></div>
              <div className="h-3 bg-slate-800 rounded animate-pulse w-5/6"></div>
              <div className="h-3 bg-slate-800 rounded animate-pulse w-4/6"></div>
            </div>
          ) : (
            <p className="text-slate-300 text-sm leading-relaxed font-medium">
              <FormatText text={insights?.offensiveFlow} />
            </p>
          )}
        </div>

        {/* Defensive Pressure Card */}
        <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-5 flex flex-col gap-3 group hover:border-rose-500/30 transition-colors">
          <div className="flex items-center gap-2 text-rose-400">
            <ShieldAlert className="w-4 h-4" />
            <h3 className="font-bold text-sm uppercase tracking-wider">Defensive Pressure</h3>
          </div>
          {isAnalyzing ? (
            <div className="space-y-2 mt-2">
              <div className="h-3 bg-slate-800 rounded animate-pulse w-full"></div>
              <div className="h-3 bg-slate-800 rounded animate-pulse w-5/6"></div>
              <div className="h-3 bg-slate-800 rounded animate-pulse w-3/4"></div>
            </div>
          ) : (
            <p className="text-slate-300 text-sm leading-relaxed font-medium">
              <FormatText text={insights?.defensivePressure} />
            </p>
          )}
        </div>

        {/* Personnel Mapping Card */}
        <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-5 flex flex-col gap-3 group hover:border-indigo-500/30 transition-colors">
          <div className="flex items-center gap-2 text-indigo-400">
            <Users className="w-4 h-4" />
            <h3 className="font-bold text-sm uppercase tracking-wider">Personnel Mapping</h3>
          </div>
          {isAnalyzing ? (
            <div className="space-y-2 mt-2">
              <div className="h-3 bg-slate-800 rounded animate-pulse w-full"></div>
              <div className="h-3 bg-slate-800 rounded animate-pulse w-4/5"></div>
              <div className="h-3 bg-slate-800 rounded animate-pulse w-5/6"></div>
            </div>
          ) : (
            <p className="text-slate-300 text-sm leading-relaxed font-medium">
              <FormatText text={insights?.personnel} />
            </p>
          )}
        </div>

        {/* Deep Game Analysis Card */}
        <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-5 flex flex-col gap-3 group hover:border-amber-500/30 transition-colors">
          <div className="flex items-center gap-2 text-amber-400">
            <Target className="w-4 h-4" />
            <h3 className="font-bold text-sm uppercase tracking-wider">Deep Game Analysis</h3>
          </div>
          {isAnalyzing ? (
            <div className="space-y-2 mt-2">
              <div className="h-3 bg-slate-800 rounded animate-pulse w-full"></div>
              <div className="h-3 bg-slate-800 rounded animate-pulse w-5/6"></div>
              <div className="h-3 bg-slate-800 rounded animate-pulse w-4/5"></div>
            </div>
          ) : (
            <p className="text-slate-300 text-sm leading-relaxed font-medium">
              <FormatText text={insights?.deepGame} />
            </p>
          )}
        </div>

      </div>
    </div>
  );
};

export default AiAdvisorModule;
