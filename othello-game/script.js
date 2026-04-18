const BOARD_SIZE = 8;
const EMPTY = 0;
const BLACK = 1;
const WHITE = -1;
const DIRECTIONS = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

const boardElement = document.querySelector("#board");
const turnTextElement = document.querySelector("#turn-text");
const turnDiscElement = document.querySelector("#turn-disc");
const messageElement = document.querySelector("#message");
const statusTextElement = document.querySelector("#status-text");
const blackScoreElement = document.querySelector("#black-score");
const whiteScoreElement = document.querySelector("#white-score");
const moveCountElement = document.querySelector("#move-count");
const restartButton = document.querySelector("#restart-button");

const state = {
  board: createInitialBoard(),
  currentPlayer: BLACK,
  validMoves: [],
  moveCount: 0,
  message: "ゲームを開始しました。",
  gameOver: false,
  lastMove: null,
};

restartButton.addEventListener("click", resetGame);

initialize();

function initialize() {
  state.validMoves = getValidMoves(state.board, state.currentPlayer);
  render();
}

function resetGame() {
  state.board = createInitialBoard();
  state.currentPlayer = BLACK;
  state.validMoves = getValidMoves(state.board, state.currentPlayer);
  state.moveCount = 0;
  state.message = "ゲームを開始しました。";
  state.gameOver = false;
  state.lastMove = null;
  render();
}

function createInitialBoard() {
  const board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(EMPTY));
  board[3][3] = WHITE;
  board[3][4] = BLACK;
  board[4][3] = BLACK;
  board[4][4] = WHITE;
  return board;
}

function render() {
  const counts = countDiscs(state.board);
  blackScoreElement.textContent = counts.black;
  whiteScoreElement.textContent = counts.white;
  moveCountElement.textContent = `手数: ${state.moveCount}`;
  messageElement.textContent = state.message;

  turnTextElement.textContent = state.gameOver
    ? "ゲーム終了"
    : `${getPlayerName(state.currentPlayer)}の番`;
  turnDiscElement.className = `turn-disc ${state.currentPlayer === BLACK ? "black" : "white"}`;
  statusTextElement.textContent = state.gameOver
    ? getWinnerText(counts.black, counts.white)
    : `合法手: ${state.validMoves.length} 箇所`;

  renderBoard();
}

function renderBoard() {
  boardElement.innerHTML = "";

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cell";
      cell.setAttribute("role", "gridcell");
      cell.setAttribute("aria-label", `${row + 1}行${col + 1}列`);

      const value = state.board[row][col];
      const move = state.validMoves.find((candidate) => candidate.row === row && candidate.col === col);

      if (move && !state.gameOver) {
        cell.classList.add("valid");
        cell.addEventListener("click", () => handleMove(move));
      } else {
        cell.disabled = true;
      }

      if (state.lastMove && state.lastMove.row === row && state.lastMove.col === col) {
        cell.classList.add("last-move");
      }

      if (value !== EMPTY) {
        const disc = document.createElement("span");
        disc.className = `disc ${value === BLACK ? "black" : "white"}`;
        cell.appendChild(disc);
      }

      boardElement.appendChild(cell);
    }
  }
}

function handleMove(move) {
  if (state.gameOver) {
    return;
  }

  applyMove(state.board, move, state.currentPlayer);
  state.moveCount += 1;
  state.lastMove = { row: move.row, col: move.col };

  const nextPlayer = -state.currentPlayer;
  const nextMoves = getValidMoves(state.board, nextPlayer);

  if (nextMoves.length > 0) {
    state.currentPlayer = nextPlayer;
    state.validMoves = nextMoves;
    state.message = `${getPlayerName(nextPlayer)}の番です。`;
    render();
    return;
  }

  const retryMoves = getValidMoves(state.board, state.currentPlayer);
  if (retryMoves.length > 0) {
    state.validMoves = retryMoves;
    state.message = `${getPlayerName(nextPlayer)}は置けないためパスです。${getPlayerName(
      state.currentPlayer,
    )}が続けて打ちます。`;
    render();
    return;
  }

  state.gameOver = true;
  state.validMoves = [];
  state.message = `両者とも置けないため終了です。${getWinnerText(
    countDiscs(state.board).black,
    countDiscs(state.board).white,
  )}`;
  render();
}

function applyMove(board, move, player) {
  board[move.row][move.col] = player;
  move.flips.forEach(([row, col]) => {
    board[row][col] = player;
  });
}

function getValidMoves(board, player) {
  const moves = [];

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const flips = getFlips(board, row, col, player);
      if (flips.length > 0) {
        moves.push({ row, col, flips });
      }
    }
  }

  return moves;
}

function getFlips(board, row, col, player) {
  if (!isInsideBoard(row, col) || board[row][col] !== EMPTY) {
    return [];
  }

  const flips = [];

  DIRECTIONS.forEach(([dr, dc]) => {
    let currentRow = row + dr;
    let currentCol = col + dc;
    const line = [];

    while (isInsideBoard(currentRow, currentCol) && board[currentRow][currentCol] === -player) {
      line.push([currentRow, currentCol]);
      currentRow += dr;
      currentCol += dc;
    }

    if (
      line.length > 0 &&
      isInsideBoard(currentRow, currentCol) &&
      board[currentRow][currentCol] === player
    ) {
      flips.push(...line);
    }
  });

  return flips;
}

function isInsideBoard(row, col) {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

function countDiscs(board) {
  let black = 0;
  let white = 0;

  board.forEach((row) => {
    row.forEach((cell) => {
      if (cell === BLACK) {
        black += 1;
      } else if (cell === WHITE) {
        white += 1;
      }
    });
  });

  return { black, white };
}

function getPlayerName(player) {
  return player === BLACK ? "黒" : "白";
}

function getWinnerText(black, white) {
  if (black === white) {
    return `引き分けです。黒 ${black} - 白 ${white}`;
  }

  const winner = black > white ? "黒" : "白";
  return `${winner}の勝ちです。黒 ${black} - 白 ${white}`;
}
