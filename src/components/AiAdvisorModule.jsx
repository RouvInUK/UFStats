import React, { useState, useEffect } from 'react';
import { Brain, RefreshCw, Megaphone } from 'lucide-react';

const FormatText = ({ text }) => {
  if (!text) return null;
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} className="text-white font-black text-xl uppercase tracking-wider">{part.slice(2, -2)}</strong>;
        }
        return <span key={i} className="text-slate-100 font-black text-lg leading-relaxed">{part}</span>;
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
        
        let oPointsPlayed = 0;
        let cleanHolds = 0;
        let dPointsPlayed = 0;
        let breaks = 0;

        let scoringPointsCount = 0;
        let passesInScoringPoints = 0;

        let oHuckAttempts = 0;
        let oHuckCompletions = 0;
        let dHuckAttempts = 0;
        let dHuckCompletions = 0;

        let currentPointPasses = 0;
        let currentPointTurnovers = 0;
        let isDPoint = false;
        let isFirstEvent = true;

        let playerDict = {};
        if (playerStats) {
            playerStats.forEach(p => {
               playerDict[p.name] = {
                  name: p.name,
                  pointsPlayed: p.pp || p.pointsPlayed || 0,
                  touches: 0,
                  completions: 0,
                  goals: 0,
                  ds: 0,
                  huckCompletions: 0,
                  huckAttempts: 0,
                  turnovers: 0,
                  drops: 0
               };
            });
        }

        if (rawStats && rawStats.length > 0) {
            rawStats.forEach(stat => {
               if (stat.stat_type === 'Start Defense') {
                   isDPoint = true;
               } else if (stat.stat_type === 'Start Offense') {
                   isDPoint = false;
               }

               const realActions = ['Pull', 'Pass', 'Opponent Turnover', 'Throwaway', 'Drop', 'Stall Out', 'Defence', 'Block'];
               if (isFirstEvent && realActions.includes(stat.stat_type)) {
                  if (stat.stat_type === 'Pull') {
                     isDPoint = true;
                  }
                  
                  if (isDPoint) dPointsPlayed++;
                  else oPointsPlayed++;
                  
                  isFirstEvent = false;
               }

               if (stat.details?.is_huck) {
                  if (isDPoint) {
                     dHuckAttempts++;
                     if (['Pass', 'Point'].includes(stat.stat_type)) dHuckCompletions++;
                  } else {
                     oHuckAttempts++;
                     if (['Pass', 'Point'].includes(stat.stat_type)) oHuckCompletions++;
                  }
               }

               if (stat.player && playerDict[stat.player]) {
                   const ps = playerDict[stat.player];
                   if (['Pass', 'Point'].includes(stat.stat_type)) {
                       ps.touches++;
                       ps.completions++;
                       if (stat.stat_type === 'Point') ps.goals++;
                       if (stat.details?.is_huck) {
                           ps.huckCompletions++;
                           ps.huckAttempts++;
                       }
                   } else if (['Throwaway', 'Stall Out'].includes(stat.stat_type)) {
                       ps.touches++;
                       ps.turnovers++;
                       if (stat.details?.is_huck) ps.huckAttempts++;
                   } else if (stat.stat_type === 'Drop') {
                       ps.touches++;
                       ps.turnovers++;
                       ps.drops++;
                       if (stat.details?.is_huck) ps.huckAttempts++;
                   } else if (['Defence', 'Block'].includes(stat.stat_type)) {
                       ps.ds++;
                   }
               }

               if (['Pass', 'Point'].includes(stat.stat_type)) {
                  currentPointPasses++;
                  if (stat.stat_type === 'Point') {
                     scoringPointsCount++;
                     passesInScoringPoints += currentPointPasses;
                     
                     if (isDPoint) breaks++;
                     else if (currentPointTurnovers === 0) cleanHolds++;

                     currentPointPasses = 0;
                     currentPointTurnovers = 0;
                     isFirstEvent = true;
                     isDPoint = true; // We scored, so we pull next
                  }
               } else if (['Throwaway', 'Drop', 'Stall Out'].includes(stat.stat_type)) {
                  currentPointTurnovers++;
               } else if (stat.stat_type === 'Opponent Point') {
                  currentPointPasses = 0;
                  currentPointTurnovers = 0;
                  isFirstEvent = true;
                  isDPoint = false; // They scored, we receive next
               }
            });
        }

        const cleanHoldRate = oPointsPlayed > 0 ? (cleanHolds / oPointsPlayed) * 100 : 0;
        const breakRate = dPointsPlayed > 0 ? (breaks / dPointsPlayed) * 100 : 0;
        const passToScoreRatio = scoringPointsCount > 0 ? (passesInScoringPoints / scoringPointsCount) : 0;
        const oHuckIntegrityPct = oHuckAttempts > 0 ? (oHuckCompletions / oHuckAttempts) * 100 : 0;
        const dHuckIntegrityPct = dHuckAttempts > 0 ? (dHuckCompletions / dHuckAttempts) * 100 : 0;

        // --- Paragraph 1: Offensive Execution ---
        let p1 = `**Offensive Execution:** The Active Unit is currently operating with a **${cleanHoldRate.toFixed(0)}% Clean Hold Rate** on offense. `;
        if (cleanHoldRate >= 60) {
           p1 += `We are maintaining absolute possession and punishing the opposition without giving them second chances. `;
        } else if (cleanHoldRate >= 30) {
           p1 += `We are getting broken too frequently, relying heavily on getting the disc back after our own mistakes. `;
        } else {
           p1 += `We are bleeding possessions. The offense is failing to convert first-chance opportunities. `;
        }

        if (passToScoreRatio > 7) {
           p1 += `With a Pass-to-Score ratio of **${passToScoreRatio.toFixed(1)}**, we are being forced into long, grinding possessions. The opposition is taking away our primary looks. `;
        } else if (passToScoreRatio > 0 && passToScoreRatio <= 4) {
           p1 += `With a clinical Pass-to-Score ratio of **${passToScoreRatio.toFixed(1)}**, we are striking fast and efficiently tearing through their defensive sets. `;
        } else if (passToScoreRatio > 0) {
           p1 += `Our Pass-to-Score ratio sits at **${passToScoreRatio.toFixed(1)}**, indicating a healthy balance of patience and decisive attacking motion. `;
        }

        if (oHuckAttempts > 0) {
           p1 += `Our set offense is launching deep with a **${oHuckIntegrityPct.toFixed(0)}% Huck Integrity** (${oHuckCompletions}/${oHuckAttempts}). `;
           if (oHuckIntegrityPct < 50) p1 += `We are turning the disc over on low-percentage deep looks. `;
        }
        briefing.para1 = p1;

        // --- Paragraph 2: Defensive & Counter-Attack ---
        let p2 = `**Defensive & Counter-Attack:** On the other side of the disc, our D-Line is converting at a **${breakRate.toFixed(0)}% Break Rate**. `;
        if (breakRate >= 40) {
           p2 += `We are absolutely ruthless on the counter-attack, capitalizing on their mistakes immediately. `;
        } else if (breakRate > 0) {
           p2 += `We are generating turns, but our conversion leaves points on the board. `;
        } else if (dPointsPlayed > 0) {
           p2 += `We are failing to convert when the opponent gives us the disc. `;
        } else {
           p2 += `We haven't recorded any defensive points yet. `;
        }

        if (dHuckAttempts > 0) {
           p2 += `Looking at our transition offense, our Huck Integrity is at **${dHuckIntegrityPct.toFixed(0)}%** (${dHuckCompletions}/${dHuckAttempts}). `;
           if (dHuckIntegrityPct >= 50) {
              p2 += `We are taking calculated deep shots and stretching the field responsibly after generating a turn.`;
           } else {
              p2 += `We are forcing low-percentage deep looks after securing the disc instead of establishing the offense.`;
           }
        } else if (dPointsPlayed > 0) {
           p2 += `We haven't recorded any transition deep shots yet. The D-unit is keeping everything underneath after generating a turn.`;
        }
        briefing.para2 = p2;

        // --- Paragraph 3: Tactical Recommendation ---
        let p3 = `**Tactical Recommendation:** `;
        const totalHuckAttempts = oHuckAttempts + dHuckAttempts;
        const totalHuckCompletions = oHuckCompletions + dHuckCompletions;
        const totalHuckIntegrity = totalHuckAttempts > 0 ? (totalHuckCompletions / totalHuckAttempts) * 100 : 0;

        if (cleanHoldRate < 40 && oPointsPlayed > 0) {
           p3 += `**Protect the disc.** The Active Unit must prioritize possession over progression. Look to the break-side handler immediately if the primary cut isn't open by stall 3. Do not force the disc into tight windows.`;
        } else if (totalHuckAttempts > 0 && totalHuckIntegrity < 40) {
           p3 += `**Holster the deep ball.** We are turning the disc over on forced hucks. I want the deep look held strictly as a decoy. Establish the dump-swing rhythm first, and only take the deep shot if it's a clear 1-on-1 mismatch.`;
        } else if (passToScoreRatio > 7) {
           p3 += `**Pace the offense.** We are working extremely hard for every point. Call strategic timeouts to preserve legs, and look for isolation plays to generate larger chunks of yardage.`;
        } else if (dPointsPlayed > 0 && breakRate < 30) {
           p3 += `**Value the block.** The D-Line is working too hard to earn the disc just to throw it away. Upon a turnover, establish a mandatory 'one reset' rule to calm the chaos before attacking.`;
        } else {
           p3 += `**Maintain the clinical execution.** The Active Unit is dictating the pace of the game. Keep the defensive brackets tight, trust the reset space on offense, and step onto the line knowing we are executing our game plan to perfection.`;
        }
        briefing.para3 = p3;

        // --- Archetypes & Focus ---
        const minPointsReq = Math.max(1, Math.ceil((oPointsPlayed + dPointsPlayed) * 0.25));
        const eligiblePlayers = Object.values(playerDict).filter(p => p.pointsPlayed >= minPointsReq);

        let theEngine = null;
        let theFinisher = null;
        let theDifferenceMaker = null;
        
        let engineScore = -1;
        let finisherScore = -1;
        let differenceScore = -1;

        eligiblePlayers.forEach(p => {
            const compRate = p.touches > 0 ? (p.completions / p.touches) : 0;
            const touchesPerPoint = p.pointsPlayed > 0 ? (p.touches / p.pointsPlayed) : 0;
            if (compRate > 0.90 && touchesPerPoint > engineScore && p.touches > 5) {
                engineScore = touchesPerPoint;
                theEngine = p;
            }

            const goalsToTouches = p.touches > 0 ? (p.goals / p.touches) : 0;
            if (p.goals >= 3 && goalsToTouches > finisherScore) {
                finisherScore = goalsToTouches;
                theFinisher = p;
            }

            const playmakerScore = p.pointsPlayed > 0 ? ((p.ds + p.huckCompletions) / p.pointsPlayed) : 0;
            if ((p.ds + p.huckCompletions) > 0 && playmakerScore > differenceScore) {
                differenceScore = playmakerScore;
                theDifferenceMaker = p;
            }
        });

        const focusPlayers = [...eligiblePlayers]
            .filter(p => p.touches > 3 && p.turnovers > 0)
            .sort((a, b) => (b.turnovers / b.touches) - (a.turnovers / a.touches))
            .slice(0, 2);

        let focusArray = [];
        focusPlayers.forEach(p => {
            const huckCompRate = p.huckAttempts > 0 ? p.huckCompletions / p.huckAttempts : 0;
            if (p.huckAttempts >= 2 && huckCompRate < 0.5) {
                focusArray.push(`**${p.name}:** Work on deep shot selection or resetting the stall earlier.`);
            } else if (p.drops >= 2 || p.drops > p.turnovers / 2) {
                focusArray.push(`**${p.name}:** Focus on hand-eye coordination and secure catches before moving the disc.`);
            } else {
                focusArray.push(`**${p.name}:** Prioritize possession and look for the reset option earlier in the stall count.`);
            }
        });

        briefing.archetypes = {
            engine: theEngine,
            finisher: theFinisher,
            differenceMaker: theDifferenceMaker
        };
        briefing.focusAreas = focusArray;

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

            {insights.archetypes && (insights.archetypes.engine || insights.archetypes.finisher || insights.archetypes.differenceMaker) && (
               <div className="mt-8 pt-8 border-t border-slate-800">
                  <h3 className="text-xl font-black text-white uppercase tracking-widest mb-6">Player Archetypes</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     {insights.archetypes.engine && (
                        <div className="bg-blue-900/20 border border-blue-500/30 rounded-2xl p-5">
                           <div className="text-xs uppercase tracking-widest text-blue-400 font-bold mb-1">The Engine</div>
                           <div className="text-lg font-black text-white mb-2">{insights.archetypes.engine.name}</div>
                           <p className="text-sm font-bold text-slate-300 leading-relaxed">
                              Primary distributor, keeping the disc moving with high reliability.
                           </p>
                        </div>
                     )}
                     {insights.archetypes.finisher && (
                        <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-2xl p-5">
                           <div className="text-xs uppercase tracking-widest text-emerald-400 font-bold mb-1">The Finisher</div>
                           <div className="text-lg font-black text-white mb-2">{insights.archetypes.finisher.name}</div>
                           <p className="text-sm font-bold text-slate-300 leading-relaxed">
                              Clinical in the endzone, converting the most scoring opportunities into points.
                           </p>
                        </div>
                     )}
                     {insights.archetypes.differenceMaker && (
                        <div className="bg-purple-900/20 border border-purple-500/30 rounded-2xl p-5">
                           <div className="text-xs uppercase tracking-widest text-purple-400 font-bold mb-1">The Difference Maker</div>
                           <div className="text-lg font-black text-white mb-2">{insights.archetypes.differenceMaker.name}</div>
                           <p className="text-sm font-bold text-slate-300 leading-relaxed">
                              Provided the big plays, creating turnovers and deep gains at critical moments.
                           </p>
                        </div>
                     )}
                  </div>
               </div>
            )}

            {insights.focusAreas && insights.focusAreas.length > 0 && (
               <div className="mt-8 pt-8 border-t border-slate-800">
                  <h3 className="text-xl font-black text-white uppercase tracking-widest mb-6 text-amber-500">Area for Focus</h3>
                  <div className="space-y-4">
                     {insights.focusAreas.map((focus, idx) => (
                        <div key={idx} className="bg-slate-800/50 rounded-xl p-5 border-l-4 border-amber-500 text-slate-100 font-black text-lg tracking-wide">
                           <FormatText text={focus} />
                        </div>
                     ))}
                  </div>
               </div>
            )}
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
