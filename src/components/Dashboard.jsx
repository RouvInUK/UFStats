import { useState, useEffect, useRef } from 'react';
import { recordStatToDB, fetchActiveGames, clearActiveLineup, fetchLastStatForGame, deleteStat, fetchGameStats } from '../supabaseClient';
import { Undo2, ArrowLeftRight, Mic, MicOff } from 'lucide-react';
import Fuse from 'fuse.js';
import { playChime, playClick, playBuzz } from '../utils/audioFeedback';

const Dashboard = ({ activeLineup, currentPoint, setCurrentPoint, currentGame, gameType, currentTeam, targetTeamId, opponentName, initialPossession, isTrackingActive, setIsTrackingActive, onNavigate, players, setPlayers, isVoiceEnabled, setIsVoiceEnabled, isPro, isVoiceBeta }) => {
  const [possessionChain, setPossessionChain] = useState([]);
  const [previousChain, setPreviousChain] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [activeGames, setActiveGames] = useState([]);
  const [flashType, setFlashType] = useState(null);

  // Voice Tracking State
  const [voiceFeedback, setVoiceFeedback] = useState('');
  const [voiceRecognizedAction, setVoiceRecognizedAction] = useState(null);
  const [voiceRecognizedPlayer, setVoiceRecognizedPlayer] = useState(null);
  const recognitionRef = useRef(null);

  const triggerFeedback = (type) => {
    setFlashType(type);
    
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        if (type === 'success') navigator.vibrate([50, 50, 50]);
        else if (type === 'error') navigator.vibrate([100, 50, 100]);
        else navigator.vibrate(40);
      }
    } catch {
      // Ignore haptic errors securely
    }

    setTimeout(() => setFlashType(null), 250); 
  };

  const [score, setScore] = useState({ us: 0, them: 0 });
  const [currentOD, setCurrentOD] = useState('O');
  const [liveOpponentName, setLiveOpponentName] = useState('Opponent');

  useEffect(() => {
    if (!currentGame) return;
    const loadGameContext = async () => {
       try {
          const stats = await fetchGameStats(currentGame, targetTeamId);
          let us = 0, them = 0;
          let od = initialPossession || 'O';
          let gameStartOD = initialPossession || null;
          let oppName = opponentName || 'Opponent';

          const chronStats = [...stats].reverse();
          chronStats.forEach(stat => {
              if (stat.stat_type === 'Start Offense') {
                  od = 'O';
                  if (!gameStartOD) gameStartOD = 'O';
              }
              if (stat.stat_type === 'Start Defense') {
                  od = 'D';
                  if (!gameStartOD) gameStartOD = 'D';
              }
              if (stat.stat_type === 'Half Time') {
                  // Half time possession is ALWAYS the exact opposite of the initial game start possession
                  od = gameStartOD === 'O' ? 'D' : 'O';
              }
              if (stat.stat_type === 'Point') { us += 1; od = 'D'; }
              if (stat.stat_type === 'Opponent Point') { them += 1; od = 'O'; }
              if (stat.stat_type === 'Match Metadata') oppName = stat.player;
          });
          setScore({ us, them });
          setCurrentOD(od);
          setLiveOpponentName(oppName);
       } catch (e) {
          console.error("Failed to load live score context", e);
       }
    };
    loadGameContext();
  }, [currentGame, isTrackingActive, lastSaved]);

  useEffect(() => {
    fetchActiveGames(targetTeamId).then(setActiveGames).catch(console.error);
  }, [targetTeamId]);

  // Removed the useEffect that overrode currentPoint based on activeGames.
  // The server maxPoint will lag behind the local state (especially offline),
  // causing the client to silently revert to the previous point and write stats to the wrong point.

  const [callahanModeFor, setCallahanModeFor] = useState(null);

  useEffect(() => {
    if (activeLineup.length === 0) {
      setPossessionChain([]);
      setCallahanModeFor(null);
    }
  }, [activeLineup]);

  const handlePlayerSelect = async (playerName) => {
    if (!isTrackingActive) return alert("Start tracking first!");
    
    if (possessionChain.length === 0) {
      // We are picking up the disc. Did the opponent have it?
      const lastStat = await fetchLastStatForGame(currentGame, targetTeamId);
      if (lastStat) {
        // Only consider it an opponent turnover if we were in the middle of a point
        // and the last action was us losing it OR us starting on defense/pulling.
        const opponentTurnoverTriggers = ['Drop', 'Throwaway', 'Stall Out', 'Pull', 'Start Defense'];
        
        // If the last action was one of the triggers, AND it's not a brand new point where we haven't done anything yet
        if (opponentTurnoverTriggers.includes(lastStat.stat_type)) {
           // Auto-log the opponent turnover before starting our possession
           await handleStatRecord('Opponent Turnover', 'Opponent', []);
        }
      }
    }

    // We update possessionChain immediately for instant UI feedback
    setPossessionChain(prev => {
      if (prev.length > 0 && prev[prev.length - 1] === playerName) {
        setCallahanModeFor(c => c === playerName ? null : playerName);
        return prev;
      }
      
      setCallahanModeFor(null);
      const newChain = [...prev, playerName];
      
      if (prev.length >= 2) {
        const playerNMinus2 = prev[prev.length - 2];
        // Fire and forget the pass log so the UI doesn't freeze
        handleStatRecord('Pass', playerNMinus2, prev);
      }
      
      return newChain;
    });
  };

  const handleStatRecord = async (statType, overridePlayer = null, overrideChain = null) => {
    // Use overrideChain if provided, otherwise fallback to the current state.
    // Note: fallback to current state is still susceptible to race conditions for rapid sequential calls,
    // but we use overrideChain from handlePlayerSelect to fix the critical path.
    const currentChain = overrideChain || possessionChain;
    const activePlayer = overridePlayer || currentChain[currentChain.length - 1];
    if (statType !== 'Opponent Point' && !activePlayer) return alert("Select a player first!");
    
    setIsSaving(true);
    setLastSaved(null);
    try {
      const statsToSave = [];
      const baseStat = {
        timestamp: new Date().toLocaleString(),
        pointNumber: currentPoint,
        gameName: currentGame,
        gameType: gameType,
        teamName: currentTeam,
      };

      if (statType === 'Opponent Point') {
        if (callahanModeFor) {
          statsToSave.push({ ...baseStat, player: callahanModeFor, stat: 'Pass Attempt' });
          statsToSave.push({ ...baseStat, player: 'Opponent', stat: 'Opponent Point', details: { isCallahan: true } });
        } else {
          statsToSave.push({ ...baseStat, player: 'Opponent', stat: 'Opponent Point' });
        }
        setPossessionChain([]);
        setCallahanModeFor(null);
        playBuzz();
      } else if (statType === 'Point') {
        let pendingPasser = null;
        
        if (activePlayer === currentChain[currentChain.length - 1]) {
           pendingPasser = currentChain[currentChain.length - 2];
        }

        if (pendingPasser) statsToSave.push({ ...baseStat, player: pendingPasser, stat: 'Pass' });
        statsToSave.push({ ...baseStat, player: activePlayer, stat: 'Point' });
        
        setPossessionChain([]);
        setCallahanModeFor(null);
        playChime();
      } else if (statType === 'Pass') {
        statsToSave.push({ ...baseStat, player: activePlayer, stat: 'Pass' });
        playClick();
      } else if (['Drop', 'Throwaway', 'Stall Out'].includes(statType)) {
        if (currentChain.length > 1 && statType === 'Drop') {
          const thrower = currentChain[currentChain.length - 2];
          statsToSave.push({ ...baseStat, player: thrower, stat: 'Pass Attempt' });
        } else if (currentChain.length > 1 && (statType === 'Throwaway' || statType === 'Stall Out')) {
          const pendingPasser = currentChain[currentChain.length - 2];
          statsToSave.push({ ...baseStat, player: pendingPasser, stat: 'Pass' });
        }
        statsToSave.push({ ...baseStat, player: activePlayer, stat: statType });
        setPossessionChain([]);
        setCallahanModeFor(null);
        playBuzz();
      } else if (statType === 'Opponent Turnover') {
        statsToSave.push({ ...baseStat, player: 'Opponent', stat: 'Opponent Turnover' });
        // Handled silently
      } else if (statType === 'Defence') {
        statsToSave.push({ ...baseStat, player: activePlayer, stat: statType });
        setPossessionChain([activePlayer]);
        playChime();
      } else {
        statsToSave.push({ ...baseStat, player: activePlayer, stat: statType });
        playClick();
      }

      for (const st of statsToSave) {
        console.log(`[Dashboard] Attempting to save stat:`, st);
        await recordStatToDB(st, targetTeamId);
      }
      
      setLastSaved(statType === 'Opponent Point' ? `Saved Opponent Point` : `Saved ${statType} for ${activePlayer}`);
      
      if (statType === 'Point' || statType === 'Opponent Point') {
        setIsSaving(true);
        triggerFeedback(statType === 'Point' ? 'success' : 'error');
        setVoiceFeedback(statType === 'Opponent Point' ? 'Opponent Scored!' : `Point Scored by ${activePlayer}!`);
        
        setTimeout(() => {
           if (gameType !== 'training') {
             setIsTrackingActive(false);
             clearActiveLineup(targetTeamId).catch(console.error);
             if (players && setPlayers) {
                 setPlayers(players.map(p => ({ ...p, is_active: false })));
             }
             onNavigate('lineup');
           } else {
             setIsSaving(false);
             setPossessionChain([]);
             setVoiceFeedback('');
           }
        }, 1500);
        return;
      }

      if (statType === 'Point') {
        triggerFeedback('success');
      } else if (['Throwaway', 'Drop', 'Stall Out', 'Opponent Point'].includes(statType)) {
        triggerFeedback('error');
      } else {
        triggerFeedback('neutral');
      }
      if (statType !== 'Point' && statType !== 'Opponent Point') {
        setIsSaving(false);
      }
    } catch (error) {
      console.error('Save failed:', error);
      alert('Failed to save. Check server logs.');
      setIsSaving(false);
    }
  };

  // Voice Tracking Engine
  const lastActionTimeRef = useRef(0);
  const lastExecutedTranscriptRef = useRef('');
  const voiceCommandTimeoutRef = useRef(null);

  useEffect(() => {
    if (!isVoiceEnabled || !isTrackingActive) {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        try { recognitionRef.current.abort(); } catch(e) {}
        recognitionRef.current = null;
      }
      setVoiceFeedback('');
      executedCommandsCountRef.current = {};
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const SpeechGrammarList = window.SpeechGrammarList || window.webkitSpeechGrammarList;
    if (!SpeechRecognition) {
      setVoiceFeedback("Voice tracking not supported on this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true; // Set to true to prevent constant restarting and system mic beeping
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    // 1. Generate Dictionary of expected exact commands
    const expectedCommands = [];
    const activeObjects = activeLineup.map(name => players?.find(p => p.name === name)).filter(Boolean);
    
    activeObjects.forEach(player => {
        if (player.shirt_number != null && player.shirt_number !== '') {
           const num = String(player.shirt_number).toLowerCase();
           expectedCommands.push({ text: num, action: 'PlayerSelect', player: player.name });
           // We also keep combined commands just in case they say it fast together
           expectedCommands.push({ text: `${num} score`, action: 'Point', player: player.name });
           expectedCommands.push({ text: `${num} drop`, action: 'Drop', player: player.name });
           expectedCommands.push({ text: `${num} throwaway`, action: 'Throwaway', player: player.name });
           expectedCommands.push({ text: `${num} stall out`, action: 'Stall Out', player: player.name });
           expectedCommands.push({ text: `${num} defence`, action: 'Defence', player: player.name });
        }
    });
    
    // Add standalone actions that operate on the currently active player
    expectedCommands.push({ text: `score`, action: 'Point', player: null });
    expectedCommands.push({ text: `drop`, action: 'Drop', player: null });
    expectedCommands.push({ text: `throwaway`, action: 'Throwaway', player: null });
    expectedCommands.push({ text: `stall out`, action: 'Stall Out', player: null });
    expectedCommands.push({ text: `defence`, action: 'Defence', player: null });
    
    expectedCommands.push({ text: `opponent score`, action: 'Opponent Point', player: 'Opponent' });

    // Initialize Fuse for full-phrase matching
    const fuse = new Fuse(expectedCommands, {
       keys: ['text'],
       threshold: 0.3, // Tighter fuzziness to prevent matching incorrect numbers
       includeScore: true
    });

    // 2. Build and apply Grammar Hints (Chrome only)
    if (SpeechGrammarList && expectedCommands.length > 0) {
        const phrases = expectedCommands.map(cmd => cmd.text);
        const grammar = `#JSGF V1.0; grammar ufstats; public <command> = ${phrases.join(' | ')} ;`;
        const speechRecognitionList = new SpeechGrammarList();
        speechRecognitionList.addFromString(grammar, 1);
        recognition.grammars = speechRecognitionList;
    }

    // 3. Aggressive phonetic map
    const wordMap = {
      'double zero': '00', 'double oh': '00', 'zero zero': '00', 'double hero': '00', 'double arrow': '00',
      'zero': '0', 'oh': '0', 'o': '0', 'null': '0', 'nil': '0', 'nought': '0', 'hero': '0', 'arrow': '0', 'narrow': '0', 'zorro': '0', 'sarah': '0', 'borough': '0', 'borrow': '0', 'sorrow': '0', 'tomorrow': '0', 'cereal': '0', 'serial': '0',
      'ill': '0', 'neal': '0', 'neil': '0', 'mill': '0', 'meal': '0', 'bill': '0', 'pill': '0', 'will': '0', 'till': '0', 'dill': '0', 'fill': '0', 'hill': '0', 'kill': '0', 'gill': '0',
      'one': '1', 'won': '1', 'want': '1', 'juan': '1', 'on': '1', 'an': '1', 'and': '1', 'un': '1', 'van': '1', 'bun': '1', 'fun': '1', 'gun': '1', 'run': '1', 'sun': '1', 'done': '1',
      'two': '2', 'to': '2', 'too': '2', 'chew': '2', 'shoe': '2', 'true': '2', 'do': '2', 'due': '2', 'who': '2', 'zoo': '2', 'you': '2', 'through': '2', 'blew': '2', 'blue': '2', 'clue': '2', 'glue': '2',
      'three': '3', 'tree': '3', 'free': '3', 'see': '3', 'sea': '3', 'me': '3', 'we': '3', 'be': '3', 'bee': '3', 'key': '3', 'tea': '3', 'fee': '3', 'knee': '3', 'he': '3', 'she': '3', 'flee': '3', 'glee': '3', 'plea': '3',
      'four': '4', 'for': '4', 'fall': '4', 'full': '4', 'door': '4', 'floor': '4', 'more': '4', 'pour': '4', 'poor': '4', 'core': '4', 'war': '4', 'raw': '4', 'law': '4', 'draw': '4', 'saw': '4',
      'five': '5', 'hive': '5', 'pipe': '5', 'dive': '5', 'live': '5', 'drive': '5', 'alive': '5', 'arrive': '5', 'wife': '5', 'knife': '5', 'life': '5',
      'six': '6', 'sex': '6', 'sick': '6', 'ticks': '6', 'mix': '6', 'fix': '6', 'kicks': '6', 'picks': '6', 'bricks': '6', 'tricks': '6', 'sticks': '6', 'clicks': '6', 'chicks': '6',
      'seven': '7', 'steven': '7', 'kevin': '7', 'heaven': '7', 'eleven': '7', 'leaven': '7', 'evan': '7', 'devon': '7', 'lemon': '7', 'melon': '7', 'felon': '7',
      'eight': '8', 'ate': '8', 'hate': '8', 'hey': '8', 'late': '8', 'great': '8', 'weight': '8', 'wait': '8', 'straight': '8', 'state': '8', 'rate': '8', 'mate': '8', 'gate': '8', 'date': '8', 'fate': '8', 'eat': '8', 'aid': '8', 'age': '8', 'ache': '8', 'eggs': '8',
      'nine': '9', 'nein': '9', 'line': '9', 'mine': '9', 'fine': '9', 'dine': '9', 'wine': '9', 'sign': '9', 'shine': '9', 'spine': '9', 'pine': '9', 'vine': '9', 'rhyme': '9', 'time': '9', 'dime': '9', 'chime': '9', 'climb': '9', 'crime': '9', 'prime': '9', 'slime': '9',
      'ten': '10', 'tin': '10', 'pen': '10', 'then': '10', 'tan': '10', 'den': '10', 'ken': '10', 'men': '10', 'ben': '10', 'zen': '10', 'hen': '10', 'tent': '10', 'tenth': '10', 'can': '10', 'pan': '10', 'ran': '10', 'man': '10', 'fan': '10', 'van': '10', 'tem': '10', 'tim': '10', 'them': '10', 'stem': '10', 'gem': '10', 'tend': '10', 'trend': '10', 'friend': '10', 'mend': '10', 'send': '10',
      'eleven': '11', 'leaven': '11', 'evan': '11', 'kevin': '11', 'heaven': '11', 'seven': '11', 'steven': '11', 'lemon': '11', 'melon': '11',
      'twelve': '12', 'twelf': '12', 'dwell': '12', 'delve': '12', 'tell': '12', 'bell': '12', 'fell': '12', 'sell': '12', 'well': '12', 'yell': '12', 'hell': '12', 'shell': '12', 'smell': '12', 'spell': '12', 'swell': '12',
      'thirteen': '13', 'thirty': '13', 'thirsting': '13', 'hurting': '13', 'certain': '13', 'curtain': '13', 'flirting': '13', 'skirting': '13', 'shirt in': '13', 'dirt in': '13',
      'fourteen': '14', 'forty': '14', 'four team': '14', 'for team': '14', 'fault in': '14', 'sport in': '14', 'short in': '14', 'port in': '14', 'court in': '14', 'fort in': '14',
      'fifteen': '15', 'fifty': '15', 'lifting': '15', 'drifting': '15', 'sifting': '15', 'shifting': '15', 'gifting': '15', 'rift in': '15', 'swift in': '15',
      'sixteen': '16', 'sixty': '16', 'succeed': '16', 'six team': '16', 'sick string': '16', 'thick string': '16', 'stick string': '16', 'brick string': '16', 'trick string': '16', 'click string': '16',
      'seventeen': '17', 'seventy': '17', 'seven team': '17', 'heaven team': '17', 'leaven team': '17', 'evan team': '17', 'kevin team': '17', 'devon team': '17',
      'eighteen': '18', 'eighty': '18', 'eight team': '18', 'aching': '18', 'baking': '18', 'making': '18', 'taking': '18', 'waking': '18', 'shaking': '18', 'faking': '18', 'raking': '18', 'lake in': '18',
      'nineteen': '19', 'ninety': '19', 'nine team': '19', 'knight in': '19', 'night in': '19', 'light in': '19', 'fight in': '19', 'sight in': '19', 'might in': '19', 'right in': '19', 'tight in': '19', 'white in': '19',
      'twenty': '20', 'plenty': '20', 'genty': '20', 'tenting': '20', 'venting': '20', 'renting': '20', 'denting': '20', 'sent in': '20', 'went in': '20', 'meant in': '20', 'bent in': '20', 'spent in': '20',
      'thirty': '30', 'thirsty': '30', 'dirty': '30', 'sturdy': '30', 'birdie': '30', 'wordy': '30', 'nerdy': '30', 'hurdy': '30', 'gurdy': '30',
      'forty': '40', 'shorty': '40', 'sorta': '40', 'naughty': '40', 'haughty': '40', 'sporty': '40',
      'fifty': '50', 'nifty': '50', 'shifty': '50', 'thrifty': '50', 'swiftly': '50', 'stiffly': '50',
      'sixty': '60', 'thickly': '60', 'quickly': '60', 'slickly': '60', 'strictly': '60', 'prickly': '60',
      'seventy': '70', 'heavenly': '70', 'heavily': '70',
      'eighty': '80', 'haidi': '80', 'haiti': '80', 'lady': '80', 'baby': '80', 'maybe': '80', 'navy': '80', 'gravy': '80', 'wavy': '80', 'crazy': '80', 'lazy': '80', 'daisy': '80', 'hazy': '80', 'maze in': '80',
      'ninety': '90', 'mighty': '90', 'nighty': '90', 'flighty': '90', 'tiny': '90', 'shiny': '90', 'whiny': '90', 'piney': '90', 'briny': '90', 'spiny': '90',
      // Actions and variants
      'paths': 'pass', 'past': 'pass', 'pats': 'pass', 'fast': 'pass', 'path': 'pass', 'pence': 'pass', 'pounds': 'pass',
      'score': 'score', 'scored': 'score', 'point': 'score', 'points': 'score', 'coin': 'score', 'boy': 'score', 'store': 'score', 'soar': 'score', 'sore': 'score', 'door': 'score',
      'drop': 'drop', 'dropped': 'drop', 'cop': 'drop', 'crop': 'drop',
      'defense': 'defence', 'fence': 'defence', 'defend': 'defence',
      'incomplete': 'throwaway', 'away': 'throwaway', 'throw away': 'throwaway',
      'stall': 'stall out', 'stalled': 'stall out', 'out': 'stall out',
      'past': 'pass', 'paths': 'pass', 'path': 'pass', 'pats': 'pass', 'pad': 'pass', 'pads': 'pass',
      'store': 'score', 'core': 'score', 'soar': 'score', 'shore': 'score',
      'number': '', 'player': '',
      'campus': '10 pass', 'compass': '10 pass', 'tempest': '10 pass', 'tempass': '10 pass', 'pamphlet': '10 pass'
    };

    recognition.onresult = (event) => {
      // With continuous=true, we must look at the entire transcript since the last start
      // Safari/iOS has a bug where it duplicates words across result chunks. We deduplicate overlaps.
      let chunks = Array.from(event.results).map(r => r[0].transcript.toLowerCase().trim());
      let fullTranscript = '';
      let prevChunk = '';
      
      for (let chunk of chunks) {
         if (!chunk) continue;
         let originalChunk = chunk;
         
         if (prevChunk) {
            let wordsPrev = prevChunk.split(' ');
            let wordsChunk = chunk.split(' ');
            let overlapLen = 0;
            
            for (let k = 1; k <= Math.min(wordsPrev.length, wordsChunk.length); k++) {
               if (wordsPrev.slice(-k).join(' ') === wordsChunk.slice(0, k).join(' ')) {
                  overlapLen = k;
               }
            }
            
            if (overlapLen > 0) {
               chunk = wordsChunk.slice(overlapLen).join(' ');
            }
         }
         
         if (chunk) {
            fullTranscript += (fullTranscript ? ' ' : '') + chunk;
         }
         prevChunk = originalChunk;
      }
      
      fullTranscript = fullTranscript.trim();
        
      // Show the user exactly what the mic is hearing in real-time
      setVoiceFeedback(`Hearing: "${fullTranscript}"...`);
      
      // Debounce lock (ignore if recognized something in the last 1500ms)
      if (Date.now() - lastActionTimeRef.current < 1500) {
          return;
      }

      // Pre-process transcript with word map
      let normalizedTranscript = fullTranscript;
      for (const [word, replacement] of Object.entries(wordMap)) {
         normalizedTranscript = normalizedTranscript.replace(new RegExp(`\\b${word}\\b`, 'g'), replacement);
      }
      
      // 4. Find the best match at the END of the transcript
      // Sort commands by length descending so "34 score" is checked before "34"
      const sortedCommands = [...expectedCommands].sort((a, b) => b.text.length - a.text.length);
      
      let matchedCmd = null;
      for (const cmd of sortedCommands) {
          const regex = new RegExp(`\\b${cmd.text}$`, 'i');
          if (regex.test(normalizedTranscript)) {
              matchedCmd = cmd;
              break;
          }
      }

      if (matchedCmd) {
          // If this is exactly the same transcript text we already executed, ignore it!
          if (lastExecutedTranscriptRef.current === normalizedTranscript) {
              return;
          }

          // Debounce execution by 600ms to allow interim results to settle (e.g. "1" -> "14" or "14" -> "14 score")
          if (voiceCommandTimeoutRef.current) clearTimeout(voiceCommandTimeoutRef.current);
          
          voiceCommandTimeoutRef.current = setTimeout(() => {
              lastExecutedTranscriptRef.current = normalizedTranscript;
              const cmd = matchedCmd;
              
              setVoiceFeedback(`Heard: "${cmd.text}" ✓`);
              setVoiceRecognizedAction(cmd.action);
              setVoiceRecognizedPlayer(cmd.player);

              if (cmd.action === 'Opponent Point') {
                  handleStatRecord('Opponent Point');
              } else if (cmd.action === 'PlayerSelect') {
                  handlePlayerSelect(cmd.player);
              } else {
                  // For combined commands like "14 score", ensure the player is selected first to log the pass!
                  if (cmd.player) {
                      handlePlayerSelect(cmd.player);
                      // Slight delay to allow React state to process the chain
                      setTimeout(() => handleStatRecord(cmd.action, cmd.player), 100);
                  } else {
                      handleStatRecord(cmd.action);
                  }
              }
              
              setTimeout(() => {
                setVoiceRecognizedAction(null);
                setVoiceRecognizedPlayer(null);
              }, 500);
          }, 600);
      } else {
         setVoiceFeedback(`Heard: "${fullTranscript}" (No match)`);
      }
    };

    recognition.onerror = (event) => {
      if (event.error !== 'no-speech' && event.error !== 'no-match' && event.error !== 'aborted') {
         setVoiceFeedback(`Mic error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      if (isVoiceEnabled && isTrackingActive && recognitionRef.current) {
        setTimeout(() => {
           try {
             executedCommandsCountRef.current = {}; // Reset counts on hard restart
             if (recognitionRef.current) recognitionRef.current.start();
           } catch(e) {
             // Ignore already started errors
           }
        }, 250);
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setVoiceFeedback("Listening...");
    } catch (e) {
      console.error("Failed to start speech recognition", e);
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        try { recognitionRef.current.abort(); } catch(e) {}
        recognitionRef.current = null;
      }
    };
  }, [isVoiceEnabled, isTrackingActive, activeLineup, possessionChain]);

  const handleUndo = async () => {
    if (!currentGame) return;
    setIsSaving(true);
    try {
      const lastStat = await fetchLastStatForGame(currentGame, targetTeamId);
      if (!lastStat) {
        alert("No recent actions found to undo for this game.");
        return;
      }
      
      const isPoint = lastStat.stat_type === 'Point' || lastStat.stat_type === 'Opponent Point';
      if (isPoint) {
        if (!window.confirm(`Are you sure you want to undo this ${lastStat.stat_type}?`)) return;
      }
      
      await deleteStat(lastStat.id);
      
      // If we just undid a turnover, opponent point, or point, the system likely logged a "Pass" or "Pass Attempt" 
      // immediately before it for the previous player. We need to delete that too to fully revert the action.
      if (['Drop', 'Throwaway', 'Stall Out', 'Opponent Point', 'Point'].includes(lastStat.stat_type)) {
        const nextLast = await fetchLastStatForGame(currentGame, targetTeamId);
        if (nextLast && (nextLast.stat_type === 'Pass Attempt' || nextLast.stat_type === 'Pass')) {
           // Ensure it has the same point number to be safe
           if (nextLast.point_number === lastStat.point_number) {
             await deleteStat(nextLast.id);
           }
        }
      }
      
      if (lastStat.stat_type === 'Pass') {
         setPossessionChain(prev => prev.slice(0, -1));
      } else if (['Drop', 'Throwaway', 'Stall Out', 'Opponent Point', 'Point', 'Defence'].includes(lastStat.stat_type)) {
         if (previousChain && previousChain.length > 0) {
           setPossessionChain(previousChain);
         }
      } else if (lastStat.stat_type === 'Opponent Turnover') {
         setPossessionChain([]);
      }
      
      setLastSaved(isPoint ? 'Point Undone' : 'Action Undone');
    } catch (error) {
      console.error('Undo failed:', error);
      alert('Failed to undo action.');
    } finally {
      setIsSaving(false);
    }
  };

  const getActionClass = (baseClass, actionName) => {
    const isVoiceGlow = voiceRecognizedAction === actionName;
    return `${baseClass} ${isVoiceGlow ? '!ring-4 !ring-emerald-400 !scale-105 shadow-[0_0_30px_rgba(52,211,153,0.8)] z-50 transition-all duration-300' : ''}`;
  };

  const getPlayerClass = (player) => {
    const isCurrentHolder = possessionChain.length > 0 && possessionChain[possessionChain.length - 1] === player;
    const isPendingPasser = possessionChain.length > 1 && possessionChain[possessionChain.length - 2] === player;
    const isVoiceGlow = voiceRecognizedPlayer === player;
    
    if (isVoiceGlow) {
      return 'bg-emerald-500 text-white shadow-[0_0_30px_rgba(52,211,153,0.8)] ring-4 ring-emerald-400 scale-110 z-50 transition-all duration-300';
    }
    if (isVoiceEnabled) {
      return 'bg-slate-900 text-slate-500 border border-slate-800 opacity-50 cursor-not-allowed transition-all';
    }
    if (callahanModeFor === player) {
      return 'bg-gradient-to-br from-indigo-600 to-rose-600 text-white shadow-[0_0_25px_rgba(225,29,72,0.7)] ring-4 ring-rose-500 scale-105 z-30 transition-all relative animate-pulse';
    }
    if (isCurrentHolder) {
      // Current holder glow
      return 'bg-indigo-600 text-white shadow-[0_0_20px_rgba(79,70,229,0.7)] ring-4 ring-indigo-400 scale-105 z-20 transition-all relative';
    }
    if (isPendingPasser) {
      // Subtle active state for pending passer
      return 'bg-indigo-900/80 text-indigo-200 border border-indigo-500/50 scale-100 z-10 transition-all shadow-[0_0_10px_rgba(79,70,229,0.2)]';
    }
    return 'bg-slate-900 text-slate-300 border border-slate-700 hover:bg-slate-700 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105';
  };

  return (
    <>
      {/* Visual Feedback Flash Overlay */}
      <div 
        className={`pointer-events-none fixed inset-0 z-[100] transition-colors duration-200 ${
          flashType === 'success' ? 'bg-emerald-500/20' :
          flashType === 'error' ? 'bg-rose-600/30' :
          flashType === 'neutral' ? 'bg-cyan-500/10' :
          'bg-transparent'
        }`}
      />
      
      <div className="flex flex-col items-center px-1 pt-1 w-full max-h-[calc(100dvh-140px)] sm:max-h-[calc(100dvh-95px)]">
        <div className="flex flex-col w-full max-w-xl mx-auto bg-slate-800/80 backdrop-blur-xl rounded-2xl border border-slate-700 shadow-2xl overflow-hidden relative max-h-full">
        
        {/* Scoreboard Header Section (Original Full-Size Layout) */}
        <div className="p-2 sm:p-4 bg-slate-900 border-b border-slate-700/50 shrink-0">
          <div className="flex items-center justify-between bg-slate-950/50 rounded-xl border border-white/5 shadow-inner p-2 sm:p-4">
             {/* Left Column: Us */}
             <div className="flex flex-col items-start w-1/3">
                <span className="text-slate-500 text-[10px] sm:text-xs font-bold uppercase tracking-widest truncate w-full">{currentTeam}</span>
                <div className={`text-4xl sm:text-5xl font-black font-mono tracking-tighter ${score.us > score.them ? 'text-indigo-400 drop-shadow-[0_0_15px_rgba(129,140,248,0.5)]' : 'text-slate-300'}`}>{score.us}</div>
             </div>

             {/* Center Column: Point & O/D */}
             <div className="flex flex-col items-center justify-center w-1/3 px-2">
                <div className="flex items-center justify-center gap-3">
                  <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-sm sm:text-base font-black shadow-lg ${currentOD === 'O' ? 'bg-indigo-600 text-white ring-2 ring-indigo-400/50' : 'bg-rose-600 text-white ring-2 ring-rose-400/50'}`}>
                    {currentOD}
                  </div>
                </div>
                <div className="mt-2 text-slate-400 text-[10px] sm:text-xs font-bold uppercase tracking-widest whitespace-nowrap">Point {currentPoint}</div>
             </div>

             {/* Right Column: Them */}
             <div className="flex flex-col items-end w-1/3 text-right">
                <span className="text-slate-500 text-[10px] sm:text-xs font-bold uppercase tracking-widest truncate w-full text-right">{liveOpponentName}</span>
                <div className={`text-4xl sm:text-5xl font-black font-mono tracking-tighter ${score.them > score.us ? 'text-rose-400 drop-shadow-[0_0_15px_rgba(244,63,94,0.5)]' : 'text-slate-300'}`}>{score.them}</div>
             </div>
          </div>
        </div>

        {/* On-Pitch Player Section */}
        <div className="flex flex-col p-2 min-h-0 overflow-y-auto relative bg-slate-800">
           <div className="flex items-center px-1 mb-1 shrink-0 gap-3">
              <span className="text-[11px] sm:text-xs uppercase font-bold text-slate-400 tracking-wider whitespace-nowrap">On Pitch ({activeLineup.length})</span>
              <div className="flex-1 overflow-hidden">
                  {isSaving && <span className="text-amber-400 text-[10px] font-bold animate-pulse truncate block text-left">Synchronizing...</span>}
                  {lastSaved && !isSaving && <span className="text-emerald-400 text-[10px] font-bold truncate block text-left">✓ {lastSaved}</span>}
              </div>
           </div>
           
           <div className="w-full">
            {activeLineup.length === 0 ? (
              <div className="bg-slate-900/50 border border-slate-700 p-6 rounded-2xl text-center mt-4">
                <p className="text-slate-400 font-medium mb-4">No active players on the pitch.</p>
                <button 
                  onClick={() => onNavigate('lineup')}
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all text-sm"
                >
                  Select Lineup
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 h-full content-start pb-2">
                {activeLineup.map((player, index) => {
                  const isHolder = possessionChain.length > 0 && possessionChain[possessionChain.length - 1] === player;
                  return (
                  <button
                    key={player}
                    onClick={() => handlePlayerSelect(player)}
                    disabled={isSaving || isVoiceEnabled}
                    className={`flex flex-col items-center justify-center rounded-xl p-1 sm:p-2 h-[95px] sm:h-24 min-w-0 ${getPlayerClass(player)} ${index === 6 && activeLineup.length === 7 ? 'col-start-2 sm:col-start-auto' : ''}`}
                  >
                     {players?.find(p => p.name === player)?.shirt_number ? (
                        <div className="relative flex flex-col items-center justify-center w-full">
                          <span className="text-4xl sm:text-5xl font-black mb-1 shrink-0 relative">
                            {players.find(p => p.name === player).shirt_number}
                            {isHolder && <span className="absolute -top-3 -right-6 sm:-right-8 text-xl sm:text-2xl animate-bounce drop-shadow-md z-30">🥏</span>}
                          </span>
                          <span className="text-xs sm:text-sm font-bold uppercase truncate w-full px-1 leading-tight text-center">{player}</span>
                        </div>
                     ) : (
                        <div className="relative flex flex-col items-center justify-center w-full">
                           <span className="text-xl sm:text-2xl font-bold px-1 text-center truncate w-full leading-tight relative">
                             {player}
                             {isHolder && <span className="absolute -top-4 -right-4 sm:-right-6 text-lg sm:text-xl animate-bounce drop-shadow-md z-30">🥏</span>}
                           </span>
                        </div>
                     )}
                  </button>
                  );
                })}
              </div>
            )}
           </div>

          {isVoiceEnabled && (
            <div className="absolute top-2 right-2 text-right bg-slate-900/90 rounded border border-slate-700 px-2 py-1 z-50 pointer-events-none">
               <p className={`text-[10px] font-mono tracking-widest uppercase transition-all duration-300 ${voiceFeedback.includes('✓') ? 'text-emerald-400 font-bold scale-105' : 'text-slate-500'}`}>
                  {voiceFeedback || 'Mic Active...'}
               </p>
            </div>
          )}
        </div>

        {/* Scoring Actions Section */}
        <div className="px-3 pt-3 shrink-0 border-t border-slate-700/50 pb-1 bg-slate-900 relative">
           {/* Primary Scores */}
           <div className="grid grid-cols-2 gap-3 mb-3">
              <button
                onClick={() => handleStatRecord('Point')}
                disabled={isSaving || activeLineup.length === 0 || !isTrackingActive || possessionChain.length === 0 || isVoiceEnabled}
                className={getActionClass("flex items-center justify-center h-14 sm:h-16 rounded-xl font-black text-xl sm:text-2xl text-white bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] transition-all shadow-md disabled:opacity-50 tracking-tight", 'Point')}
              >
                WE SCORED
              </button>
              <button
                onClick={() => handleStatRecord('Opponent Point')}
                disabled={isSaving || activeLineup.length === 0 || !isTrackingActive || isVoiceEnabled || (possessionChain.length > 0 && callahanModeFor === null)}
                className={getActionClass("flex items-center justify-center h-14 sm:h-16 rounded-xl font-black text-xl sm:text-2xl text-white bg-rose-700 hover:bg-rose-600 active:scale-[0.98] transition-all shadow-md disabled:opacity-50 tracking-tight", 'Opponent Point')}
              >
                THEY SCORED
              </button>
           </div>
           
           {/* Secondary Actions */}
           <div className="grid grid-cols-4 gap-2">
              <button
                onClick={() => handleStatRecord('Drop')}
                disabled={isSaving || activeLineup.length === 0 || !isTrackingActive || possessionChain.length === 0 || isVoiceEnabled}
                className={getActionClass("h-14 sm:h-16 bg-slate-700 text-white text-[11px] sm:text-xs font-bold rounded-lg uppercase tracking-tighter active:scale-95 disabled:opacity-50 flex items-center justify-center", 'Drop')}
              >
                Drop
              </button>
              <button
                onClick={() => handleStatRecord('Throwaway')}
                disabled={isSaving || activeLineup.length === 0 || !isTrackingActive || possessionChain.length === 0 || isVoiceEnabled}
                className={getActionClass("h-14 sm:h-16 bg-slate-700 text-white text-[11px] sm:text-xs font-bold rounded-lg uppercase tracking-tighter active:scale-95 disabled:opacity-50 flex items-center justify-center", 'Throwaway')}
              >
                Incomplete
              </button>
              <button
                onClick={() => handleStatRecord('Stall Out')}
                disabled={isSaving || activeLineup.length === 0 || !isTrackingActive || possessionChain.length === 0 || isVoiceEnabled}
                className={getActionClass("h-14 sm:h-16 bg-slate-700 text-white text-[11px] sm:text-xs font-bold rounded-lg uppercase tracking-tighter active:scale-95 disabled:opacity-50 flex items-center justify-center", 'Stall Out')}
              >
                Stall Out
              </button>
              <button
                onClick={() => handleStatRecord('Defence')}
                disabled={isSaving || activeLineup.length === 0 || !isTrackingActive || possessionChain.length === 0 || isVoiceEnabled}
                className={getActionClass("h-14 sm:h-16 bg-orange-600 hover:bg-orange-500 text-white text-[11px] sm:text-xs font-bold rounded-lg uppercase tracking-tighter active:scale-95 disabled:opacity-50 flex items-center justify-center", 'Defence')}
              >
                Defence
              </button>
           </div>
        </div>

        {/* Footer Actions */}
        <div className="shrink-0 p-2 border-t border-slate-800 bg-slate-950 grid grid-cols-3 gap-2">
            <button
              onClick={() => {
                if (!isVoiceBeta) {
                  return alert("Voice Pro is temporarily disabled for iOS compatibility updates. Beta access required.");
                }
                if (!isVoiceEnabled) {
                  if (!isPro) {
                    return alert("Voice Pro is exclusively available on the Coach Pro Tier.");
                  }
                  // Only check for shirt numbers if turning ON
                  const missingNumbers = players.filter(p => activeLineup.includes(p.name) && !p.shirt_number);
                  if (missingNumbers.length > 0) {
                    return alert(`Voice tracking requires every active player to have a shirt number. Please add numbers for: ${missingNumbers.map(p => p.name).join(', ')}`);
                  }
                }
                setIsVoiceEnabled(!isVoiceEnabled);
              }}
              className={`flex flex-col items-center justify-center py-2 rounded-xl transition-all ${
                isVoiceEnabled
                  ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-[0_0_10px_rgba(245,158,11,0.4)]'
                  : (!isPro || !isVoiceBeta)
                    ? 'bg-slate-800 text-slate-600 border border-slate-700/30 cursor-not-allowed opacity-50'
                    : 'bg-slate-800 text-slate-400 hover:text-amber-400 border border-slate-700/50'
              }`}
            >
              {isVoiceEnabled ? <Mic className="w-4 h-4 mb-0.5" /> : <MicOff className="w-4 h-4 mb-0.5" />}
              <span className="text-[9px] font-bold uppercase tracking-widest">Voice Pro</span>
            </button>
            <button
              onClick={handleUndo}
              disabled={isSaving || !currentGame}
              className="flex flex-col items-center justify-center py-2 rounded-xl transition-all bg-slate-800 text-slate-400 hover:text-white border border-slate-700/50 disabled:opacity-50"
            >
              <Undo2 className="w-4 h-4 mb-0.5" />
              <span className="text-[9px] font-bold uppercase tracking-widest">Undo Action</span>
            </button>
            <button
              onClick={() => onNavigate('lineup')}
              disabled={isSaving || !currentGame || !isTrackingActive}
              className="flex flex-col items-center justify-center py-2 rounded-xl transition-all bg-slate-800 text-slate-400 hover:text-white border border-slate-700/50 disabled:opacity-50"
            >
              <ArrowLeftRight className="w-4 h-4 mb-0.5" />
              <span className="text-[9px] font-bold uppercase tracking-widest">{gameType === 'training' ? 'End' : 'Substitute'}</span>
            </button>
        </div>

      </div>
      </div>
    </>
  );
};

export default Dashboard;
