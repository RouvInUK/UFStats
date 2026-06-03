import React, { useState, useEffect } from 'react';
import { Brain, RefreshCw, Megaphone } from 'lucide-react';
import { useDrillState } from '../contexts/DrillStateContext';

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

const AiAdvisorModule = ({ playerStats, rawStats, gameType, score, isMultiGame, teamStats, targetTeamId }) => {
  const { activeDrill } = useDrillState();
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Generate a unique value-based hash of the current stats data
  const gameNames = rawStats && rawStats.length > 0 
    ? Array.from(new Set(rawStats.map(s => s.game_name))).sort().join(',') 
    : '';
  const currentHash = `${gameType}_${score?.us || 0}_${score?.them || 0}_${rawStats?.length || 0}_${playerStats?.length || 0}_${gameNames}`;

  const insightsKey = `ufstats_coach_ai_insights_${targetTeamId || 'global'}`;
  const hashKey = `ufstats_coach_ai_hash_${targetTeamId || 'global'}`;

  const [lastGeneratedHash, setLastGeneratedHash] = useState(() => {
    return localStorage.getItem(hashKey) || null;
  });

  const [insights, setInsights] = useState(() => {
    try {
      const saved = localStorage.getItem(insightsKey);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn("Failed to parse saved AI insights:", e);
    }
    return null;
  });

  const dataChanged = lastGeneratedHash !== currentHash;

  // High-performance offline fallback generator
  const generateHeuristicBriefing = () => {
    let briefing = {
      para1: "",
      para2: "",
      para3: "",
      archetypes: { engine: [], finisher: [], differenceMaker: [] },
      focusAreas: []
    };

    if (playerStats && playerStats.length > 0) {
      if (gameType === 'training') {
         // Aggregate training statistics
         const drillAgg = {};
         let totalReps = 0;
         let positiveReps = 0;
         let negativeReps = 0;
         const errorCounts = {};
         let systemDefenseReps = 0;
         let systemDefenseSuccess = 0;

         const playerDict = {};
         playerStats.forEach(p => {
            playerDict[p.name] = {
               name: p.name,
               reps: 0,
               successes: 0,
               errors: 0,
               ds: 0
            };
         });

         rawStats?.forEach(stat => {
            if (stat.game_type === 'training') {
              const drillName = stat.details?.drill_name || 'Active Drill';
              if (!drillAgg[drillName]) {
                drillAgg[drillName] = { name: drillName, reps: 0, successes: 0, errors: {} };
              }
              drillAgg[drillName].reps++;
              totalReps++;

              const metric = stat.details?.metric || stat.stat_type;
              const isPositive = ['Leading Catch', 'Pass', 'Point', 'Defence', 'Block'].some(x => metric.toLowerCase().includes(x.toLowerCase()) || x.toLowerCase().includes(metric.toLowerCase()));
              const isNegative = ['Drop', 'Overthrow', 'Underthrow', 'Throwaway', 'Stall Out', 'Incomplete'].some(x => metric.toLowerCase().includes(x.toLowerCase()) || x.toLowerCase().includes(metric.toLowerCase()));

              if (stat.player && playerDict[stat.player]) {
                const ps = playerDict[stat.player];
                ps.reps++;
                if (isPositive) {
                  ps.successes++;
                  if (metric === 'Defence' || metric === 'Block') {
                    ps.ds++;
                  }
                } else if (isNegative) {
                  ps.errors++;
                }
              }

              if (isPositive) {
                drillAgg[drillName].successes++;
                positiveReps++;
                if (drillName.toLowerCase().includes('defense') || drillName.toLowerCase().includes('system')) {
                  systemDefenseSuccess++;
                }
              } else if (isNegative) {
                negativeReps++;
                drillAgg[drillName].errors[metric] = (drillAgg[drillName].errors[metric] || 0) + 1;
                errorCounts[metric] = (errorCounts[metric] || 0) + 1;
              }

              if (drillName.toLowerCase().includes('defense') || drillName.toLowerCase().includes('system')) {
                systemDefenseReps++;
              }
            }
         });

         // Find top error
         let topError = 'Incomplete Reps';
         let maxErrorCount = 0;
         Object.entries(errorCounts).forEach(([errName, count]) => {
           if (count > maxErrorCount) {
             maxErrorCount = count;
             topError = errName;
           }
         });

         const activeDrillName = activeDrill?.name || 'Active Drill';
         const activeDrillReps = drillAgg[activeDrillName]?.reps || totalReps || 0;
         const activeDrillSuccesses = drillAgg[activeDrillName]?.successes || positiveReps || 0;
         const successRate = activeDrillReps > 0 ? (activeDrillSuccesses / activeDrillReps) * 100 : 0;

         let p1 = `**Drill Ingestion Analysis:** We reviewed the training logs for **${activeDrillName}** where the squad completed **${activeDrillReps} reps** with a **${successRate.toFixed(0)}% execution rating**. `;
         if (activeDrillReps === 0) {
           p1 = `**Drill Ingestion Analysis:** No drill repetitions have been logged yet for the active session. Tap active players and outcome buttons to start compiling rep performance analytics. `;
         } else {
           if (successRate >= 75) {
             p1 += `Execution is exceptionally clean, with cutter-handler synchronization operating at peak levels. `;
           } else if (successRate >= 50) {
             p1 += `Execution is moderate, showing solid flashes of coordination, but consistency is lagging due to mechanical errors. `;
           } else {
             p1 += `Execution is unstable. High-frequency errors are disrupting training flows and stalling progressions. `;
           }

           if (maxErrorCount > 0) {
             p1 += `The primary limiting factor was **${topError}**, accounting for ${((maxErrorCount / activeDrillReps) * 100).toFixed(0)}% of total repetitions. `;
           }
         }

         if (systemDefenseReps > 0) {
           const defRate = (systemDefenseSuccess / systemDefenseReps) * 100;
           p1 += `On defensive drills (System Defense), the containment unit maintained a **${defRate.toFixed(0)}% clamp rating** against cutting lines. `;
         }
         briefing.para1 = p1;

         // Simulated/Calculated Tactical Alignment Error check
         let alignmentErrorZone = 'Open Side Cutting Lane';
         let remedialDrill = 'The Box Drill';
         let simulatedTurnovers = 3;

         if (topError.toLowerCase().includes('drop')) {
           alignmentErrorZone = 'Under Cutting Space';
           remedialDrill = 'The Go Drill';
         } else if (topError.toLowerCase().includes('throw') || topError.toLowerCase().includes('over')) {
           alignmentErrorZone = 'Deep Space';
           remedialDrill = 'The 3-Person Weave';
         }

         let p2 = `**Tactical Alignment Analyst:** During scrimmage patterns, we identified a **Tactical Alignment Error** in the **${alignmentErrorZone}** (${simulatedTurnovers} turnovers logged inside these coordinates). `;
         if (activeDrillReps === 0) {
           p2 = `**Tactical Alignment Analyst:** Awaiting active rep streams to overlay playbook tactical bounds. Once logged, turnovers will be cross-referenced with your playbook diagrams to flag positional errors. `;
         } else {
           p2 += `Cutter separation is breaking down in these margins, causing handlers to force late reset passes. We recommend deploying **${remedialDrill}** in the next training block to calibrate cutter-handler spacing and timing. `;
         }
         briefing.para2 = p2;

         let p3 = `**AI Technical Diagnostic:** `;
         if (activeDrillReps === 0) {
           p3 += `**Establish training benchmarks.** Coach, initialize stationary thrower locks (🔒) during line rotations to log rapid reps at only 2 taps per repetition. Keep the squad focused on fundamental mechanics.`;
         } else {
           if (successRate < 60) {
             p3 += `**Slow down to speed up.** Core mechanics are breaking down on the cuts. Re-emphasize standard chest-catches and leading throws, rather than trying to hit highlight-reel passes in tight windows.`;
           } else {
             p3 += `**Increase intensity.** Squad execution is meeting the baseline standard. Increase defense pressure in drills, or introduce a 5-second stall limit to simulate high-pressure tournament conditions.`;
           }
         }
         briefing.para3 = p3;

         // Calculate archetypes for training
         const eligiblePlayers = Object.values(playerDict).filter(p => p.reps > 0);
         const engines = [...eligiblePlayers]
            .filter(p => p.reps > 2 && (p.successes / p.reps) >= 0.8)
            .sort((a, b) => b.successes - a.successes)
            .slice(0, 3);

         const finishers = [...eligiblePlayers]
            .filter(p => p.reps > 2)
            .sort((a, b) => b.successes - a.successes)
            .slice(0, 3);

         const differenceMakers = [...eligiblePlayers]
            .filter(p => p.ds > 0)
            .sort((a, b) => b.ds - a.ds)
            .slice(0, 3);

         briefing.archetypes = {
            engine: engines.map(x => ({ name: x.name })),
            finisher: finishers.map(x => ({ name: x.name })),
            differenceMaker: differenceMakers.map(x => ({ name: x.name }))
         };

         const focusArray = [];
         const turnoverPlayers = [...eligiblePlayers]
            .filter(p => p.errors > 0)
            .sort((a, b) => (b.errors / b.reps) - (a.errors / a.reps));

         if (turnoverPlayers.length > 0) {
            focusArray.push(`**${turnoverPlayers[0].name}:** Re-focus on catching posture and hand-eye contact. Maintain focus until disc is secure.`);
         }
         if (turnoverPlayers.length > 1) {
            focusArray.push(`**${turnoverPlayers[1].name}:** Work on pivot stability and release angles during rapid rotating cuts.`);
         }

         briefing.focusAreas = focusArray;
         return briefing;
      }

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
      playerStats.forEach(p => {
         playerDict[p.name] = {
            name: p.name,
            pointsPlayed: p.pp || p.pointsPlayed || 0,
            gamesPlayed: p.gamesPlayed || 0,
            touches: 0,
            completions: 0,
            goals: 0,
            ds: 0,
            huckCompletions: 0,
            huckAttempts: 0,
            turnovers: 0,
            drops: 0,
            assists: p.assists || 0,
            secondaryAssists: p.secondaryAssists || 0
         };
      });

      let lastGameName = null;
      if (rawStats && rawStats.length > 0) {
          rawStats.forEach(stat => {
             if (lastGameName && stat.game_name !== lastGameName) {
                 isDPoint = false;
                 isFirstEvent = true;
                 currentPointPasses = 0;
                 currentPointTurnovers = 0;
             }
             lastGameName = stat.game_name;

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
                   isDPoint = true; 
                }
             } else if (['Throwaway', 'Drop', 'Stall Out'].includes(stat.stat_type)) {
                currentPointTurnovers++;
             } else if (stat.stat_type === 'Opponent Point') {
                currentPointPasses = 0;
                currentPointTurnovers = 0;
                isFirstEvent = true;
                isDPoint = false; 
             }
          });
      }

      const cleanHoldRate = teamStats && teamStats.cleanHoldRate !== undefined ? teamStats.cleanHoldRate : (oPointsPlayed > 0 ? (cleanHolds / oPointsPlayed) * 100 : 0);
      const breakRate = teamStats && teamStats.breakRate !== undefined ? teamStats.breakRate : (dPointsPlayed > 0 ? (breaks / dPointsPlayed) * 100 : 0);
      const passToScoreRatio = scoringPointsCount > 0 ? (passesInScoringPoints / scoringPointsCount) : 0;
      const oHuckIntegrityPct = teamStats && teamStats.huckSuccessRate !== undefined ? teamStats.huckSuccessRate : (oHuckAttempts > 0 ? (oHuckCompletions / oHuckAttempts) * 100 : 0);
      const dHuckIntegrityPct = teamStats && teamStats.dHuckSuccessRate !== undefined ? teamStats.dHuckSuccessRate : (dHuckAttempts > 0 ? (dHuckCompletions / dHuckAttempts) * 100 : 0);

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

      const totalTeamPassAttempts = playerStats.reduce((sum, p) => sum + (p.passAttempts || 0), 0);
      const totalTeamHuckAttempts = oHuckAttempts + dHuckAttempts;
      const teamHuckRate = totalTeamPassAttempts > 0 ? (totalTeamHuckAttempts / totalTeamPassAttempts) * 100 : 0;
      const reflectHucks = teamHuckRate >= 2.0;

      if (reflectHucks && oHuckAttempts > 0) {
         p1 += `Our set offense is launching deep with a **${oHuckIntegrityPct.toFixed(0)}% Huck Integrity** (${oHuckCompletions}/${oHuckAttempts}). `;
         if (oHuckIntegrityPct < 50) p1 += `We are turning the disc over on low-percentage deep looks. `;
      }
      briefing.para1 = p1;

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

      if (reflectHucks && dHuckAttempts > 0) {
         p2 += `Looking at our transition offense, our Huck Integrity is at **${dHuckIntegrityPct.toFixed(0)}%** (${dHuckCompletions}/${dHuckAttempts}). `;
         if (dHuckIntegrityPct >= 50) {
            p2 += `We are taking calculated deep shots and stretching the field responsibly after generating a turn.`;
         } else {
            p2 += `We are forcing low-percentage deep looks after securing the disc instead of establishing the offense.`;
         }
      } else if (dPointsPlayed > 0 && reflectHucks) {
         p2 += `We haven't recorded any transition deep shots yet. The D-unit is keeping everything underneath after generating a turn.`;
      }
      briefing.para2 = p2;

      let p3 = `**Tactical Recommendation:** `;
      const totalHuckCompletions = oHuckCompletions + dHuckCompletions;
      const totalHuckIntegrity = totalTeamHuckAttempts > 0 ? (totalHuckCompletions / totalTeamHuckAttempts) * 100 : 0;

      if (cleanHoldRate < 40 && oPointsPlayed > 0) {
         p3 += `**Protect the disc.** The Active Unit must prioritize possession over progression. Look to the break-side handler immediately if the primary cut isn't open by stall 3. Do not force the disc into tight windows.`;
      } else if (reflectHucks && totalTeamHuckAttempts > 0 && totalHuckIntegrity < 40) {
         p3 += `**Holster the deep ball.** We are turning the disc over on forced hucks. I want the deep look held strictly as a decoy. Establish the dump-swing rhythm first, and only take the deep shot if it's a clear 1-on-1 mismatch.`;
      } else if (passToScoreRatio > 7) {
         p3 += `**Pace the offense.** We are working extremely hard for every point. Call strategic timeouts to preserve legs, and look for isolation plays to generate larger chunks of yardage.`;
      } else if (dPointsPlayed > 0 && breakRate < 30) {
         p3 += `**Value the block.** The D-Line is working too hard to earn the disc just to throw it away. Upon a turnover, establish a mandatory 'one reset' rule to calm the chaos before attacking.`;
      } else {
         p3 += `**Maintain the clinical execution.** The Active Unit is dictating the pace of the game. Keep the defensive brackets tight, trust the reset space on offense, and step onto the line knowing we are executing our game plan to perfection.`;
      }
      briefing.para3 = p3;

      const uniqueGames = rawStats && rawStats.length > 0 
        ? Array.from(new Set(rawStats.map(s => s.game_name))).filter(Boolean) 
        : [];
      const totalGamesCount = Math.max(1, uniqueGames.length);

      const minPointsReq = Math.max(1, Math.ceil((oPointsPlayed + dPointsPlayed) * 0.25));
      
      // Enforce: Player must have played in at least 50% of the total matches played by the team
      const eligiblePlayers = Object.values(playerDict).filter(p => 
        p.pointsPlayed >= minPointsReq && 
        p.gamesPlayed >= totalGamesCount * 0.5
      );

      // Enforce: touches per point >= 1.2
      const engines = [...eligiblePlayers]
          .filter(p => p.touches > 5 && (p.touches / p.pointsPlayed) >= 1.2 && (p.completions / p.touches) > 0.90)
          .sort((a, b) => (b.touches / b.pointsPlayed) - (a.touches / a.pointsPlayed))
          .slice(0, 3);

      const finishers = [...eligiblePlayers]
          .filter(p => p.goals >= 2 && p.touches > 0 && (p.goals / p.touches) >= 0.20)
          .sort((a, b) => (b.goals / Math.max(1, b.touches)) - (a.goals / Math.max(1, a.touches)))
          .slice(0, 3);

      // Enforce Difference Maker formula: (Goals + Assists + Secondary Assists + Defence + Huck Completions) - Turnovers
      const differenceMakers = [...eligiblePlayers]
          .map(p => ({
             ...p,
             netPlaymaking: (1.0 * p.goals) + (1.5 * p.assists) + (0.75 * p.secondaryAssists) + (1.5 * p.ds) + (1.0 * p.huckCompletions) - (1.25 * p.turnovers)
          }))
          .filter(p => p.netPlaymaking > 0)
          .sort((a, b) => (b.netPlaymaking / b.pointsPlayed) - (a.netPlaymaking / a.pointsPlayed))
          .slice(0, 3);

      let focusArray = [];

      const turnoverPlayers = [...eligiblePlayers]
          .filter(p => p.touches > 3 && p.turnovers > 0)
          .sort((a, b) => (b.turnovers / b.touches) - (a.turnovers / a.touches));

      if (turnoverPlayers.length > 0) {
          const p = turnoverPlayers[0];
          const huckCompRate = p.huckAttempts > 0 ? p.huckCompletions / p.huckAttempts : 0;
          if (p.huckAttempts >= 2 && huckCompRate < 0.5) {
              focusArray.push(`**${p.name}:** Work on deep shot selection or resetting the stall earlier.`);
          } else if (p.drops >= 2 || p.drops > p.turnovers / 2) {
              focusArray.push(`**${p.name}:** Focus on hand-eye coordination and secure catches before moving the disc.`);
          } else {
              focusArray.push(`**${p.name}:** Prioritize possession and look for the reset option earlier in the stall count.`);
          }
      }

      const invisiblePlayers = [...eligiblePlayers]
          .filter(p => p.pointsPlayed >= Math.max(3, minPointsReq))
          .map(p => ({ ...p, impactRatio: (p.touches + p.ds) / p.pointsPlayed }))
          .filter(p => p.impactRatio <= 0.4)
          .sort((a, b) => a.impactRatio - b.impactRatio);

      if (invisiblePlayers.length > 0) {
          const ghost = invisiblePlayers.find(p => !focusArray.some(f => f.includes(`**${p.name}:**`)));
          if (ghost) {
              focusArray.push(`**${ghost.name}:** Needs to increase pitch presence. Work on dominating the cutting lanes to demand the disc, or generating more defensive pressure.`);
          }
      }

      if (focusArray.length < 2 && turnoverPlayers.length > 1) {
          const p = turnoverPlayers[1];
          if (!focusArray.some(f => f.includes(`**${p.name}:**`))) {
              const huckCompRate = p.huckAttempts > 0 ? p.huckCompletions / p.huckAttempts : 0;
              if (p.huckAttempts >= 2 && huckCompRate < 0.5) {
                  focusArray.push(`**${p.name}:** Work on deep shot selection or resetting the stall earlier.`);
              } else if (p.drops >= 2 || p.drops > p.turnovers / 2) {
                  focusArray.push(`**${p.name}:** Focus on hand-eye coordination and secure catches before moving the disc.`);
              } else {
                  focusArray.push(`**${p.name}:** Prioritize possession and look for the reset option earlier in the stall count.`);
              }
          }
      }

      briefing.archetypes = {
          engine: engines,
          finisher: finishers,
          differenceMaker: differenceMakers
      };
      briefing.focusAreas = focusArray;

    } else {
      briefing.para1 = "We need more data before I can give you a comprehensive breakdown.";
      briefing.para2 = "Keep logging the points so we can start seeing the tactical trends emerge.";
      briefing.para3 = "**Focus on the fundamentals** until we have enough volume to make structural adjustments.";
    }

    return briefing;
  };

  // Defensive normalizer wrapper protecting the UI from LLM JSON formatting fluctuations
  const normalizeArchetype = (val) => {
    if (!val) return [];
    if (Array.isArray(val)) {
      return val.map(item => {
        if (typeof item === 'string') return { name: item };
        if (item && typeof item === 'object' && item.name) return item;
        return { name: String(item) };
      });
    }
    if (typeof val === 'string') {
      return val.split(',').map(name => ({ name: name.trim() })).filter(x => x.name);
    }
    return [];
  };

  const generateInsights = async () => {
    setIsAnalyzing(true);

    if (gameType === 'training') {
      setTimeout(() => {
        const fallback = generateHeuristicBriefing();
        setInsights(fallback);
        setLastGeneratedHash(currentHash);
        localStorage.setItem(insightsKey, JSON.stringify(fallback));
        localStorage.setItem(hashKey, currentHash);
        setIsAnalyzing(false);
      }, 600);
      return;
    }

    try {
      const response = await fetch('/api/generate-insights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ playerStats, rawStats, gameType, score, isMultiGame, teamStats }),
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const data = await response.json();
      
      const newInsights = {
        para1: data.offensiveBriefing || "No offensive breakdown generated.",
        para2: data.defensiveBriefing || "No defensive transition diagnostics generated.",
        para3: data.tacticalBriefing || "Keep focusing on possession and standard positional play.",
        archetypes: {
          engine: normalizeArchetype(data.archetypes?.engine).slice(0, 3),
          finisher: normalizeArchetype(data.archetypes?.finisher).slice(0, 3),
          differenceMaker: normalizeArchetype(data.archetypes?.differenceMaker).slice(0, 3)
        },
        focusAreas: Array.isArray(data.focusAreas) ? data.focusAreas : []
      };

      setInsights(newInsights);
      setLastGeneratedHash(currentHash);

      localStorage.setItem(insightsKey, JSON.stringify(newInsights));
      localStorage.setItem(hashKey, currentHash);

    } catch (err) {
      console.warn("[AiAdvisorModule] Gemini endpoint offline or failed. Falling back to rule heuristics:", err);
      const fallback = generateHeuristicBriefing();
      setInsights(fallback);
      setLastGeneratedHash(currentHash);
      localStorage.setItem(insightsKey, JSON.stringify(fallback));
      localStorage.setItem(hashKey, currentHash);
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    if (!insights) {
      const initBriefing = generateHeuristicBriefing();
      setInsights(initBriefing);
      setLastGeneratedHash(currentHash);
      localStorage.setItem(insightsKey, JSON.stringify(initBriefing));
      localStorage.setItem(hashKey, currentHash);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0">
          {dataChanged && insights && !isAnalyzing && (
            <span className="text-amber-400 text-[10px] sm:text-xs font-bold uppercase tracking-widest animate-pulse border border-amber-500/30 bg-amber-500/10 px-3 py-2 rounded-xl">
              ⚠️ Stats changed
            </span>
          )}
          <button 
            onClick={generateInsights}
            disabled={isAnalyzing}
            className={`flex items-center gap-2 px-6 py-3 border text-sm font-bold rounded-xl transition-all disabled:opacity-50 shrink-0 uppercase tracking-wider ${
              dataChanged 
                ? 'bg-amber-500 hover:bg-amber-400 border-amber-300 text-slate-950 shadow-lg shadow-amber-500/30 animate-pulse' 
                : 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-slate-200 shadow-md'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
            {isAnalyzing ? 'Processing...' : dataChanged ? 'Update Briefing' : 'Generate Briefing'}
          </button>
        </div>
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

            {insights.archetypes && (insights.archetypes.engine?.length > 0 || insights.archetypes.finisher?.length > 0 || insights.archetypes.differenceMaker?.length > 0) && (
               <div className="mt-8 pt-8 border-t border-slate-800">
                  <h3 className="text-xl font-black text-white uppercase tracking-widest mb-6">Player Archetypes</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     {insights.archetypes.engine?.length > 0 && (
                        <div className="bg-blue-900/20 border border-blue-500/30 rounded-2xl p-5">
                           <div className="text-xs uppercase tracking-widest text-blue-400 font-bold mb-1">The Engine</div>
                           <div className="text-lg font-black text-white mb-2">{insights.archetypes.engine.map(p => p.name).join(', ')}</div>
                           <p className="text-sm font-bold text-slate-300 leading-relaxed">
                              Primary distributor{insights.archetypes.engine.length > 1 ? 's' : ''}, keeping the disc moving with high reliability.
                           </p>
                        </div>
                     )}
                     {insights.archetypes.finisher?.length > 0 && (
                        <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-2xl p-5">
                           <div className="text-xs uppercase tracking-widest text-emerald-400 font-bold mb-1">The Finisher</div>
                           <div className="text-lg font-black text-white mb-2">{insights.archetypes.finisher.map(p => p.name).join(', ')}</div>
                           <p className="text-sm font-bold text-slate-300 leading-relaxed">
                              Clinical in the endzone, converting the most scoring opportunities into points.
                           </p>
                        </div>
                     )}
                     {insights.archetypes.differenceMaker?.length > 0 && (
                        <div className="bg-purple-900/20 border border-purple-500/30 rounded-2xl p-5">
                           <div className="text-xs uppercase tracking-widest text-purple-400 font-bold mb-1">The Difference Maker</div>
                           <div className="text-lg font-black text-white mb-2">{insights.archetypes.differenceMaker.map(p => p.name).join(', ')}</div>
                           <p className="text-sm font-bold text-slate-300 leading-relaxed">
                              Generated the most high-value plays on the pitch (Assists, Blocks, and Hucks).
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
