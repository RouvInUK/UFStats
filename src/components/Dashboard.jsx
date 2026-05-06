import { useState, useEffect, useRef } from 'react';
import { recordStatToDB, fetchActiveGames, clearActiveLineup, fetchLastStatForGame, deleteStat, fetchGameStats } from '../supabaseClient';
import { Undo2, ArrowLeftRight, Mic, MicOff } from 'lucide-react';
import Fuse from 'fuse.js';
import { playChime, playClick, playBuzz } from '../utils/audioFeedback';

const Dashboard = ({ activeLineup, currentPoint, setCurrentPoint, currentGame, gameType, currentTeam, targetTeamId, opponentName, initialPossession, isTrackingActive, setIsTrackingActive, onNavigate, players, setPlayers, isVoiceEnabled, setIsVoiceEnabled }) => {
  const [selectedPlayer, setSelectedPlayer] = useState('');
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
          let oppName = opponentName || 'Opponent';

          const chronStats = [...stats].reverse();
          chronStats.forEach(stat => {
              if (stat.stat_type === 'Start Offense') od = 'O';
              if (stat.stat_type === 'Start Defense') od = 'D';
              if (stat.stat_type === 'Half Time') od = od === 'O' ? 'D' : 'O';
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

  useEffect(() => {
    const matchedGame = activeGames.find(g => g.name === currentGame);
    if (matchedGame && matchedGame.maxPoint) {
      setCurrentPoint(matchedGame.maxPoint);
    }
  }, [currentGame, activeGames, setCurrentPoint]);

  useEffect(() => {
    if (activeLineup.length > 0 && !activeLineup.includes(selectedPlayer)) {
      setSelectedPlayer(activeLineup[0]);
    } else if (activeLineup.length === 0) {
      setSelectedPlayer('');
    }
  }, [activeLineup, selectedPlayer]);

  const handleStatRecord = async (statType, overridePlayer = null) => {
    const activePlayer = overridePlayer || selectedPlayer;
    if (statType !== 'Opponent Point' && !activePlayer) return alert("Select a player first!");
    
    setIsSaving(true);
    setLastSaved(null);
    try {
      const pObj = players?.find(p => p.name === activePlayer);
      const dbPlayer = pObj?.shirt_number ? `${activePlayer} ${pObj.shirt_number}` : activePlayer;
      
      const statData = {
        player: statType === 'Opponent Point' ? 'Opponent' : dbPlayer,
        stat: statType,
        timestamp: new Date().toLocaleString(),
        pointNumber: currentPoint,
        gameName: currentGame,
        gameType: gameType,
        teamName: currentTeam,
      };
      await recordStatToDB(statData, targetTeamId);
      setLastSaved(statType === 'Opponent Point' ? `Saved Opponent Point` : `Saved ${statType} for ${activePlayer}`);
      
      if (statType === 'Point' || statType === 'Opponent Point') {
        setIsTrackingActive(false);
        clearActiveLineup(targetTeamId).catch(console.error);
        if (players && setPlayers) {
            setPlayers(players.map(p => ({ ...p, is_active: false })));
        }
        setTimeout(() => {
          onNavigate('lineup');
        }, 1000);
      }

      if (statType === 'Point') {
        triggerFeedback('success');
      } else if (['Throwaway', 'Drop', 'Stall Out', 'Opponent Point'].includes(statType)) {
        triggerFeedback('error');
      } else {
        triggerFeedback('neutral');
      }
    } catch (error) {
      console.error('Save failed:', error);
      alert('Failed to save. Check server logs.');
    } finally {
      setIsSaving(false);
    }
  };

  // Voice Tracking Engine
  // Add a ref to lock out duplicates
  const lastActionTimeRef = useRef(0);

  useEffect(() => {
    if (!isVoiceEnabled || !isTrackingActive) {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      setVoiceFeedback('');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const SpeechGrammarList = window.SpeechGrammarList || window.webkitSpeechGrammarList;
    if (!SpeechRecognition) {
      setVoiceFeedback("Voice tracking not supported on this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false; // Must be false so it doesn't create run-on sentences
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    // 1. Generate Dictionary of expected exact commands
    const expectedCommands = [];
    const activeObjects = activeLineup.map(name => players?.find(p => p.name === name)).filter(Boolean);
    
    activeObjects.forEach(player => {
        if (player.shirt_number != null && player.shirt_number !== '') {
           const num = String(player.shirt_number).toLowerCase();
           expectedCommands.push({ text: `${num} pass`, action: 'Pass', player: player.name });
           expectedCommands.push({ text: `${num} score`, action: 'Point', player: player.name });
           expectedCommands.push({ text: `${num} drop`, action: 'Drop', player: player.name });
           expectedCommands.push({ text: `${num} throwaway`, action: 'Throwaway', player: player.name });
           expectedCommands.push({ text: `${num} stall out`, action: 'Stall Out', player: player.name });
           expectedCommands.push({ text: `${num} defence`, action: 'Defence', player: player.name });
        }
    });
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
      'eight': '8', 'ate': '8', 'hate': '8', 'hey': '8', 'late': '8', 'great': '8', 'weight': '8', 'wait': '8', 'straight': '8', 'state': '8', 'rate': '8', 'mate': '8', 'gate': '8', 'date': '8', 'fate': '8',
      'nine': '9', 'nein': '9', 'line': '9', 'mine': '9', 'fine': '9', 'dine': '9', 'wine': '9', 'sign': '9', 'shine': '9', 'spine': '9', 'pine': '9', 'vine': '9', 'rhyme': '9', 'time': '9', 'dime': '9', 'chime': '9', 'climb': '9', 'crime': '9', 'prime': '9', 'slime': '9',
      'ten': '10', 'tin': '10', 'pen': '10', 'then': '10', 'tan': '10', 'den': '10', 'ken': '10', 'men': '10', 'ben': '10', 'zen': '10', 'hen': '10', 'tent': '10', 'tenth': '10', 'can': '10', 'pan': '10', 'ran': '10', 'man': '10', 'fan': '10', 'van': '10',
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
      'stall': 'stall out', 'stalled': 'stall out', 'out': 'stall out'
    };

    recognition.onresult = (event) => {
      let transcript = event.results[event.results.length - 1][0].transcript.toLowerCase().trim();
      
      // Debounce lock (ignore if recognized something in the last 1500ms)
      if (Date.now() - lastActionTimeRef.current < 1500) {
          console.log("Ignored duplicate recognition:", transcript);
          return;
      }

      // Pre-process transcript with word map
      let normalizedTranscript = transcript;
      for (const [word, replacement] of Object.entries(wordMap)) {
         normalizedTranscript = normalizedTranscript.replace(new RegExp(`\\b${word}\\b`, 'g'), replacement);
      }
      
      // Handle currency edge cases where numbers are attached to symbols (e.g. "£28" -> "28 pass")
      normalizedTranscript = normalizedTranscript.replace(/£\s*(\d+)/g, '$1 pass').replace(/(\d+)\s*£/g, '$1 pass').replace(/£/g, ' pass ');

      // Require an action word to be present to prevent interim results (e.g. just "0") from prematurely triggering an action
      const validActions = ['pass', 'score', 'drop', 'throwaway', 'defence', 'stall out', 'point'];
      const hasAction = validActions.some(action => normalizedTranscript.includes(action));
      if (!hasAction) {
          return; // Wait for the rest of the sentence
      }

      // 4. Execute Fuzzy Search
      const results = fuse.search(normalizedTranscript);
      
      if (results.length > 0) {
         // Check if the match is good enough
         const bestMatch = results[0];
         if (bestMatch.score > 0.2) { // Extremely tight cutoff so mismatched numbers aren't logged to the wrong player
            setVoiceFeedback(`Heard: "${transcript}" (Poor match)`);
            return;
         }

         const cmd = bestMatch.item;
         lastActionTimeRef.current = Date.now(); // Lock
         
         if (cmd.action === 'Opponent Point') {
             setVoiceFeedback(`Heard: "Opponent Point" ✓`);
             setVoiceRecognizedAction('Opponent Point');
             playBuzz();
             handleStatRecord('Opponent Point');
             setTimeout(() => setVoiceRecognizedAction(null), 500);
             try { recognition.stop(); } catch(e) {} // Flush the buffer
             return;
         }

         // Standard action
         setVoiceFeedback(`Heard: "${cmd.text}" ✓`);
         setVoiceRecognizedAction(cmd.action);
         setVoiceRecognizedPlayer(cmd.player);
         
         if (['Point', 'Defence'].includes(cmd.action)) {
            playChime();
         } else if (cmd.action === 'Pass') {
            playClick();
         } else {
            playBuzz();
         }

         handleStatRecord(cmd.action, cmd.player);
         
         setTimeout(() => {
           setVoiceRecognizedAction(null);
           setVoiceRecognizedPlayer(null);
         }, 500);
         
         try { recognition.stop(); } catch(e) {} // Flush the buffer

      } else {
         setVoiceFeedback(`Heard: "${transcript}" (No match)`);
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
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, [isVoiceEnabled, isTrackingActive, activeLineup, selectedPlayer]);

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
        await deleteStat(lastStat.id);
        setLastSaved('Point Undone');
      } else {
        await deleteStat(lastStat.id);
        setLastSaved('Action Undone');
      }
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
    const isSelected = selectedPlayer === player;
    const isVoiceGlow = voiceRecognizedPlayer === player;
    
    if (isVoiceGlow) {
      return 'bg-emerald-500 text-white shadow-[0_0_30px_rgba(52,211,153,0.8)] ring-4 ring-emerald-400 scale-110 z-50 transition-all duration-300';
    }
    if (isVoiceEnabled) {
      return 'bg-slate-900 text-slate-500 border border-slate-800 opacity-50 cursor-not-allowed transition-all';
    }
    if (isSelected) {
      return 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(79,70,229,0.4)] ring-2 ring-indigo-400 scale-105 z-10 transition-all';
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
      
      <div className="flex flex-col items-center p-4 py-8 sm:py-12 min-h-screen">
      <div className="w-full max-w-xl bg-slate-800/80 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden border border-slate-700 pb-6">
        
        {/* Scoreboard Header Section */}
        <div className="p-6 sm:p-8 bg-slate-900 border-b border-slate-700/50">


          <div className="flex items-center justify-between bg-slate-950/50 rounded-2xl border border-white/5 shadow-inner p-4">
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
          
          <div className="flex justify-between items-center mt-4 h-6">
             <div className="flex-1">
                 {isSaving && <p className="text-amber-400 text-sm font-bold animate-pulse text-left">Synchronizing...</p>}
                 {lastSaved && !isSaving && <p className="text-emerald-400 text-sm font-bold text-left">✓ {lastSaved}</p>}
             </div>
          </div>
        </div>

        {/* Content Section */}
        <div className="p-6 sm:p-8 space-y-8">
          
          {/* Player Selection */}
          <div className="space-y-4">
            <label className="block text-sm font-semibold tracking-wide text-slate-300 uppercase">
              On Pitch ({activeLineup.length})
            </label>

            {activeLineup.length === 0 ? (
              <div className="bg-slate-900/50 border border-slate-700 p-6 rounded-2xl text-center">
                <p className="text-slate-400 font-medium mb-4">No active players on the pitch.</p>
                <button 
                  onClick={() => onNavigate('lineup')}
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all text-sm"
                >
                  Select Lineup
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {activeLineup.map((player) => (
                  <button
                    key={player}
                    onClick={() => setSelectedPlayer(player)}
                    disabled={isSaving || isVoiceEnabled}
                    className={`px-3 py-3 text-sm font-bold rounded-xl ${getPlayerClass(player)}`}
                  >
                    <span className="flex flex-col items-center">
                       <span>{player}</span>
                       {players?.find(p => p.name === player)?.shirt_number && (
                          <span className="opacity-70 font-mono text-xs">#{players.find(p => p.name === player).shirt_number}</span>
                       )}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Control Buttons */}
            {activeLineup.length > 0 && (
              <div className="flex justify-end gap-3 mt-4">
                <button
                  onClick={() => {
                    if (!isVoiceEnabled) {
                      const activeObjects = activeLineup.map(name => players?.find(p => p.name === name)).filter(Boolean);
                      const missingNumbers = activeObjects.filter(p => p.shirt_number == null || p.shirt_number === '');
                      if (missingNumbers.length > 0) {
                        return alert(`Voice tracking requires every active player to have a shirt number. Please add numbers for: ${missingNumbers.map(p => p.name).join(', ')}`);
                      }
                    }
                    setIsVoiceEnabled(!isVoiceEnabled);
                  }}
                  className={`w-full sm:w-auto py-3 px-6 flex items-center justify-center gap-2 font-extrabold rounded-xl transition-all ${
                    isVoiceEnabled
                      ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-[0_0_20px_rgba(245,158,11,0.4)] border border-transparent animate-pulse'
                      : 'border border-slate-700/50 text-slate-400 bg-slate-900 shadow-md hover:bg-slate-800 hover:text-amber-400'
                  }`}
                  title={isVoiceEnabled ? "Disable Voice Pro" : "Enable Voice Pro"}
                >
                  {isVoiceEnabled ? <Mic className="w-5 h-5 text-white" /> : <MicOff className="w-5 h-5" />}
                  <span className="sm:hidden">Voice Pro ★</span>
                  <span className="hidden sm:inline">Voice Pro ★</span>
                </button>
                <button
                  onClick={handleUndo}
                  disabled={isSaving || !currentGame}
                  className="w-full sm:w-auto py-3 px-6 flex items-center justify-center gap-2 font-bold rounded-xl transition-all border border-slate-700/50 text-slate-400 hover:text-white bg-slate-900 shadow-md hover:bg-slate-800"
                  title="Undo Last Action"
                >
                  <Undo2 className="w-5 h-5" />
                  <span className="sm:hidden">Undo Last Action</span>
                </button>
              </div>
            )}
          </div>

           {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-700/50">
            <div className="col-span-2 grid grid-cols-2 gap-4">
              <button
                onClick={() => handleStatRecord('Point')}
                disabled={isSaving || activeLineup.length === 0 || !isTrackingActive || !selectedPlayer || isVoiceEnabled}
                className={getActionClass("group relative flex items-center justify-center px-6 py-4 border border-transparent text-lg font-bold rounded-xl text-white bg-emerald-500 hover:bg-emerald-400 focus:outline-none active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_30px_rgba(16,185,129,0.3)] disabled:opacity-50 disabled:cursor-not-allowed", 'Point')}
              >
                Score
              </button>
              <button
                onClick={() => handleStatRecord('Pass')}
                disabled={isSaving || activeLineup.length === 0 || !isTrackingActive || !selectedPlayer || isVoiceEnabled}
                className={getActionClass("group relative flex items-center justify-center px-6 py-4 border border-transparent text-lg font-bold rounded-xl text-white bg-cyan-500 hover:bg-cyan-400 focus:outline-none active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(6,182,212,0.2)] hover:shadow-[0_0_30px_rgba(6,182,212,0.3)] disabled:opacity-50 disabled:cursor-not-allowed", 'Pass')}
              >
                Pass
              </button>
            </div>
            
            <button
              onClick={() => handleStatRecord('Opponent Point')}
              disabled={isSaving || activeLineup.length === 0 || !isTrackingActive || isVoiceEnabled}
              className={getActionClass("group relative flex items-center justify-center px-6 py-4 border border-transparent text-lg font-bold rounded-xl text-white bg-rose-700 hover:bg-rose-600 focus:outline-none active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(225,29,72,0.2)] hover:shadow-[0_0_30px_rgba(225,29,72,0.3)] disabled:opacity-50 disabled:cursor-not-allowed", 'Opponent Point')}
            >
              Opponent Score
            </button>
            <button
              onClick={() => handleStatRecord('Throwaway')}
              disabled={isSaving || activeLineup.length === 0 || !isTrackingActive || !selectedPlayer || isVoiceEnabled}
              className={getActionClass("group relative flex items-center justify-center px-6 py-4 border border-transparent text-lg font-bold rounded-xl text-white bg-rose-500 hover:bg-rose-400 focus:outline-none active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(244,63,94,0.2)] hover:shadow-[0_0_30px_rgba(244,63,94,0.3)] disabled:opacity-50 disabled:cursor-not-allowed", 'Throwaway')}
            >
              Incomplete
            </button>
            <button
              onClick={() => handleStatRecord('Drop')}
              disabled={isSaving || activeLineup.length === 0 || !isTrackingActive || !selectedPlayer || isVoiceEnabled}
              className={getActionClass("group relative flex items-center justify-center px-6 py-4 border border-transparent text-lg font-bold rounded-xl text-white bg-rose-600 hover:bg-rose-500 focus:outline-none active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(225,29,72,0.2)] hover:shadow-[0_0_30px_rgba(225,29,72,0.3)] disabled:opacity-50 disabled:cursor-not-allowed", 'Drop')}
            >
              Drop
            </button>
            <button
              onClick={() => handleStatRecord('Stall Out')}
              disabled={isSaving || activeLineup.length === 0 || !isTrackingActive || !selectedPlayer || isVoiceEnabled}
              className={getActionClass("group relative flex items-center justify-center px-6 py-4 border border-transparent text-lg font-bold rounded-xl text-white bg-violet-600 hover:bg-violet-500 focus:outline-none active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(124,58,237,0.2)] hover:shadow-[0_0_30px_rgba(124,58,237,0.3)] disabled:opacity-50 disabled:cursor-not-allowed", 'Stall Out')}
            >
              Stall Out
            </button>
            <button
              onClick={() => handleStatRecord('Defence')}
              disabled={isSaving || activeLineup.length === 0 || !isTrackingActive || !selectedPlayer || isVoiceEnabled}
              className={getActionClass("group relative flex items-center justify-center px-6 py-4 border border-transparent text-lg font-bold rounded-xl text-white bg-orange-500 hover:bg-orange-400 focus:outline-none active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(249,115,22,0.2)] hover:shadow-[0_0_30px_rgba(249,115,22,0.3)] disabled:opacity-50 disabled:cursor-not-allowed", 'Defence')}
            >
              Defence
            </button>
          </div>

          {isVoiceEnabled && (
            <div className="pt-2 text-center h-6 flex items-center justify-center overflow-hidden">
               <p className={`text-xs font-mono tracking-widest uppercase transition-all duration-300 ${voiceFeedback.includes('✓') ? 'text-emerald-400 font-bold scale-105' : 'text-slate-500'}`}>
                  {voiceFeedback || 'Mic Active... Listening'}
               </p>
            </div>
          )}
          
          {/* Secondary Footer Action */}
          {activeLineup.length > 0 && (
            <div className="pt-2 pb-2 w-full">
              <button
                onClick={() => onNavigate('lineup')}
                disabled={isSaving || !currentGame || !isTrackingActive}
                className="w-full py-3.5 px-6 flex items-center justify-center gap-3 font-bold rounded-xl transition-all bg-transparent border border-white/20 backdrop-blur-sm text-slate-300 hover:bg-white/5 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowLeftRight className="w-5 h-5" />
                Substitution
              </button>
            </div>
          )}

        </div>
      </div>
      </div>
    </>
  );
};

export default Dashboard;
