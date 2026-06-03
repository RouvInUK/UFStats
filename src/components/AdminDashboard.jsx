import React, { useState, useEffect } from 'react';
import { supabase, pruneIncompleteGames, fetchActionsPerDay, fetchPendingDrills, updateDrillStatus } from '../supabaseClient';
import { Shield, ArrowLeft, Users, Activity, Trash2, Crown, LayoutDashboard, Database, RefreshCw, BarChart2, Calendar, ChevronDown, ChevronUp, Search, Download } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const AdminDashboard = ({ onNavigate, onShadowTeam }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [users, setUsers] = useState([]);
  const [expandedUser, setExpandedUser] = useState(null);
  const [actionsData, setActionsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [deletingUser, setDeletingUser] = useState(null);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  
  const [pendingDrills, setPendingDrills] = useState([]);
  const [drillsLoading, setDrillsLoading] = useState(false);

  // Sorting & Filtering States
  const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' });
  const [searchTerm, setSearchTerm] = useState('');
  const [tierFilter, setTierFilter] = useState('ALL');

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

      // 3. Fetch Actions Per Day
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

  const handleUpdateProExpiration = async (userId, expiresAt) => {
    try {
      const { updateUserProExpiration } = await import('../supabaseClient');
      await updateUserProExpiration(userId, expiresAt);
      setUsers(users.map(u => u.id === userId ? { ...u, pro_expires_at: expiresAt } : u));
    } catch (err) {
      console.error(err);
      alert(`Failed to update pro expiration: ${err.message}`);
    }
  };

  const handleUpdateBetaVoicePro = async (userId, beta_voice_pro) => {
    try {
      const { updateUserBetaVoicePro } = await import('../supabaseClient');
      await updateUserBetaVoicePro(userId, beta_voice_pro);
      setUsers(users.map(u => u.id === userId ? { ...u, beta_voice_pro } : u));
    } catch (err) {
      console.error(err);
      alert(`Failed to update voice beta: ${err.message}`);
    }
  };

  const handleUpdateBetaTournamentTier = async (userId, beta_tournament_tier) => {
    try {
      const { updateUserBetaTournamentTier } = await import('../supabaseClient');
      await updateUserBetaTournamentTier(userId, beta_tournament_tier);
      setUsers(users.map(u => u.id === userId ? { ...u, beta_tournament_tier } : u));
    } catch (err) {
      console.error(err);
      alert(`Failed to update tournament beta: ${err.message}`);
    }
  };

  const handleUpdateBetaTrainingsTier = async (userId, beta_trainings_tier) => {
    try {
      const { updateUserBetaTrainingsTier } = await import('../supabaseClient');
      await updateUserBetaTrainingsTier(userId, beta_trainings_tier);
      setUsers(users.map(u => u.id === userId ? { ...u, beta_trainings_tier } : u));
    } catch (err) {
      console.error(err);
      alert(`Failed to update trainings beta: ${err.message}`);
    }
  };

  const handleUpdateDisableClubTrack = async (userId, disable_club_track) => {
    try {
      const { updateUserDisableClubTrack } = await import('../supabaseClient');
      await updateUserDisableClubTrack(userId, disable_club_track);
      setUsers(users.map(u => u.id === userId ? { ...u, disable_club_track } : u));
    } catch (err) {
      console.error(err);
      alert(`Failed to update Club Track status: ${err.message}`);
    }
  };

  const handleUpdateIsTestAccount = async (userId, is_test_account) => {
    try {
      const { updateUserIsTestAccount } = await import('../supabaseClient');
      await updateUserIsTestAccount(userId, is_test_account);
      setUsers(users.map(u => u.id === userId ? { ...u, is_test_account } : u));
    } catch (err) {
      console.error(err);
      alert(`Failed to update test account flag: ${err.message}`);
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

  const handleDeleteUser = async (userId) => {
    setActionLoading(true);
    try {
      const { error } = await supabase.rpc('delete_user_by_admin', { target_user_id: userId });
      if (error) throw error;
      alert("User account and all linked data permanently deleted.");
      setDeletingUser(null);
      setDeleteConfirmationText('');
      await fetchAdminData();
    } catch (err) {
      console.error(err);
      alert(`Failed to delete user: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const loadPendingDrills = async () => {
    setDrillsLoading(true);
    try {
      const data = await fetchPendingDrills();
      setPendingDrills(data);
    } catch (err) {
      console.error("Failed to fetch pending drills:", err);
    } finally {
      setDrillsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'drills') {
      loadPendingDrills();
    }
  }, [activeTab]);

  const handleApproveDrill = async (drillId) => {
    try {
      await updateDrillStatus(drillId, 'approved');
      setPendingDrills(prev => prev.filter(d => d.id !== drillId));
      alert("Drill approved and added to the public library!");
    } catch (err) {
      console.error(err);
      alert(`Failed to approve drill: ${err.message}`);
    }
  };

  const handleRejectDrill = async (drillId) => {
    if (!window.confirm("Are you sure you want to reject this public drill request?")) return;
    try {
      await updateDrillStatus(drillId, 'rejected');
      setPendingDrills(prev => prev.filter(d => d.id !== drillId));
      alert("Drill request rejected.");
    } catch (err) {
      console.error(err);
      alert(`Failed to reject drill: ${err.message}`);
    }
  };

  // Sorting Handler
  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // CSV Export Utility
  const handleExportCSV = () => {
    const headers = ['Email', 'User ID', 'Signed Up', 'Clubs Count', 'Teams Count', 'Games Tracked', 'Tier', 'Promo Expiry', 'Voice Beta Enabled', 'Is Test Account'];
    const rows = filteredUsers.map(u => [
      u.email || '',
      u.id || '',
      u.created_at ? new Date(u.created_at).toISOString() : '',
      u.clubs?.length || 0,
      u.teams?.length || 0,
      u.gamesTracked || 0,
      u.tier || 'FREE',
      u.pro_expires_at || '',
      u.beta_voice_pro ? 'Yes' : 'No',
      u.is_test_account ? 'Yes' : 'No'
    ]);
    
    const csvContent = [headers, ...rows]
      .map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))
      .join("\n");
      
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `ufstats_users_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Sorting Pipeline
  const sortedUsers = React.useMemo(() => {
    let sortableUsers = [...users];
    if (sortConfig !== null) {
      sortableUsers.sort((a, b) => {
        let aVal, bVal;
        
        switch (sortConfig.key) {
          case 'email':
            aVal = (a.email || '').toLowerCase();
            bVal = (b.email || '').toLowerCase();
            break;
          case 'created_at':
            aVal = new Date(a.created_at || 0);
            bVal = new Date(b.created_at || 0);
            break;
          case 'clubs_teams':
            aVal = (a.clubs?.length || 0) + (a.teams?.length || 0);
            bVal = (b.clubs?.length || 0) + (b.teams?.length || 0);
            break;
          case 'games':
            aVal = a.gamesTracked || 0;
            bVal = b.gamesTracked || 0;
            break;
          case 'tier':
            aVal = a.tier || 'FREE';
            bVal = b.tier || 'FREE';
            break;
          case 'pro_expires_at':
            aVal = a.pro_expires_at ? new Date(a.pro_expires_at) : new Date(0);
            bVal = b.pro_expires_at ? new Date(b.pro_expires_at) : new Date(0);
            break;
          default:
            return 0;
        }

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableUsers;
  }, [users, sortConfig]);

  // Filtering Pipeline
  const filteredUsers = React.useMemo(() => {
    return sortedUsers.filter(user => {
      const matchesSearch = 
        (user.email || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
        (user.id || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      let matchesTier = true;
      if (tierFilter === 'FREE') {
        matchesTier = user.tier === 'FREE';
      } else if (tierFilter === 'PRO') {
        matchesTier = user.tier === 'PRO';
      } else if (tierFilter === 'PROMO') {
        matchesTier = !!user.pro_expires_at;
      }
      
      return matchesSearch && matchesTier;
    });
  }, [sortedUsers, searchTerm, tierFilter]);

  // Global Health Calculations (Excluding QA / Test Accounts and Admins)
  const activeRegularUsers = users.filter(u => !u.is_test_account);
  const totalGamesTracked = activeRegularUsers.reduce((acc, u) => acc + u.gamesTracked, 0);
  const paidProCount = activeRegularUsers.filter(u => u.tier === 'PRO' && !u.pro_expires_at).length;
  const activePromoCount = activeRegularUsers.filter(u => u.pro_expires_at && new Date(u.pro_expires_at) > new Date()).length;

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
          <div className="flex items-center gap-3 flex-wrap">
             {activeTab === 'users' && (
               <button 
                 onClick={handleExportCSV}
                 className="flex items-center gap-2 px-4 py-2 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/20 font-bold rounded-xl transition-all"
                 title="Export Filtered Users to CSV"
               >
                 <Download className="w-4 h-4" /> Export CSV
               </button>
             )}
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
            { id: 'drills', icon: Shield, label: 'Drills Review' },
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
                <p className="text-xs text-slate-500 font-medium italic -mb-3">* Test accounts are automatically excluded from global health telemetry.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* Total Users */}
                  <div className="bg-slate-900/50 backdrop-blur-md border border-white/10 p-6 rounded-3xl flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest mb-1 text-slate-400">Total Active Users</p>
                      <h2 className="text-4xl font-black text-white">{activeRegularUsers.length}</h2>
                    </div>
                    <Users className="w-10 h-10 text-indigo-500/20" />
                  </div>
                  
                  {/* Paid Pro Members */}
                  <div className="bg-slate-900/50 backdrop-blur-md border border-white/10 p-6 rounded-3xl flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest mb-1 text-indigo-400">Paid Pro Coaches</p>
                      <h2 className="text-4xl font-black text-indigo-400">{paidProCount}</h2>
                    </div>
                    <Crown className="w-10 h-10 text-indigo-500/20" />
                  </div>
                  
                  {/* Active Trials / Promos */}
                  <div className="bg-slate-900/50 backdrop-blur-md border border-white/10 p-6 rounded-3xl flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest mb-1 text-amber-400">Active Trials/Promos</p>
                      <h2 className="text-4xl font-black text-amber-400">{activePromoCount}</h2>
                    </div>
                    <Calendar className="w-10 h-10 text-amber-500/20" />
                  </div>

                  {/* Lifetime Games */}
                  <div className="bg-slate-900/50 backdrop-blur-md border border-white/10 p-6 rounded-3xl flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest mb-1 text-emerald-400">Lifetime Games</p>
                      <h2 className="text-4xl font-black text-white">{totalGamesTracked}</h2>
                    </div>
                    <Activity className="w-10 h-10 text-emerald-500/20" />
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
              <div className="space-y-6">
                
                {/* Search and Filters Controls */}
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-900/40 border border-white/5 p-4 rounded-2xl">
                  {/* Search Input */}
                  <div className="relative w-full md:w-80">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search email or user ID..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-950/60 border border-white/10 rounded-xl text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all"
                    />
                  </div>
                  
                  {/* Tier Filter Segmented Controller */}
                  <div className="flex gap-1.5 p-1 bg-slate-950/60 border border-white/10 rounded-xl w-full md:w-auto">
                    {[
                      { id: 'ALL', label: 'All Users' },
                      { id: 'FREE', label: 'Free' },
                      { id: 'PRO', label: 'Pro' },
                      { id: 'PROMO', label: 'Promos' }
                    ].map(f => (
                      <button
                        key={f.id}
                        onClick={() => setTierFilter(f.id)}
                        className={`flex-1 md:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${tierFilter === f.id ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-900/50 backdrop-blur-md border border-white/10 rounded-3xl shadow-xl overflow-hidden">
                  <div className="p-6 border-b border-white/10 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Users className="w-5 h-5 text-indigo-400" /> Registered Users ({filteredUsers.length})
                    </h3>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-950/80 text-slate-400 text-xs uppercase tracking-widest selection:bg-transparent">
                          <th className="p-4 font-bold select-none cursor-pointer hover:text-white transition-colors" onClick={() => requestSort('email')}>
                            <div className="flex items-center gap-1.5">
                              User Email
                              {sortConfig.key === 'email' && (
                                sortConfig.direction === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-indigo-400" /> : <ChevronDown className="w-3.5 h-3.5 text-indigo-400" />
                              )}
                            </div>
                          </th>
                          <th className="p-4 font-bold select-none cursor-pointer hover:text-white transition-colors" onClick={() => requestSort('created_at')}>
                            <div className="flex items-center gap-1.5">
                              Signed Up
                              {sortConfig.key === 'created_at' && (
                                sortConfig.direction === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-indigo-400" /> : <ChevronDown className="w-3.5 h-3.5 text-indigo-400" />
                              )}
                            </div>
                          </th>
                          <th className="p-4 font-bold text-center select-none cursor-pointer hover:text-white transition-colors" onClick={() => requestSort('clubs_teams')}>
                            <div className="flex items-center justify-center gap-1.5">
                              Clubs / Teams
                              {sortConfig.key === 'clubs_teams' && (
                                sortConfig.direction === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-indigo-400" /> : <ChevronDown className="w-3.5 h-3.5 text-indigo-400" />
                              )}
                            </div>
                          </th>
                          <th className="p-4 font-bold text-center select-none cursor-pointer hover:text-white transition-colors" onClick={() => requestSort('games')}>
                            <div className="flex items-center justify-center gap-1.5">
                              Games
                              {sortConfig.key === 'games' && (
                                sortConfig.direction === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-indigo-400" /> : <ChevronDown className="w-3.5 h-3.5 text-indigo-400" />
                              )}
                            </div>
                          </th>
                          <th className="p-4 font-bold text-center select-none cursor-pointer hover:text-white transition-colors" onClick={() => requestSort('tier')}>
                            <div className="flex items-center justify-center gap-1.5">
                              Tier
                              {sortConfig.key === 'tier' && (
                                sortConfig.direction === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-indigo-400" /> : <ChevronDown className="w-3.5 h-3.5 text-indigo-400" />
                              )}
                            </div>
                          </th>
                          <th className="p-4 font-bold text-center text-amber-400 select-none cursor-pointer hover:text-amber-300 transition-colors" onClick={() => requestSort('pro_expires_at')}>
                            <div className="flex items-center justify-center gap-1.5">
                              Promo Expiry
                              {sortConfig.key === 'pro_expires_at' && (
                                sortConfig.direction === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-amber-400" /> : <ChevronDown className="w-3.5 h-3.5 text-amber-400" />
                              )}
                            </div>
                          </th>
                          <th className="p-4 font-bold text-center select-none">Test Account</th>
                          <th className="p-4 font-bold text-center select-none">Voice Beta</th>
                          <th className="p-4 font-bold text-center select-none">Tourney Beta</th>
                          <th className="p-4 font-bold text-center select-none">Trainings Beta</th>
                          <th className="p-4 font-bold text-center select-none">Disable Club Mode</th>
                          <th className="p-4 font-bold text-right select-none">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {filteredUsers.length === 0 ? (
                          <tr>
                            <td colSpan={11} className="p-12 text-center text-slate-500 font-medium">
                              No matching registered coaches found.
                            </td>
                          </tr>
                        ) : (
                          filteredUsers.map((user, i) => (
                            <React.Fragment key={user.id}>
                              <tr 
                                className={`border-b border-white/5 ${i % 2 === 0 ? 'bg-slate-900/30' : 'bg-slate-950/30'} hover:bg-slate-800 transition-colors cursor-pointer`} 
                                onClick={() => setExpandedUser(expandedUser === user.id ? null : user.id)}
                              >
                                <td className="p-4">
                                  <span className="font-bold text-white">{user.email}</span>
                                  {user.is_test_account && (
                                    <span className="text-[8px] font-black text-rose-450 bg-rose-500/10 px-1 py-0.5 rounded border border-rose-500/20 uppercase tracking-wider ml-2.5 inline-block">Test Account</span>
                                  )}
                                  <div className="text-[10px] text-slate-500 font-mono mt-1">{user.id}</div>
                                </td>
                                <td className="p-4">
                                  <div className="text-slate-300 font-medium" title={user.created_at ? new Date(user.created_at).toLocaleString() : 'N/A'}>
                                    {user.created_at ? new Date(user.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}
                                  </div>
                                  {user.created_at && (() => {
                                    const signupDate = new Date(user.created_at);
                                    const now = new Date();
                                    const diffTime = Math.abs(now - signupDate);
                                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                    if (diffDays <= 7) {
                                      return <span className="text-[8px] font-black text-teal-400 bg-teal-500/10 px-1.5 py-0.5 rounded border border-teal-500/20 uppercase tracking-wider mt-1.5 inline-block">New</span>;
                                    }
                                  })()}
                                </td>
                                <td className="p-4 text-center text-slate-300 font-bold">
                                  {user.clubs?.length || 0} / {user.teams?.length || 0}
                                </td>
                                <td className="p-4 text-center text-slate-300 font-bold">
                                  {user.gamesTracked}
                                </td>
                                <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                                  <select 
                                    value={user.tier || 'FREE'} 
                                    onChange={(e) => handleUpdateTier(user.id, e.target.value)}
                                    className="bg-slate-900 border border-slate-700 text-xs font-bold rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                                  >
                                    <option value="FREE">FREE</option>
                                    <option value="PRO">PRO</option>
                                  </select>
                                </td>
                                <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                                  <div className="flex flex-col gap-1 items-center">
                                    <select
                                      value={user.pro_expires_at ? 'custom' : 'none'}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        if (val === 'none') {
                                          handleUpdateProExpiration(user.id, null);
                                        } else if (val === '1w') {
                                          const d = new Date();
                                          d.setDate(d.getDate() + 7);
                                          handleUpdateProExpiration(user.id, d.toISOString());
                                        } else if (val === '1m') {
                                          const d = new Date();
                                          d.setMonth(d.getMonth() + 1);
                                          handleUpdateProExpiration(user.id, d.toISOString());
                                        } else if (val === '6m') {
                                          const d = new Date();
                                          d.setMonth(d.getMonth() + 6);
                                          handleUpdateProExpiration(user.id, d.toISOString());
                                        }
                                      }}
                                      className="bg-slate-900 border border-slate-700 text-[10px] font-bold rounded-lg px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                                    >
                                      <option value="none">No Promo</option>
                                      <option value="1w">+1 Week</option>
                                      <option value="1m">+1 Month</option>
                                      <option value="6m">+6 Months</option>
                                      <option value="custom">Custom (Select below)</option>
                                    </select>
                                    <div className="relative flex items-center bg-slate-900 border border-slate-700 hover:border-slate-600 rounded-lg px-2 py-1 w-32 focus-within:ring-1 focus-within:ring-indigo-500 cursor-pointer transition-all shadow-inner">
                                      <Calendar className="w-3.5 h-3.5 text-indigo-400 mr-1.5 flex-shrink-0" />
                                      <input 
                                        type="date"
                                        value={user.pro_expires_at ? new Date(user.pro_expires_at).toISOString().split('T')[0] : ''}
                                        onChange={(e) => {
                                          if (e.target.value) {
                                            const d = new Date(e.target.value);
                                            d.setHours(23, 59, 59, 999);
                                            handleUpdateProExpiration(user.id, d.toISOString());
                                          } else {
                                            handleUpdateProExpiration(user.id, null);
                                          }
                                        }}
                                        onClick={(e) => {
                                          try { e.target.showPicker(); } catch {
                                            // Fallback for browsers that do not support showPicker
                                          }
                                        }}
                                        className="bg-transparent text-xs text-slate-300 font-semibold outline-none w-full cursor-pointer [color-scheme:dark]"
                                      />
                                    </div>
                                    {user.pro_expires_at && (() => {
                                      const daysLeft = Math.ceil((new Date(user.pro_expires_at) - new Date()) / (1000 * 60 * 60 * 24));
                                      if (daysLeft > 0) {
                                        return <span className="text-[8px] font-black text-amber-400 bg-amber-500/10 px-1 py-0.5 rounded border border-amber-500/20">{daysLeft} days left</span>;
                                      } else {
                                        return <span className="text-[8px] font-black text-rose-400 bg-rose-500/10 px-1 py-0.5 rounded border border-rose-500/20">Expired</span>;
                                      }
                                    })()}
                                  </div>
                                </td>
                                <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                                  <input 
                                    type="checkbox"
                                    checked={user.is_test_account || false}
                                    onChange={(e) => handleUpdateIsTestAccount(user.id, e.target.checked)}
                                    className="w-4 h-4 text-indigo-650 rounded bg-slate-900 border-slate-700 focus:ring-indigo-500 cursor-pointer"
                                  />
                                </td>
                                <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                                  <input 
                                    type="checkbox"
                                    checked={user.beta_voice_pro || false}
                                    onChange={(e) => handleUpdateBetaVoicePro(user.id, e.target.checked)}
                                    className="w-4 h-4 text-indigo-600 rounded bg-slate-900 border-slate-700 focus:ring-indigo-500 cursor-pointer animate-none"
                                  />
                                </td>
                                <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                                  <input 
                                    type="checkbox"
                                    checked={user.beta_tournament_tier || false}
                                    onChange={(e) => handleUpdateBetaTournamentTier(user.id, e.target.checked)}
                                    className="w-4 h-4 text-indigo-600 rounded bg-slate-900 border-slate-700 focus:ring-indigo-500 cursor-pointer animate-none"
                                  />
                                </td>
                                <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                                  <input 
                                    type="checkbox"
                                    checked={user.beta_trainings_tier || false}
                                    onChange={(e) => handleUpdateBetaTrainingsTier(user.id, e.target.checked)}
                                    className="w-4 h-4 text-indigo-600 rounded bg-slate-900 border-slate-700 focus:ring-indigo-500 cursor-pointer animate-none"
                                  />
                                </td>
                                <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                                  <input 
                                    type="checkbox"
                                    checked={user.disable_club_track || false}
                                    onChange={(e) => handleUpdateDisableClubTrack(user.id, e.target.checked)}
                                    className="w-4 h-4 text-rose-500 rounded bg-slate-900 border-slate-700 focus:ring-rose-500 cursor-pointer animate-none"
                                  />
                                </td>
                                <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                                  <div className="flex items-center justify-end gap-2.5">
                                    {user.teams?.length === 1 && (
                                      <button
                                        onClick={() => {
                                          const team = user.teams[0];
                                          onShadowTeam({ id: team.id, name: team.name, tier: user.tier, beta_voice_pro: user.beta_voice_pro });
                                          onNavigate('dashboard');
                                        }}
                                        className="px-2.5 py-1 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 hover:text-indigo-300 border border-indigo-500/20 hover:border-indigo-500/40 font-bold rounded-lg transition-all text-[10px] flex items-center justify-center gap-1 uppercase tracking-widest"
                                        title={`Direct Shadow: ${user.teams[0].name}`}
                                      >
                                        <Shield className="w-3 h-3" /> Shadow
                                      </button>
                                    )}
                                    <button
                                      onClick={() => setDeletingUser(user)}
                                      className="p-1.5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-lg transition-all"
                                      title="Permanently Delete User Account"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => setExpandedUser(expandedUser === user.id ? null : user.id)}
                                      className="text-xs text-indigo-400 hover:text-indigo-300 font-bold transition-colors"
                                    >
                                      {expandedUser === user.id ? 'Hide Details' : 'Show Details'}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                              {expandedUser === user.id && (
                                <tr className="bg-slate-950/50">
                                  <td colSpan={10} className="p-6 border-b border-white/5">
                                    <h4 className="text-slate-300 font-bold mb-4 uppercase tracking-widest text-xs">Clubs & Teams Hierarchy</h4>
                                    {(!user.clubs || user.clubs.length === 0) && <p className="text-slate-500 text-sm">No clubs created.</p>}
                                    <div className="space-y-4">
                                      {user.clubs?.map(club => (
                                        <div key={club.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                                          <h5 className="font-black text-white text-lg mb-3">{club.name}</h5>
                                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {user.teams?.filter(t => t.club_id === club.id).map(team => (
                                              <div key={team.id} className="flex items-center justify-between bg-slate-950 p-3 rounded-lg border border-slate-800">
                                                <span className="font-bold text-slate-300">{team.name}</span>
                                                <button 
                                                  onClick={() => {
                                                    onShadowTeam({ id: team.id, name: team.name, tier: user.tier, beta_voice_pro: user.beta_voice_pro });
                                                    onNavigate('dashboard');
                                                  }}
                                                  className="px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 font-bold rounded-lg border border-indigo-500/20 transition-all text-[10px] flex items-center justify-center gap-1 uppercase tracking-widest"
                                                >
                                                  <Shield className="w-3 h-3" /> Shadow Team
                                                </button>
                                              </div>
                                            ))}
                                            {(!user.teams || user.teams.filter(t => t.club_id === club.id).length === 0) && (
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
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
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
                      This utility scans the entire database for "Ghost Games". A ghost game is any Match Name that contains <strong>only Lineup or Setup metadata</strong>, but zero actual point actions (Passes, Goals, Turnovers), and is older than 48 hours.
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

            {/* DRILLS REVIEW TAB */}
            {activeTab === 'drills' && (
              <div className="bg-slate-900/50 backdrop-blur-md border border-white/10 rounded-3xl shadow-xl overflow-hidden">
                <div className="p-6 border-b border-white/10 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Shield className="w-5 h-5 text-indigo-400" /> Pending Public Drills Review ({pendingDrills.length})
                  </h3>
                  <button 
                    onClick={loadPendingDrills}
                    className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-xl border border-white/5 text-slate-300"
                  >
                    Refresh List
                  </button>
                </div>
                
                <div className="p-6">
                  {drillsLoading ? (
                    <div className="text-center p-12 text-indigo-400 font-bold tracking-widest animate-pulse">
                      FETCHING PENDING DRILLS...
                    </div>
                  ) : pendingDrills.length === 0 ? (
                    <div className="text-center p-12 text-slate-500 font-medium">
                      No pending public drills submitted for admin review.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {pendingDrills.map(drill => (
                        <div key={drill.id} className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-6 flex flex-col justify-between shadow-lg relative overflow-hidden">
                          <div className="absolute top-0 left-0 right-0 h-1 bg-indigo-500/50"></div>
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-[10px] font-black uppercase tracking-widest bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2.5 py-1 rounded">
                                {drill.category}
                              </span>
                              <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                                Flow: {drill.flow_type === 'rep_based' ? 'Rep-by-Rep' : 'Continuous'}
                              </span>
                            </div>
                            <h4 className="text-lg font-extrabold text-white mb-2">{drill.name}</h4>
                            <p className="text-xs text-slate-400 mb-4 font-semibold uppercase tracking-wider">
                              Submitted by: <span className="text-indigo-400 font-extrabold">{drill.teams?.name || 'Unknown Team'}</span>
                            </p>
                            
                            <div className="mb-6 bg-slate-900/60 border border-slate-800 rounded-xl p-4">
                              <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-2.5">Pre-configured Metrics Grid</div>
                              <div className="grid grid-cols-2 gap-2">
                                {drill.metrics?.map((m, idx) => (
                                  <div key={idx} className="bg-slate-950 px-3 py-1.5 rounded border border-white/5 text-xs text-slate-300 font-bold text-center truncate">
                                    {m}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => handleApproveDrill(drill.id)}
                              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-md shadow-emerald-500/10"
                            >
                              Approve Public
                            </button>
                            <button
                              onClick={() => handleRejectDrill(drill.id)}
                              className="flex-1 py-2.5 bg-rose-900/20 hover:bg-rose-900/40 text-rose-400 border border-rose-500/20 font-black text-xs uppercase tracking-widest rounded-xl transition-all"
                            >
                              Reject Request
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        )}

        {/* Secure Deletion Modal */}
        {deletingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="bg-slate-900 border border-rose-500/30 p-8 rounded-3xl max-w-md w-full shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-rose-600 to-rose-400"></div>
              
              <div className="flex justify-center mb-6">
                <div className="p-4 bg-rose-500/10 rounded-full border border-rose-500/20">
                  <Trash2 className="w-10 h-10 text-rose-500" />
                </div>
              </div>
              
              <h2 className="text-xl font-black text-center text-white mb-3 uppercase tracking-wider">🚨 Delete User Account?</h2>
              
              <div className="p-4 bg-rose-950/20 border border-rose-500/20 rounded-2xl text-xs text-rose-300 leading-relaxed space-y-2 mb-6">
                <p className="font-extrabold uppercase tracking-widest text-[10px] text-rose-400">Warning — Critical Action</p>
                <p>You are about to permanently delete the user account <strong className="text-white">{deletingUser.email}</strong>.</p>
                <p>This will **immediately and permanently wipe** all of their Clubs, Teams, Rostered Players, Game Events, and Synced Stats from the database. This action is completely irreversible.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
                    Type user email to confirm:
                  </label>
                  <input
                    type="text"
                    value={deleteConfirmationText}
                    onChange={(e) => setDeleteConfirmationText(e.target.value)}
                    placeholder={deletingUser.email}
                    className="w-full bg-slate-950 border border-slate-800 text-sm font-semibold rounded-xl px-4 py-3 text-slate-300 placeholder-slate-700 outline-none focus:border-rose-500/50 transition-all text-center"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={() => {
                      setDeletingUser(null);
                      setDeleteConfirmationText('');
                    }}
                    className="py-3 px-4 bg-slate-850 hover:bg-slate-800 text-slate-300 font-bold rounded-xl transition-all uppercase tracking-wider text-xs border border-white/5"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDeleteUser(deletingUser.id)}
                    disabled={deleteConfirmationText !== deletingUser.email || actionLoading}
                    className="py-3 px-4 bg-rose-600 hover:bg-rose-500 disabled:bg-rose-950/20 text-white disabled:text-rose-900/50 font-black rounded-xl transition-all shadow-lg shadow-rose-900/10 disabled:shadow-none uppercase tracking-wider text-xs disabled:border disabled:border-rose-950/40"
                  >
                    {actionLoading ? 'Deleting...' : 'Delete User'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default AdminDashboard;
