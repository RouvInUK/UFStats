import React, { useState, useEffect } from 'react';
import { supabase, fetchBetaKeys, generateBetaKey, pruneIncompleteGames, fetchActionsPerDay } from '../supabaseClient';
import { Shield, ArrowLeft, Users, Activity, Key, Trash2, Crown, LayoutDashboard, Database, RefreshCw, BarChart2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const AdminDashboard = ({ onNavigate, onShadowTeam }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [users, setUsers] = useState([]);
  const [expandedUser, setExpandedUser] = useState(null);
  const [betaKeys, setBetaKeys] = useState([]);
  const [actionsData, setActionsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Users (Profiles)
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (profilesError) throw profilesError;

      // 2. Fetch Clubs
      const { data: clubsData, error: clubsError } = await supabase
        .from('clubs')
        .select('*');
      if (clubsError) throw clubsError;

      // 3. Fetch Teams
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('*');
      if (teamsError) throw teamsError;

      // 4. Fetch unique games per team
      const { data: statsData, error: statsError } = await supabase
        .from('stats')
        .select('game_name, team_id');
      if (statsError) throw statsError;

      const gamesPerTeam = {};
      statsData.forEach(stat => {
        if (stat.team_id && stat.game_name) {
          if (!gamesPerTeam[stat.team_id]) {
            gamesPerTeam[stat.team_id] = new Set();
          }
          gamesPerTeam[stat.team_id].add(stat.game_name);
        }
      });

      // Filter out system admins
      const regularUsers = profilesData.filter(p => !p.is_system_admin);

      const enrichedUsers = regularUsers.map(user => {
        const userClubs = clubsData.filter(c => c.owner_id === user.id);
        const userTeams = teamsData.filter(t => t.owner_id === user.id);
        
        let gamesTracked = 0;
        userTeams.forEach(team => {
          if (gamesPerTeam[team.id]) {
            gamesTracked += gamesPerTeam[team.id].size;
          }
        });

        return {
          ...user,
          clubs: userClubs,
          teams: userTeams,
          gamesTracked
        };
      });

      setUsers(enrichedUsers);

      // 3. Fetch Beta Keys
      const keys = await fetchBetaKeys();
      setBetaKeys(keys);

      // 4. Fetch Actions Per Day
      const actions = await fetchActionsPerDay();
      setActionsData(actions);

    } catch (err) {
      console.error("Admin data fetch failed", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleGenerateKey = async () => {
    setActionLoading(true);
    try {
      await generateBetaKey();
      const keys = await fetchBetaKeys();
      setBetaKeys(keys);
    } catch (err) {
      alert("Failed to generate beta key.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateTier = async (userId, tier) => {
    try {
      const { updateUserTier } = await import('../supabaseClient');
      await updateUserTier(userId, tier);
      setUsers(users.map(u => u.id === userId ? { ...u, tier } : u));
    } catch (err) {
      console.error(err);
      alert(`Failed to update tier: ${err.message}`);
    }
  };

  const handlePruneGames = async () => {
    if (!window.confirm("Are you sure you want to PRUNE all incomplete games older than 48 hours? This deletes dead data directly from the database.")) return;
    setActionLoading(true);
    try {
      const deletedCount = await pruneIncompleteGames();
      alert(`Successfully pruned ${deletedCount} dead events/stats.`);
      await fetchAdminData();
    } catch (err) {
      console.error(err);
      alert("Failed to prune games.");
    } finally {
      setActionLoading(false);
    }
  };

  const totalGamesTracked = users.reduce((acc, u) => acc + u.gamesTracked, 0);

  return (
    <div className="min-h-screen bg-slate-950 p-4 sm:p-8 pb-32">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-slate-900/50 border border-white/10 p-6 rounded-3xl shadow-xl gap-6">
          <div className="flex items-center gap-4">
            <Shield className="w-10 h-10 text-indigo-500" />
            <div>
              <h1 className="text-2xl font-black text-white uppercase tracking-widest">System Admin</h1>
              <p className="text-slate-400 text-sm font-medium">Cross-Tenant Global Overview</p>
            </div>
          </div>
          <div className="flex gap-3">
             <button 
               onClick={fetchAdminData}
               className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all border border-white/5"
             >
               <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Sync
             </button>
             <button 
               onClick={() => onNavigate('dashboard')}
               className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all"
             >
               <ArrowLeft className="w-4 h-4" /> Exit
             </button>
          </div>
        </div>

        {/* Tab Nav */}
        <div className="flex overflow-x-auto gap-2 p-2 bg-slate-900/50 border border-white/5 rounded-2xl">
          {[
            { id: 'overview', icon: LayoutDashboard, label: 'Global Health' },
            { id: 'users', icon: Users, label: 'Users & Tiers' },
            { id: 'beta', icon: Key, label: 'Beta Keys' },
            { id: 'data', icon: Database, label: 'Data Hygiene' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
            >
              <tab.icon className="w-4 h-4" /> {tab.label}
            </button>
          ))}
        </div>

        {loading && activeTab !== 'overview' ? (
          <div className="flex items-center justify-center p-12 text-indigo-400 font-bold tracking-widest animate-pulse">
            LOADING ADMIN DATA...
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="bg-slate-900/50 backdrop-blur-md border border-white/10 p-6 rounded-3xl flex items-center justify-between">
                    <div>
                      <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mb-1">Total Active Users</p>
                      <h2 className="text-4xl font-black text-white">{users.length}</h2>
                    </div>
                    <Users className="w-12 h-12 text-indigo-500/20" />
                  </div>
                  <div className="bg-slate-900/50 backdrop-blur-md border border-white/10 p-6 rounded-3xl flex items-center justify-between">
                    <div>
                      <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mb-1">Lifetime Games</p>
                      <h2 className="text-4xl font-black text-white">{totalGamesTracked}</h2>
                    </div>
                    <Activity className="w-12 h-12 text-emerald-500/20" />
                  </div>
                </div>

                <div className="bg-slate-900/50 backdrop-blur-md border border-white/10 p-6 rounded-3xl shadow-xl">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-6">
                    <BarChart2 className="w-5 h-5 text-indigo-400" /> Actions Logged (Last 30 Days)
                  </h3>
                  <div className="h-64 w-full">
                    {actionsData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={actionsData}>
                          <XAxis dataKey="day" stroke="#64748b" tick={{fill: '#64748b', fontSize: 12}} />
                          <YAxis stroke="#64748b" tick={{fill: '#64748b', fontSize: 12}} />
                          <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }} />
                          <Line type="monotone" dataKey="action_count" stroke="#6366f1" strokeWidth={3} dot={{r: 4, fill: '#6366f1'}} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-slate-500 font-medium">No actions logged in the last 30 days.</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* USERS & TIERS TAB */}
            {activeTab === 'users' && (
              <div className="bg-slate-900/50 backdrop-blur-md border border-white/10 rounded-3xl shadow-xl overflow-hidden">
                <div className="p-6 border-b border-white/10 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-indigo-400" /> Registered Users
                  </h3>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-950/80 text-slate-400 text-xs uppercase tracking-widest">
                        <th className="p-4 font-bold">User Email</th>
                        <th className="p-4 font-bold text-center">Clubs / Teams</th>
                        <th className="p-4 font-bold text-center">Games</th>
                        <th className="p-4 font-bold text-center">Tier</th>
                        <th className="p-4 font-bold text-right">View Data</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {users.map((user, i) => (
                        <React.Fragment key={user.id}>
                          <tr className={`border-b border-white/5 ${i % 2 === 0 ? 'bg-slate-900/30' : 'bg-slate-950/30'} hover:bg-slate-800 transition-colors cursor-pointer`} onClick={() => setExpandedUser(expandedUser === user.id ? null : user.id)}>
                            <td className="p-4">
                              <span className="font-bold text-white">{user.email}</span>
                              <div className="text-[10px] text-slate-500 font-mono mt-1">{user.id}</div>
                            </td>
                            <td className="p-4 text-center text-slate-300 font-bold">
                              {user.clubs.length} / {user.teams.length}
                            </td>
                            <td className="p-4 text-center text-slate-300 font-bold">
                              {user.gamesTracked}
                            </td>
                            <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                              <select 
                                value={user.tier || 'FREE'} 
                                onChange={(e) => handleUpdateTier(user.id, e.target.value)}
                                className="bg-slate-900 border border-slate-700 text-xs font-bold rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-500"
                              >
                                <option value="FREE">FREE</option>
                                <option value="PRO">PRO</option>
                              </select>
                            </td>
                            <td className="p-4 text-right">
                              <span className="text-xs text-indigo-400 font-bold">
                                {expandedUser === user.id ? 'Hide Details' : 'Show Details'}
                              </span>
                            </td>
                          </tr>
                          {expandedUser === user.id && (
                            <tr className="bg-slate-950/50">
                              <td colSpan={5} className="p-6 border-b border-white/5">
                                <h4 className="text-slate-300 font-bold mb-4 uppercase tracking-widest text-xs">Clubs & Teams Hierarchy</h4>
                                {user.clubs.length === 0 && <p className="text-slate-500 text-sm">No clubs created.</p>}
                                <div className="space-y-4">
                                  {user.clubs.map(club => (
                                    <div key={club.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                                      <h5 className="font-black text-white text-lg mb-3">{club.name}</h5>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {user.teams.filter(t => t.club_id === club.id).map(team => (
                                          <div key={team.id} className="flex items-center justify-between bg-slate-950 p-3 rounded-lg border border-slate-800">
                                            <span className="font-bold text-slate-300">{team.name}</span>
                                            <button 
                                              onClick={() => {
                                                onShadowTeam({ id: team.id, name: team.name });
                                                onNavigate('dashboard');
                                              }}
                                              className="px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 font-bold rounded-lg border border-indigo-500/20 transition-all text-[10px] flex items-center justify-center gap-1 uppercase tracking-widest"
                                            >
                                              <Shield className="w-3 h-3" /> Shadow Team
                                            </button>
                                          </div>
                                        ))}
                                        {user.teams.filter(t => t.club_id === club.id).length === 0 && (
                                          <div className="text-slate-500 text-sm font-medium">No teams in this club.</div>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* BETA KEYS TAB */}
            {activeTab === 'beta' && (
              <div className="bg-slate-900/50 backdrop-blur-md border border-white/10 rounded-3xl shadow-xl overflow-hidden">
                <div className="p-6 border-b border-white/10 flex items-center justify-between flex-wrap gap-4">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Key className="w-5 h-5 text-amber-400" /> Beta Access Keys
                  </h3>
                  <button 
                    onClick={handleGenerateKey}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-amber-950 font-black rounded-xl transition-all shadow-[0_0_15px_rgba(245,158,11,0.2)] disabled:opacity-50"
                  >
                    + Generate New Key
                  </button>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-950/80 text-slate-400 text-xs uppercase tracking-widest">
                        <th className="p-4 font-bold">Key Code</th>
                        <th className="p-4 font-bold text-center">Status</th>
                        <th className="p-4 font-bold text-right">Generated At</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {betaKeys.map((k, i) => (
                        <tr key={k.id} className={`border-b border-white/5 ${i % 2 === 0 ? 'bg-slate-900/30' : 'bg-slate-950/30'} hover:bg-slate-800 transition-colors`}>
                          <td className="p-4 font-mono font-bold text-lg tracking-widest text-white">
                            {k.key}
                          </td>
                          <td className="p-4 text-center">
                            {k.is_used ? (
                              <span className="px-2 py-1 bg-rose-500/10 text-rose-400 text-xs font-bold rounded border border-rose-500/20">CLAIMED</span>
                            ) : (
                              <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-bold rounded border border-emerald-500/20">AVAILABLE</span>
                            )}
                          </td>
                          <td className="p-4 text-right font-mono text-slate-500 text-xs">
                            {new Date(k.created_at).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                      {betaKeys.length === 0 && (
                        <tr>
                          <td colSpan={3} className="p-8 text-center text-slate-500 font-medium">No beta keys generated yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* DATA HYGIENE TAB */}
            {activeTab === 'data' && (
              <div className="bg-slate-900/50 backdrop-blur-md border border-white/10 rounded-3xl shadow-xl p-8 max-w-2xl mx-auto">
                <div className="flex items-start gap-4 mb-8">
                  <div className="p-3 bg-rose-500/20 rounded-2xl">
                    <Trash2 className="w-8 h-8 text-rose-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">Prune Incomplete Games</h3>
                    <p className="text-slate-400 text-sm leading-relaxed">
                      This utility scans the entire database for "Ghost Games". A ghost game is any Match Name that contains <strong className="text-slate-300">only Lineup or Setup metadata</strong>, but zero actual point actions (Passes, Goals, Turnovers), and is older than 48 hours.
                    </p>
                  </div>
                </div>
                
                <button 
                  onClick={handlePruneGames}
                  disabled={actionLoading}
                  className="w-full py-4 bg-rose-600/20 hover:bg-rose-600/40 border border-rose-500/30 text-rose-300 font-black tracking-widest uppercase rounded-xl transition-all shadow-[0_0_20px_rgba(225,29,72,0.1)] hover:shadow-[0_0_30px_rgba(225,29,72,0.3)] disabled:opacity-50"
                >
                  {actionLoading ? 'SCANNING & PRUNING...' : 'RUN PRUNE OPERATION'}
                </button>
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
};

export default AdminDashboard;
