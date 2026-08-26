export const MOCK_USER_ID = 'b36a3e73-6a09-4437-ab62-325ad9e9be25';
export const MOCK_TEAM_ID = '47606d63-877c-4c3f-950e-e05d4a52078f';
export const MOCK_CLUB_ID = 'club-id-abc';

export const MOCK_PROFILE = {
  id: MOCK_USER_ID,
  email: 'rouven@ustats.pro',
  is_system_admin: false,
  admin_level: null,
  tier: 'PRO',
  beta_voice_pro: true,
  beta_tournament_tier: true,
  beta_trainings_tier: true,
  disable_club_track: false,
  current_session_id: 'mock-session-id',
  pro_expires_at: '2030-01-01T00:00:00.000Z',
  created_at: '2026-01-01T00:00:00.000Z',
};

// Static mock data
export const MOCK_TEAMS = [
  {
    id: MOCK_TEAM_ID,
    name: 'South Circular',
    owner_id: MOCK_USER_ID,
    club_id: MOCK_CLUB_ID,
    created_at: '2026-01-01T00:00:00.000Z',
  }
];

export const MOCK_CLUBS = [
  {
    id: MOCK_CLUB_ID,
    name: 'South Circular Ultimate Club',
    owner_id: MOCK_USER_ID,
    created_at: '2026-01-01T00:00:00.000Z',
  }
];

export const MOCK_PLAYERS = [
  { id: 'p1', name: 'Serena', shirt_number: 10, team_players: [{ team_id: MOCK_TEAM_ID, is_active: true }] },
  { id: 'p2', name: 'Trebs', shirt_number: 14, team_players: [{ team_id: MOCK_TEAM_ID, is_active: true }] },
  { id: 'p3', name: 'Ilona', shirt_number: 7, team_players: [{ team_id: MOCK_TEAM_ID, is_active: true }] },
  { id: 'p4', name: 'Alex', shirt_number: 11, team_players: [{ team_id: MOCK_TEAM_ID, is_active: true }] },
  { id: 'p5', name: 'Casey', shirt_number: 22, team_players: [{ team_id: MOCK_TEAM_ID, is_active: true }] },
  { id: 'p6', name: 'Taylor', shirt_number: 5, team_players: [{ team_id: MOCK_TEAM_ID, is_active: true }] },
  { id: 'p7', name: 'Jordan', shirt_number: 9, team_players: [{ team_id: MOCK_TEAM_ID, is_active: true }] },
];

const createStat = (gameName, pointNum, statType, player, extra = {}) => ({
  id: crypto.randomUUID(),
  game_name: gameName,
  point_number: pointNum,
  stat_type: statType,
  player: player,
  team_name: 'South Circular',
  team_id: MOCK_TEAM_ID,
  created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  ...extra
});

const gameName = 'Beach Nationals Bronze Medal Match ';

export const MOCK_STATS = [
  // Point 1: Serena pass -> Trebs pass -> Ilona Goal
  createStat(gameName, 1, 'Lineup', 'System', { details: { lineup: ['Serena', 'Trebs', 'Ilona', 'Alex', 'Casey', 'Taylor', 'Jordan'] } }),
  createStat(gameName, 1, 'Pull', 'Serena'),
  createStat(gameName, 1, 'Pass', 'Serena'),
  createStat(gameName, 1, 'Pass', 'Trebs'),
  createStat(gameName, 1, 'Point', 'Ilona'),
  
  // Point 2: Ilona pass -> Serena Drop -> Turnover -> Opponent score
  createStat(gameName, 2, 'Lineup', 'System', { details: { lineup: ['Serena', 'Trebs', 'Ilona', 'Alex', 'Casey', 'Taylor', 'Jordan'] } }),
  createStat(gameName, 2, 'Pass', 'Ilona'),
  createStat(gameName, 2, 'Drop', 'Serena'),
  createStat(gameName, 2, 'Opponent Point', 'System'),

  // Point 3: Serena pass -> Trebs pass -> Serena Point
  createStat(gameName, 3, 'Lineup', 'System', { details: { lineup: ['Serena', 'Trebs', 'Ilona', 'Alex', 'Casey', 'Taylor', 'Jordan'] } }),
  createStat(gameName, 3, 'Pass', 'Serena'),
  createStat(gameName, 3, 'Pass', 'Trebs'),
  createStat(gameName, 3, 'Point', 'Serena'),

  // Point 4: Taylor Pass -> Throwaway -> Opponent Point
  createStat(gameName, 4, 'Lineup', 'System', { details: { lineup: ['Serena', 'Trebs', 'Ilona', 'Alex', 'Casey', 'Taylor', 'Jordan'] } }),
  createStat(gameName, 4, 'Pass', 'Taylor'),
  createStat(gameName, 4, 'Throwaway', 'Taylor'),
  createStat(gameName, 4, 'Opponent Point', 'System'),

  // Point 5: Serena block -> Pass to Ilona -> Ilona Point
  createStat(gameName, 5, 'Lineup', 'System', { details: { lineup: ['Serena', 'Trebs', 'Ilona', 'Alex', 'Casey', 'Taylor', 'Jordan'] } }),
  createStat(gameName, 5, 'Defence', 'Serena'),
  createStat(gameName, 5, 'Pass', 'Serena'),
  createStat(gameName, 5, 'Point', 'Ilona'),

  // Point 6: Stall Out on Casey -> Opponent Point
  createStat(gameName, 6, 'Lineup', 'System', { details: { lineup: ['Serena', 'Trebs', 'Ilona', 'Alex', 'Casey', 'Taylor', 'Jordan'] } }),
  createStat(gameName, 6, 'Stall Out', 'Casey'),
  createStat(gameName, 6, 'Opponent Point', 'System'),
];

export function resetDynamicMockStore() {
  // no-op: state is isolated within setupMocks closures per page instance
}

export async function initTestAuth(page, testInfo, useDynamic = false) {
  const isMocked = testInfo.project.name.includes('Mocked');
  
  await page.addInitScript(() => {
    window.localStorage.removeItem('ufstats_game');
    window.localStorage.removeItem('ufstats_point');
    window.localStorage.removeItem('ufstats_tracking');
    window.localStorage.removeItem('ufstats_opponent');
    window.localStorage.removeItem('ufstats_possession');
    window.localStorage.setItem('ufstats_theme', 'dark');
  });

  if (isMocked) {
    await setupMocks(page, useDynamic);

    await page.addInitScript(({ key, value, profileKey, profileVal }) => {
      window.localStorage.setItem(key, value);
      window.localStorage.setItem(profileKey, profileVal);
    }, {
      key: 'sb-rktfovbzhqehqjulmwuj-auth-token',
      value: JSON.stringify({
        access_token: 'mock-access-token-jwt',
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: 'mock-refresh-token',
        user: {
          id: MOCK_USER_ID,
          aud: 'authenticated',
          role: 'authenticated',
          email: useDynamic ? 'test-runner@ustats.pro' : 'rouven@ustats.pro',
          created_at: MOCK_PROFILE.created_at,
          updated_at: MOCK_PROFILE.created_at,
        },
        expires_at: Math.floor(Date.now() / 1000) + 3600
      }),
      profileKey: 'ufstats_cached_profile',
      profileVal: JSON.stringify(MOCK_PROFILE)
    });
  }
}

export async function setupMocks(page, useDynamic = false) {
  let dynamicClubs = [];
  let dynamicTeams = [];
  let dynamicPlayers = [];
  let dynamicStats = [];
  let dynamicTeamPlayers = [];

  // 1. Intercept Supabase Auth GET User/Session calls
  await page.route('**/auth/v1/user', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: MOCK_USER_ID,
        aud: 'authenticated',
        role: 'authenticated',
        email: useDynamic ? 'test-runner@ustats.pro' : 'rouven@ustats.pro',
        app_metadata: { provider: 'email', providers: ['email'] },
        user_metadata: {},
        identities: [],
        created_at: MOCK_PROFILE.created_at,
        updated_at: MOCK_PROFILE.created_at,
      })
    });
  });

  await page.route('**/auth/v1/token**', async route => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'mock-access-token-jwt',
          token_type: 'bearer',
          expires_in: 3600,
          refresh_token: 'mock-refresh-token',
          user: {
            id: MOCK_USER_ID,
            email: useDynamic ? 'test-runner@ustats.pro' : 'rouven@ustats.pro',
          }
        })
      });
    }
  });

  // 2. Intercept profiles table queries
  await page.route('**/rest/v1/profiles*', async route => {
    const method = route.request().method();
    if (method === 'GET' || method === 'HEAD') {
      const url = route.request().url();
      const profile = {
        ...MOCK_PROFILE,
        email: useDynamic ? 'test-runner@ustats.pro' : 'rouven@ustats.pro'
      };
      if (url.includes('.single')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(profile) });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([profile]) });
      }
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_PROFILE) });
    }
  });

  // 3. Intercept clubs table queries
  await page.route('**/rest/v1/clubs*', async route => {
    const method = route.request().method();
    if (useDynamic) {
      if (method === 'GET' || method === 'HEAD') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: { 'content-range': `0-0/${dynamicClubs.length}` },
          body: method === 'HEAD' ? undefined : JSON.stringify(dynamicClubs)
        });
      } else if (method === 'POST') {
        const payload = JSON.parse(route.request().postData() || '[]');
        const items = Array.isArray(payload) ? payload : [payload];
        const newClubs = items.map(item => ({ id: crypto.randomUUID(), created_at: new Date().toISOString(), ...item }));
        dynamicClubs.push(...newClubs);
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(newClubs) });
      } else if (method === 'DELETE') {
        dynamicClubs = [];
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
      }
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'content-range': `0-0/${MOCK_CLUBS.length}` },
        body: method === 'HEAD' ? undefined : JSON.stringify(MOCK_CLUBS)
      });
    }
  });

  // 4. Intercept teams table queries
  await page.route('**/rest/v1/teams*', async route => {
    const method = route.request().method();
    if (useDynamic) {
      if (method === 'GET' || method === 'HEAD') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: { 'content-range': `0-0/${dynamicTeams.length}` },
          body: method === 'HEAD' ? undefined : JSON.stringify(dynamicTeams)
        });
      } else if (method === 'POST') {
        const payload = JSON.parse(route.request().postData() || '[]');
        const items = Array.isArray(payload) ? payload : [payload];
        const newTeams = items.map(item => ({ id: crypto.randomUUID(), created_at: new Date().toISOString(), ...item }));
        dynamicTeams.push(...newTeams);
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(newTeams) });
      } else if (method === 'DELETE') {
        dynamicTeams = [];
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
      }
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'content-range': `0-0/${MOCK_TEAMS.length}` },
        body: method === 'HEAD' ? undefined : JSON.stringify(MOCK_TEAMS)
      });
    }
  });

  // Junction table team_players
  await page.route('**/rest/v1/team_players*', async route => {
    const method = route.request().method();
    if (method === 'POST') {
      const payload = JSON.parse(route.request().postData() || '[]');
      const items = Array.isArray(payload) ? payload : [payload];
      dynamicTeamPlayers.push(...items.map(item => ({ ...item, is_active: item.is_active || false })));
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(items) });
    } else if (method === 'PATCH' || method === 'PUT') {
      const payload = JSON.parse(route.request().postData() || '{}');
      if (payload.is_active !== undefined) {
        dynamicTeamPlayers.forEach(tp => {
          tp.is_active = payload.is_active;
        });
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    }
  });

  // 5. Intercept players table queries
  await page.route('**/rest/v1/players*', async route => {
    const method = route.request().method();
    if (useDynamic) {
      if (method === 'GET' || method === 'HEAD') {
        const responsePlayers = dynamicPlayers.map(p => {
          const tp = dynamicTeamPlayers.find(tp => tp.player_id === p.id);
          return {
            ...p,
            team_players: tp ? [tp] : []
          };
        });
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: { 'content-range': `0-0/${responsePlayers.length}` },
          body: method === 'HEAD' ? undefined : JSON.stringify(responsePlayers)
        });
      } else if (method === 'POST') {
        const payload = JSON.parse(route.request().postData() || '[]');
        const items = Array.isArray(payload) ? payload : [payload];
        const newPlayers = items.map(item => ({ id: crypto.randomUUID(), ...item }));
        dynamicPlayers.push(...newPlayers);
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(newPlayers) });
      } else if (method === 'DELETE') {
        dynamicPlayers = [];
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
      }
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'content-range': `0-0/${MOCK_PLAYERS.length}` },
        body: method === 'HEAD' ? undefined : JSON.stringify(MOCK_PLAYERS)
      });
    }
  });

  // 6. Intercept stats table queries
  await page.route('**/rest/v1/stats*', async route => {
    const method = route.request().method();
    if (useDynamic) {
      if (method === 'GET' || method === 'HEAD') {
        const url = new URL(route.request().url());
        let filteredStats = [...dynamicStats];
        
        console.log(`🔍 [Mock GET Stats Debug] URL: ${route.request().url()}`);
        console.log(`🔍 [Mock GET Stats Debug] Before filtering: ${dynamicStats.length} stats:`, dynamicStats.map(s => `${s.stat_type}(P${s.point_number}, G:${s.game_name}, T:${s.team_name})`));

        for (const [key, value] of url.searchParams.entries()) {
          if (value.startsWith('eq.')) {
            const val = decodeURIComponent(value.substring(3));
            console.log(`🔍 [Mock GET Stats Debug] Filter: ${key} === ${val}`);
            if (key === 'point_number') {
              const num = parseInt(val, 10);
              filteredStats = filteredStats.filter(s => s.point_number === num);
            } else {
              filteredStats = filteredStats.filter(s => s[key] === val);
            }
          }
        }

        console.log(`📡 [Mock Route] GET/HEAD stats requested. Returning ${filteredStats.length} filtered dynamic stats.`);
        await route.fulfill({
          status: 200,
          headers: { 'content-range': `0-0/${filteredStats.length}` },
          body: method === 'HEAD' ? undefined : JSON.stringify(filteredStats)
        });
      } else if (method === 'POST') {
        const payload = JSON.parse(route.request().postData() || '[]');
        const items = Array.isArray(payload) ? payload : [payload];
        const newStats = items.map(item => ({ id: item.id || crypto.randomUUID(), created_at: item.created_at || new Date().toISOString(), ...item }));
        
        console.log(`📡 [Mock Route] POST stats requested. Upserting/Merging ${newStats.length} stats.`);
        
        for (const ns of newStats) {
          const idx = dynamicStats.findIndex(x => x.id === ns.id);
          if (idx !== -1) {
            dynamicStats[idx] = ns;
          } else {
            dynamicStats.push(ns);
          }
        }
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(newStats) });
      } else if (method === 'DELETE') {
        const url = decodeURIComponent(route.request().url());
        const idParamMatch = url.match(/id=in\.\(([^)]+)\)/);
        if (idParamMatch) {
          const idsToDelete = idParamMatch[1].split(',').map(id => id.replace(/["']/g, '').trim());
          console.log(`📡 [Mock Route] DELETE stats requested for IDs:`, idsToDelete);
          dynamicStats = dynamicStats.filter(s => !idsToDelete.includes(s.id));
        } else {
          console.log('📡 [Mock Route] DELETE stats requested (no query). Clearing all dynamic stats.');
          dynamicStats = [];
        }
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
      }
    } else {
      if (method === 'GET' || method === 'HEAD') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: { 'content-range': `0-0/${MOCK_STATS.length}` },
          body: method === 'HEAD' ? undefined : JSON.stringify(MOCK_STATS)
        });
      } else if (method === 'POST') {
        const payload = JSON.parse(route.request().postData() || '{}');
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: crypto.randomUUID(), ...payload }) });
      }
    }
  });
}
