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
}

type Difficulty = 'easy' | 'medium' | 'hard';

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

  // Advanced Features State
  const [history, setHistory] = useState<Board[]>([]);
  const [memos, setMemos] = useState<number[][][]>(
    Array(9).fill(null).map(() => Array(9).fill(null).map(() => []))
  );
  const [isMemoMode, setIsMemoMode] = useState(false);
  const [bestTimes, setBestTimes] = useState<BestTimes>(() => {
    const saved = localStorage.getItem('sudoku-best-times');
    try {
      return saved ? JSON.parse(saved) : { easy: null, medium: null, hard: null };
    } catch {
      return { easy: null, medium: null, hard: null };
    }
  });

  // Initialize game
  const startNewGame = useCallback((diff: Difficulty = 'medium', force = false) => {
    if (!force && isGameActive && userBoard.some((row, ri) => row.some((cell, ci) => cell !== initialBoard[ri][ci]))) {
      if (!confirm('Start a new game? Your current progress will be lost.')) return;
    }

    setTimeout(() => {
      setDifficulty(diff);
      setIsLoading(true);
      try {
        const { initial, solution } = generateSudoku(diff);
        setInitialBoard(initial.map(row => [...row]));
        setUserBoard(initial.map(row => [...row]));
        setSolution(solution);
        setMistakes(0);
        setTimer(0);
        setIsGameActive(true);
        setSelectedCell(null);
        setHistory([]);
        setMemos(Array(9).fill(null).map(() => Array(9).fill(null).map(() => [])));
        setIsLoading(false);
      } catch (error) {
        console.error('Error generating game:', error);
        setIsLoading(false);
      }
    }, 100);
  }, [isGameActive, userBoard, initialBoard]);

  useEffect(() => {
    if (!initialized.current) {
      startNewGame('medium', true);
      initialized.current = true;
    }
  }, [startNewGame]); // Only on mount

  // Timer logic
  useEffect(() => {
    let interval: number;
    if (isGameActive) {
      interval = setInterval(() => {
        setTimer(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isGameActive]);

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

        // Clear memos for this cell and related cells
        const newMemos = memos.map((r, ri) => r.map((c, ci) => {
            if (ri === row && ci === col) return [];
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

        // Check win condition
        const isComplete = newBoard.every((r, ri) => r.every((c, ci) => c === solution[ri][ci]));
        if (isComplete) {
          setIsGameActive(false);
          const currentBest = bestTimes[difficulty];
          if (currentBest === null || timer < currentBest) {
            const newBest = { ...bestTimes, [difficulty]: timer };
            setBestTimes(newBest);
            localStorage.setItem('sudoku-best-times', JSON.stringify(newBest));
            alert(`New Record! You solved the ${difficulty} Sudoku in ${formatTime(timer)}!`);
          } else {
            alert(`Congratulations! You solved the Sudoku in ${formatTime(timer)}!`);
          }
        }
      } else {
        // --- Feature 1: Shake cell on wrong input ---
        setShakingCell({ row, col });
        setTimeout(() => setShakingCell(null), 300);

        setMistakes(prev => prev + 1);
        if (mistakes + 1 >= 3) {
          setIsGameActive(false);
          alert('Game Over! You made 3 mistakes.');
        }
      }
    }
  }, [selectedCell, userBoard, initialBoard, solution, isGameActive, mistakes, isMemoMode, memos, bestTimes, difficulty, timer]);

  const undo = useCallback(() => {
    if (history.length === 0 || !isGameActive) return;
    const previousState = history[history.length - 1];
    setUserBoard(previousState);
    setHistory(prev => prev.slice(0, -1));
  }, [history, isGameActive]);

  const getHint = useCallback(() => {
    if (!isGameActive) return;
    
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
    // Clear memos for target
    setMemos(prev => prev.map((r, ri) => r.map((c, ci) => (ri === row && ci === col) ? [] : c)));
  }, [isGameActive, userBoard, selectedCell, solution]);

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
    if (col < 8) base += (col + 1) % 3 === 0 ? "border-r-[2px] border-white/20 " : "border-r-[1px] border-white/10 ";
    if (row < 8) base += (row + 1) % 3 === 0 ? "border-b-[2px] border-white/20 " : "border-b-[1px] border-white/10 ";

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

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-800 flex flex-col items-center pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))] px-4 font-sans select-none overflow-x-hidden text-white">
      {/* Header */}
      <div className="w-full max-w-md flex flex-col gap-4 mb-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-black text-white tracking-tighter uppercase italic drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">Sudoku</h1>
          <div className="flex gap-2 items-center">
             <div className="bg-white/10 backdrop-blur-md px-3 py-1 rounded-lg shadow-sm border border-white/20 text-xs font-bold text-white/70 uppercase">
                Best: <span className="text-white font-black">{formatTime(bestTimes[difficulty])}</span>
             </div>
             <div className="bg-white text-slate-900 px-3 py-1 rounded-lg shadow-[0_0_15px_rgba(255,255,255,0.4)] text-sm font-mono font-bold w-16 text-center">
                {formatTime(timer)}
             </div>
          </div>
        </div>
        
        <div className="flex justify-between items-center bg-white/10 backdrop-blur-md p-2 rounded-xl shadow-sm border border-white/20">
           <div className="flex items-center gap-2 ml-2">
             <div className={`w-2.5 h-2.5 rounded-full shadow-[0_0_8px_currentColor] ${difficulty === 'easy' ? 'bg-green-400 text-green-400' : difficulty === 'medium' ? 'bg-yellow-400 text-yellow-400' : 'bg-red-400 text-red-400'}`}></div>
             <span className="text-xs font-black uppercase text-white/80 tracking-widest">{difficulty}</span>
           </div>
           <div className="flex gap-2">
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-tighter">Mistakes</span>
              <span className={`text-sm font-black ${mistakes > 0 ? 'text-red-400' : 'text-white'}`}>{mistakes}/3</span>
           </div>
        </div>
      </div>

      {/* Grid */}
      <div className="bg-slate-900/60 backdrop-blur-xl rounded-xl shadow-2xl border-[2px] border-white/20 mb-6 overflow-hidden transform transition-all duration-300 ring-8 ring-white/5">
        <div className="grid grid-cols-9 bg-transparent">
          {userBoard.map((row, ri) => (
            row.map((cell, ci) => (
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
                          <span className={isMemoMode && selectedNumber === n ? 'text-blue-400' : 'text-white/30'}>
                            {n}
                          </span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="w-full max-w-md flex flex-col gap-6">
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
            className="flex flex-col items-center justify-center p-3 bg-white/5 backdrop-blur-md rounded-xl shadow-sm border-2 border-white/10 text-white/80 hover:bg-white/20 hover:border-white/30 transition-all active:scale-95"
          >
            <span className="text-xs font-black uppercase mb-1">Hint</span>
            <span className="text-[10px] uppercase font-bold">Help</span>
          </button>
        </div>

        {/* Number Pad */}
        <div className="grid grid-cols-9 gap-1.5">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <button
              key={num}
              onClick={() => handleNumberInput(num)}
              className="aspect-square flex items-center justify-center text-xl font-black bg-white/10 backdrop-blur-md border-2 border-white/5 rounded-lg text-white hover:bg-white hover:text-slate-950 active:scale-90 transition-all shadow-sm"
            >
              {num}
            </button>
          ))}
        </div>

        {/* New Game Buttons */}
        <div className="flex flex-col items-center gap-3 py-4 border-t border-white/10">
          <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Start New Game</span>
          <div className="flex gap-2 w-full">
            {(['easy', 'medium', 'hard'] as const).map((diff) => (
              <button
                key={diff}
                onClick={() => startNewGame(diff)}
                className={`flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-tighter shadow-lg active:scale-95 transition-all
                  ${diff === 'easy' ? 'bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500 hover:text-white' : 
                    diff === 'medium' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500 hover:text-white' : 
                    'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500 hover:text-white'}`}
              >
                {diff}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
