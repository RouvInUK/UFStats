import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Shield, ArrowLeft, Users, Activity } from 'lucide-react';

const AdminDashboard = ({ onNavigate }) => {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAdminData = async () => {
      try {
        // Fetch all teams
        const { data: teamsData, error: teamsError } = await supabase
          .from('teams')
          .select('*')
          .order('created_at', { ascending: false });

        if (teamsError) throw teamsError;

        // Fetch all unique games mapped to team_id
        // Since we have 'stats' table, we can group by game_name and team_id
        const { data: statsData, error: statsError } = await supabase
          .from('stats')
          .select('game_name, team_id');

        if (statsError) throw statsError;

        // Calculate total games per team
        const gamesPerTeam = {};
        statsData.forEach(stat => {
          if (stat.team_id && stat.game_name) {
            if (!gamesPerTeam[stat.team_id]) {
              gamesPerTeam[stat.team_id] = new Set();
            }
            gamesPerTeam[stat.team_id].add(stat.game_name);
          }
        });

        const mergedTeams = teamsData.map(team => ({
          ...team,
          gamesTracked: gamesPerTeam[team.id] ? gamesPerTeam[team.id].size : 0
        }));

        setTeams(mergedTeams);
      } catch (err) {
        console.error("Admin data fetch failed", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAdminData();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 p-6 sm:p-8 pb-32">
      <div className="max-w-5xl mx-auto space-y-8">
        
        <div className="flex items-center justify-between bg-slate-900/50 border border-white/10 p-6 rounded-3xl shadow-xl">
          <div className="flex items-center gap-4">
            <Shield className="w-10 h-10 text-indigo-500" />
            <div>
              <h1 className="text-2xl font-black text-white uppercase tracking-widest">System Admin</h1>
              <p className="text-slate-400 text-sm font-medium">Cross-Tenant Global Overview</p>
            </div>
          </div>
          <button 
            onClick={() => onNavigate('dashboard')}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all"
          >
            <ArrowLeft className="w-4 h-4" /> Return
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12 text-indigo-400 font-bold tracking-widest animate-pulse">
            LOADING ADMIN DATA...
          </div>
        ) : (
          <div className="bg-slate-900/50 backdrop-blur-md border border-white/10 rounded-3xl shadow-xl overflow-hidden">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-400" /> Registered Teams
              </h3>
              <span className="bg-indigo-500/20 text-indigo-400 px-3 py-1 rounded-lg text-sm font-bold">
                {teams.length} Total Teams
              </span>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950/80 text-slate-400 text-xs uppercase tracking-widest">
                    <th className="p-4 font-bold">Team Name</th>
                    <th className="p-4 font-bold">Tenant ID (UUID)</th>
                    <th className="p-4 font-bold text-center">Games Tracked</th>
                    <th className="p-4 font-bold text-right">Registered</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {teams.map((team, i) => (
                    <tr key={team.id} className={`border-b border-white/5 ${i % 2 === 0 ? 'bg-slate-900/30' : 'bg-slate-950/30'} hover:bg-slate-800 transition-colors`}>
                      <td className="p-4 font-bold text-slate-200">
                        {team.name}
                      </td>
                      <td className="p-4 font-mono text-xs text-slate-500">
                        {team.id}
                      </td>
                      <td className="p-4 text-center">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-400 font-bold rounded-lg border border-emerald-500/20">
                          <Activity className="w-3 h-3" />
                          {team.gamesTracked}
                        </span>
                      </td>
                      <td className="p-4 text-right font-mono text-slate-400">
                        {new Date(team.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                  {teams.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-500 font-medium">
                        No teams found in database.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default AdminDashboard;
