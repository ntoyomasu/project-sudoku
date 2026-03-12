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
 * Generates a full valid Sudoku board.
 */
export const generateFullBoard = (): Board => {
  const board: Board = Array(9).fill(null).map(() => Array(9).fill(null));
  
  const fill = (b: Board): boolean => {
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (b[row][col] === null) {
          const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - 0.5);
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
export const generateSudoku = (difficulty: 'easy' | 'medium' | 'hard' = 'medium'): { initial: Board, solution: Board } => {
  console.log(`Generating Sudoku for difficulty: ${difficulty}...`);
  const solution = generateFullBoard();
  const initial = solution.map(row => [...row]);
  
  let attempts = difficulty === 'easy' ? 30 : difficulty === 'medium' ? 45 : 55;
  let removedCount = 0;
  
  while (attempts > 0) {
    let row = Math.floor(Math.random() * 9);
    let col = Math.floor(Math.random() * 9);
    while (initial[row][col] === null) {
      row = Math.floor(Math.random() * 9);
      col = Math.floor(Math.random() * 9);
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
