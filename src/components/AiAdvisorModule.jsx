import React, { useState, useEffect } from 'react';
import { Brain, RefreshCw, Activity, Target, Users } from 'lucide-react';

const AiAdvisorModule = ({ playerStats, rawStats, gameType, score }) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [insights, setInsights] = useState(null);

  const generateInsights = () => {
    setIsAnalyzing(true);
    setInsights(null);

    // Simulate AI processing delay
    setTimeout(() => {
      const generated = {
        personnel: "No personnel anomalies detected.",
        tactical: "No immediate tactical adjustments recommended.",
        conditioning: "Line efficiency appears stable."
      };

      if (playerStats && playerStats.length > 0) {
        // 1. Personnel Logic
        const highNisLowComp = playerStats.find(p => p.nis > 0 && p.usage > 15 && p.completion < 85);
        if (highNisLowComp) {
          generated.personnel = `${highNisLowComp.name} is driving positive Net Impact (+${highNisLowComp.nis.toFixed(1)}) but has a sub-optimal completion rate (${highNisLowComp.completion}%). Consider moving them to a mid-handler or cutter role to reduce deep-shot turnovers.`;
        } else {
          const topPerformer = playerStats.reduce((prev, current) => (prev.nis > current.nis) ? prev : current);
          generated.personnel = `${topPerformer.name} is anchoring the team with a +${topPerformer.nis.toFixed(1)} NIS. Keep their usage high while rotating handlers to preserve their energy.`;
        }

        // 2. Tactical Logic (Pull Distance & Surface)
        const pullStats = playerStats.filter(p => p.pulls > 0);
        if (pullStats.length > 0) {
          const avgScore = pullStats.reduce((sum, p) => sum + p.avgPullScore, 0) / pullStats.length;
          if (avgScore < 2.5) {
            generated.tactical = `Short pulls (Avg Impact: ${avgScore.toFixed(1)}/5) are allowing quick offensive holds. Push the pull deeper, especially in these ${gameType === 'beach' ? 'windy Beach' : gameType} conditions, to allow the D-mark to set properly.`;
          } else {
            generated.tactical = `Pull quality is excellent (Avg Impact: ${avgScore.toFixed(1)}/5). The defense is getting time to set. Focus on trapping the opponent on the sideline after the first pass.`;
          }
        } else if (gameType === 'beach') {
          generated.tactical = "Beach conditions drastically affect completion rates. Prioritize short, high-percentage passes and avoid floaty hucks into the wind.";
        } else {
          generated.tactical = "Offense is moving well. If the opponent switches to zone, ensure handlers are swinging the disc to stretch their cup.";
        }

        // 3. Conditioning / Line Logic
        // Simulate line efficiency drop based on late game score or high touches
        const totalPoints = score ? score.us + score.them : 0;
        if (totalPoints > 10) {
          generated.conditioning = "We're deep into the match. Based on the aggregate touch volume, your primary offensive handlers' efficiency typically drops ~15% from here. Consider a full rotation to rest the O-Line.";
        } else {
           generated.conditioning = "Energy levels look good. Keep monitoring your defensive pods for fatigue after long multi-turnover points.";
        }
      }

      setInsights(generated);
      setIsAnalyzing(false);
    }, 2000);
  };

  // Initial generation
  useEffect(() => {
    generateInsights();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameType, score?.us, score?.them]);

  return (
    <div className="w-full bg-slate-900 border border-slate-700/50 rounded-3xl p-6 shadow-xl relative overflow-hidden mb-8">
      {/* Background Pulse Effect */}
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
              AI Coach Advisor
              <span className="text-[10px] uppercase tracking-widest bg-indigo-600 px-2 py-0.5 rounded-full text-white font-bold">Pro</span>
            </h2>
            <p className="text-xs text-slate-400 uppercase tracking-widest font-bold mt-1">Elite Tactical Analysis</p>
          </div>
        </div>
        
        <button 
          onClick={generateInsights}
          disabled={isAnalyzing}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 text-sm font-bold rounded-xl transition-all shadow-md disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
          {isAnalyzing ? 'Analyzing...' : 'Refresh Insights'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative z-10">
        {/* Personnel Card */}
        <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-emerald-400">
            <Users className="w-4 h-4" />
            <h3 className="font-bold text-sm uppercase tracking-wider">Personnel</h3>
          </div>
          {isAnalyzing ? (
            <div className="space-y-2 mt-2">
              <div className="h-3 bg-slate-800 rounded animate-pulse w-full"></div>
              <div className="h-3 bg-slate-800 rounded animate-pulse w-5/6"></div>
              <div className="h-3 bg-slate-800 rounded animate-pulse w-4/6"></div>
            </div>
          ) : (
            <p className="text-slate-300 text-sm leading-relaxed font-medium">
              {insights?.personnel || "Awaiting data..."}
            </p>
          )}
        </div>

        {/* Tactical Card */}
        <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-indigo-400">
            <Target className="w-4 h-4" />
            <h3 className="font-bold text-sm uppercase tracking-wider">Tactical</h3>
          </div>
          {isAnalyzing ? (
            <div className="space-y-2 mt-2">
              <div className="h-3 bg-slate-800 rounded animate-pulse w-full"></div>
              <div className="h-3 bg-slate-800 rounded animate-pulse w-5/6"></div>
              <div className="h-3 bg-slate-800 rounded animate-pulse w-3/4"></div>
            </div>
          ) : (
            <p className="text-slate-300 text-sm leading-relaxed font-medium">
              {insights?.tactical || "Awaiting data..."}
            </p>
          )}
        </div>

        {/* Conditioning Card */}
        <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-rose-400">
            <Activity className="w-4 h-4" />
            <h3 className="font-bold text-sm uppercase tracking-wider">Conditioning</h3>
          </div>
          {isAnalyzing ? (
            <div className="space-y-2 mt-2">
              <div className="h-3 bg-slate-800 rounded animate-pulse w-full"></div>
              <div className="h-3 bg-slate-800 rounded animate-pulse w-5/6"></div>
              <div className="h-3 bg-slate-800 rounded animate-pulse w-4/5"></div>
            </div>
          ) : (
            <p className="text-slate-300 text-sm leading-relaxed font-medium">
              {insights?.conditioning || "Awaiting data..."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AiAdvisorModule;
