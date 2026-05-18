import React, { useState, useEffect } from 'react';
import { Brain, RefreshCw, Megaphone } from 'lucide-react';

const FormatText = ({ text }) => {
  if (!text) return null;
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} className="text-white font-black text-lg">{part.slice(2, -2)}</strong>;
        }
        return <span key={i} className="text-slate-200 font-bold text-base leading-relaxed">{part}</span>;
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
      let briefing = {
        para1: "",
        para2: "",
        para3: ""
      };

      if (playerStats && playerStats.length > 0) {
        
        const totalPasses = playerStats.reduce((sum, p) => sum + (p.passes || 0), 0);
        const totalTurnovers = playerStats.reduce((sum, p) => sum + (p.turnovers || 0), 0);
        const totalBlocks = playerStats.reduce((sum, p) => sum + (p.blocks || 0), 0);
        const totalCompletionsGlobal = playerStats.reduce((sum, p) => sum + (p.completions || 0), 0);
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

        const dLineConv = dLinePointsPlayed > 0 ? (teamBreaks / dLinePointsPlayed) * 100 : 0;

        const sortedByPP = [...playerStats].sort((a, b) => (b.pp || b.pointsPlayed || 0) - (a.pp || a.pointsPlayed || 0));
        const lineA = sortedByPP.slice(0, 7);
        const lineB = sortedByPP.slice(7, 14);
        
        let lineAEff = 0;
        let lineBEff = 0;
        if (lineB.length >= 5) {
            lineAEff = lineA.reduce((sum, p) => sum + ((p.completions || 0)/(Math.max(p.passes || 0, 1))), 0) / Math.max(lineA.length, 1) * 100;
            lineBEff = lineB.reduce((sum, p) => sum + ((p.completions || 0)/(Math.max(p.passes || 0, 1))), 0) / Math.max(lineB.length, 1) * 100;
        }

        // --- Paragraph 1: Tactical Identity ---
        let p1 = `We're establishing our tactical identity out there. Overall, our offensive unit is moving the disc at a **${oLineCompPct.toFixed(0)}% completion rate** over **${totalPasses} total attempts**. `;
        if (lineB.length >= 5) {
            if (Math.abs(lineAEff - lineBEff) < 10) {
                p1 += `Our rotation strategy is paying massive dividends—both the starting line and the rotational unit are executing with absolute parity, meaning we are winning the war of attrition without dropping efficiency. `;
            } else if (lineAEff > lineBEff + 15) {
                p1 += `However, we are seeing a harsh drop-off when we rotate. The primary unit is carrying the load at **${lineAEff.toFixed(0)}% efficiency**, while our secondary line is struggling to protect the disc. We need to trust the system and tighten up the execution from the entire 14-man roster. `;
            } else {
                p1 += `The lines are rotating smoothly and maintaining our structural intensity. `;
            }
        } else {
            p1 += `We're running a very tight rotation today, which means every set of legs matters. We have to lean on our handler structure rather than raw athleticism to survive the late-game grind. `;
        }
        briefing.para1 = p1;

        // --- Paragraph 2: Offensive & Defensive Flow ---
        let p2 = `Looking at the rhythm of the game, `;
        if (first3PassesConv > longGrindConv + 20) {
            p2 += `our O-unit is lethal on rapid strikes but struggling heavily when forced into a prolonged, grinding point. If we can't score in the first three passes, we're panicking. `;
        } else if (longGrindConv >= 50) {
            p2 += `our O-unit is displaying incredible patience. We are effectively grinding out the long, high-pass possessions without forcing desperate looks. `;
        } else {
            p2 += `our offensive flow is stable, finding a healthy balance between quick action and structured resets. `;
        }

        if (huckIntentPct > 15) {
            p2 += `That being said, our huck integrity is slipping. We're launching deep on **${huckIntentPct.toFixed(0)}%** of our completions, which means we are actively abandoning the under lanes and playing too vertically. `;
        } else {
            p2 += `We are keeping our huck integrity intact, stretching the field responsibly without over-relying on the deep ball. `;
        }

        if (totalBlocks > totalTurnovers * 0.4) {
            p2 += `Defensively, the D-unit is an absolute buzzsaw. We are actively hunting the disc and generating blocks through raw pressure. `;
        } else if (dLineConv > 30) {
            p2 += `When the opponent makes a mistake, our D-unit is converting with lethal calmness, boasting a **${dLineConv.toFixed(0)}% break rate**. `;
        } else {
            p2 += `On the defensive side, we are struggling to capitalize on turns. We are rushing the transition after securing a block, giving the disc right back instead of punishing them. `;
        }
        briefing.para2 = p2;

        // --- Paragraph 3: The Work-On (Marching Order) ---
        let p3 = `Here is our marching order for the next half. `;
        if (lineB.length >= 5 && lineAEff > lineBEff + 15) {
            p3 += `**We must stabilize the rotational unit.** We are going to integrate two of our most reliable handlers into the secondary line to act as anchors. Take the chaotic pressure off the cutters and ensure the system runs smoothly regardless of who is on the pitch.`;
        } else if (huckIntentPct > 15) {
            p3 += `**We are pulling the trigger too early.** I want the deep look held strictly as a decoy to open up the primary under cuts. Establish the dump-swing rhythm first, and only take the huck if the defense explicitly gives us a 1-on-1 mismatch.`;
        } else if (first3PassesConv > longGrindConv + 20) {
            p3 += `**We have to embrace the reset.** We cannot rely purely on fast-breaks. If the primary vertical motion stops, immediately look to the break-side handler. Keep the disc alive and force their defense to work for the full stall count.`;
        } else if (dLineConv < 30 && teamBreaks === 0) {
            p3 += `**The D-line needs to take a breath.** We are working too hard to earn the disc just to throw it away. Upon a turnover, establish a mandatory 'one reset' rule. Stop the fast-break, secure possession, and attack against a unset defense.`;
        } else {
            p3 += `**Maintain the clinical execution.** We are dictating the pace of the game and owning the structure. Keep the defensive brackets tight, trust the reset space on offense, and step onto the line knowing we are executing our game plan to perfection.`;
        }
        briefing.para3 = p3;

      } else {
        briefing.para1 = "We need more data before I can give you a comprehensive breakdown.";
        briefing.para2 = "Keep logging the points so we can start seeing the tactical trends emerge.";
        briefing.para3 = "**Focus on the fundamentals** until we have enough volume to make structural adjustments.";
      }

      setInsights(briefing);
      setIsAnalyzing(false);
    }, 2500);
  };

  useEffect(() => {
    generateInsights();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameType, score?.us, score?.them]);

  return (
    <div className="w-full bg-slate-900 border border-slate-700/50 rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden mb-8">
      {isAnalyzing && (
        <div className="absolute inset-0 bg-indigo-500/5 animate-pulse rounded-3xl pointer-events-none" />
      )}
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 relative z-10 border-b border-slate-800 pb-6">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 ${isAnalyzing ? 'animate-pulse' : ''}`}>
            <Megaphone className={`w-8 h-8 ${isAnalyzing ? 'text-amber-400' : 'text-amber-500'}`} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
              The Coach's Briefing
              <span className="text-[10px] uppercase tracking-widest bg-amber-600 px-2 py-0.5 rounded-full text-white font-bold shadow-lg shadow-amber-500/30">Huddle Ready</span>
            </h2>
            <p className="text-sm text-slate-400 uppercase tracking-widest font-bold mt-1">AI Tactical Narrative Assessment</p>
          </div>
        </div>
        
        <button 
          onClick={generateInsights}
          disabled={isAnalyzing}
          className="flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 text-sm font-bold rounded-xl transition-all shadow-md disabled:opacity-50 shrink-0 uppercase tracking-wider"
        >
          <RefreshCw className={`w-4 h-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
          {isAnalyzing ? 'Processing...' : 'Generate Briefing'}
        </button>
      </div>

      <div className="relative z-10 bg-slate-950/60 border border-slate-800 rounded-2xl p-6 sm:p-10 shadow-inner">
        {insights ? (
          <div className="space-y-8">
            <p className="text-slate-300 font-medium leading-relaxed tracking-wide text-lg sm:text-xl">
              <FormatText text={insights.para1} />
            </p>
            <p className="text-slate-300 font-medium leading-relaxed tracking-wide text-lg sm:text-xl">
              <FormatText text={insights.para2} />
            </p>
            <div className="bg-amber-950/20 border-l-4 border-amber-500 p-6 rounded-r-2xl">
               <p className="text-amber-100 font-medium leading-relaxed tracking-wide text-lg sm:text-xl">
                 <FormatText text={insights.para3} />
               </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="h-6 bg-slate-800/50 rounded-lg animate-pulse w-full"></div>
            <div className="h-6 bg-slate-800/50 rounded-lg animate-pulse w-11/12"></div>
            <div className="h-6 bg-slate-800/50 rounded-lg animate-pulse w-4/5"></div>
            <div className="h-6 bg-slate-800/50 rounded-lg animate-pulse w-full mt-8"></div>
            <div className="h-6 bg-slate-800/50 rounded-lg animate-pulse w-5/6"></div>
            <div className="h-20 bg-slate-800/30 rounded-xl animate-pulse w-full mt-8"></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AiAdvisorModule;
