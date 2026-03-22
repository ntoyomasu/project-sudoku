/**
 * Sudoku logic utilities including solver and generator using backtracking.
 */

export type Board = (number | null)[][];

/**
 * Checks if a number can be placed in a specific position on the board.
 */
export const isValid = (board: Board, row: number, col: number, num: number): boolean => {
  // Check row
  for (let x = 0; x < 9; x++) {
    if (board[row][x] === num) return false;
  }

  // Check column
  for (let x = 0; x < 9; x++) {
    if (board[x][col] === num) return false;
  }

  // Check 3x3 box
  const startRow = Math.floor(row / 3) * 3;
  const startCol = Math.floor(col / 3) * 3;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (board[i + startRow][j + startCol] === num) return false;
    }
  }

  return true;
};

/**
 * Solves the Sudoku board using backtracking.
 * Returns true if solved, false if no solution exists.
 */
export const solveSudoku = (board: Board): boolean => {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (board[row][col] === null) {
        for (let num = 1; num <= 9; num++) {
          if (isValid(board, row, col, num)) {
            board[row][col] = num;
            if (solveSudoku(board)) return true;
            board[row][col] = null;
          }
        }
        return false;
      }
    }
  }
  return true;
};

/**
 * Counts the number of solutions for a given board.
 * Used to ensure a unique solution.
 */
export const countSolutions = (board: Board, count: { value: number }): void => {
  if (count.value > 1) return;

  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (board[row][col] === null) {
        for (let num = 1; num <= 9; num++) {
          if (isValid(board, row, col, num)) {
            board[row][col] = num;
            countSolutions(board, count);
            board[row][col] = null;
          }
        }
        return;
      }
    }
  }
  count.value++;
};

/**
 * Simple seeded random number generator.
 */
const createSeededRandom = (seed: string) => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  }
  return () => {
    h = Math.imul(48271, h) | 0;
    return (h >>> 0) / 2147483647;
  };
};

/**
 * Generates a full valid Sudoku board.
 */
export const generateFullBoard = (seed?: string): Board => {
  const board: Board = Array(9).fill(null).map(() => Array(9).fill(null));
  const random = seed ? createSeededRandom(seed) : Math.random;
  
  const fill = (b: Board): boolean => {
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (b[row][col] === null) {
          const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => random() - 0.5);
          for (const num of nums) {
            if (isValid(b, row, col, num)) {
              b[row][col] = num;
              if (fill(b)) return true;
              b[row][col] = null;
            }
          }
          return false;
        }
      }
    }
    return true;
  };

  fill(board);
  return board;
};

/**
 * Generates a Sudoku problem by removing numbers from a full board.
 * Ensures a unique solution exists.
 */
export const generateSudoku = (
  difficulty: 'easy' | 'medium' | 'hard' | 'super-hard' = 'medium',
  seed?: string
): { initial: Board, solution: Board } => {
  console.log(`Generating Sudoku for difficulty: ${difficulty}${seed ? ' with seed' : ''}...`);
  const solution = generateFullBoard(seed);
  const initial = solution.map(row => [...row]);
  const random = seed ? createSeededRandom(seed + "-remove") : Math.random;
  
  let attempts = difficulty === 'easy' ? 30 : difficulty === 'medium' ? 45 : difficulty === 'hard' ? 55 : 75;
  let removedCount = 0;
  
  while (attempts > 0) {
    let row = Math.floor(random() * 9);
    let col = Math.floor(random() * 9);
    while (initial[row][col] === null) {
      row = Math.floor(random() * 9);
      col = Math.floor(random() * 9);
    }

    const backup = initial[row][col];
    initial[row][col] = null;

    const count = { value: 0 };
    const boardCopy = initial.map(r => [...r]);
    countSolutions(boardCopy, count);

    if (count.value !== 1) {
      initial[row][col] = backup;
    } else {
      removedCount++;
    }
    attempts--;
  }

  console.log(`Generation complete. Removed ${removedCount} numbers.`);
  return { initial, solution };
};
