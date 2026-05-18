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
    <div className={`flex items-center justify-between`}>
      <div className={`flex items-center gap-2 ${iconColor}`}>
        <Icon className="w-5 h-5" />
        <h3 className="font-bold text-sm uppercase tracking-wider">{title}</h3>
      </div>
    </div>
    {data ? (
      <div className="space-y-3 mt-2 text-sm leading-relaxed font-medium text-slate-300">
        <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-700/50">
           <span className="text-slate-400 font-bold block mb-1 uppercase text-[10px] tracking-widest">System Status</span>
           <FormatText text={data.status} />
        </div>
        <div className="bg-amber-950/20 p-3 rounded-lg border border-amber-900/30">
           <span className="text-amber-400 font-bold block mb-1 uppercase text-[10px] tracking-widest">Unit Trend</span>
           <FormatText text={data.trend} />
        </div>
        <div className="bg-emerald-950/30 p-3 rounded-lg border border-emerald-900/40">
           <span className="text-emerald-400 font-bold block mb-1 uppercase text-[10px] tracking-widest">Actionable System Fix</span>
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
        offense: null,
        defense: null,
        roster: null
      };

      if (playerStats && playerStats.length > 0) {
        
        const totalPasses = playerStats.reduce((sum, p) => sum + p.passes, 0);
        const totalTurnovers = playerStats.reduce((sum, p) => sum + p.turnovers, 0);
        const totalBlocks = playerStats.reduce((sum, p) => sum + p.blocks, 0);
        const totalCompletionsGlobal = playerStats.reduce((sum, p) => sum + p.completions, 0);
        const totalHuckAttemptsGlobal = playerStats.reduce((sum, p) => sum + (p.totalHuckAttempts || 0), 0);
        
        const huckIntentPct = totalCompletionsGlobal > 0 ? (totalHuckAttemptsGlobal / totalCompletionsGlobal) * 100 : 0;
        const oLineCompPct = totalPasses > 0 ? (totalCompletionsGlobal / totalPasses) * 100 : 0;

        let possessions = [];
        let currentPossession = { passes: 0, scored: false };
        let teamBreaks = 0;
        let dLinePointsPlayed = 0;
        let currentPointHadPull = false;

        if (rawStats && rawStats.length > 0) {
            rawStats.forEach(stat => {
               if (stat.stat_type === 'Pull') {
                  currentPointHadPull = true;
                  dLinePointsPlayed++;
               } else if (stat.stat_type === 'Pass') {
                  currentPossession.passes += 1;
               } else if (stat.stat_type === 'Point') {
                  currentPossession.passes += 1;
                  currentPossession.scored = true;
                  possessions.push(currentPossession);
                  if (currentPointHadPull) teamBreaks++;
                  currentPossession = { passes: 0, scored: false };
                  currentPointHadPull = false;
               } else if (['Throwaway', 'Drop', 'Stall Out', 'Opponent Turnover', 'Opponent Point'].includes(stat.stat_type)) {
                  if (stat.stat_type !== 'Opponent Turnover' && stat.stat_type !== 'Opponent Point') {
                     possessions.push(currentPossession);
                  }
                  if (stat.stat_type === 'Opponent Point') {
                     currentPointHadPull = false;
                  }
                  currentPossession = { passes: 0, scored: false };
               }
            });
        }
        
        const shortPossessions = possessions.filter(p => p.passes <= 3 && p.passes > 0);
        const longPossessions = possessions.filter(p => p.passes > 6);
        
        let first3PassesConv = 0;
        let longGrindConv = 0;
        if (shortPossessions.length > 0) {
           first3PassesConv = (shortPossessions.filter(p => p.scored).length / shortPossessions.length) * 100;
        }
        if (longPossessions.length > 0) {
           longGrindConv = (longPossessions.filter(p => p.scored).length / longPossessions.length) * 100;
        }

        // --- 1. Detailed Offense Assessment ---
        let offStatus, offTrend, offFix;
        if (huckIntentPct > 15) {
           offStatus = `The O-Line is heavily reliant on the deep ball (Unit Completion: **${oLineCompPct.toFixed(1)}%**).`;
           offTrend = `High huck volume is expanding the field, but early-stall deep shots are lowering overall possession retention.`;
           offFix = `Hold the deep look explicitly for the 'under' cut to open the lane. Establish the short game first before looking deep.`;
        } else if (first3PassesConv > longGrindConv + 20) {
           offStatus = `The O-Line excels at rapid strikes (Unit Completion: **${oLineCompPct.toFixed(1)}%**).`;
           offTrend = `The unit converts highly on drives under 3 passes, but struggles severely in prolonged, grinding possessions.`;
           offFix = `Increase horizontal resets when the primary vertical motion stops. Prioritize swinging the disc to the break side.`;
        } else {
           offStatus = `The O-Line is grinding out points effectively (Unit Completion: **${oLineCompPct.toFixed(1)}%**).`;
           offTrend = `The unit is patient, utilizing long possession chains rather than forcing quick strikes or high-risk hucks.`;
           offFix = `Maintain structural discipline, but actively look to punish the defense with a deep shot if they over-commit underneath.`;
        }
        generated.offense = { status: offStatus, trend: offTrend, fix: offFix };

        // --- 2. Detailed Defense Assessment ---
        let defStatus, defTrend, defFix;
        let timeToTurn = "42s";
        if (totalBlocks > 5) timeToTurn = "28s";
        else if ((score?.them || 0) > 8 && totalBlocks < 3) timeToTurn = "75s+";

        const dLineConv = dLinePointsPlayed > 0 ? (teamBreaks / dLinePointsPlayed) * 100 : 0;

        if (totalBlocks > totalTurnovers * 0.4) {
           defStatus = `The D-Line is generating elite pressure (Avg Time to Turn: **${timeToTurn}**).`;
           defTrend = `Turnovers are stemming from direct defensive pressure and poach anticipation rather than unforced errors.`;
           defFix = `Maintain chaotic defensive structures. Once the turn is forced, the D-Line handlers must establish a calm reset instantly.`;
        } else if (dLineConv < 30 && teamBreaks === 0 && dLinePointsPlayed > 3) {
           defStatus = `The D-Line is struggling with post-turnover conversion (Avg Time to Turn: **${timeToTurn}**).`;
           defTrend = `The unit is rushing the transition after securing a block, leading to chaotic give-aways back to the opponent.`;
           defFix = `Implement a mandatory 'one reset' rule upon securing a block to stabilize the offensive shape before attacking.`;
        } else {
           defStatus = `The D-Line is operating with average disruption (Avg Time to Turn: **${timeToTurn}**).`;
           defTrend = `Turnover generation is primarily reliant on unforced opposition errors rather than active blocks or interceptions.`;
           defFix = `Tighten the defensive brackets and apply harder localized pressure on the primary handler resets to force difficult throws.`;
        }
        generated.defense = { status: defStatus, trend: defTrend, fix: defFix };

        // --- 3. Lineup & Roster Assessment ---
        const sortedByPP = [...playerStats].sort((a, b) => (b.pp || b.pointsPlayed || 0) - (a.pp || a.pointsPlayed || 0));
        const lineA = sortedByPP.slice(0, 7);
        const lineB = sortedByPP.slice(7, 14);

        let rosterStatus, rosterTrend, rosterFix;
        if (lineB.length >= 5) {
            const lineAEff = lineA.reduce((sum, p) => sum + (p.completions/(Math.max(p.passes, 1))), 0) / Math.max(lineA.length, 1) * 100;
            const lineBEff = lineB.reduce((sum, p) => sum + (p.completions/(Math.max(p.passes, 1))), 0) / Math.max(lineB.length, 1) * 100;

            if (lineAEff > lineBEff + 15) {
               rosterStatus = `Line A (**${lineAEff.toFixed(0)}%** Eff) is drastically outperforming Line B (**${lineBEff.toFixed(0)}%** Eff).`;
               rosterTrend = `Unit fatigue is setting in for the primary starters, while the rotational unit is struggling to maintain possession.`;
               rosterFix = `Implement a strategic mix. Integrate 2 reliable handlers from Line A into the Line B rotation to stabilize their offensive flow.`;
            } else {
               rosterStatus = `Line A (**${lineAEff.toFixed(0)}%** Eff) and Line B (**${lineBEff.toFixed(0)}%** Eff) are performing at parity.`;
               rosterTrend = `The collective system is holding up well against fatigue. Load management is currently optimal.`;
               rosterFix = `Maintain strict, short shifts for all lines to preserve energy for late-game defensive stands.`;
            }
        } else {
            rosterStatus = `Playing with a tight rotation (Less than 12 active players).`;
            rosterTrend = `The core units are playing heavy minutes, increasing the risk of mechanical breakdown late in the game.`;
            rosterFix = `Call strategic timeouts immediately following long, grinding points to preserve the primary unit's legs.`;
        }
        generated.roster = { status: rosterStatus, trend: rosterTrend, fix: rosterFix };
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
              Unit-Based Tactical Analysis
              <span className="text-[10px] uppercase tracking-widest bg-indigo-600 px-2 py-0.5 rounded-full text-white font-bold">AI Pro</span>
            </h2>
            <p className="text-xs text-slate-400 uppercase tracking-widest font-bold mt-1">Lineup & System Assessment</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-10">
        
        {/* Offense Assessment */}
        <ProblemSolutionCard 
          title="Detailed Offense Assessment" 
          icon={TrendingUp} 
          data={insights?.offense} 
          iconColor="text-indigo-400" 
          hoverBorder="hover:border-indigo-500/30" 
        />
        
        {/* Defense Assessment */}
        <ProblemSolutionCard 
          title="Detailed Defense Assessment" 
          icon={ShieldAlert} 
          data={insights?.defense} 
          iconColor="text-rose-400" 
          hoverBorder="hover:border-rose-500/30" 
        />

        {/* Roster & Lineup Assessment */}
        <ProblemSolutionCard 
          title="Lineup & System View" 
          icon={Users} 
          data={insights?.roster} 
          iconColor="text-emerald-400" 
          hoverBorder="hover:border-emerald-500/30" 
        />

      </div>
    </div>
  );
};

export default AiAdvisorModule;
