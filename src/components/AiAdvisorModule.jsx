import React, { useState, useEffect } from 'react';
import { Brain, RefreshCw, Activity, Target, Users, Zap, ShieldAlert, BarChart3 } from 'lucide-react';

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
        tactics: "No immediate tactical adjustments recommended."
      };

      if (playerStats && playerStats.length > 0) {
        
        // --- Aggregates ---
        const totalPasses = playerStats.reduce((sum, p) => sum + p.passes, 0);
        const totalCompletions = playerStats.reduce((sum, p) => sum + p.completions, 0);
        const totalTurnovers = playerStats.reduce((sum, p) => sum + p.turnovers, 0);
        const totalBlocks = playerStats.reduce((sum, p) => sum + p.blocks, 0);
        
        const teamCompPct = totalPasses > 0 ? (totalCompletions / totalPasses) * 100 : 0;
        const totalPoints = score ? score.us + score.them : 0;

        // --- 1. Offensive Flow ---
        const avgOce = playerStats.reduce((sum, p) => sum + (p.possessionsPlayed > 0 ? (p.goalsOnPitch / p.possessionsPlayed)*100 : 0), 0) / playerStats.length;
        const topOcePlayer = [...playerStats].sort((a,b) => {
           const aOce = a.possessionsPlayed > 0 ? a.goalsOnPitch/a.possessionsPlayed : 0;
           const bOce = b.possessionsPlayed > 0 ? b.goalsOnPitch/b.possessionsPlayed : 0;
           return bOce - aOce;
        })[0];

        if (teamCompPct > 90 && avgOce > 50) {
          generated.offensiveFlow = `Elite offensive efficiency. Team completion rate is ${teamCompPct.toFixed(1)}%. The disc is moving cleanly with minimal stagnation. Maintain current spacing and reset structures.`;
        } else if (teamCompPct > 85 && totalTurnovers > totalPoints * 2) {
          generated.offensiveFlow = `Completion rate is solid (${teamCompPct.toFixed(1)}%), but overall turnover volume is high. This indicates we are stringing together many short passes but failing in the redzone or deep space. Prioritize finishing drives.`;
        } else if (teamCompPct < 80) {
           generated.offensiveFlow = `Struggling with possession retention (${teamCompPct.toFixed(1)}% completion). Our offensive sets are too risky or handlers are being pressured into tight windows. Emphasize early resets and swing passes to stretch the defense.`;
        } else {
           generated.offensiveFlow = `Offense is converting at an average rate. ${topOcePlayer && topOcePlayer.possessionsPlayed > 2 ? `When ${topOcePlayer.name} is on the pitch, offensive conversion spikes. Run more handler-sets through them.` : 'Focus on clean holds to build momentum.'}`;
        }

        // --- 2. Defensive Pressure ---
        const topBlocker = [...playerStats].sort((a,b) => b.blocks - a.blocks)[0];
        const breaksWonAvg = playerStats.reduce((sum, p) => sum + p.breaksWon, 0) / playerStats.length;
        
        if (totalBlocks > totalPoints * 0.5) {
          generated.defensivePressure = `Defense is generating massive pressure (${totalBlocks} blocks). ${topBlocker && topBlocker.blocks > 1 ? `${topBlocker.name} is anchoring the D-Line with ${topBlocker.blocks} blocks.` : 'Excellent collective defensive effort.'} Ensure we are converting these break opportunities into scores.`;
        } else if (breaksWonAvg > 1) {
          generated.defensivePressure = `D-Line is highly opportunistic. We aren't relying purely on blocks, meaning we are forcing unforced errors or capitalizing on opposition drops effectively.`;
        } else if (totalBlocks === 0 && score.them > 3) {
          generated.defensivePressure = `Zero defensive blocks recorded while conceding ${score.them} points. The opponent's offense is too comfortable. Consider switching marks, implementing a poach bracket, or changing the defensive force to disrupt their primary look.`;
        } else {
          generated.defensivePressure = "Defensive pressure is standard. Try varying the mark (e.g., flash flat occasionally) to bait high-stall throwaways.";
        }

        // --- 3. Personnel Mapping ---
        const engines = playerStats.filter(p => p.touchesPerPoint >= 3 && p.completion >= 90);
        const liabilities = playerStats.filter(p => p.nis < -1 && p.usage > 10);
        const pureFinishers = playerStats.filter(p => (p.goals + p.assists) > 2 && p.touchesPerPoint < 2 && p.nis > 0);

        let personnelInsights = [];
        if (engines.length > 0) {
           personnelInsights.push(`${engines[0].name} is operating as a true Engine (${engines[0].touchesPerPoint.toFixed(1)} touches/pt @ ${engines[0].completion}%). Keep the offense flowing through them.`);
        }
        if (pureFinishers.length > 0) {
           personnelInsights.push(`${pureFinishers[0].name} is a hyper-efficient Finisher. They require very few touches to generate scores.`);
        }
        if (liabilities.length > 0) {
           personnelInsights.push(`Warning: ${liabilities[0].name} is absorbing >10% usage but carrying a negative Net Impact (${liabilities[0].nis.toFixed(1)}). Rotate them out of primary initiation roles.`);
        }

        if (personnelInsights.length > 0) {
          generated.personnel = personnelInsights.join(" ");
        } else {
          const topPerformer = playerStats.reduce((prev, current) => (prev.nis > current.nis) ? prev : current);
          generated.personnel = `${topPerformer.name} is leading the team overall (+${topPerformer.nis.toFixed(1)} NIS). No extreme outliers detected in usage roles.`;
        }

        // --- 4. Tactics & Conditioning ---
        const pullStats = playerStats.filter(p => p.pulls > 0);
        let tacticalInsight = "";
        
        if (pullStats.length > 0) {
          const avgScore = pullStats.reduce((sum, p) => sum + p.avgPullScore, 0) / pullStats.length;
          if (avgScore < 2.5) {
            tacticalInsight = `Short pulls (Avg ${avgScore.toFixed(1)}/5) are giving the opponent a short field. Deepen the pull trajectory. `;
          } else {
            tacticalInsight = `Pull quality is elite (Avg ${avgScore.toFixed(1)}/5), allowing our D-Line to set up effectively. `;
          }
        }

        if (gameType === 'beach') {
          tacticalInsight += "Given the Beach surface, fatigue compounds faster. Maintain strict, short shifts for cutters and avoid low-percentage hucks into the wind.";
        } else if (gameType === 'indoor') {
          tacticalInsight += "Indoor Ultimate requires lightning-fast transitions. Exploit turnovers immediately before the defense can set their structures.";
        }

        if (totalPoints > 15) {
           tacticalInsight += " Deep into the match: O-Line handlers typically lose 15% efficiency due to fatigue. Monitor your primary handlers closely.";
        }

        if (tacticalInsight) {
           generated.tactics = tacticalInsight;
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
              {insights?.offensiveFlow || "Awaiting data..."}
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
              {insights?.defensivePressure || "Awaiting data..."}
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
              {insights?.personnel || "Awaiting data..."}
            </p>
          )}
        </div>

        {/* Tactics & Conditioning Card */}
        <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-5 flex flex-col gap-3 group hover:border-amber-500/30 transition-colors">
          <div className="flex items-center gap-2 text-amber-400">
            <Zap className="w-4 h-4" />
            <h3 className="font-bold text-sm uppercase tracking-wider">System & Conditioning</h3>
          </div>
          {isAnalyzing ? (
            <div className="space-y-2 mt-2">
              <div className="h-3 bg-slate-800 rounded animate-pulse w-full"></div>
              <div className="h-3 bg-slate-800 rounded animate-pulse w-5/6"></div>
              <div className="h-3 bg-slate-800 rounded animate-pulse w-4/5"></div>
            </div>
          ) : (
            <p className="text-slate-300 text-sm leading-relaxed font-medium">
              {insights?.tactics || "Awaiting data..."}
            </p>
          )}
        </div>

      </div>
    </div>
  );
};

export default AiAdvisorModule;
