import { useState, useEffect, useCallback } from 'react';
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
  const [mistakes, setMistakes] = useState(0);
  const [timer, setTimer] = useState(0);
  const [isGameActive, setIsGameActive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  
  // Advanced Features State
  const [history, setHistory] = useState<Board[]>([]);
  const [memos, setMemos] = useState<number[][][]>(
    Array(9).fill(null).map(() => Array(9).fill(null).map(() => []))
  );
  const [isMemoMode, setIsMemoMode] = useState(false);
  const [bestTimes, setBestTimes] = useState<BestTimes>({ easy: null, medium: null, hard: null });

  // Load High Scores
  useEffect(() => {
    const saved = localStorage.getItem('sudoku-best-times');
    if (saved) {
      setBestTimes(JSON.parse(saved));
    }
  }, []);

  // Initialize game
  const startNewGame = useCallback((diff: Difficulty = 'medium', force = false) => {
    if (!force && isGameActive && userBoard.some((row, ri) => row.some((cell, ci) => cell !== initialBoard[ri][ci]))) {
      if (!confirm('Start a new game? Your current progress will be lost.')) return;
    }

    setDifficulty(diff);
    setIsLoading(true);
    
    setTimeout(() => {
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
    startNewGame('medium', true);
  }, []); // Only on mount

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
            // Optional: Auto-clear related memos if you want that feature
            return c;
        }));
        setMemos(newMemos);

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
        setMistakes(prev => prev + 1);
        if (mistakes + 1 >= 3) {
          setIsGameActive(false);
          alert('Game Over! You made 3 mistakes.');
        }
      }
    }
  }, [selectedCell, userBoard, initialBoard, solution, isGameActive, mistakes, isMemoMode, memos, bestTimes, difficulty, timer]);

  const undo = () => {
    if (history.length === 0 || !isGameActive) return;
    const previousState = history[history.length - 1];
    setUserBoard(previousState);
    setHistory(prev => prev.slice(0, -1));
  };

  const getHint = () => {
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
    setMemos(memos.map((r, ri) => r.map((c, ci) => (ri === row && ci === col) ? [] : c)));
  };

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
  }, [selectedCell, isGameActive, handleNumberInput]);

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

    let base = "w-10 h-10 sm:w-14 sm:h-14 flex items-center justify-center text-2xl transition-all duration-150 cursor-pointer relative ";
    
    if (col < 8) base += (col + 1) % 3 === 0 ? "border-r-4 border-slate-900 " : "border-r border-slate-200 ";
    if (row < 8) base += (row + 1) % 3 === 0 ? "border-b-4 border-slate-900 " : "border-b border-slate-200 ";

    if (isSelected) {
      base += "bg-blue-500 text-white z-10 scale-105 shadow-md ";
    } else if (isSameValue && userBoard[row][col] !== null) {
      base += "bg-blue-200 ";
    } else if (isSameRow || isSameCol || isSameBlock) {
      base += "bg-blue-50 ";
    } else {
      base += "bg-white hover:bg-slate-50 ";
    }

    if (!isSelected) {
      base += isInitial ? "text-slate-900 font-bold " : "text-blue-600 font-medium ";
    }

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
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-6 px-4 font-sans select-none overflow-x-hidden">
      {/* Header */}
      <div className="w-full max-w-md flex flex-col gap-4 mb-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic">Sudoku</h1>
          <div className="flex gap-2 items-center">
             <div className="bg-white px-3 py-1 rounded-lg shadow-sm border border-slate-200 text-xs font-bold text-slate-500 uppercase">
                Best: <span className="text-slate-900 font-black">{formatTime(bestTimes[difficulty])}</span>
             </div>
             <div className="bg-slate-900 text-white px-3 py-1 rounded-lg shadow-sm text-sm font-mono font-bold w-16 text-center">
                {formatTime(timer)}
             </div>
          </div>
        </div>
        
        <div className="flex justify-between items-center bg-white p-2 rounded-xl shadow-sm border border-slate-200">
           <div className="flex items-center gap-2 ml-2">
             <div className={`w-2 h-2 rounded-full ${difficulty === 'easy' ? 'bg-green-500' : difficulty === 'medium' ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
             <span className="text-xs font-black uppercase text-slate-600 tracking-widest">{difficulty}</span>
           </div>
           <div className="flex gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Mistakes</span>
              <span className={`text-sm font-black ${mistakes > 0 ? 'text-red-500' : 'text-slate-900'}`}>{mistakes}/3</span>
           </div>
        </div>
      </div>

      {/* Grid */}
      <div className="bg-white rounded-lg shadow-2xl border-4 border-slate-900 mb-6 overflow-hidden transform transition-all duration-300 ring-4 ring-slate-900/10">
        <div className="grid grid-cols-9 bg-white">
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
                      <div key={n} className="flex items-center justify-center text-[8px] sm:text-[10px] leading-none text-slate-400 font-bold">
                        {memos[ri][ci].includes(n) ? n : ''}
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
            className="flex flex-col items-center justify-center p-3 bg-white rounded-xl shadow-sm border-2 border-slate-100 text-slate-600 hover:border-blue-500 hover:text-blue-500 disabled:opacity-30 transition-all active:scale-95"
          >
            <span className="text-xs font-black uppercase mb-1">Undo</span>
            <span className="text-[10px] opacity-70">({history.length})</span>
          </button>
          
          <button 
            onClick={() => setIsMemoMode(!isMemoMode)}
            className={`flex flex-col items-center justify-center p-3 rounded-xl shadow-sm border-2 transition-all active:scale-95 ${isMemoMode ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-100 text-slate-600 hover:border-blue-500 hover:text-blue-500'}`}
          >
            <span className="text-xs font-black uppercase mb-1">Notes</span>
            <span className="text-[10px] uppercase font-bold">{isMemoMode ? 'On' : 'Off'}</span>
          </button>
          
          <button 
            onClick={getHint}
            className="flex flex-col items-center justify-center p-3 bg-white rounded-xl shadow-sm border-2 border-slate-100 text-slate-600 hover:border-blue-500 hover:text-blue-500 transition-all active:scale-95"
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
              className="aspect-square flex items-center justify-center text-xl font-black bg-white border-2 border-slate-100 rounded-lg text-slate-800 hover:bg-slate-900 hover:text-white hover:border-slate-900 active:scale-90 transition-all shadow-sm"
            >
              {num}
            </button>
          ))}
        </div>

        {/* New Game Buttons */}
        <div className="flex flex-col items-center gap-3 py-4 border-t border-slate-200">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Start New Game</span>
          <div className="flex gap-2 w-full">
            {(['easy', 'medium', 'hard'] as const).map((diff) => (
              <button
                key={diff}
                onClick={() => startNewGame(diff)}
                className={`flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-tighter shadow-md active:scale-95 transition-all
                  ${diff === 'easy' ? 'bg-green-100 text-green-700 hover:bg-green-600 hover:text-white' : 
                    diff === 'medium' ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-600 hover:text-white' : 
                    'bg-red-100 text-red-700 hover:bg-red-600 hover:text-white'}`}
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
