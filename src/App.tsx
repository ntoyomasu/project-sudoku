import { useState, useEffect, useCallback, useRef } from 'react';
import { generateSudoku, type Board } from './utils/sudokuLogic';

interface SelectedCell {
  row: number;
  col: number;
}

interface BestTimes {
  easy: number | null;
  medium: number | null;
  hard: number | null;
  'super-hard': number | null;
}

export type Difficulty = 'easy' | 'medium' | 'hard' | 'super-hard';
export type Theme = 'default' | 'ocean' | 'sunset' | 'cyber';

const LockIcon = ({ className = "w-3 h-3 inline-block" }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
    <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
  </svg>
);

function App() {
  const [initialBoard, setInitialBoard] = useState<Board>([]);
  const [userBoard, setUserBoard] = useState<Board>([]);
  const [solution, setSolution] = useState<Board>([]);
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);
  const initialized = useRef(false);
  const [mistakes, setMistakes] = useState(0);
  const [timer, setTimer] = useState(0);
  const [isGameActive, setIsGameActive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  
  // UI Effect State
  const [shakingCell, setShakingCell] = useState<{ row: number; col: number } | null>(null);
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
  const [flashingCells, setFlashingCells] = useState<Set<string>>(new Set());
  const [flashingNumber, setFlashingNumber] = useState<number | null>(null);

  const [gameMode, setGameMode] = useState<'classic' | 'time-attack'>('classic');
  const [isDaily, setIsDaily] = useState(false);
  const [timeEffect, setTimeEffect] = useState<{ type: 'plus' | 'minus'; value: number } | null>(null);

  const [history, setHistory] = useState<Board[]>([]);
  const [memos, setMemos] = useState<number[][][]>(
    Array(9).fill(null).map(() => Array(9).fill(null).map(() => []))
  );
  const [isMemoMode, setIsMemoMode] = useState(false);
  const [hintsUsed, setHintsUsed] = useState(0);
  const hintsLimit = 3;

  const [bestTimes, setBestTimes] = useState<BestTimes>(() => {
    const saved = localStorage.getItem('sudoku-best-times');
    const defaultTimes = { easy: null, medium: null, hard: null, 'super-hard': null };
    try {
      return saved ? { ...defaultTimes, ...JSON.parse(saved) } : defaultTimes;
    } catch {
      return defaultTimes;
    }
  });

  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('sudoku-theme');
    return (saved as Theme) || 'default';
  });

  useEffect(() => {
    localStorage.setItem('sudoku-theme', theme);
  }, [theme]);

  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);

  // Streaks & Stats
  const [stats, setStats] = useState(() => {
    const saved = localStorage.getItem('sudoku-stats');
    const defaultStats = { 
        gamesPlayed: 0, 
        gamesWon: 0, 
        currentStreak: 0, 
        lastWinDate: null as string | null,
        achievements: [] as string[],
        unlockedThemes: ['default'] as Theme[],
        superHardUnlocked: false,
        winsPerDifficulty: { easy: 0, medium: 0, hard: 0, 'super-hard': 0 }
    };
    try {
      return saved ? { ...defaultStats, ...JSON.parse(saved) } : defaultStats;
    } catch {
      return defaultStats;
    }
  });

  // Initialize game
  const startNewGame = useCallback((diff: Difficulty = 'medium', mode: 'classic' | 'time-attack' = 'classic', daily = false, force = false) => {
    // Only confirm if the game has progressed (timer > 0 AND boards differ)
    const hasProgressed = userBoard.some((row, ri) => row.some((cell, ci) => cell !== initialBoard[ri][ci]));
    if (!force && isGameActive && timer > 0 && hasProgressed) {
      if (!confirm('Start a new game? Your current progress will be lost.')) return;
    }

    setTimeout(() => {
      setDifficulty(diff);
      setGameMode(mode);
      setIsDaily(daily);
      setIsLoading(true);
      try {
        const seed = daily ? new Date().toISOString().split('T')[0] : undefined;
        const { initial, solution } = generateSudoku(diff, seed);
        
        setInitialBoard(initial.map(row => [...row]));
        setUserBoard(initial.map(row => [...row]));
        setSolution(solution);
        setMistakes(0);
        
        // Initial timer
        if (mode === 'time-attack') {
          const initialTime = diff === 'easy' ? 120 : diff === 'medium' ? 180 : 300;
          setTimer(initialTime);
        } else {
          setTimer(0);
        }
        
        setIsGameActive(true);
        setSelectedCell(null);
        setHistory([]);
        setMemos(Array(9).fill(null).map(() => Array(9).fill(null).map(() => [])));
        setHintsUsed(0);
        setIsLoading(false);
      } catch (error) {
        console.error('Error generating game:', error);
        setIsLoading(false);
      }
    }, 100);
  }, [isGameActive, userBoard, initialBoard, timer]);

  useEffect(() => {
    if (!initialized.current) {
      // Defer initialization slightly to avoid synchronous setState inside useEffect warning
      setTimeout(() => {
        const savedGame = localStorage.getItem('sudoku-current-game');
        if (savedGame) {
          try {
            const game = JSON.parse(savedGame);
            setInitialBoard(game.initialBoard);
            setUserBoard(game.userBoard);
            setSolution(game.solution);
            setMistakes(game.mistakes);
            setTimer(game.timer);
            setDifficulty(game.difficulty);
            setHistory(game.history || []);
            setMemos(game.memos || Array(9).fill(null).map(() => Array(9).fill(null).map(() => [])));
            setHintsUsed(game.hintsUsed || 0);
            setIsGameActive(true);
            setIsLoading(false);
            return;
          } catch (e) {
            console.error("Failed to load saved game", e);
          }
        }
        startNewGame('medium', 'classic', false, true);
      }, 0);
      initialized.current = true;
    }
  }, [startNewGame]);

  // Auto-save effect
  useEffect(() => {
    if (isGameActive && !isLoading) {
      const gameState = {
        initialBoard,
        userBoard,
        solution,
        mistakes,
        timer,
        difficulty,
        history,
        memos,
        hintsUsed
      };
      localStorage.setItem('sudoku-current-game', JSON.stringify(gameState));
    }
  }, [isGameActive, isLoading, initialBoard, userBoard, solution, mistakes, timer, difficulty, history, memos, hintsUsed]);

  // Timer logic
  useEffect(() => {
    let interval: number;
    if (isGameActive) {
      interval = setInterval(() => {
        if (gameMode === 'time-attack') {
          setTimer(prev => {
            if (prev <= 1) {
              setIsGameActive(false);
              alert('Time is up! Game Over.');
              return 0;
            }
            return prev - 1;
          });
        } else {
          setTimer(prev => prev + 1);
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isGameActive, gameMode]);

  const formatTime = (seconds: number | null) => {
    if (seconds === null) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCellClick = (row: number, col: number) => {
    setSelectedCell({ row, col });
  };

  const handleNumberInput = useCallback((num: number) => {
    if (!selectedCell || !isGameActive) return;
    const { row, col } = selectedCell;

    setSelectedNumber(num);

    if (initialBoard[row][col] !== null) return;

    if (isMemoMode) {
      // Memo Mode Logic
      if (userBoard[row][col] !== null) return; // Can't memo on filled cell
      const newMemos = [...memos];
      newMemos[row] = [...newMemos[row]];
      const cellMemos = [...newMemos[row][col]];

      if (cellMemos.includes(num)) {
        newMemos[row][col] = cellMemos.filter(n => n !== num);
      } else {
        newMemos[row][col] = [...cellMemos, num].sort();
      }
      setMemos(newMemos);
    } else {
      // Normal Input Logic
      if (userBoard[row][col] === num) return; // No change

      if (solution[row][col] === num) {
        // Save history before change
        setHistory(prev => [...prev, userBoard.map(r => [...r])]);

        const newBoard = userBoard.map((r, ri) => ri === row ? r.map((c, ci) => ci === col ? num : c) : [...r]);
        setUserBoard(newBoard);

        // Clear memos for this cell and related cells (row, col, block)
        const newMemos = memos.map((r, ri) => r.map((c, ci) => {
            if (ri === row && ci === col) return [];
            
            // If in same row, same col, or same 3x3 block, remove the num from memo
            const isSameRow = ri === row;
            const isSameCol = ci === col;
            const isSameBlock = Math.floor(ri / 3) === Math.floor(row / 3) && Math.floor(ci / 3) === Math.floor(col / 3);
            
            if (isSameRow || isSameCol || isSameBlock) {
              return c.filter(n => n !== num);
            }
            
            return c;
        }));
        setMemos(newMemos);

        // --- Feature 3: Flash completed row / col / block ---
        const completedCells = new Set<string>();
        if ([0,1,2,3,4,5,6,7,8].every(c => newBoard[row][c] !== null))
          [0,1,2,3,4,5,6,7,8].forEach(c => completedCells.add(`${row}-${c}`));
        if ([0,1,2,3,4,5,6,7,8].every(r => newBoard[r][col] !== null))
          [0,1,2,3,4,5,6,7,8].forEach(r => completedCells.add(`${r}-${col}`));
        const br = Math.floor(row / 3) * 3, bc = Math.floor(col / 3) * 3;
        if ([0,1,2].every(dr => [0,1,2].every(dc => newBoard[br+dr][bc+dc] !== null)))
          [0,1,2].forEach(dr => [0,1,2].forEach(dc => completedCells.add(`${br+dr}-${bc+dc}`)));
        if (completedCells.size > 0) {
          setFlashingCells(completedCells);
          setTimeout(() => setFlashingCells(new Set()), 600);
        }

        // --- Feature 4: Flash all cells of a number when all 9 are placed ---
        if (newBoard.flat().filter(c => c === num).length === 9) {
          setFlashingNumber(num);
          setTimeout(() => setFlashingNumber(null), 600);
        }

        // Time Attack Bonus
        if (gameMode === 'time-attack') {
          setTimer(prev => prev + 10);
          setTimeEffect({ type: 'plus', value: 10 });
          setTimeout(() => setTimeEffect(null), 1000);
        }

        // Check win condition
        const isComplete = newBoard.every((r, ri) => r.every((c, ci) => c === solution[ri][ci]));
        if (isComplete) {
          setIsGameActive(false);
          
          const currentBest = bestTimes[difficulty];
          // Stats for classic mode or time attack? usually classic.
          if (gameMode === 'classic') {
              if (currentBest === null || timer < currentBest) {
                const newBest = { ...bestTimes, [difficulty]: timer };
                setBestTimes(newBest);
                localStorage.setItem('sudoku-best-times', JSON.stringify(newBest));
                alert(`New Record! You solved the ${difficulty} Sudoku in ${formatTime(timer)}!`);
              } else {
                alert(`Congratulations! You solved the Sudoku in ${formatTime(timer)}!`);
              }
          } else {
              alert(`Congratulations! You completed the Time Attack with ${formatTime(timer)} remaining!`);
          }

          // Update overall stats & achievements
          const now = new Date();
          const today = now.toISOString().split('T')[0];
          const isNoMistake = mistakes === 0;
          const isSpeedy = (difficulty === 'easy' && timer < 180) || (difficulty === 'medium' && timer < 300) || (difficulty === 'hard' && timer < 600);
          
          const newAchievements = [...(stats.achievements || [])];
          if (isNoMistake && !newAchievements.includes('Perfect Game')) newAchievements.push('Perfect Game');
          if (isSpeedy && !newAchievements.includes('Speed Demon')) newAchievements.push('Speed Demon');
          if (difficulty === 'hard' && !newAchievements.includes('Sudoku Master')) newAchievements.push('Sudoku Master');
          if (isDaily && !newAchievements.includes('Daily Hero')) newAchievements.push('Daily Hero');

          const newWinsPerDifficulty = { ...stats.winsPerDifficulty, [difficulty]: (stats.winsPerDifficulty[difficulty] || 0) + 1 };
          const totalWins = stats.gamesWon + 1;
          const newUnlockedThemes = [...(stats.unlockedThemes || ['default'])];
          let superHardUnlocked = stats.superHardUnlocked || false;

          let unlockMessage = '';
          if (newWinsPerDifficulty.hard >= 3 && !superHardUnlocked) {
            superHardUnlocked = true;
            newAchievements.push('Super Hard Unlocked');
            unlockMessage += '\nUNLOCKED: SUPER HARD Difficulty! (Won 3 Hard games)';
          }
          if (totalWins >= 3 && !newUnlockedThemes.includes('ocean')) { newUnlockedThemes.push('ocean'); unlockMessage += '\nUNLOCKED: Ocean Theme! (Won 3 games)'; }
          if (totalWins >= 7 && !newUnlockedThemes.includes('sunset')) { newUnlockedThemes.push('sunset'); unlockMessage += '\nUNLOCKED: Sunset Theme! (Won 7 games)'; }

          const newCurrentStreak = stats.lastWinDate === today ? stats.currentStreak : 
                           (stats.lastWinDate === new Date(now.setDate(now.getDate() - 1)).toISOString().split('T')[0] ? stats.currentStreak + 1 : 1);

          if (newCurrentStreak >= 3 && !newUnlockedThemes.includes('cyber')) { newUnlockedThemes.push('cyber'); unlockMessage += '\nUNLOCKED: Cyber Theme! (3-day streak)'; }

          if (unlockMessage) {
            setTimeout(() => alert('Congratulations!' + unlockMessage), 500);
          }

          const newStats = {
            ...stats,
            gamesPlayed: stats.gamesPlayed + 1,
            gamesWon: totalWins,
            lastWinDate: today,
            currentStreak: newCurrentStreak,
            achievements: newAchievements,
            unlockedThemes: newUnlockedThemes,
            superHardUnlocked,
            winsPerDifficulty: newWinsPerDifficulty
          };
          setStats(newStats);
          localStorage.setItem('sudoku-stats', JSON.stringify(newStats));
        }
      } else {
        // --- Feature 1: Shake cell on wrong input & Haptic feedback ---
        setShakingCell({ row, col });
        if ('vibrate' in navigator) navigator.vibrate(200);
        setTimeout(() => setShakingCell(null), 350);

        // Time Attack Penalty
        if (gameMode === 'time-attack') {
          setTimer(prev => Math.max(0, prev - 30));
          setTimeEffect({ type: 'minus', value: 30 });
          setTimeout(() => setTimeEffect(null), 1000);
        }

        setMistakes(prev => prev + 1);
        if (mistakes + 1 >= 3) {
          setIsGameActive(false);
          alert('Game Over! You made 3 mistakes.');
        }
      }
    }
  }, [selectedCell, userBoard, initialBoard, solution, isGameActive, mistakes, isMemoMode, memos, bestTimes, difficulty, timer, stats, gameMode, isDaily]);

  const undo = useCallback(() => {
    if (history.length === 0 || !isGameActive) return;
    const previousState = history[history.length - 1];
    setUserBoard(previousState);
    setHistory(prev => prev.slice(0, -1));
  }, [history, isGameActive]);

  const getHint = useCallback(() => {
    if (!isGameActive || hintsUsed >= hintsLimit) return;
    
    // Find all empty cells
    const emptyCells: SelectedCell[] = [];
    userBoard.forEach((row, ri) => {
      row.forEach((cell, ci) => {
        if (cell === null) emptyCells.push({ row: ri, col: ci });
      });
    });

    if (emptyCells.length === 0) return;

    // Pick a random one or the selected one if empty
    let target = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    if (selectedCell && userBoard[selectedCell.row][selectedCell.col] === null) {
        target = selectedCell;
    }

    setHistory(prev => [...prev, userBoard.map(r => [...r])]);
    const { row, col } = target;
    const num = solution[row][col];
    
    setUserBoard(userBoard.map((r, ri) => ri === row ? r.map((c, ci) => ci === col ? num : c) : [...r]));
    setHintsUsed(prev => prev + 1);
    // Clear memos for target
    setMemos(prev => prev.map((r, ri) => r.map((c, ci) => (ri === row && ci === col) ? [] : c)));
  }, [isGameActive, userBoard, selectedCell, solution, hintsUsed, hintsLimit]);

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isGameActive) return;

      if (e.key >= '1' && e.key <= '9') {
        handleNumberInput(parseInt(e.key));
      } else if (e.key.startsWith('Arrow') && selectedCell) {
        let { row, col } = selectedCell;
        if (e.key === 'ArrowUp') row = (row + 8) % 9;
        if (e.key === 'ArrowDown') row = (row + 1) % 9;
        if (e.key === 'ArrowLeft') col = (col + 8) % 9;
        if (e.key === 'ArrowRight') col = (col + 1) % 9;
        setSelectedCell({ row, col });
      } else if (e.key.toLowerCase() === 'z' && (e.ctrlKey || e.metaKey)) {
        undo();
      } else if (e.key.toLowerCase() === 'n') {
        setIsMemoMode(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCell, isGameActive, handleNumberInput, undo]);

  const getCellClassName = (row: number, col: number) => {
    const isSelected = selectedCell?.row === row && selectedCell?.col === col;
    const isSameRow = selectedCell?.row === row;
    const isSameCol = selectedCell?.col === col;
    const isSameBlock =
      selectedCell &&
      Math.floor(selectedCell.row / 3) === Math.floor(row / 3) &&
      Math.floor(selectedCell.col / 3) === Math.floor(col / 3);

    const isInitial = initialBoard[row] && initialBoard[row][col] !== null;
    const isSameValue = selectedCell && userBoard[row][col] !== null && userBoard[row][col] === userBoard[selectedCell.row][selectedCell.col];

    // Feature 1: shake on wrong input
    const isShaking = shakingCell?.row === row && shakingCell?.col === col;
    // Feature 3 & 4: gold flash on completion
    const isFlashing =
      flashingCells.has(`${row}-${col}`) ||
      (flashingNumber !== null && userBoard[row][col] === flashingNumber);

    let base = "w-10 h-10 sm:w-14 sm:h-14 flex items-center justify-center text-2xl transition-all duration-150 cursor-pointer relative ";

    // Borders
    if (col < 8) base += (col + 1) % 3 === 0 ? "border-r-[2px] border-white/50 " : "border-r-[1px] border-white/15 ";
    if (row < 8) base += (row + 1) % 3 === 0 ? "border-b-[2px] border-white/50 " : "border-b-[1px] border-white/15 ";

    if (isSelected) {
      base += "bg-blue-600/90 text-white z-20 shadow-[0_0_20px_rgba(37,99,235,0.6)] ring-[2px] ring-white/60 ring-inset ";
    } else if (isSameValue && userBoard[row][col] !== null) {
      base += "bg-blue-400/30 ";
    } else if (isSameRow || isSameCol || isSameBlock) {
      base += "bg-white/5 ";
    } else {
      base += "bg-slate-900/40 hover:bg-white/10 ";
    }

    if (!isSelected) {
      base += isInitial ? "text-white font-black " : "text-cyan-400 font-bold ";
    }

    if (isShaking) base += "cell-shake ";
    if (isFlashing) base += "cell-flash ";

    return base;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-2xl font-bold text-slate-800 animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          Generating Sudoku...
        </div>
      </div>
    );
  }

  const themeClasses = {
    default: "from-slate-950 via-slate-900 to-slate-800",
    ocean: "from-blue-950 via-blue-900 to-sky-950",
    sunset: "from-orange-950 via-red-950 to-rose-950",
    cyber: "from-fuchsia-950 via-purple-950 to-indigo-950"
  };

  return (
    <div className={`min-h-screen bg-linear-to-br ${themeClasses[theme]} flex flex-col items-center pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(0.5rem+env(safe-area-inset-bottom))] px-4 font-sans select-none overflow-x-hidden text-white transition-colors duration-1000`}>
      {/* Header */}
      <div className="w-full max-w-md flex flex-col gap-3 mb-6 z-10">
        <div className="flex justify-between items-end gap-2">
            <h1 className="text-2xl font-black text-white tracking-tighter uppercase italic drop-shadow-[0_0_10px_rgba(255,255,255,0.3)] shrink-0 leading-none">Sudoku</h1>
            
            <div className="flex gap-1.5 items-center flex-wrap justify-end">
              <button 
                onClick={() => {
                  if (confirm('Unlock all features for testing?')) {
                    setStats({
                      ...stats,
                      gamesWon: 10,
                      currentStreak: 5,
                      superHardUnlocked: true,
                      unlockedThemes: ['default', 'ocean', 'sunset', 'cyber']
                    });
                    alert('All features unlocked!');
                  }
                }}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-orange-500/20 border border-orange-500/50 hover:bg-orange-500/40 transition-all active:scale-95"
              >
                <span className="text-[9px] font-black uppercase tracking-widest text-orange-400">Unlock</span>
              </button>

              <button 
                onClick={() => setIsThemeModalOpen(true)}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all active:scale-95"
              >
                <span className="text-[9px] font-black uppercase tracking-widest text-white/50">Theme</span>
              </button>

              <button 
                onClick={() => setIsStatsOpen(true)}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all active:scale-95"
              >
                <span className="text-[9px] font-black uppercase tracking-widest text-white/50">Stats</span>
              </button>
              
              <button 
                onClick={() => startNewGame('medium', 'classic', true)}
                className={`flex items-center gap-1 px-2 py-1.5 rounded-lg transition-all active:scale-95 ${isDaily ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400' : 'bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-white/50'}`}
              >
                <span className="text-[9px] font-black uppercase tracking-widest">Daily</span>
              </button>

              <div className="bg-white/10 backdrop-blur-md px-2 py-1.5 rounded-lg border border-white/20 text-[9px] font-black uppercase tracking-widest text-white/90 whitespace-nowrap min-w-[75px] text-center shadow-sm">
                 <span className="text-white/40 mr-1 italic">Best</span> {formatTime(bestTimes[difficulty])}
              </div>

              <div className={`px-2 py-1.5 rounded-lg shadow-[0_0_15px_rgba(255,255,255,0.3)] text-[10px] font-mono font-bold w-18 text-center relative transition-all duration-300 ${gameMode === 'time-attack' && timer < 30 ? 'bg-red-500 text-white animate-pulse scale-110' : 'bg-white text-slate-900'}`}>
                 {formatTime(timer)}
                 {timeEffect && (
                   <div className={`absolute -bottom-8 left-1/2 -translate-x-1/2 font-black text-xs animate-bounce pointer-events-none whitespace-nowrap drop-shadow-md ${timeEffect.type === 'plus' ? 'text-green-400' : 'text-red-400'}`}>
                     {timeEffect.type === 'plus' ? '+' : '-'}{timeEffect.value}s
                   </div>
                 )}
              </div>
            </div>
        </div>
        
        <div className="flex justify-between items-center bg-white/10 backdrop-blur-md p-2 rounded-xl shadow-sm border border-white/20">
           <div className="flex items-center gap-2 ml-2">
             <div className={`w-2.5 h-2.5 rounded-full shadow-[0_0_8px_currentColor] ${difficulty === 'easy' ? 'bg-green-400 text-green-400' : difficulty === 'medium' ? 'bg-yellow-400 text-yellow-400' : 'bg-red-400 text-red-400'}`}></div>
             <span className="text-xs font-black uppercase text-white/80 tracking-widest">{difficulty}</span>
             {gameMode === 'time-attack' && (
               <span className="text-[8px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 font-black uppercase ml-1">Time Attack</span>
             )}
             {isDaily && (
               <span className="text-[8px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 font-black uppercase ml-1">Daily</span>
             )}
           </div>
           <div className="flex gap-2">
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-tighter">Mistakes</span>
              <span className={`text-sm font-black ${mistakes > 0 ? 'text-red-400' : 'text-white'}`}>{mistakes}/3</span>
           </div>
        </div>
      </div>

      {/* Grid */}
      <div className="bg-slate-900/60 backdrop-blur-xl rounded-xl shadow-2xl border-2 border-white/50 mb-4 overflow-hidden transform transition-all duration-300 ring-8 ring-white/5">
        <div className="grid grid-cols-9 bg-transparent">
          {userBoard.map((row, ri) => (
            row.map((cell, ci) => {
              const activeNumber = selectedCell && userBoard[selectedCell.row][selectedCell.col] !== null 
                ? userBoard[selectedCell.row][selectedCell.col] 
                : (isMemoMode ? selectedNumber : null);
              
              return (
              <div
                key={`${ri}-${ci}`}
                className={getCellClassName(ri, ci)}
                onClick={() => handleCellClick(ri, ci)}
              >
                {cell !== null ? (
                  cell
                ) : (
                  <div className="grid grid-cols-3 grid-rows-3 w-full h-full p-0.5 pointer-events-none">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                      <div key={n} className="flex items-center justify-center text-[8px] sm:text-[10px] leading-none font-bold">
                        {memos[ri][ci].includes(n) ? (
                          <span className={activeNumber === n ? 'text-blue-400 font-black scale-110 shadow-[0_0_8px_rgba(96,165,250,0.5)]' : 'text-white/30 truncate'}>
                            {n}
                          </span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              );
            })
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="w-full max-w-md flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-3">
          <button 
            onClick={undo}
            disabled={history.length === 0}
            className="flex flex-col items-center justify-center p-3 bg-white/5 backdrop-blur-md rounded-xl shadow-sm border-2 border-white/10 text-white/80 hover:bg-white/20 hover:border-white/30 disabled:opacity-20 transition-all active:scale-95"
          >
            <span className="text-xs font-black uppercase mb-1">Undo</span>
            <span className="text-[10px] opacity-70">({history.length})</span>
          </button>
          
          <button 
            onClick={() => setIsMemoMode(!isMemoMode)}
            className={`flex flex-col items-center justify-center p-3 rounded-xl shadow-md border-2 transition-all active:scale-95 ${isMemoMode ? 'bg-white text-slate-900 border-white shadow-[0_0_15px_rgba(255,255,255,0.3)]' : 'bg-white/5 backdrop-blur-md border-white/10 text-white/80 hover:bg-white/20 hover:border-white/30'}`}
          >
            <span className="text-xs font-black uppercase mb-1">Notes</span>
            <span className="text-[10px] uppercase font-bold">{isMemoMode ? 'On' : 'Off'}</span>
          </button>
          
          <button 
            onClick={getHint}
            disabled={hintsUsed >= hintsLimit || !isGameActive}
            className="flex flex-col items-center justify-center p-3 bg-white/5 backdrop-blur-md rounded-xl shadow-sm border-2 border-white/10 text-white/80 hover:bg-white/20 hover:border-white/30 disabled:opacity-20 transition-all active:scale-95"
          >
            <span className="text-xs font-black uppercase mb-1 text-yellow-400">Hint</span>
            <span className="text-[10px] uppercase font-bold text-white/60">{hintsLimit - hintsUsed} Left</span>
          </button>
        </div>

        <div className="grid grid-cols-9 gap-1.5">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => {
            const isCompleted = userBoard.flat().filter(c => c === num).length === 9;
            return (
              <button
                key={num}
                onClick={() => handleNumberInput(num)}
                className={`aspect-square flex items-center justify-center text-xl font-black rounded-lg transition-all shadow-sm
                  ${isCompleted ? 'number-complete' : 'bg-white/10 backdrop-blur-md border-2 border-white/5 text-white hover:bg-white hover:text-slate-950 active:scale-90'}`}
              >
                {num}
              </button>
            );
          })}
        </div>

        {/* New Game Buttons */}
        <div className="flex flex-col items-center gap-2 pt-2 pb-1 border-t border-white/10">
          <div className="flex justify-between items-center w-full mb-1">
            <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Start New Game</span>
            <div className="flex gap-1 bg-white/5 rounded-lg p-1 border border-white/10">
                <button 
                  onClick={() => setGameMode('classic')}
                  className={`text-[8px] font-black uppercase px-2 py-1 rounded ${gameMode === 'classic' ? 'bg-white text-slate-900' : 'text-white/40 hover:text-white'}`}
                >
                  Classic
                </button>
                <button 
                  onClick={() => setGameMode('time-attack')}
                  className={`text-[8px] font-black uppercase px-2 py-1 rounded ${gameMode === 'time-attack' ? 'bg-red-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'text-white/40 hover:text-red-400'}`}
                >
                  Time Attack
                </button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full">
            {(['easy', 'medium', 'hard', 'super-hard'] as const).map((diff) => {
              const isSuper = diff === 'super-hard';
              const isLocked = isSuper && !stats.superHardUnlocked;
              
              return (
                <button
                  key={diff}
                  onClick={() => {
                    if (isLocked) {
                      alert('[LOCKED] SUPER HARD is locked!\nUnlock requirement: Win 3 games on Hard difficulty.');
                      return;
                    }
                    startNewGame(diff, gameMode);
                  }}
                  className={`relative py-2 rounded-xl font-black text-xs uppercase tracking-tighter shadow-lg transition-all
                    ${isLocked ? 'bg-slate-800/50 text-slate-500 border border-slate-700 pointer-events-auto' :
                      diff === 'easy' ? 'bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500 hover:text-white active:scale-95' : 
                      diff === 'medium' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500 hover:text-white active:scale-95' : 
                      diff === 'hard' ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500 hover:text-white active:scale-95' :
                      'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500 hover:text-white active:scale-95'}`}
                >
                  {isLocked && <div className="absolute -top-1.5 right-1 text-[8px]"><LockIcon className="w-3 h-3 text-slate-500" /></div>}
                  {diff.replace('-', ' ')}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Stats Modal */}
      {isStatsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md text-white">
          <div className="w-full max-w-sm bg-slate-900 border-2 border-white/20 rounded-2xl shadow-2xl p-6 relative overflow-hidden">
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl"></div>
            
            <div className="relative z-10">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black text-white tracking-tight uppercase italic drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">Statistics</h2>
                <button 
                  onClick={() => setIsStatsOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-white/5 p-4 rounded-xl border border-white/10 text-center">
                  <div className="text-[10px] font-bold text-white/40 uppercase mb-1">Won</div>
                  <div className="text-2xl font-black text-white">{stats.gamesWon}</div>
                </div>
                <div className="bg-white/5 p-4 rounded-xl border border-white/10 text-center">
                  <div className="text-[10px] font-bold text-white/40 uppercase mb-1">Streak</div>
                  <div className="text-2xl font-black text-blue-400">{stats.currentStreak}</div>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <div className="text-[10px] font-black text-white/30 uppercase tracking-widest pl-1 mb-2">Best Times</div>
                  <div className="space-y-2">
                    {(['easy', 'medium', 'hard', 'super-hard'] as const).map(diff => (
                      <div key={diff} className={`flex justify-between items-center px-3 py-2 rounded-lg border border-white/10 ${diff === 'super-hard' && !stats.superHardUnlocked ? 'bg-slate-900/50 opacity-50' : 'bg-white/5'}`}>
                        <span className="text-[10px] font-bold text-white/60 uppercase flex items-center gap-1">
                          {diff.replace('-', ' ')} {diff === 'super-hard' && !stats.superHardUnlocked && <LockIcon />}
                        </span>
                        <span className="text-xs font-mono font-bold text-white">
                          {diff === 'super-hard' && !stats.superHardUnlocked ? 'LOCKED' : formatTime(bestTimes[diff])}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-black text-white/30 uppercase tracking-widest pl-1 mb-2">Badges</div>
                  <div className="flex flex-wrap gap-2">
                    {stats.achievements && stats.achievements.length > 0 ? (
                      stats.achievements.map((badge: string) => (
                        <div key={badge} className="px-2 py-1 bg-blue-500/20 border border-blue-500/40 rounded-md text-[9px] font-black text-blue-300 uppercase">
                          {badge}
                        </div>
                      ))
                    ) : (
                      <div className="text-[10px] font-bold text-white/20 italic pl-1">No badges yet...</div>
                    )}
                  </div>
                </div>
              </div>

              <button 
                onClick={() => setIsStatsOpen(false)}
                className="w-full py-3 bg-white text-slate-900 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-colors shadow-[0_0_20px_rgba(255,255,255,0.2)]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Theme Modal */}
      {isThemeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md text-white">
          <div className="w-full max-w-sm bg-slate-900 border-2 border-white/20 rounded-2xl shadow-2xl p-6 relative overflow-hidden">
            <div className={`absolute -top-24 -right-24 w-48 h-48 rounded-full blur-3xl ${theme === 'cyber' ? 'bg-fuchsia-500/20' : theme === 'sunset' ? 'bg-orange-500/20' : theme === 'ocean' ? 'bg-sky-500/20' : 'bg-slate-500/20'}`}></div>
            
            <div className="relative z-10">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black text-white tracking-tight uppercase italic drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">Themes</h2>
                <button 
                  onClick={() => setIsThemeModalOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
                >
                  ✕
                </button>
              </div>
              
              <div className="grid grid-cols-2 gap-3 mb-6">
                {(['default', 'ocean', 'sunset', 'cyber'] as Theme[]).map(t => {
                  const isUnlocked = stats.unlockedThemes.includes(t);
                  return (
                    <button
                      key={t}
                      onClick={() => {
                        if (isUnlocked) setTheme(t);
                        else alert(`[LOCKED] Theme locked!\n\nUnlock conditions:\nOcean: Win 3 games total\nSunset: Win 7 games total\nCyber: Achieve a 3-day winning streak`);
                      }}
                      className={`p-4 rounded-xl border-2 transition-all text-left relative overflow-hidden ${theme === t ? 'border-white bg-white/10 shadow-[0_0_15px_rgba(255,255,255,0.3)]' : 'border-white/10 bg-white/5 hover:bg-white/10'} ${!isUnlocked && 'opacity-60 cursor-not-allowed'}`}
                    >
                      <div className={`absolute inset-0 opacity-20 bg-linear-to-br ${themeClasses[t]}`}></div>
                      {!isUnlocked && <div className="absolute top-2 right-2 text-xs"><LockIcon className="w-4 h-4 text-white/50" /></div>}
                      <div className="relative z-10 font-black uppercase text-[10px] tracking-widest text-white">{t}</div>
                    </button>
                  );
                })}
              </div>

              <button 
                onClick={() => setIsThemeModalOpen(false)}
                className="w-full py-3 bg-white text-slate-900 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-colors shadow-[0_0_20px_rgba(255,255,255,0.2)] active:scale-95"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

}

export default App;
