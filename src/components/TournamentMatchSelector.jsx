import React, { useState, useEffect } from 'react';
import { fetchTournaments, fetchTournamentMatches } from '../supabaseClient';
import { Trophy, Calendar, Eye, Activity, RefreshCw, ArrowLeft } from 'lucide-react';

const TournamentMatchSelector = ({ onBack, onSelectMatch }) => {
  const [tournaments, setTournaments] = useState([]);
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadTournaments();
  }, []);

  useEffect(() => {
    if (selectedTournament) {
      loadMatches(selectedTournament.id);
    }
  }, [selectedTournament]);

  const loadTournaments = async () => {
    setLoading(true);
    try {
      const data = await fetchTournaments();
      setTournaments(data || []);
      if (data && data.length > 0) {
        setSelectedTournament(data[0]);
      }
    } catch (err) {
      setError('Failed to load tournaments list.');
    } finally {
      setLoading(false);
    }
  };

  const loadMatches = async (tid) => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchTournamentMatches(tid);
      setMatches(data || []);
    } catch (err) {
      setError('Failed to load matches scheduled for this tournament.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col p-4 sm:p-6 md:p-8 pb-32">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-6 mb-8">
        <div className="flex items-center gap-4">
          {onBack && (
            <button onClick={onBack} className="p-3 rounded-2xl bg-slate-800 hover:bg-slate-700 transition-colors">
              <ArrowLeft className="w-5 h-5 text-indigo-400" />
            </button>
          )}
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight flex items-center gap-3">
              Live Tournament Center
              <span className="text-[10px] uppercase tracking-widest bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full text-emerald-400 font-bold shadow-lg shadow-emerald-500/5 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live Brackets
              </span>
            </h1>
            <p className="text-sm text-slate-400 mt-1 font-medium">Sideline score tracking, multi-pitch schedules, and brackets</p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-stretch sm:self-auto">
          {tournaments.length > 0 && (
            <div className="flex items-center gap-3 bg-slate-950/60 p-2.5 border border-slate-800 rounded-2xl w-full sm:w-auto">
              <Trophy className="w-5 h-5 text-indigo-400 shrink-0" />
              <select
                value={selectedTournament?.id || ''}
                onChange={(e) => setSelectedTournament(tournaments.find(t => t.id === e.target.value))}
                className="bg-transparent text-white font-black text-sm uppercase tracking-wider border-none outline-none focus:ring-0 cursor-pointer pr-8"
              >
                {tournaments.map(t => (
                  <option key={t.id} value={t.id} className="bg-slate-950 text-slate-200 uppercase font-black tracking-wide text-xs">{t.name}</option>
                ))}
              </select>
            </div>
          )}

          {selectedTournament && (
            <button
              onClick={() => loadMatches(selectedTournament.id)}
              disabled={loading}
              className="p-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-2xl transition-colors text-indigo-400"
              title="Refresh Scores"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-5 py-4 rounded-2xl text-sm flex items-start gap-3 mb-6">
          <span className="font-bold">{error}</span>
        </div>
      )}

      {/* Matches Grid */}
      {loading && matches.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-40 bg-slate-950/40 rounded-3xl border border-slate-800/50 animate-pulse" />
          <div className="h-40 bg-slate-950/40 rounded-3xl border border-slate-800/50 animate-pulse" />
        </div>
      ) : matches.length === 0 ? (
        <div className="bg-slate-950/40 border border-slate-800 rounded-3xl p-16 text-center text-slate-500 font-medium">
          No matches scheduled for this tournament yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {matches.map(m => (
            <div
              key={m.id}
              onClick={() => m.status !== 'scheduled' && onSelectMatch(m)}
              className={`bg-slate-950/60 border border-slate-800 rounded-3xl p-6 sm:p-8 flex flex-col justify-between h-48 transition-all group ${
                m.status !== 'scheduled' ? 'cursor-pointer hover:border-indigo-500/40 hover:bg-slate-950/90' : 'opacity-80'
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] uppercase tracking-widest font-black bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-full text-indigo-400">
                    Pitch {m.pitch_number || '1'}
                  </span>
                  {m.status === 'completed' ? (
                    <span className="text-[10px] uppercase tracking-widest font-black bg-slate-900 border border-slate-850 px-3 py-1 rounded-full text-slate-400">
                      Completed
                    </span>
                  ) : m.status === 'active' ? (
                    <span className="text-[10px] uppercase tracking-widest font-black bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full text-emerald-400 animate-pulse flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-emerald-400" /> Active
                    </span>
                  ) : (
                    <span className="text-[10px] uppercase tracking-widest font-black bg-slate-900 border border-slate-800/50 px-3 py-1 rounded-full text-slate-500">
                      Scheduled
                    </span>
                  )}
                </div>

                {m.status !== 'scheduled' && (
                  <Eye className="w-4 h-4 text-slate-600 group-hover:text-indigo-400 transition-colors" />
                )}
              </div>

              <div className="flex items-center justify-between gap-4 my-2">
                <div className="flex-1 flex flex-col min-w-0">
                  <span className="text-base font-black text-white uppercase tracking-tight truncate">{m.home_team?.team_name || 'Home'}</span>
                  <span className="text-[9px] uppercase tracking-widest text-slate-500 font-black mt-0.5">Home</span>
                </div>
                <div className="flex items-center gap-3 text-2xl font-black shrink-0 px-4 py-2 bg-slate-900/50 border border-slate-800 rounded-2xl">
                  <span className="text-indigo-400">{m.home_score}</span>
                  <span className="text-slate-700 font-light text-sm">-</span>
                  <span className="text-rose-500">{m.away_score}</span>
                </div>
                <div className="flex-1 flex flex-col items-end min-w-0">
                  <span className="text-base font-black text-white uppercase tracking-tight truncate">{m.away_team?.team_name || 'Away'}</span>
                  <span className="text-[9px] uppercase tracking-widest text-slate-500 font-black mt-0.5">Away</span>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-900 pt-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{m.start_time ? new Date(m.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'TBD'}</span>
                </div>
                {m.status !== 'scheduled' && (
                  <span className="text-[10px] text-indigo-400 font-black group-hover:underline">View Match Center &rarr;</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TournamentMatchSelector;
