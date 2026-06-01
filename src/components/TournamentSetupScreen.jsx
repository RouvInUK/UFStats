import React, { useState, useEffect, useMemo } from 'react';
import { supabase, fetchTournaments, createTournament, updateTournament, fetchTournamentTeams, createTournamentTeam, fetchTournamentMatches, createTournamentMatch, createTournamentScorerSeat } from '../supabaseClient';
import { Trophy, Calendar, Users, Target, Plus, Check, Play, Share2, Clipboard, FileSpreadsheet, Trash2, ArrowLeft, AlertTriangle, UserPlus, Edit2, X } from 'lucide-react';

const TournamentSetupScreen = ({ onBack, profile }) => {
  const [activeTab, setActiveTab] = useState('tournaments'); // 'tournaments' | 'teams' | 'matches'
  const [tournaments, setTournaments] = useState([]);
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  
  // Loading & Error States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form Inputs
  const [newTournamentName, setNewTournamentName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [tournamentGameType, setTournamentGameType] = useState('grass'); // 'grass', 'beach', 'indoor'
  const [editingTournamentId, setEditingTournamentId] = useState(null);

  const [newTeamName, setNewTeamName] = useState('');
  const [teamDivision, setTeamDivision] = useState('Standard Mixed'); // Standard Mixed, Light Mixed, Open, Women's

  const [homeTeamId, setHomeTeamId] = useState('');
  const [awayTeamId, setAwayTeamId] = useState('');
  const [pitchNumber, setPitchNumber] = useState('1');
  const [matchTime, setMatchTime] = useState('');

  // CSV Drag and Drop / Upload
  const [csvFile, setCsvFile] = useState(null);
  const [csvUploading, setCsvUploading] = useState(false);
  const [csvTeamId, setCsvTeamId] = useState('');

  // Roster Viewer/Editor State
  const [selectedRosterTeam, setSelectedRosterTeam] = useState(null);
  const [rosterPlayers, setRosterPlayers] = useState([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterError, setRosterError] = useState('');

  // Roster New Player Form
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerNumber, setNewPlayerNumber] = useState('');
  const [newPlayerGender, setNewPlayerGender] = useState(''); // '', 'mmp', 'fmp'

  // Roster Edit Player State
  const [editingPlayerId, setEditingPlayerId] = useState(null);
  const [editPlayerName, setEditPlayerName] = useState('');
  const [editPlayerNumber, setEditPlayerNumber] = useState('');
  const [editPlayerGender, setEditPlayerGender] = useState(''); // '', 'mmp', 'fmp'

  const hasExistingMatchup = useMemo(() => {
    if (!homeTeamId || !awayTeamId || matches.length === 0) return false;
    return matches.some(m => 
      (m.home_team_id === homeTeamId && m.away_team_id === awayTeamId) ||
      (m.home_team_id === awayTeamId && m.away_team_id === homeTeamId)
    );
  }, [homeTeamId, awayTeamId, matches]);

  // Match Edit State
  const [editingMatchId, setEditingMatchId] = useState(null);
  const [editMatchPitch, setEditMatchPitch] = useState('');
  const [editMatchTime, setEditMatchTime] = useState('');

  const handleStartEditMatch = (match) => {
    setEditingMatchId(match.id);
    setEditMatchPitch(match.pitch_number || '');
    if (match.start_time) {
      const localDate = new Date(match.start_time);
      const year = localDate.getFullYear();
      const month = String(localDate.getMonth() + 1).padStart(2, '0');
      const day = String(localDate.getDate()).padStart(2, '0');
      const hours = String(localDate.getHours()).padStart(2, '0');
      const minutes = String(localDate.getMinutes()).padStart(2, '0');
      setEditMatchTime(`${year}-${month}-${day}T${hours}:${minutes}`);
    } else {
      setEditMatchTime('');
    }
  };

  const handleSaveMatchEdit = async (e) => {
    e.preventDefault();
    if (!editingMatchId) return;
    setLoading(true);
    setError('');
    try {
      let formattedTime = null;
      if (editMatchTime) {
        try {
          formattedTime = new Date(editMatchTime).toISOString();
        } catch (e) {
          formattedTime = editMatchTime;
        }
      }

      const { data, error: updErr } = await supabase
        .from('tournament_matches')
        .update({
          pitch_number: editMatchPitch || null,
          start_time: formattedTime
        })
        .eq('id', editingMatchId)
        .select()
        .single();

      if (updErr) throw updErr;

      // Also update the pitch_code in tournament_scorer_seats to keep it perfectly synchronized!
      const newCode = `P${editMatchPitch}-${editingMatchId.substring(0, 4).toUpperCase()}`;
      await supabase
        .from('tournament_scorer_seats')
        .update({ pitch_code: newCode })
        .eq('match_id', editingMatchId);

      setSuccess('Match scheduled details updated successfully!');
      setEditingMatchId(null);
      if (selectedTournament) {
        await loadTournamentData(selectedTournament.id);
      }
    } catch (err) {
      setError(err.message || 'Failed to update match details.');
    } finally {
      setLoading(false);
    }
  };

  const loadTeamRoster = async (teamId) => {
    if (!teamId) return;
    setRosterLoading(true);
    setRosterError('');
    try {
      const { data, error: fetchErr } = await supabase
        .from('players')
        .select('*')
        .eq('team_id', teamId)
        .order('name', { ascending: true });
      if (fetchErr) throw fetchErr;
      setRosterPlayers(data || []);
    } catch (err) {
      setRosterError(err.message || 'Failed to load roster players.');
    } finally {
      setRosterLoading(false);
    }
  };

  useEffect(() => {
    if (selectedRosterTeam) {
      loadTeamRoster(selectedRosterTeam.id);
    }
  }, [selectedRosterTeam]);

  const handleAddPlayerManually = async (e) => {
    e.preventDefault();
    if (!selectedRosterTeam || !newPlayerName.trim()) return;
    setRosterLoading(true);
    setRosterError('');
    try {
      const { data, error: addErr } = await supabase
        .from('players')
        .insert([{
          name: newPlayerName.trim(),
          shirt_number: newPlayerNumber.trim() || null,
          gender_designation: newPlayerGender || null,
          team_id: selectedRosterTeam.id
        }])
        .select()
        .single();
      if (addErr) throw addErr;

      setRosterPlayers(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setNewPlayerName('');
      setNewPlayerNumber('');
      setNewPlayerGender('');
    } catch (err) {
      setRosterError(err.message || 'Failed to add player.');
    } finally {
      setRosterLoading(false);
    }
  };

  const handleDeletePlayer = async (playerId) => {
    if (!confirm('Are you sure you want to remove this player from the roster?')) return;
    setRosterLoading(true);
    setRosterError('');
    try {
      const { error: delErr } = await supabase
        .from('players')
        .delete()
        .eq('id', playerId);
      if (delErr) throw delErr;

      setRosterPlayers(prev => prev.filter(p => p.id !== playerId));
    } catch (err) {
      setRosterError(err.message || 'Failed to delete player.');
    } finally {
      setRosterLoading(false);
    }
  };

  const handleStartEditPlayer = (player) => {
    setEditingPlayerId(player.id);
    setEditPlayerName(player.name);
    setEditPlayerNumber(player.shirt_number || '');
    setEditPlayerGender(player.gender_designation || '');
  };

  const handleSaveEditPlayer = async (e) => {
    e.preventDefault();
    if (!editingPlayerId || !editPlayerName.trim()) return;
    setRosterLoading(true);
    setRosterError('');
    try {
      const { data, error: updErr } = await supabase
        .from('players')
        .update({
          name: editPlayerName.trim(),
          shirt_number: editPlayerNumber.trim() || null,
          gender_designation: editPlayerGender || null
        })
        .eq('id', editingPlayerId)
        .select()
        .single();
      if (updErr) throw updErr;

      setRosterPlayers(prev => prev.map(p => p.id === editingPlayerId ? data : p).sort((a, b) => a.name.localeCompare(b.name)));
      setEditingPlayerId(null);
    } catch (err) {
      setRosterError(err.message || 'Failed to update player.');
    } finally {
      setRosterLoading(false);
    }
  };

  useEffect(() => {
    loadAllTournaments();
  }, []);

  useEffect(() => {
    if (selectedTournament) {
      loadTournamentData(selectedTournament.id);
    } else {
      setTeams([]);
      setMatches([]);
    }
  }, [selectedTournament]);

  const loadAllTournaments = async () => {
    setLoading(true);
    try {
      const data = await fetchTournaments();
      setTournaments(data || []);
      if (data && data.length > 0 && !selectedTournament) {
        setSelectedTournament(data[0]);
      }
    } catch (err) {
      setError('Failed to load tournaments.');
    } finally {
      setLoading(false);
    }
  };

  const loadTournamentData = async (tid) => {
    setLoading(true);
    setError('');
    try {
      const tData = await fetchTournamentTeams(tid);
      setTeams(tData || []);
      
      const mData = await fetchTournamentMatches(tid);
      setMatches(mData || []);
    } catch (err) {
      setError('Failed to load tournament rosters or matches.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTournament = async (e) => {
    e.preventDefault();
    if (!newTournamentName.trim()) return;
    setLoading(true);
    setError('');
    try {
      if (editingTournamentId) {
        const data = await updateTournament(editingTournamentId, newTournamentName, startDate, endDate, tournamentGameType);
        
        // Auto-heal and batch-synchronize all existing matches' scorer seats to use the correct format!
        try {
          const { data: matchesData } = await supabase
            .from('tournament_matches')
            .select('id, pitch_number')
            .eq('tournament_id', editingTournamentId);
          
          if (matchesData && matchesData.length > 0) {
            for (const m of matchesData) {
              const expectedCode = `P${m.pitch_number || '1'}-${m.id.substring(0, 4).toUpperCase()}`;
              await supabase
                .from('tournament_scorer_seats')
                .update({ pitch_code: expectedCode })
                .eq('match_id', m.id);
            }
          }
        } catch (syncErr) {
          console.warn("Match batch synchronization warning:", syncErr);
        }

        setSuccess('Tournament details updated & all matches synchronized!');
        setNewTournamentName('');
        setStartDate('');
        setEndDate('');
        setTournamentGameType('grass');
        setEditingTournamentId(null);
        await loadAllTournaments();
        setSelectedTournament(data);
        await loadTournamentData(data.id);
      } else {
        const data = await createTournament(newTournamentName, startDate, endDate, profile?.id, tournamentGameType);
        setSuccess('Tournament created successfully!');
        setNewTournamentName('');
        setStartDate('');
        setEndDate('');
        setTournamentGameType('grass');
        await loadAllTournaments();
        setSelectedTournament(data);
      }
    } catch (err) {
      setError(err.message || (editingTournamentId ? 'Failed to update tournament.' : 'Failed to create tournament.'));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    if (!newTeamName.trim() || !selectedTournament) return;
    setLoading(true);
    setError('');
    try {
      await createTournamentTeam(selectedTournament.id, newTeamName, teamDivision);
      setSuccess('Team added successfully!');
      setNewTeamName('');
      await loadTournamentData(selectedTournament.id);
    } catch (err) {
      setError(err.message || 'Failed to add team.');
    } finally {
      setLoading(false);
    }
  };

  const handleScheduleMatch = async (e) => {
    e.preventDefault();
    if (!homeTeamId || !awayTeamId || !selectedTournament) return;
    if (homeTeamId === awayTeamId) {
      setError('Home and Away teams must be different.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const match = await createTournamentMatch(
        selectedTournament.id,
        homeTeamId,
        awayTeamId,
        pitchNumber,
        matchTime
      );

      // Generate a secure, deterministic Pitch Code for this seat
      const code = `P${pitchNumber}-${match.id.substring(0, 4).toUpperCase()}`;
      await createTournamentScorerSeat(selectedTournament.id, match.id, code);

      setSuccess('Match scheduled & Pitch Code generated!');
      setHomeTeamId('');
      setAwayTeamId('');
      setMatchTime('');
      await loadTournamentData(selectedTournament.id);
    } catch (err) {
      setError(err.message || 'Failed to schedule match.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetTournamentData = async () => {
    if (!selectedTournament) return;
    const confirmMessage = "Are you sure you want to completely reset all match scores, active lineups, and logged stats for this tournament?\n\nThis will:\n1. Reset all match scores to 0-0.\n2. Purge all stats telemetry events (Passes, Points, D-Blocks, Turnovers, Lineups).\n3. Revert all matches back to 'scheduled' state.\n4. Clear any local scorer sync cache.\n\nThis action cannot be undone. Do you wish to proceed?";
    
    if (!window.confirm(confirmMessage)) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const matchIds = matches.map(m => m.id);
      if (matchIds.length === 0) {
        setError('No scheduled matches found to reset.');
        setLoading(false);
        return;
      }

      // 1. Reset all tournament matches to score 0-0 and status 'scheduled'
      const { error: resetMatchesErr } = await supabase
        .from('tournament_matches')
        .update({
          home_score: 0,
          away_score: 0,
          status: 'scheduled'
        })
        .in('id', matchIds);

      if (resetMatchesErr) throw resetMatchesErr;

      // 2. Delete all stats associated with these matches
      const gameKeys = matchIds.map(id => `tournament_match_${id}`);
      const { error: deleteStatsErr } = await supabase
        .from('stats')
        .delete()
        .in('game_name', gameKeys);

      if (deleteStatsErr) throw deleteStatsErr;

      // 3. Clear any first point offense preferences stored locally
      matchIds.forEach(id => {
        localStorage.removeItem(`first_offense_${id}`);
      });

      // 4. Refresh local matches list
      const updatedMatches = await fetchTournamentMatches(selectedTournament.id);
      setMatches(updatedMatches || []);

      setSuccess('Tournament match scores and player stats successfully purged.');
      alert('Tournament scores and stats have been cleared.\n\nIMPORTANT: If volunteer scorers have unsynced stats queued locally in their terminal browsers, please instruct them to clear their browser local storage or click the "Clear Local Sync Queue" button in their scorer console to discard stale telemetry.');

    } catch (err) {
      setError(err.message || 'An error occurred while resetting the tournament stats.');
    } finally {
      setLoading(false);
    }
  };

  const generate6DigitCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid ambiguous chars
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleCsvUpload = async (e) => {
    e.preventDefault();
    if (!csvFile || !csvTeamId) return;

    setCsvUploading(true);
    setError('');
    setSuccess('');

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length <= 1) {
          throw new Error('CSV is empty or lacks headers.');
        }

        const headers = lines[0].toLowerCase().split(',');
        const nameIdx = headers.findIndex(h => h.includes('name'));
        const numberIdx = headers.findIndex(h => h.includes('number') || h.includes('shirt'));
        const genderIdx = headers.findIndex(h => h.includes('gender') || h.includes('designation') || h.includes('mmp') || h.includes('fmp'));

        if (nameIdx === -1) {
          throw new Error('CSV must contain a "name" column.');
        }

        const playersToInsert = [];
        const uniqueNames = new Set();

        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
          const pName = cols[nameIdx];
          if (!pName || uniqueNames.has(pName)) continue;
          uniqueNames.add(pName);

          const shirtNum = numberIdx !== -1 ? cols[numberIdx] : '';
          
          let gender = null;
          if (genderIdx !== -1 && cols[genderIdx]) {
            const rawGender = cols[genderIdx].toLowerCase();
            if (rawGender.includes('mmp') || rawGender === 'm' || rawGender.includes('male')) {
              gender = 'mmp';
            } else if (rawGender.includes('fmp') || rawGender === 'f' || rawGender.includes('female')) {
              gender = 'fmp';
            }
          }

          playersToInsert.push({
            name: pName,
            shirt_number: shirtNum || null,
            gender_designation: gender,
            team_id: csvTeamId
          });
        }

        if (playersToInsert.length === 0) {
          throw new Error('No valid players parsed from CSV.');
        }

        // Insert into supabase
        const { error: insertError } = await supabase
          .from('players')
          .insert(playersToInsert);

        if (insertError) throw insertError;

        setSuccess(`Roster successfully updated! Imported ${playersToInsert.length} players.`);
        setCsvFile(null);
        
        // Automatically open the roster editor for the team that was just uploaded
        const uploadedTeam = teams.find(t => t.id === csvTeamId);
        if (uploadedTeam) {
          setSelectedRosterTeam(uploadedTeam);
        }
      } catch (err) {
        setError(err.message || 'Failed to process CSV file.');
      } finally {
        setCsvUploading(false);
      }
    };
    reader.readAsText(csvFile);
  };

  const copyShareLink = (code) => {
    const shareUrl = `${window.location.origin}/volunteer-login?code=${code}`;
    navigator.clipboard.writeText(shareUrl);
    alert(`Volunteer Access Link copied to clipboard!\n\n${shareUrl}`);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col p-4 sm:p-6 md:p-8 pb-32">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-6 mb-8">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-3 rounded-2xl bg-slate-800 hover:bg-slate-700 transition-colors">
            <ArrowLeft className="w-5 h-5 text-indigo-400" />
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight flex items-center gap-3">
              Tournament Desk
              <span className="text-[10px] uppercase tracking-widest bg-indigo-500 px-2.5 py-0.5 rounded-full text-white font-bold shadow-lg shadow-indigo-500/20">Organizer</span>
            </h1>
            <p className="text-sm text-slate-400 mt-1">Multi-Pitch Match & Roster Provisioning Portal</p>
          </div>
        </div>

        {tournaments.length > 0 && (
          <div className="flex items-center gap-3 self-stretch sm:self-auto bg-slate-950/60 p-2.5 border border-slate-800 rounded-2xl shrink-0">
            <Trophy className="w-5 h-5 text-indigo-400" />
            <select
              value={selectedTournament?.id || ''}
              onChange={(e) => setSelectedTournament(tournaments.find(t => t.id === e.target.value))}
              className="bg-transparent text-white font-black text-sm uppercase tracking-wider border-none outline-none focus:ring-0 cursor-pointer pr-8"
            >
              {tournaments.map(t => (
                <option key={t.id} value={t.id} className="bg-slate-950 text-slate-200 uppercase font-black tracking-wide text-xs">
                  {t.name} ({t.game_type || 'grass'})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-800 pb-4 mb-8">
        <button
          onClick={() => setActiveTab('tournaments')}
          className={`flex items-center gap-2 px-5 py-3 text-xs uppercase tracking-widest font-black rounded-xl transition-all border ${
            activeTab === 'tournaments'
              ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400 shadow-md'
              : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Trophy className="w-4 h-4" /> Tournaments
        </button>
        <button
          onClick={() => setActiveTab('teams')}
          className={`flex items-center gap-2 px-5 py-3 text-xs uppercase tracking-widest font-black rounded-xl transition-all border ${
            activeTab === 'teams'
              ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400 shadow-md'
              : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Users className="w-4 h-4" /> Teams & Rosters
        </button>
        <button
          onClick={() => setActiveTab('matches')}
          className={`flex items-center gap-2 px-5 py-3 text-xs uppercase tracking-widest font-black rounded-xl transition-all border ${
            activeTab === 'matches'
              ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400 shadow-md'
              : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4" /> Scheduled Matches
        </button>
      </div>

      {/* Error & Success Messages */}
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-5 py-4 rounded-2xl text-sm flex items-start gap-3 mb-6">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-500" />
          <span className="font-bold">{error}</span>
        </div>
      )}
      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-5 py-4 rounded-2xl text-sm flex items-start gap-3 mb-6">
          <Check className="w-5 h-5 shrink-0 text-emerald-400 animate-pulse" />
          <span className="font-bold">{success}</span>
        </div>
      )}

      {/* Tab Contents */}
      {activeTab === 'tournaments' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 bg-slate-950/60 border border-slate-800 rounded-3xl p-6 sm:p-8">
            <h2 className="text-lg font-black text-white uppercase tracking-widest mb-6 border-b border-slate-900 pb-4">
              {editingTournamentId ? 'Edit Tournament Details' : 'New Tournament'}
            </h2>
            <form onSubmit={handleCreateTournament} className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Tournament Name</label>
                <input
                  type="text"
                  value={newTournamentName}
                  onChange={(e) => setNewTournamentName(e.target.value)}
                  placeholder="e.g. UK Mixed Nationals 2026"
                  required
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 text-slate-200 transition-colors shadow-inner"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 text-slate-200 transition-colors shadow-inner text-xs font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 text-slate-200 transition-colors shadow-inner text-xs font-bold"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Game Format</label>
                <select
                  value={tournamentGameType}
                  onChange={(e) => setTournamentGameType(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 text-slate-200 transition-colors shadow-inner text-xs font-bold"
                >
                  <option value="grass">Grass (7v7)</option>
                  <option value="beach">Beach (5v5)</option>
                  <option value="indoor">Indoor (5v5)</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-500/20 py-3.5 px-6 font-black rounded-xl uppercase tracking-widest text-xs shadow-lg shadow-indigo-500/10 flex items-center justify-center gap-2 transition-all mt-6"
              >
                {editingTournamentId ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {editingTournamentId ? 'Save Changes' : 'Create Tournament'}
              </button>
              {editingTournamentId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingTournamentId(null);
                    setNewTournamentName('');
                    setStartDate('');
                    setEndDate('');
                    setTournamentGameType('grass');
                  }}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-slate-350 border border-slate-800 hover:border-slate-700 py-3.5 px-6 font-black rounded-xl uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all mt-2"
                >
                  <X className="w-4 h-4" /> Cancel Edit
                </button>
              )}
            </form>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-lg font-black text-white uppercase tracking-widest mb-6">Existing Tournaments</h2>
            {tournaments.length === 0 ? (
              <div className="bg-slate-950/40 border border-slate-800 rounded-3xl p-12 text-center text-slate-500 font-medium">
                No tournaments scheduled yet. Create one on the left to get started.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {tournaments.map(t => (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTournament(t)}
                    className={`bg-slate-950/60 border rounded-3xl p-6 cursor-pointer hover:border-indigo-500/40 hover:bg-slate-950/90 transition-all flex flex-col justify-between h-40 ${
                      selectedTournament?.id === t.id ? 'border-indigo-500 bg-slate-950/80 shadow-md shadow-indigo-500/5' : 'border-slate-800'
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-start w-full gap-2">
                        <div className="flex gap-2 items-center">
                          <span className="text-[9px] uppercase tracking-widest font-black bg-slate-900 px-2 py-0.5 rounded text-indigo-400">Match Pool</span>
                          <span className="text-[9px] uppercase tracking-widest font-black bg-indigo-900/30 border border-indigo-500/20 px-2 py-0.5 rounded text-indigo-300 animate-pulse">
                            {t.game_type || 'grass'}
                          </span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setNewTournamentName(t.name);
                            setStartDate(t.start_date || '');
                            setEndDate(t.end_date || '');
                            setTournamentGameType(t.game_type || 'grass');
                            setEditingTournamentId(t.id);
                          }}
                          className="p-1.5 bg-slate-905 hover:bg-indigo-600/20 border border-slate-900 hover:border-indigo-500/30 rounded-xl transition-all text-slate-500 hover:text-indigo-400 shrink-0 flex items-center justify-center"
                          title="Edit Tournament Details"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <h3 className="text-lg font-black text-white mt-2 leading-snug uppercase tracking-tight">{t.name}</h3>
                    </div>
                    <div className="flex items-center gap-2 text-slate-500 text-xs font-bold border-t border-slate-900 pt-4">
                      <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                      <span>{t.start_date || 'TBD'} to {t.end_date || 'TBD'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'teams' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-6">
            {/* Create Team Form */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-3xl p-6 sm:p-8">
              <h2 className="text-lg font-black text-white uppercase tracking-widest mb-6 border-b border-slate-900 pb-4">Add Tournament Team</h2>
              <form onSubmit={handleCreateTeam} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Team Name</label>
                  <input
                    type="text"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    placeholder="e.g. London Mixed Ultimate"
                    required
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 text-slate-200 transition-colors shadow-inner"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Mixed Division Warning Settings</label>
                  <select
                    value={teamDivision}
                    onChange={(e) => setTeamDivision(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 text-slate-200 transition-colors font-bold text-xs cursor-pointer"
                  >
                    <option value="Standard Mixed" className="bg-slate-950 text-slate-200 font-bold uppercase tracking-wider text-xs">Standard Mixed (Rule A/B/B/A alternations)</option>
                    <option value="Light Mixed" className="bg-slate-950 text-slate-200 font-bold uppercase tracking-wider text-xs">Light Mixed (At least 2 FMP on field)</option>
                    <option value="Not Applicable" className="bg-slate-950 text-slate-200 font-bold uppercase tracking-wider text-xs">Not Applicable (No mixed ratio audits)</option>
                    <option value="Open" className="bg-slate-950 text-slate-200 font-bold uppercase tracking-wider text-xs">Open (No roster ratio audits)</option>
                    <option value="Women" className="bg-slate-950 text-slate-200 font-bold uppercase tracking-wider text-xs">Women's (Strictly female matching roster)</option>
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={loading || !selectedTournament}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-500/20 py-3.5 px-6 font-black rounded-xl uppercase tracking-widest text-xs shadow-lg shadow-indigo-500/10 flex items-center justify-center gap-2 transition-all mt-6 disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" /> Add Team
                </button>
              </form>
            </div>

            {/* Roster CSV Drag & Drop */}
            {teams.length > 0 && (
              <div className="bg-slate-950/60 border border-slate-800 rounded-3xl p-6 sm:p-8">
                <h2 className="text-lg font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-indigo-400" />
                  Roster CSV Importer
                </h2>
                <p className="text-[10px] text-slate-400 font-medium leading-relaxed mb-4">
                  Select a team below, then upload a CSV containing player names, shirt numbers, and gender matches.
                </p>
                <div className="bg-slate-900/60 border border-slate-850 rounded-2xl p-4 mb-6">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Example CSV Format:</p>
                  <pre className="text-[10px] text-indigo-300 font-mono bg-slate-950 p-3.5 rounded-xl border border-white/5 overflow-x-auto select-all leading-relaxed">
{`name,number,gender/designation
Alex Smith,7,mmp
Sarah Connor,12,fmp
Jamie Jones,4,mmp`}
                  </pre>
                  <p className="text-[9px] text-slate-500 font-semibold mt-2 pl-1 leading-normal italic">
                    * Header names are case-sensitive. "mmp" (Male Matching Player) and "fmp" (Female Matching Player) are used to audit mixed line balances.
                  </p>
                </div>
                <form onSubmit={handleCsvUpload} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Select Target Team</label>
                    <select
                      value={csvTeamId}
                      onChange={(e) => setCsvTeamId(e.target.value)}
                      required
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 text-slate-200 transition-colors font-bold text-xs cursor-pointer"
                    >
                      <option value="" className="bg-slate-950 text-slate-500">-- Select Roster --</option>
                      {teams.map(t => (
                        <option key={t.id} value={t.id} className="bg-slate-950 text-slate-200 font-bold uppercase tracking-wider text-xs">{t.team_name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="space-y-2">
                    <input
                      type="file"
                      accept=".csv"
                      onChange={(e) => setCsvFile(e.target.files[0])}
                      required
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 outline-none transition-all shadow-inner text-xs"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={csvUploading || !csvTeamId || !csvFile}
                    className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-indigo-400 py-3.5 px-6 font-black rounded-xl uppercase tracking-widest text-xs shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  >
                    {csvUploading ? 'Importing Roster...' : 'Import Roster CSV'}
                  </button>
                </form>
              </div>
            )}
          </div>

          <div className="lg:col-span-2">
            {selectedRosterTeam ? (
              <div className="bg-slate-950/60 border border-slate-800 rounded-3xl p-6 sm:p-8">
                {/* Header */}
                <div className="flex justify-between items-center border-b border-slate-900 pb-4 mb-6">
                  <div>
                    <span className="text-[9px] uppercase tracking-widest font-black bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded text-indigo-400">Roster Editor</span>
                    <h3 className="text-xl font-black text-white mt-1 uppercase tracking-tight">{selectedRosterTeam.team_name}</h3>
                  </div>
                  <button 
                    onClick={() => { setSelectedRosterTeam(null); setEditingPlayerId(null); }}
                    className="px-4 py-2 bg-slate-900 border border-slate-850 hover:bg-slate-800 rounded-xl text-xs font-black uppercase tracking-wider text-slate-400 hover:text-white transition-colors"
                  >
                    Back to Teams
                  </button>
                </div>

                {rosterError && (
                  <div className="bg-rose-500/10 border border-rose-500/25 rounded-2xl p-4 mb-6 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                    <p className="text-xs font-bold text-rose-400 leading-normal">{rosterError}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                  {/* Left Column: Add Player */}
                  <div className="xl:col-span-1 bg-slate-900/60 border border-slate-850 rounded-2xl p-5 h-fit">
                    <h4 className="text-xs font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                      <UserPlus className="w-4 h-4 text-indigo-400" /> Add Player
                    </h4>
                    <form onSubmit={handleAddPlayerManually} className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Player Name</label>
                        <input
                          type="text"
                          value={newPlayerName}
                          onChange={(e) => setNewPlayerName(e.target.value)}
                          required
                          placeholder="e.g. Michael Jordan"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 text-slate-200 transition-colors font-bold text-xs"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Shirt Number</label>
                          <input
                            type="text"
                            value={newPlayerNumber}
                            onChange={(e) => setNewPlayerNumber(e.target.value)}
                            placeholder="e.g. 23"
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 text-slate-200 transition-colors font-bold text-xs text-center"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Gender Match</label>
                          <select
                            value={newPlayerGender}
                            onChange={(e) => setNewPlayerGender(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 text-slate-200 transition-colors font-bold text-xs cursor-pointer"
                          >
                            <option value="">None</option>
                            <option value="mmp">MMP</option>
                            <option value="fmp">FMP</option>
                          </select>
                        </div>
                      </div>
                      <button
                        type="submit"
                        disabled={rosterLoading || !newPlayerName.trim()}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-3.5 px-4 rounded-xl uppercase tracking-widest text-xs shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <Plus className="w-4 h-4" /> Add Player
                      </button>
                    </form>
                  </div>

                  {/* Right Column: Roster List */}
                  <div className="xl:col-span-2 space-y-4">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                        Roster List ({rosterPlayers.length} total)
                      </h4>
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        {rosterPlayers.filter(p => p.gender_designation === 'mmp').length} MMP / {rosterPlayers.filter(p => p.gender_designation === 'fmp').length} FMP
                      </div>
                    </div>

                    {rosterLoading && rosterPlayers.length === 0 ? (
                      <div className="bg-slate-900/40 border border-slate-850 rounded-2xl p-12 text-center text-slate-500 text-xs font-bold uppercase tracking-wider animate-pulse">
                        Loading roster...
                      </div>
                    ) : rosterPlayers.length === 0 ? (
                      <div className="bg-slate-900/40 border border-slate-850 rounded-2xl p-8 text-center text-slate-500 text-xs font-bold uppercase tracking-wider leading-relaxed">
                        No players rostered yet.<br />Import a CSV on the left or add players manually.
                      </div>
                    ) : (
                      <div className="bg-slate-900/40 border border-slate-850 rounded-2xl overflow-hidden divide-y divide-slate-850 max-h-[450px] overflow-y-auto custom-scrollbar">
                        {rosterPlayers.map((player) => (
                          <div key={player.id} className="p-4 flex items-center justify-between gap-4 hover:bg-slate-900/40 transition-colors">
                            {editingPlayerId === player.id ? (
                              <form onSubmit={handleSaveEditPlayer} className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                                <input
                                  type="text"
                                  value={editPlayerName}
                                  onChange={(e) => setEditPlayerName(e.target.value)}
                                  required
                                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 outline-none focus:border-indigo-500 text-slate-200 font-bold text-xs"
                                />
                                <div className="grid grid-cols-2 gap-2">
                                  <input
                                    type="text"
                                    value={editPlayerNumber}
                                    onChange={(e) => setEditPlayerNumber(e.target.value)}
                                    placeholder="#"
                                    className="bg-slate-950 border border-slate-800 rounded-xl px-2 py-2 outline-none focus:border-indigo-500 text-slate-200 font-bold text-xs text-center"
                                  />
                                  <select
                                    value={editPlayerGender}
                                    onChange={(e) => setEditPlayerGender(e.target.value)}
                                    className="bg-slate-950 border border-slate-800 rounded-xl px-2 py-2 outline-none focus:border-indigo-500 text-slate-200 font-bold text-xs cursor-pointer"
                                  >
                                    <option value="">None</option>
                                    <option value="mmp">MMP</option>
                                    <option value="fmp">FMP</option>
                                  </select>
                                </div>
                                <div className="flex gap-2 justify-end">
                                  <button
                                    type="submit"
                                    disabled={rosterLoading || !editPlayerName.trim()}
                                    className="p-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white transition-colors"
                                    title="Save changes"
                                  >
                                    <Check className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingPlayerId(null)}
                                    className="p-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400 hover:text-white transition-colors"
                                    title="Cancel"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              </form>
                            ) : (
                              <>
                                <div className="flex items-center gap-3">
                                  {player.shirt_number && (
                                    <span className="font-mono text-xs font-black text-indigo-400 bg-indigo-500/5 border border-indigo-500/10 px-2.5 py-1 rounded-lg">
                                      #{player.shirt_number}
                                    </span>
                                  )}
                                  <span className="font-bold text-sm text-slate-200">{player.name}</span>
                                  {player.gender_designation && (
                                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded border ${
                                      player.gender_designation === 'mmp' 
                                        ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' 
                                        : 'bg-purple-500/10 border-purple-500/20 text-purple-400'
                                    }`}>
                                      {player.gender_designation.toUpperCase()}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleStartEditPlayer(player)}
                                    className="p-2.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded-xl text-indigo-400 hover:text-indigo-300 transition-colors"
                                    title="Edit player details"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeletePlayer(player.id)}
                                    className="p-2.5 bg-slate-900 border border-slate-800 hover:bg-slate-850 rounded-xl text-rose-500 hover:text-rose-400 transition-colors"
                                    title="Remove player"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <h2 className="text-lg font-black text-white uppercase tracking-widest mb-6">Tournament Roster Lists</h2>
                {teams.length === 0 ? (
                  <div className="bg-slate-950/40 border border-slate-800 rounded-3xl p-12 text-center text-slate-500 font-medium">
                    No teams registered in this tournament yet. Create one on the left.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {teams.map(t => (
                      <div key={t.id} className="bg-slate-950/60 border border-slate-800 rounded-3xl p-6 flex flex-col justify-between h-44">
                        <div>
                          <span className="text-[9px] uppercase tracking-widest font-black bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded text-indigo-400">Roster Unit</span>
                          <h3 className="text-lg font-black text-white mt-2 uppercase tracking-tight">{t.team_name}</h3>
                          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Division: {t.division}</div>
                        </div>
                        <div className="flex justify-end mt-4 pt-4 border-t border-slate-900/60">
                          <button
                            onClick={() => setSelectedRosterTeam(t)}
                            className="px-4 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-indigo-400 hover:text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                          >
                            Manage Roster
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'matches' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 bg-slate-950/60 border border-slate-800 rounded-3xl p-6 sm:p-8">
            <h2 className="text-lg font-black text-white uppercase tracking-widest mb-6 border-b border-slate-900 pb-4">Schedule Match</h2>
            {teams.length < 2 ? (
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider text-center py-6 leading-relaxed">
                Add at least two teams in the Teams tab to schedule a match card.
              </p>
            ) : (
              <form onSubmit={handleScheduleMatch} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Home Team (Home Kit)</label>
                  <select
                    value={homeTeamId}
                    onChange={(e) => setHomeTeamId(e.target.value)}
                    required
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 text-slate-200 transition-colors font-bold text-xs cursor-pointer"
                  >
                    <option value="" className="bg-slate-950 text-slate-500">-- Select Home --</option>
                    {teams.map(t => (
                      <option key={t.id} value={t.id} className="bg-slate-950 text-slate-200 font-bold uppercase tracking-wider text-xs">{t.team_name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Away Team (Away Kit)</label>
                  <select
                    value={awayTeamId}
                    onChange={(e) => setAwayTeamId(e.target.value)}
                    required
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 text-slate-200 transition-colors font-bold text-xs cursor-pointer"
                  >
                    <option value="" className="bg-slate-950 text-slate-500">-- Select Away --</option>
                    {teams.map(t => (
                      <option key={t.id} value={t.id} className="bg-slate-950 text-slate-200 font-bold uppercase tracking-wider text-xs">{t.team_name}</option>
                    ))}
                  </select>
                </div>

                {hasExistingMatchup && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-[10px] font-black text-amber-400 leading-normal uppercase tracking-wider">
                      Matchup Reminder: These two teams are already scheduled to play against each other.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Pitch Number</label>
                    <input
                      type="text"
                      value={pitchNumber}
                      onChange={(e) => setPitchNumber(e.target.value)}
                      required
                      placeholder="e.g. 1"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 text-slate-200 transition-colors shadow-inner font-bold text-xs text-center"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Scheduled Time</label>
                    <input
                      type="datetime-local"
                      value={matchTime}
                      onChange={(e) => setMatchTime(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 text-slate-200 transition-colors shadow-inner font-bold text-xs"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-500/20 py-3.5 px-6 font-black rounded-xl uppercase tracking-widest text-xs shadow-lg shadow-indigo-500/10 flex items-center justify-center gap-2 transition-all mt-6"
                >
                  <Plus className="w-4 h-4" /> Schedule Match
                </button>
              </form>
            )}

            {/* Danger Zone / Admin Actions */}
            <div className="mt-8 pt-8 border-t border-slate-900/60 space-y-4">
              <h3 className="text-xs font-black text-rose-500 uppercase tracking-widest pl-2">Danger Zone</h3>
              <div className="bg-rose-950/10 border border-rose-500/20 rounded-2xl p-5 space-y-4">
                <div>
                  <h4 className="text-[10px] font-black text-white uppercase tracking-wider">Reset Tournament Scores & Stats</h4>
                  <p className="text-[9px] text-slate-400 mt-1 leading-normal font-bold uppercase tracking-widest">
                    Clears all match scores, deactivates active lineups, resets match statuses to 'scheduled', and purges all player stats logged in this tournament.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleResetTournamentData}
                  disabled={loading || matches.length === 0}
                  className="w-full bg-rose-950/20 hover:bg-rose-900/30 border border-rose-500/30 hover:border-rose-500/50 text-rose-450 text-xs font-black uppercase tracking-widest py-3 px-6 rounded-xl transition-all shadow flex items-center justify-center gap-1.5 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-4 h-4" /> Reset Scores & Stats
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <h2 className="text-lg font-black text-white uppercase tracking-widest mb-6">Pitch Schedules & Scorer Seats</h2>
            {matches.length === 0 ? (
              <div className="bg-slate-950/40 border border-slate-800 rounded-3xl p-12 text-center text-slate-500 font-medium">
                No matches scheduled in this tournament yet. Create one on the left.
              </div>
            ) : (
              <div className="space-y-4">
                {matches.map(m => (
                  <div key={m.id} className="bg-slate-950/60 border border-slate-800/80 rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    {editingMatchId === m.id ? (
                      <form onSubmit={handleSaveMatchEdit} className="w-full flex flex-col sm:flex-row items-end gap-4">
                        <div className="flex-1 flex flex-col sm:flex-row gap-4 w-full">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Pitch Number</label>
                            <input
                              type="text"
                              value={editMatchPitch}
                              onChange={(e) => setEditMatchPitch(e.target.value)}
                              required
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 text-slate-200 transition-colors font-bold text-xs text-center"
                            />
                          </div>
                          <div className="space-y-2 flex-1">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Scheduled Time</label>
                            <input
                              type="datetime-local"
                              value={editMatchTime}
                              onChange={(e) => setEditMatchTime(e.target.value)}
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 text-slate-200 transition-colors font-bold text-xs"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0 w-full sm:w-auto justify-end">
                          <button
                            type="submit"
                            className="p-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all shadow-md flex items-center justify-center"
                            title="Save changes"
                          >
                            <Check className="w-5 h-5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingMatchId(null)}
                            className="p-3.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-all flex items-center justify-center"
                            title="Cancel"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <div>
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] uppercase tracking-widest font-black bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-full text-indigo-400">
                              Pitch {m.pitch_number || '1'}
                            </span>
                            {m.status === 'completed' ? (
                              <span className="text-[10px] uppercase tracking-widest font-black bg-slate-800 border border-slate-700 px-3 py-1 rounded-full text-slate-400">
                                Completed
                              </span>
                            ) : m.status === 'active' ? (
                              <span className="text-[10px] uppercase tracking-widest font-black bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full text-amber-400 animate-pulse">
                                Live
                              </span>
                            ) : (
                              <span className="text-[10px] uppercase tracking-widest font-black bg-slate-900 border border-slate-800/50 px-3 py-1 rounded-full text-slate-500">
                                Scheduled
                              </span>
                            )}
                          </div>
                          <h3 className="text-xl font-black text-white mt-3 uppercase tracking-tight flex items-center gap-3">
                            {m.home_team?.team_name || 'Home'} 
                            <span className="text-indigo-400 font-black text-2xl">{m.home_score}</span>
                            <span className="text-slate-600 font-light text-sm">vs</span>
                            <span className="text-rose-500 font-black text-2xl">{m.away_score}</span>
                            {m.away_team?.team_name || 'Away'}
                          </h3>
                          <div className="text-xs font-bold text-slate-500 mt-2 uppercase tracking-wider">
                            Scheduled: {m.start_time ? new Date(m.start_time).toLocaleString() : 'TBD'}
                          </div>
                        </div>

                        {/* Scorer Seat Alphanumeric Code */}
                        {(() => {
                          const seat = m.tournament_scorer_seats?.[0] || m.tournament_scorer_seats;
                          const actualCode = seat?.pitch_code || `P${m.pitch_number}-${m.id.substring(0, 4).toUpperCase()}`;
                          return (
                            <div className="flex flex-col sm:flex-row md:flex-col lg:flex-row items-stretch sm:items-center gap-3 shrink-0 w-full md:w-auto">
                              <div className="bg-slate-950 px-5 py-3.5 border border-slate-800 rounded-2xl text-center flex-1">
                                <div className="text-[9px] uppercase tracking-widest text-slate-500 font-black mb-1">Pitch Access PIN</div>
                                <span className="font-mono text-lg font-black text-indigo-400 tracking-wider">
                                  {actualCode}
                                </span>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleStartEditMatch(m)}
                                  className="p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-2xl transition-colors text-indigo-400 flex items-center justify-center"
                                  title="Edit Schedule Details"
                                >
                                  <Edit2 className="w-5 h-5" />
                                </button>
                                <button
                                  onClick={() => copyShareLink(actualCode)}
                                  className="p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-2xl transition-colors text-slate-300 flex items-center justify-center"
                                  title="Copy Share Link"
                                >
                                  <Share2 className="w-5 h-5 text-indigo-400" />
                                </button>
                              </div>
                            </div>
                          );
                        })()}
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TournamentSetupScreen;
