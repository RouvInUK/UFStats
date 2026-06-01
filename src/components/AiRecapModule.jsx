import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { exportMatchToCsv } from '../utils/DuaaExportUtility';
import { Newspaper, RefreshCw, AlertTriangle, FileText, CheckCircle, ArrowLeft, Download, Star, Sparkles, Activity } from 'lucide-react';

const AiRecapModule = ({ match, onBack }) => {
  const matchId = match?.id;
  const homeTeamName = match?.home_team?.team_name || 'Home Team';
  const awayTeamName = match?.away_team?.team_name || 'Away Team';
  const division = match?.home_team?.division || 'Standard Mixed';

  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(true);
  const [error, setError] = useState('');
  const [rawStats, setRawStats] = useState([]);
  const [homePlayers, setHomePlayers] = useState([]);
  const [awayPlayers, setAwayPlayers] = useState([]);
  
  // Sports Recap Content state
  const [recap, setRecap] = useState(() => {
    try {
      const saved = localStorage.getItem(`recap_match_${matchId}`);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    loadMatchTelemetry();
  }, [matchId]);

  const loadMatchTelemetry = async () => {
    if (!matchId) return;
    setFetchingData(true);
    setError('');
    try {
      // 1. Fetch raw stats logged for this game name
      const gameKey = `tournament_match_${matchId}`;
      const { data: statsData, error: statsErr } = await supabase
        .from('stats')
        .select('*')
        .eq('game_name', gameKey)
        .order('created_at', { ascending: true });

      if (statsErr) throw statsErr;
      setRawStats(statsData || []);

      // 2. Fetch rosters
      const { data: homeP, error: homeErr } = await supabase
        .from('players')
        .select('*')
        .eq('team_id', match.home_team_id)
        .order('name', { ascending: true });

      if (homeErr) throw homeErr;
      setHomePlayers(homeP || []);

      const { data: awayP, error: awayErr } = await supabase
        .from('players')
        .select('*')
        .eq('team_id', match.away_team_id)
        .order('name', { ascending: true });

      if (awayErr) throw awayErr;
      setAwayPlayers(awayP || []);

    } catch (err) {
      setError('Failed to load match telemetry or team rosters.');
    } finally {
      setFetchingData(false);
    }
  };

  // Compile aggregate playerStats for the recap backend
  const compiledPlayerStats = useMemo(() => {
    const playersMap = {};

    const ensurePlayer = (name) => {
      if (!playersMap[name]) {
        playersMap[name] = { name, goals: 0, assists: 0, ds: 0, turnovers: 0 };
      }
      return playersMap[name];
    };

    rawStats.forEach((stat, index) => {
      if (stat.player === 'System' || stat.player === 'Opponent' || stat.stat_type === 'Match Metadata' || stat.stat_type === 'Lineup') return;
      
      const p = ensurePlayer(stat.player);
      
      if (stat.stat_type === 'Point') {
        p.goals += 1;

        // Robust backward-scanning logic for assists
        let passesInPoint = [];
        for (let i = index - 1; i >= 0; i--) {
          const s = rawStats[i];
          if (s.game_name !== stat.game_name || s.point_number !== stat.point_number) {
            break;
          }
          if (s.stat_type === 'Pass' && s.team_id === stat.team_id) {
            passesInPoint.push(s);
          }
        }

        if (passesInPoint.length > 1) {
          const primaryAssisterStat = passesInPoint[1];
          if (primaryAssisterStat.player !== stat.player) {
            const assisterPlayer = ensurePlayer(primaryAssisterStat.player);
            assisterPlayer.assists += 1;
          }
        }
      } else if (['Throwaway', 'Drop', 'Stall Out'].includes(stat.stat_type)) {
        p.turnovers += 1;
      } else if (stat.stat_type === 'Defence' || stat.stat_type === 'Block') {
        p.ds += 1;
      }
    });

    return Object.values(playersMap);
  }, [rawStats]);

  const handleGenerateRecap = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/generate-recap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          playerStats: compiledPlayerStats,
          rawStats: rawStats,
          homeTeamName: homeTeamName,
          awayTeamName: awayTeamName,
          finalScore: { home: match.home_score || 0, away: match.away_score || 0 }
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to connect to the writing desk.');
      }

      const parsedRecap = await response.json();
      setRecap(parsedRecap);
      localStorage.setItem(`recap_match_${matchId}`, JSON.stringify(parsedRecap));
    } catch (err) {
      setError(err.message || 'Failed to generate sports journalism recap.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadTelemetry = () => {
    exportMatchToCsv(match, rawStats, homePlayers, awayPlayers);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col p-4 sm:p-6 md:p-8 pb-32">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-6 mb-8">
        <div className="flex items-center gap-4">
          {onBack && (
            <button onClick={onBack} className="p-3 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-colors">
              <ArrowLeft className="w-5 h-5 text-indigo-400" />
            </button>
          )}
          <div>
            <span className="text-[10px] uppercase tracking-widest bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full text-emerald-400 font-black">
              Pitch {match?.pitch_number || '1'} Match Center
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-white mt-2 uppercase tracking-tight flex items-center gap-3">
              {homeTeamName} 
              <span className="text-indigo-400">{match?.home_score}</span>
              <span className="text-slate-700 font-light text-base">-</span>
              <span className="text-rose-500">{match?.away_score}</span>
              {awayTeamName}
            </h1>
          </div>
        </div>

        <button
          onClick={handleDownloadTelemetry}
          disabled={fetchingData}
          className="flex items-center gap-2 px-5 py-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-black uppercase tracking-widest rounded-xl transition-all disabled:opacity-50 text-emerald-400 self-stretch sm:self-auto shadow-md"
        >
          <Download className="w-4 h-4 text-emerald-400" /> Download telemetry CSV
        </button>
      </div>

      {fetchingData ? (
        <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-900/40 border border-slate-850 rounded-3xl h-64">
          <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
          <span className="text-xs uppercase tracking-widest text-slate-500 font-black mt-4">Analyzing sideline timeline...</span>
        </div>
      ) : error ? (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-6 rounded-3xl flex items-start gap-4 mb-6">
          <AlertTriangle className="w-6 h-6 text-rose-500 shrink-0" />
          <div>
            <h4 className="font-black uppercase tracking-wider text-sm">Writing Desk Failure</h4>
            <p className="text-xs text-rose-300 mt-1 font-medium">{error}</p>
            <button
              onClick={loadMatchTelemetry}
              className="mt-4 px-4 py-2 bg-rose-950/40 hover:bg-rose-900/50 border border-rose-500/30 rounded-lg text-rose-400 text-[10px] font-black uppercase tracking-widest transition-colors"
            >
              Try Reconnecting
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Recap Panel */}
          <div className="lg:col-span-2 space-y-6">
            {!recap ? (
              <div className="bg-slate-900/40 border border-slate-850 rounded-3xl p-12 text-center flex flex-col items-center justify-center h-80">
                <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-indigo-400 mb-4">
                  <Sparkles className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-black text-white uppercase tracking-wider">AI Sports Journalism Recap</h3>
                <p className="text-xs text-slate-400 mt-2 max-w-sm leading-relaxed font-medium">
                  Construct a high-quality, professional tournament news article reviewing key momentum shifts, breakout play patterns, and standout scorers.
                </p>
                <button
                  onClick={handleGenerateRecap}
                  disabled={loading}
                  className="mt-6 flex items-center gap-2 px-8 py-3.5 bg-indigo-600 border border-indigo-500 text-white font-black uppercase tracking-widest text-xs rounded-xl shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {loading ? 'Writing Recap Article...' : 'Generate Match Recap'}
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-indigo-300" />}
                </button>
              </div>
            ) : (
              <article className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 sm:p-10 relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-rose-500" />
                
                {/* Magazine Branding */}
                <div className="flex justify-between items-center border-b border-slate-800/80 pb-6 mb-8 text-[9px] uppercase tracking-widest text-slate-500 font-bold">
                  <span>ustats.pro newsroom</span>
                  <span>Recap Article</span>
                </div>

                {/* Article Contents */}
                <header className="mb-6">
                  <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight uppercase tracking-tight">
                    {recap.headline}
                  </h2>
                </header>

                <div className="space-y-6 text-sm text-slate-300 leading-relaxed font-medium">
                  <p className="border-l-2 border-indigo-500 pl-4 text-slate-200 font-semibold italic text-base leading-normal">
                    {recap.leadParagraph}
                  </p>
                  
                  <div>
                    <h4 className="text-[10px] uppercase tracking-widest text-indigo-400 font-black mb-2 flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5" /> Momentum shifts & strategy
                    </h4>
                    <p>{recap.momentumParagraph}</p>
                  </div>

                  <div>
                    <h4 className="text-[10px] uppercase tracking-widest text-amber-400 font-black mb-2 flex items-center gap-1.5">
                      <Star className="w-3.5 h-3.5" /> Standout performers
                    </h4>
                    <p>{recap.starPerformers}</p>
                  </div>

                  <div className="border-t border-slate-800/60 pt-6 mt-8">
                    <h4 className="text-[10px] uppercase tracking-widest text-emerald-400 font-black mb-2">
                      Outlook & standings summary
                    </h4>
                    <p className="text-slate-400 italic">{recap.summary}</p>
                  </div>
                </div>

                {/* Regenerate Trigger */}
                <div className="mt-10 pt-6 border-t border-slate-850 flex justify-end">
                  <button
                    onClick={handleGenerateRecap}
                    disabled={loading}
                    className="flex items-center gap-2 px-5 py-2.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-xs font-black uppercase tracking-widest rounded-xl transition-all disabled:opacity-50 text-indigo-400 hover:text-indigo-300"
                  >
                    Regenerate Recap
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </article>
            )}
          </div>

          {/* Quick Metrics Side Card */}
          <div className="lg:col-span-1 bg-slate-900/50 border border-slate-800 rounded-3xl p-6 sm:p-8 flex flex-col justify-between h-[450px]">
            <div>
              <h3 className="text-base font-black text-white uppercase tracking-wider mb-6 border-b border-slate-850 pb-4">Match Statistics</h3>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider">
                  <span className="text-slate-500">Tournament Division</span>
                  <span className="text-slate-200">{division}</span>
                </div>
                <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider">
                  <span className="text-slate-500">Total Points Tracked</span>
                  <span className="text-indigo-400">{rawStats.filter(s => s.stat_type === 'Point' || s.stat_type === 'Opponent Point').length}</span>
                </div>
                <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider">
                  <span className="text-slate-500">Total Telemetry Events</span>
                  <span className="text-indigo-400">{rawStats.length}</span>
                </div>
                <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider">
                  <span className="text-slate-500">Home Roster Size</span>
                  <span className="text-slate-200">{homePlayers.length} players</span>
                </div>
                <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider">
                  <span className="text-slate-500">Away Roster Size</span>
                  <span className="text-slate-200">{awayPlayers.length} players</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-950 p-4 border border-slate-850 rounded-2xl">
              <span className="text-[9px] uppercase tracking-widest text-indigo-400 font-black block mb-1">Roster Designation Ratios</span>
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-black block">{homeTeamName}</span>
                  <span className="text-xs font-bold text-slate-200 mt-0.5 block">
                    {homePlayers.filter(p => p.gender_designation === 'mmp').length} MMP / {homePlayers.filter(p => p.gender_designation === 'fmp').length} FMP
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-black block">{awayTeamName}</span>
                  <span className="text-xs font-bold text-slate-200 mt-0.5 block">
                    {awayPlayers.filter(p => p.gender_designation === 'mmp').length} MMP / {awayPlayers.filter(p => p.gender_designation === 'fmp').length} FMP
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AiRecapModule;
