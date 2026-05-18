import React, { useState, useEffect } from 'react';
import { Brain, RefreshCw, Activity, Target, Users, Zap, ShieldAlert, TrendingUp, AlertTriangle } from 'lucide-react';

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

const ProblemSolutionCard = ({ title, icon: Icon, data, iconColor, hoverBorder }) => (
  <div className={`bg-slate-950/50 border border-slate-800 rounded-2xl p-5 flex flex-col gap-3 group ${hoverBorder} transition-colors h-full`}>
    <div className={`flex items-center gap-2 ${iconColor}`}>
      <Icon className="w-5 h-5" />
      <h3 className="font-bold text-sm uppercase tracking-wider">{title}</h3>
    </div>
    {data ? (
      <div className="space-y-3 mt-2 text-sm leading-relaxed font-medium text-slate-300">
        <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-700/50">
           <span className="text-slate-400 font-bold block mb-1 uppercase text-xs tracking-wider">Observation</span>
           <FormatText text={data.observation} />
        </div>
        <div className="bg-rose-950/30 p-3 rounded-lg border border-rose-900/40">
           <span className="text-rose-400 font-bold block mb-1 uppercase text-xs tracking-wider">Root Cause</span>
           <FormatText text={data.rootCause} />
        </div>
        <div className="bg-emerald-950/30 p-3 rounded-lg border border-emerald-900/40">
           <span className="text-emerald-400 font-bold block mb-1 uppercase text-xs tracking-wider">Tactical Fix</span>
           <FormatText text={data.fix} />
        </div>
      </div>
    ) : (
      <div className="space-y-3 mt-2">
         <div className="h-16 bg-slate-800/50 rounded-lg animate-pulse w-full"></div>
         <div className="h-16 bg-slate-800/50 rounded-lg animate-pulse w-full"></div>
         <div className="h-16 bg-slate-800/50 rounded-lg animate-pulse w-full"></div>
      </div>
    )}
  </div>
);

const AiAdvisorModule = ({ playerStats, rawStats, gameType, score }) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [insights, setInsights] = useState(null);

  const generateInsights = () => {
    setIsAnalyzing(true);
    setInsights(null);

    setTimeout(() => {
      const generated = {
        health: { oLineConv: "0.0", dLineConv: "0.0", huckIntent: "0.0", huckComps: 0, huckAtts: 0 },
        oLine: null,
        dLine: null,
        verifiedImpact: "",
        outliers: ""
      };

      if (playerStats && playerStats.length > 0) {
        
        const totalGamePoints = Math.max((score?.us || 0) + (score?.them || 0), 1);
        const threshold25 = Math.ceil(totalGamePoints * 0.25);

        // --- Team Strategic Health ---
        let teamBreaks = 0;
        let dLinePointsPlayed = 0;
        let currentPointHadPull = false;
        
        if (rawStats && rawStats.length > 0) {
            rawStats.forEach(s => {
                if (s.stat_type === 'Pull') {
                    currentPointHadPull = true;
                    dLinePointsPlayed++;
                }
                else if (s.stat_type === 'Point') {
                    if (currentPointHadPull) teamBreaks++;
                    currentPointHadPull = false;
                } else if (s.stat_type === 'Opponent Point') {
                    currentPointHadPull = false;
                }
            });
        }
        
        const oLineScores = Math.max((score?.us || 0) - teamBreaks, 0);
        const oLinePointsPlayed = Math.max(totalGamePoints - dLinePointsPlayed, 0);

        const oLineConv = oLinePointsPlayed > 0 ? (oLineScores / oLinePointsPlayed) * 100 : 0;
        const dLineConv = dLinePointsPlayed > 0 ? (teamBreaks / dLinePointsPlayed) * 100 : 0;

        const totalHuckAttemptsGlobal = playerStats.reduce((sum, p) => sum + (p.totalHuckAttempts || 0), 0);
        const totalHuckCompletionsGlobal = playerStats.reduce((sum, p) => sum + (p.huckCompletions || 0), 0);
        const totalCompletionsGlobal = playerStats.reduce((sum, p) => sum + p.completions, 0);

        const huckIntentPct = totalCompletionsGlobal > 0 ? (totalHuckAttemptsGlobal / totalCompletionsGlobal) * 100 : 0;

        generated.health = {
           oLineConv: oLineConv.toFixed(1),
           dLineConv: dLineConv.toFixed(1),
           huckIntent: huckIntentPct.toFixed(1),
           huckComps: totalHuckCompletionsGlobal,
           huckAtts: totalHuckAttemptsGlobal
        };

        // --- Line Performance (Problem/Solution) ---
        // O-Line Logic
        let oLineData = { observation: "", rootCause: "", fix: "" };
        if (oLineConv < 40) {
            oLineData.observation = `O-Line conversion has dropped to **${oLineConv.toFixed(0)}%**.`;
            oLineData.rootCause = `High turnover rate on the first three passes (short-game failure).`;
            oLineData.fix = `Tighten the reset space and prioritize the open-side swing before looking downfield.`;
        } else if (oLineConv > 70) {
            oLineData.observation = `O-Line is dominating with a **${oLineConv.toFixed(0)}%** conversion rate.`;
            oLineData.rootCause = `Excellent spacing and handler discipline, exploiting the defense's gaps.`;
            oLineData.fix = `Maintain current structure and continue to isolate your strongest cutters.`;
        } else {
            oLineData.observation = `O-Line conversion is stable at **${oLineConv.toFixed(0)}%**.`;
            oLineData.rootCause = `Inconsistent execution in the red zone or unforced errors on resets.`;
            oLineData.fix = `Focus on maintaining possession during high-pressure stall counts and establish the dump early.`;
        }
        generated.oLine = oLineData;

        // D-Line Logic
        let dLineData = { observation: "", rootCause: "", fix: "" };
        const totalBlocks = playerStats.reduce((sum, p) => sum + p.blocks, 0);
        if (dLineConv < 20 && totalBlocks > 0) {
            dLineData.observation = `D-Line is struggling to convert breaks (**${dLineConv.toFixed(0)}%**).`;
            dLineData.rootCause = `Turnovers after generating blocks (**${totalBlocks}** blocks so far). Fast-breaks are being forced.`;
            dLineData.fix = `Call a timeout after a block or explicitly command the D-Line to establish a clear dump immediately upon possession.`;
        } else if (dLineConv < 20 && totalBlocks === 0) {
            dLineData.observation = `D-Line is failing to generate pressure or breaks (**${dLineConv.toFixed(0)}%**).`;
            dLineData.rootCause = `Zero defensive blocks recorded. The opponent's offense is too comfortable.`;
            dLineData.fix = `Consider switching marks, implementing a poach bracket, or changing the defensive force to disrupt their primary look.`;
        } else if (dLineConv > 40) {
            dLineData.observation = `D-Line is highly opportunistic with a **${dLineConv.toFixed(0)}%** break rate.`;
            dLineData.rootCause = `Effective pressure forcing unforced errors and quick, lethal counter-attacks.`;
            dLineData.fix = `Keep the defensive intensity high and run the counter through your primary D-Line handlers.`;
        } else {
            dLineData.observation = `D-Line is generating breaks at an average rate (**${dLineConv.toFixed(0)}%**).`;
            dLineData.rootCause = `Average block conversion and standard opposition holds.`;
            dLineData.fix = `Ensure the first pass after a turnover is a 100% completion to secure the disc and calm the tempo.`;
        }
        generated.dLine = dLineData;

        // --- Verified Impact & Outliers ---
        const highVolumePlayers = playerStats.filter(p => (p.pp || p.pointsPlayed || 0) >= threshold25);
        const lowVolumePlayers = playerStats.filter(p => (p.pp || p.pointsPlayed || 0) < threshold25 && (p.pp || p.pointsPlayed || 0) > 0);

        // Volume-Weighting NIS
        highVolumePlayers.sort((a,b) => {
            const aWeight = a.nis * (a.pp || a.pointsPlayed || 1);
            const bWeight = b.nis * (b.pp || b.pointsPlayed || 1);
            return bWeight - aWeight;
        });

        if (highVolumePlayers.length > 0) {
            const top = highVolumePlayers[0];
            const pp = top.pp || top.pointsPlayed || 1;
            const weight = (top.nis * pp).toFixed(1);
            generated.verifiedImpact = `**${top.name}** is driving elite value (+${top.nis.toFixed(1)} NIS over **${pp}** points). \n\n**Context:** They are providing massive volume-weighted impact (**${weight}** weighted score) over a sustained duration.\n\n**Recommendation:** Run critical possessions through them, but ensure they get offensive rest points to maintain efficiency.`;
            
            if (highVolumePlayers.length > 1 && highVolumePlayers[highVolumePlayers.length - 1].nis < 0) {
                const bottom = highVolumePlayers[highVolumePlayers.length - 1];
                const bPp = bottom.pp || bottom.pointsPlayed || 1;
                generated.verifiedImpact += `\n\n**${bottom.name}** has high volume (**${bPp}** points) but a negative NIS (**${bottom.nis.toFixed(1)}**).\n\n**Recommendation:** Adjust their role to minimize high-risk throws or rotate them to less taxing positions.`;
            }
        } else {
            generated.verifiedImpact = `Insufficient volume data. Need players to complete at least **25%** of total points to verify impact free of statistical noise.`;
        }

        if (lowVolumePlayers.length > 0) {
            // Sort to find the most extreme outlier (lowest points played)
            lowVolumePlayers.sort((a,b) => (a.pp || a.pointsPlayed || 0) - (b.pp || b.pointsPlayed || 0));
            const outlier = lowVolumePlayers[0]; 
            const opp = outlier.pp || outlier.pointsPlayed || 0;
            generated.outliers = `**${outlier.name}** has exceptionally low volume (**${opp}/${totalGamePoints}** points).\n\n**Context:** Likely an injury, late arrival, or specific utility substitution.\n\n**Recommendation:** Monitor for re-entry or reassess their role in the current game plan.`;
        } else {
            generated.outliers = `No low-volume outliers detected. Rotations are consistent across the active roster.`;
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
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 relative z-10">
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
          className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 text-sm font-bold rounded-xl transition-all shadow-md disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
          {isAnalyzing ? 'Processing...' : 'Run Analysis'}
        </button>
      </div>

      <div className="space-y-8 relative z-10">
        
        {/* Top Section: Team Strategic Health */}
        <div>
           <h3 className="flex items-center gap-2 font-black text-sm uppercase tracking-widest mb-4 text-slate-300 border-b border-slate-800 pb-2">
             <Activity className="w-4 h-4 text-emerald-400" />
             Team Strategic Health
           </h3>
           <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex flex-col items-center justify-center text-center group hover:border-emerald-500/30 transition-colors">
                 <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">O-Line Conversion</div>
                 {isAnalyzing ? (
                    <div className="h-8 w-16 bg-slate-800 animate-pulse rounded mt-1"></div>
                 ) : (
                    <div className="text-3xl font-black text-emerald-400">{insights?.health?.oLineConv}%</div>
                 )}
              </div>
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex flex-col items-center justify-center text-center group hover:border-rose-500/30 transition-colors">
                 <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">D-Line Break Rate</div>
                 {isAnalyzing ? (
                    <div className="h-8 w-16 bg-slate-800 animate-pulse rounded mt-1"></div>
                 ) : (
                    <div className="text-3xl font-black text-rose-400">{insights?.health?.dLineConv}%</div>
                 )}
              </div>
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex flex-col items-center justify-center text-center group hover:border-amber-500/30 transition-colors">
                 <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Huck Intent Ratio</div>
                 {isAnalyzing ? (
                    <div className="h-8 w-16 bg-slate-800 animate-pulse rounded mt-1"></div>
                 ) : (
                    <>
                       <div className="text-3xl font-black text-amber-400">{insights?.health?.huckIntent}%</div>
                       <div className="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-wider">({insights?.health?.huckAtts} Deep / {insights?.health?.huckComps} Comps)</div>
                    </>
                 )}
              </div>
           </div>
        </div>

        {/* Middle Section: Line Performance (Problem/Solution) */}
        <div>
           <h3 className="flex items-center gap-2 font-black text-sm uppercase tracking-widest mb-4 text-slate-300 border-b border-slate-800 pb-2">
             <Target className="w-4 h-4 text-indigo-400" />
             Line Performance
           </h3>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ProblemSolutionCard 
                title="O-Line Flow" 
                icon={TrendingUp} 
                data={insights?.oLine} 
                iconColor="text-indigo-400" 
                hoverBorder="hover:border-indigo-500/30" 
              />
              <ProblemSolutionCard 
                title="D-Line Pressure" 
                icon={ShieldAlert} 
                data={insights?.dLine} 
                iconColor="text-rose-400" 
                hoverBorder="hover:border-rose-500/30" 
              />
           </div>
        </div>

        {/* Bottom Section: Verified Impact & Outliers */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           {/* Verified Impact */}
           <div className="bg-slate-950/40 border border-emerald-900/30 rounded-2xl p-5 group hover:border-emerald-500/40 transition-colors">
              <h3 className="flex items-center gap-2 font-black text-sm uppercase tracking-widest mb-4 text-emerald-400">
                <Users className="w-4 h-4" />
                Verified Impact Players
              </h3>
              {isAnalyzing ? (
                 <div className="space-y-2 mt-2">
                    <div className="h-4 bg-slate-800 rounded animate-pulse w-full"></div>
                    <div className="h-4 bg-slate-800 rounded animate-pulse w-5/6"></div>
                 </div>
              ) : (
                 <div className="text-sm leading-relaxed text-slate-300 font-medium">
                    <FormatText text={insights?.verifiedImpact} />
                 </div>
              )}
           </div>

           {/* Roster Management / Outliers */}
           <div className="bg-slate-950/40 border border-amber-900/30 rounded-2xl p-5 group hover:border-amber-500/40 transition-colors">
              <h3 className="flex items-center gap-2 font-black text-sm uppercase tracking-widest mb-4 text-amber-400">
                <AlertTriangle className="w-4 h-4" />
                Roster Management
              </h3>
              {isAnalyzing ? (
                 <div className="space-y-2 mt-2">
                    <div className="h-4 bg-slate-800 rounded animate-pulse w-full"></div>
                    <div className="h-4 bg-slate-800 rounded animate-pulse w-5/6"></div>
                 </div>
              ) : (
                 <div className="text-sm leading-relaxed text-slate-300 font-medium">
                    <FormatText text={insights?.outliers} />
                 </div>
              )}
           </div>
        </div>

      </div>
    </div>
  );
};

export default AiAdvisorModule;
