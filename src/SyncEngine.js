import { get, set, keys, del } from 'idb-keyval';
import { supabase } from './supabaseClient';

// Helper to generate a client-side UUID
export const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export const getPointKey = (gameName, pointNumber) => `point_${gameName}_${pointNumber}`;

// Simple JS lock to prevent concurrent mutation of the same point array
const pointLocks = {};

export const addStatToLocalPoint = async (gameName, pointNumber, newStat) => {
  const key = getPointKey(gameName, pointNumber);
  
  // Wait for existing lock
  while (pointLocks[key]) {
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  pointLocks[key] = true;

  try {
    let pointData = await get(key);
    let statsArray = [];
    if (pointData) {
      statsArray = Array.isArray(pointData) ? pointData : (pointData.stats || []);
    }
    
    const enrichedStat = {
      ...newStat,
      id: newStat.id || generateUUID(),
      created_at: newStat.created_at || new Date().toISOString()
    };
    
    statsArray.push(enrichedStat);
    
    const newPointData = {
      gameName,
      pointNumber,
      stats: statsArray,
      last_modified: Date.now(),
      synced: false
    };

    await set(key, newPointData);

    const isPointOver = statsArray.some(s => s.stat_type === 'Point' || s.stat_type === 'Opponent Point' || s.stat_type === 'Game Completed' || s.stat_type === 'Match Metadata');
    if (isPointOver && navigator.onLine) {
      attemptSync();
    }
    
    return enrichedStat;
  } finally {
    delete pointLocks[key];
  }
};

// Legacy savePointLocally for Lineup which saves an array
export const savePointLocally = async (gameName, pointNumber, statsArray) => {
  const key = getPointKey(gameName, pointNumber);
  
  while (pointLocks[key]) await new Promise(r => setTimeout(r, 10));
  pointLocks[key] = true;

  try {
    const enrichedStats = statsArray.map(stat => ({
      ...stat,
      id: stat.id || generateUUID(),
      created_at: stat.created_at || new Date().toISOString()
    }));

    const pointData = {
      gameName,
      pointNumber,
      stats: enrichedStats,
      last_modified: Date.now(),
      synced: false
    };

    await set(key, pointData);
    
    const isPointOver = enrichedStats.some(s => s.stat_type === 'Point' || s.stat_type === 'Opponent Point' || s.stat_type === 'Game Completed' || s.stat_type === 'Match Metadata');
    if (isPointOver && navigator.onLine) {
      attemptSync();
    }
    
    return enrichedStats;
  } finally {
    delete pointLocks[key];
  }
};

export const getLocalPoint = async (gameName, pointNumber) => {
  const key = getPointKey(gameName, pointNumber);
  return await get(key);
};

// Check if we actually have internet (Lie-Fi detection)
const checkHeartbeat = async () => {
  try {
    // Quick ping to supabase health or a lightweight endpoint
    const { error } = await supabase.from('teams').select('id').limit(1);
    return !error;
  } catch (err) {
    return false;
  }
};

let isSyncing = false;
export const attemptSync = async () => {
  if (isSyncing || !navigator.onLine) return;
  
  const hasInternet = await checkHeartbeat();
  if (!hasInternet) return;

  isSyncing = true;
  // Dispatch event for UI to show Spinning Blue
  window.dispatchEvent(new CustomEvent('sync-status', { detail: 'syncing' }));

  try {
    const allKeys = await keys();
    const pointKeys = allKeys.filter(k => typeof k === 'string' && k.startsWith('point_'));
    
    if (pointKeys.length === 0) {
      window.dispatchEvent(new CustomEvent('sync-status', { detail: 'synced' }));
      isSyncing = false;
      return;
    }

    for (const key of pointKeys) {
      const pointData = await get(key);
      if (!pointData || pointData.synced) continue;

      // "Client-Wins" Logic:
      // First, get the server's current stats for this game/point to delete any that were undone/removed locally
      const { data: existingServerStats } = await supabase
        .from('stats')
        .select('id')
        .eq('game_name', pointData.gameName)
        .eq('point_number', pointData.pointNumber);

      if (existingServerStats && existingServerStats.length > 0) {
        const localIds = new Set(pointData.stats.map(s => s.id));
        const idsToDelete = existingServerStats.filter(s => !localIds.has(s.id)).map(s => s.id);
        
        if (idsToDelete.length > 0) {
          await supabase.from('stats').delete().in('id', idsToDelete);
        }
      }

      // Now upsert the local stats entirely (this handles both inserts and updates, matching client state exactly)
      if (pointData.stats.length > 0) {
        const { error } = await supabase
          .from('stats')
          .upsert(pointData.stats, { onConflict: 'id' });
          
        if (error) {
          console.error('Upsert failed for point:', error);
          throw error; // throw to abort deleting the local queue
        }
      }

      // Re-fetch with lock to ensure we don't overwrite stats added during the network request
      while (pointLocks[key]) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      pointLocks[key] = true;
      try {
        const latestPointData = await get(key);
        if (latestPointData) {
          if (latestPointData.stats.length === pointData.stats.length) {
            // Nothing changed locally during upload
            latestPointData.synced = true;
            await set(key, latestPointData);
          } else {
            // New stats were added locally while we were uploading!
            // Leave synced as false so the new stats get synced next time.
            console.log(`[SyncEngine] Stats appended during upload for ${key}. Leaving synced=false.`);
          }
        }
      } finally {
        delete pointLocks[key];
      }
    }
    
    window.dispatchEvent(new CustomEvent('sync-status', { detail: 'synced' }));
  } catch (err) {
    console.error('Sync process interrupted:', err);
    // Keep the data in IndexedDB (do not delete)
    window.dispatchEvent(new CustomEvent('sync-status', { detail: 'offline' }));
  } finally {
    isSyncing = false;
  }
};

export const getPendingSyncCount = async () => {
  const allKeys = await keys();
  const pointKeys = allKeys.filter(k => typeof k === 'string' && k.startsWith('point_'));
  let count = 0;
  for (const key of pointKeys) {
    const pointData = await get(key);
    if (pointData && !pointData.synced) count++;
  }
  return count;
};

export const removeStatLocally = async (id) => {
  const allKeys = await keys();
  const pointKeys = allKeys.filter(k => typeof k === 'string' && k.startsWith('point_'));
  
  for (const key of pointKeys) {
    const pointData = await get(key);
    if (!pointData || !pointData.stats) continue;
    
    const initialLength = pointData.stats.length;
    pointData.stats = pointData.stats.filter(s => s.id !== id);
    
    if (pointData.stats.length < initialLength) {
      // If we removed all stats, we can just delete the point key
      if (pointData.stats.length === 0) {
        await del(key);
      } else {
        pointData.last_modified = Date.now();
        pointData.synced = false;
        await set(key, pointData);
      }
      return true; // found and removed
    }
  }
  return false;
};

export const getLastLocalStat = async (gameName) => {
  const allKeys = await keys();
  const pointKeys = allKeys.filter(k => typeof k === 'string' && k.startsWith(`point_${gameName}_`));
  
  let allStats = [];
  for (const key of pointKeys) {
    const pointData = await get(key);
    if (pointData && pointData.stats) {
      allStats.push(...pointData.stats.filter(s => s.stat_type !== 'Lineup'));
    }
  }
  
  if (allStats.length === 0) return null;
  
  // Sort by created_at descending
  allStats.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return allStats[0];
};

export const upgradeLastStatToHuck = async (gameName) => {
  const allKeys = await keys();
  const pointKeys = allKeys.filter(k => typeof k === 'string' && k.startsWith(`point_${gameName}_`));
  
  let allStats = [];
  for (const key of pointKeys) {
    const pointData = await get(key);
    if (pointData && pointData.stats) {
      allStats.push(...pointData.stats.filter(s => s.stat_type !== 'Lineup').map(s => ({...s, _key: key})));
    }
  }
  
  if (allStats.length === 0) return null;
  allStats.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  
  const lastStat = allStats[0];
  if (!lastStat) return null;

  // Prevent upgrading non-action stats
  if (['Opponent Point', 'Game Completed', 'Start Offense', 'Start Defense', 'Half Time', 'Timeout', 'Pull'].includes(lastStat.stat_type)) {
    return null;
  }

  const pointData = await get(lastStat._key);
  const statIndex = pointData.stats.findIndex(s => s.id === lastStat.id);
  if (statIndex !== -1) {
    pointData.stats[statIndex].details = { ...(pointData.stats[statIndex].details || {}), is_huck: true };
    const updatePromises = [];
    updatePromises.push(
       navigator.onLine ? supabase.from('stats').update({ details: pointData.stats[statIndex].details }).eq('id', lastStat.id).catch(() => {}) : Promise.resolve()
    );

    // Also upgrade the paired thrower action if it's a Drop
    if (statIndex > 0 && lastStat.stat_type === 'Drop') {
      const prevStat = pointData.stats[statIndex - 1];
      if (['Pass', 'Pass Attempt'].includes(prevStat.stat_type) && prevStat.timestamp === lastStat.timestamp) {
         pointData.stats[statIndex - 1].details = { ...(pointData.stats[statIndex - 1].details || {}), is_huck: true };
         updatePromises.push(
            navigator.onLine ? supabase.from('stats').update({ details: pointData.stats[statIndex - 1].details }).eq('id', prevStat.id).catch(() => {}) : Promise.resolve()
         );
      }
    }

    pointData.last_modified = Date.now();
    pointData.synced = false;
    await set(lastStat._key, pointData);
    
    if (navigator.onLine) {
       await Promise.all(updatePromises);
       attemptSync();
    }
    return pointData.stats[statIndex];
  }
  return null;
};

// Setup online listener and initial sync
if (typeof window !== 'undefined') {
  window.addEventListener('online', attemptSync);
  
  // Try to sync on startup just in case there are queued items
  if (navigator.onLine) {
    setTimeout(attemptSync, 1000);
  }
}
