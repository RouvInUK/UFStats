import React, { useState, useEffect } from 'react';
import { fetchUserHierarchy, createClub, createTeam, checkTierLimits } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { Shield, Plus, LogOut, ChevronRight, AlertTriangle, Crown } from 'lucide-react';

const TeamSelectionScreen = ({ onSelectTeam, onNavigateToAdmin, allowAutoSelect = true }) => {
  const { user, profile, signOut } = useAuth();
  const [hierarchy, setHierarchy] = useState({ clubs: [], teams: [] });
  const [loading, setLoading] = useState(true);
  
  const [showAddClub, setShowAddClub] = useState(false);
  const [newClubName, setNewClubName] = useState('');
  
  const [showAddTeamForClub, setShowAddTeamForClub] = useState(null);
  const [newTeamName, setNewTeamName] = useState('');
  
  const [limits, setLimits] = useState(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const loadHierarchy = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await fetchUserHierarchy(user.id);
      setHierarchy(data);
      const userLimits = await checkTierLimits(user.id);
      setLimits(userLimits);
      
      // Auto-select if exactly 1 club and 1 team
      if (allowAutoSelect && data.teams.length === 1 && data.clubs.length === 1 && onSelectTeam) {
        onSelectTeam(data.teams[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHierarchy();
  }, [user]);

  const handleAddClub = async (e) => {
    e.preventDefault();
    if (!newClubName.trim()) return;
    if (!limits.canAddClub) {
      setShowUpgradeModal(true);
      return;
    }
    
    try {
      await createClub(newClubName, user.id);
      setNewClubName('');
      setShowAddClub(false);
      loadHierarchy();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleAddTeam = async (e, clubId) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    if (!limits.canAddTeam) {
      setShowUpgradeModal(true);
      return;
    }
    
    try {
      await createTeam(newTeamName, clubId, user.id);
      setNewTeamName('');
      setShowAddTeamForClub(null);
      loadHierarchy();
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-indigo-400 font-bold tracking-widest text-lg">
        LOADING YOUR TEAMS...
      </div>
    );
  }

  const noClubs = hierarchy.clubs.length === 0;

  return (
    <div className="min-h-screen bg-slate-900 selection:bg-indigo-500 selection:text-white pb-24 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-8 mt-12">
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-black text-white uppercase tracking-widest mb-2">Select Your Team</h1>
            <p className="text-slate-400 text-sm font-medium">
              Logged in as {profile?.email} 
              {limits?.isPro ? (
                <span className="ml-3 inline-flex items-center gap-1 text-amber-400 bg-amber-500/10 px-2 py-1 rounded-md text-xs font-bold border border-amber-500/20">
                  <Crown className="w-3 h-3" /> PRO TIER
                </span>
              ) : (
                <span className="ml-3 inline-flex items-center gap-1 text-slate-400 bg-slate-800 px-2 py-1 rounded-md text-xs font-bold border border-slate-700">
                  FREE TIER
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-3">
             {profile?.is_system_admin && (
               <button 
                  onClick={onNavigateToAdmin}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-300 hover:text-white font-bold rounded-xl transition-all border border-slate-700"
               >
                  <Shield className="w-4 h-4" /> Admin Panel
               </button>
             )}
             <button 
               onClick={() => {
                  if (window.confirm("Are you sure you want to sign out?")) signOut();
               }}
               className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all border border-slate-700"
             >
               <LogOut className="w-4 h-4" /> Sign Out
             </button>
          </div>
        </div>

        {noClubs ? (
          <div className="bg-slate-800/80 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden border border-slate-700 p-8 sm:p-12 text-center">
            <h2 className="text-2xl font-bold text-white mb-4">Welcome to ustats.pro!</h2>
            <p className="text-slate-400 mb-8 max-w-lg mx-auto">
              To get started, create your first Club. You can then add multiple teams (e.g. Open, Women's, Mixed) under this club.
            </p>
            <form onSubmit={handleAddClub} className="max-w-md mx-auto flex flex-col gap-4">
              <input 
                type="text" 
                value={newClubName}
                onChange={e => setNewClubName(e.target.value)}
                placeholder="Enter Club Name (e.g. Deep Space)"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-4 text-slate-200 outline-none focus:border-indigo-500 transition-colors shadow-inner text-center text-lg font-bold"
                required
                autoComplete="off"
              />
              <button 
                type="submit"
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(79,70,229,0.5)] uppercase tracking-widest text-lg"
              >
                Create My Club
              </button>
            </form>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {hierarchy.clubs.map(club => {
              const clubTeams = hierarchy.teams.filter(t => t.club_id === club.id);
              
              return (
                <div key={club.id} className="bg-slate-800/80 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden border border-slate-700 flex flex-col">
                  <div className="p-6 bg-slate-800 border-b border-slate-700/50">
                    <h2 className="text-xl font-extrabold text-white">{club.name}</h2>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Club</p>
                  </div>
                  
                  <div className="p-4 flex-1 space-y-2">
                    {clubTeams.length === 0 ? (
                      <p className="text-slate-500 text-sm font-medium text-center py-4">No teams added yet.</p>
                    ) : (
                      clubTeams.map(team => (
                        <button
                          key={team.id}
                          onClick={() => onSelectTeam(team)}
                          className="w-full flex items-center justify-between p-4 bg-slate-900/50 hover:bg-slate-700/50 border border-slate-700/50 rounded-xl transition-all text-left group"
                        >
                          <span className="font-bold text-slate-200 group-hover:text-white">{team.name}</span>
                          <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-indigo-400 transition-colors" />
                        </button>
                      ))
                    )}
                  </div>
                  
                  <div className="p-4 border-t border-slate-700/50 bg-slate-900/30">
                    {showAddTeamForClub === club.id ? (
                      <form onSubmit={(e) => handleAddTeam(e, club.id)} className="flex gap-2">
                        <input 
                          type="text" 
                          value={newTeamName}
                          onChange={e => setNewTeamName(e.target.value)}
                          placeholder="Team Name"
                          className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 outline-none focus:border-indigo-500 text-sm"
                          autoFocus
                          autoComplete="off"
                        />
                        <button type="submit" className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-sm transition-all">
                          Add
                        </button>
                        <button type="button" onClick={() => setShowAddTeamForClub(null)} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg text-sm transition-all">
                          Cancel
                        </button>
                      </form>
                    ) : (
                      <button 
                        onClick={() => {
                          if (!limits.canAddTeam) {
                            setShowUpgradeModal(true);
                          } else {
                            setShowAddTeamForClub(club.id);
                          }
                        }}
                        className="w-full py-3 flex items-center justify-center gap-2 text-indigo-400 font-bold hover:bg-indigo-500/10 rounded-xl transition-all"
                      >
                        <Plus className="w-4 h-4" /> Add Team
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            
            {/* Add Club Card */}
            {showAddClub ? (
              <div className="bg-slate-800/80 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden border border-slate-700 flex flex-col justify-center p-6 border-dashed">
                <form onSubmit={handleAddClub} className="space-y-4">
                  <h3 className="font-bold text-white text-center">Create New Club</h3>
                  <input 
                    type="text" 
                    value={newClubName}
                    onChange={e => setNewClubName(e.target.value)}
                    placeholder="Club Name"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 outline-none focus:border-indigo-500 text-sm text-center"
                    autoFocus
                    autoComplete="off"
                  />
                  <div className="flex gap-2">
                    <button type="submit" className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm transition-all">
                      Save
                    </button>
                    <button type="button" onClick={() => setShowAddClub(false)} className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl text-sm transition-all">
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <button 
                onClick={() => {
                  if (!limits.canAddClub) {
                    setShowUpgradeModal(true);
                  } else {
                    setShowAddClub(true);
                  }
                }}
                className="bg-slate-900/50 hover:bg-slate-800/80 backdrop-blur-xl rounded-3xl shadow-inner border-2 border-dashed border-slate-700 hover:border-indigo-500/50 flex flex-col items-center justify-center p-8 transition-all min-h-[300px] text-slate-500 hover:text-indigo-400 group"
              >
                <div className="w-16 h-16 rounded-full bg-slate-800 group-hover:bg-indigo-500/20 flex items-center justify-center mb-4 transition-all">
                  <Plus className="w-8 h-8" />
                </div>
                <span className="font-bold tracking-widest uppercase">Create Club</span>
              </button>
            )}
          </div>
        )}

      </div>

      {showUpgradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-amber-500/30 rounded-3xl p-8 max-w-md w-full shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-orange-600"></div>
            <div className="flex justify-center mb-6">
              <div className="p-4 bg-amber-500/10 rounded-full">
                <Crown className="w-12 h-12 text-amber-500" />
              </div>
            </div>
            <h2 className="text-2xl font-black text-white text-center mb-2 uppercase tracking-widest">Upgrade to Pro</h2>
            <p className="text-slate-300 text-center mb-6 leading-relaxed">
              You've reached the limit of the Free tier (1 Club, 3 Teams). Upgrade to Coach Pro to create unlimited clubs and teams.
            </p>
            <div className="space-y-3 mb-8">
              <div className="flex items-center gap-3 text-sm text-slate-400 font-medium bg-slate-950 p-3 rounded-lg border border-slate-800">
                <Shield className="w-4 h-4 text-emerald-500" /> Unlimited Clubs
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-400 font-medium bg-slate-950 p-3 rounded-lg border border-slate-800">
                <Shield className="w-4 h-4 text-emerald-500" /> Unlimited Teams
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-400 font-medium bg-slate-950 p-3 rounded-lg border border-slate-800">
                <Shield className="w-4 h-4 text-amber-500" /> Advanced Analytics
              </div>
            </div>
            <button 
              onClick={() => setShowUpgradeModal(false)}
              className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-black rounded-xl transition-all shadow-[0_0_20px_rgba(245,158,11,0.3)] uppercase tracking-widest mb-3"
            >
              Get Pro Now
            </button>
            <button 
              onClick={() => setShowUpgradeModal(false)}
              className="w-full py-3 bg-transparent hover:bg-slate-800 text-slate-500 hover:text-white font-bold rounded-xl transition-all"
            >
              Maybe Later
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default TeamSelectionScreen;
