const BOARD_SIZE = 9;
const SENTE = "sente";
const GOTE = "gote";
const HAND_TYPES = ["R", "B", "G", "S", "N", "L", "P"];
const FILE_LABELS = [9, 8, 7, 6, 5, 4, 3, 2, 1];
const RANK_LABELS = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];
const PROMOTABLE_TYPES = new Set(["P", "L", "N", "S", "B", "R"]);

const PIECE_LABELS = {
  K: "玉",
  R: "飛",
  B: "角",
  G: "金",
  S: "銀",
  N: "桂",
  L: "香",
  P: "歩",
  "+R": "龍",
  "+B": "馬",
  "+S": "成銀",
  "+N": "成桂",
  "+L": "成香",
  "+P": "と",
};

const MOVEMENT_DEFINITIONS = {
  K: {
    steps: [
      [-1, -1],
      [-1, 0],
      [-1, 1],
      [0, -1],
      [0, 1],
      [1, -1],
      [1, 0],
      [1, 1],
    ],
    slides: [],
  },
  G: {
    steps: [
      [-1, -1],
      [-1, 0],
      [-1, 1],
      [0, -1],
      [0, 1],
      [1, 0],
    ],
    slides: [],
  },
  S: {
    steps: [
      [-1, -1],
      [-1, 0],
      [-1, 1],
      [1, -1],
      [1, 1],
    ],
    slides: [],
  },
  N: {
    steps: [
      [-2, -1],
      [-2, 1],
    ],
    slides: [],
  },
  L: {
    steps: [],
    slides: [[-1, 0]],
  },
  P: {
    steps: [[-1, 0]],
    slides: [],
  },
  B: {
    steps: [],
    slides: [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ],
  },
  R: {
    steps: [],
    slides: [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ],
  },
  "+B": {
    steps: [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ],
    slides: [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ],
  },
  "+R": {
    steps: [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ],
    slides: [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ],
  },
  "+S": null,
  "+N": null,
  "+L": null,
  "+P": null,
};

MOVEMENT_DEFINITIONS["+S"] = MOVEMENT_DEFINITIONS.G;
MOVEMENT_DEFINITIONS["+N"] = MOVEMENT_DEFINITIONS.G;
MOVEMENT_DEFINITIONS["+L"] = MOVEMENT_DEFINITIONS.G;
MOVEMENT_DEFINITIONS["+P"] = MOVEMENT_DEFINITIONS.G;

const boardElement = document.querySelector("#board");
const fileLabelsElement = document.querySelector("#file-labels");
const rankLabelsElement = document.querySelector("#rank-labels");
const senteHandElement = document.querySelector("#sente-hand");
const goteHandElement = document.querySelector("#gote-hand");
const turnBadgeElement = document.querySelector("#turn-badge");
const turnTextElement = document.querySelector("#turn-text");
const statusTextElement = document.querySelector("#status-text");
const selectionTextElement = document.querySelector("#selection-text");
const moveCountElement = document.querySelector("#move-count");
const legalCountElement = document.querySelector("#legal-count");
const historyListElement = document.querySelector("#history-list");
const restartButton = document.querySelector("#restart-button");

const state = createInitialState();

restartButton.addEventListener("click", resetGame);

initialize();

function initialize() {
  renderAxes();
  refreshLegalState();
  render();
}

function resetGame() {
  Object.assign(state, createInitialState());
  refreshLegalState();
  render();
}

function createInitialState() {
  return {
    board: createInitialBoard(),
    hands: createEmptyHands(),
    currentPlayer: SENTE,
    selected: null,
    legalActions: [],
    moveCount: 0,
    gameOver: false,
    winner: null,
    message: "先手から開始です。駒を選んでください。",
    history: [],
    lastAction: null,
    checkedPlayer: null,
  };
}

function createInitialBoard() {
  const emptyRow = () => Array(BOARD_SIZE).fill(null);
  const board = Array.from({ length: BOARD_SIZE }, emptyRow);

  board[0] = ["L", "N", "S", "G", "K", "G", "S", "N", "L"].map((type) => createPiece(GOTE, type));
  board[1][1] = createPiece(GOTE, "R");
  board[1][7] = createPiece(GOTE, "B");
  board[2] = Array.from({ length: BOARD_SIZE }, () => createPiece(GOTE, "P"));
  board[6] = Array.from({ length: BOARD_SIZE }, () => createPiece(SENTE, "P"));
  board[7][1] = createPiece(SENTE, "B");
  board[7][7] = createPiece(SENTE, "R");
  board[8] = ["L", "N", "S", "G", "K", "G", "S", "N", "L"].map((type) => createPiece(SENTE, type));

  return board;
}

function createEmptyHands() {
  return {
    [SENTE]: createHandBucket(),
    [GOTE]: createHandBucket(),
  };
}

function createHandBucket() {
  return HAND_TYPES.reduce((bucket, type) => {
    bucket[type] = 0;
    return bucket;
  }, {});
}

function createPiece(owner, type) {
  return { owner, type };
}

function renderAxes() {
  fileLabelsElement.innerHTML = "";
  rankLabelsElement.innerHTML = "";

  FILE_LABELS.forEach((label) => {
    const span = document.createElement("span");
    span.textContent = String(label);
    fileLabelsElement.appendChild(span);
  });

  RANK_LABELS.forEach((label) => {
    const span = document.createElement("span");
    span.textContent = label;
    rankLabelsElement.appendChild(span);
  });
}

function refreshLegalState() {
  if (state.gameOver) {
    state.checkedPlayer = null;
    state.legalActions = [];
    return;
  }

  state.checkedPlayer = isKingInCheck(state.board, state.currentPlayer) ? state.currentPlayer : null;
  state.legalActions = getAllLegalActions(state.board, state.hands, state.currentPlayer);
}

function render() {
  renderStatus();
  renderHands();
  renderBoard();
  renderHistory();
}

function renderStatus() {
  const displayPlayer = state.gameOver && state.winner ? state.winner : state.currentPlayer;
  const isSenteTurn = displayPlayer === SENTE;

  turnBadgeElement.textContent = state.gameOver
    ? state.winner
      ? `${getPlayerLabel(state.winner)}勝ち`
      : "終局"
    : getPlayerLabel(state.currentPlayer);
  turnBadgeElement.className = `turn-badge ${isSenteTurn ? "sente" : "gote"}`;

  turnTextElement.textContent = state.gameOver
    ? state.winner
      ? `${getPlayerLabel(state.winner)}の勝ち`
      : "対局終了"
    : `${getPlayerLabel(state.currentPlayer)}の番`;
  statusTextElement.textContent = state.message;
  selectionTextElement.textContent = getSelectionText();
  moveCountElement.textContent = String(state.moveCount);
  legalCountElement.textContent = String(state.legalActions.length);
}

function renderHands() {
  renderHand(SENTE, senteHandElement);
  renderHand(GOTE, goteHandElement);
}

function renderHand(owner, container) {
  container.innerHTML = "";

  HAND_TYPES.forEach((type) => {
    const count = state.hands[owner][type];
    const button = document.createElement("button");
    button.type = "button";
    button.className = "hand-piece";
    button.disabled = count === 0 || state.gameOver || owner !== state.currentPlayer;
    button.setAttribute("aria-label", `${getPlayerLabel(owner)}の${PIECE_LABELS[type]} ${count}枚`);

    if (
      state.selected &&
      state.selected.kind === "hand" &&
      state.selected.owner === owner &&
      state.selected.type === type
    ) {
      button.classList.add("is-selected");
    }

    button.addEventListener("click", () => handleHandClick(owner, type));

    const visual = createPieceElement(createPiece(owner, type), true);
    visual.classList.add("hand-piece-visual");
    button.appendChild(visual);

    const name = document.createElement("span");
    name.className = "hand-piece-name";
    name.textContent = PIECE_LABELS[type];
    button.appendChild(name);

    const countLabel = document.createElement("span");
    countLabel.className = "hand-piece-count";
    countLabel.textContent = `x${count}`;
    button.appendChild(countLabel);

    container.appendChild(button);
  });
}

function renderBoard() {
  boardElement.innerHTML = "";
  const selectedTargets = getSelectedTargets();
  const checkedKing = state.checkedPlayer ? findKing(state.board, state.checkedPlayer) : null;

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cell";
      cell.setAttribute("role", "gridcell");
      cell.setAttribute("aria-label", `${FILE_LABELS[col]}${RANK_LABELS[row]}`);
      cell.addEventListener("click", () => handleBoardClick(row, col));

      if (isSelectedSquare(row, col)) {
        cell.classList.add("is-selected");
      }

      if (selectedTargets.some((action) => action.to.row === row && action.to.col === col)) {
        cell.classList.add("is-target");

        const dot = document.createElement("span");
        dot.className = "target-dot";
        cell.appendChild(dot);
      }

      if (state.lastAction && state.lastAction.to.row === row && state.lastAction.to.col === col) {
        cell.classList.add("is-last");
      }

      if (checkedKing && checkedKing.row === row && checkedKing.col === col) {
        cell.classList.add("is-check");
      }

      const piece = state.board[row][col];
      if (piece) {
        const pieceElement = createPieceElement(piece, false);
        cell.appendChild(pieceElement);
      }

      boardElement.appendChild(cell);
    }
  }
}

function renderHistory() {
  historyListElement.innerHTML = "";

  if (state.history.length === 0) {
    const item = document.createElement("li");
    item.className = "history-empty";
    item.textContent = "まだ指していません。";
    historyListElement.appendChild(item);
    return;
  }

  state.history.forEach((entry) => {
    const item = document.createElement("li");
    item.textContent = entry;
    historyListElement.appendChild(item);
  });
}

function createPieceElement(piece, isHandPiece) {
  const pieceElement = document.createElement("div");
  pieceElement.className = "piece";
  pieceElement.textContent = PIECE_LABELS[piece.type];

  if (piece.owner === GOTE) {
    pieceElement.classList.add("gote");
  }

  if (piece.type.startsWith("+")) {
    pieceElement.classList.add("promoted");
  }

  if (isHandPiece) {
    pieceElement.classList.add("piece-hand");
  }

  return pieceElement;
}

function handleHandClick(owner, type) {
  if (state.gameOver || owner !== state.currentPlayer || state.hands[owner][type] === 0) {
    return;
  }

  if (
    state.selected &&
    state.selected.kind === "hand" &&
    state.selected.owner === owner &&
    state.selected.type === type
  ) {
    state.selected = null;
    render();
    return;
  }

  state.selected = { kind: "hand", owner, type };
  render();
}

function handleBoardClick(row, col) {
  if (state.gameOver) {
    return;
  }

  const clickedPiece = state.board[row][col];

  if (
    state.selected &&
    state.selected.kind === "board" &&
    state.selected.row === row &&
    state.selected.col === col
  ) {
    state.selected = null;
    render();
    return;
  }

  const targetActions = getSelectedTargets().filter(
    (action) => action.to.row === row && action.to.col === col,
  );

  if (targetActions.length > 0) {
    commitAction(chooseAction(targetActions));
    return;
  }

  if (clickedPiece && clickedPiece.owner === state.currentPlayer) {
    const hasActions = state.legalActions.some(
      (action) => action.kind === "move" && action.from.row === row && action.from.col === col,
    );

    state.selected = hasActions ? { kind: "board", row, col } : null;
    render();
    return;
  }

  state.selected = null;
  render();
}

function chooseAction(actions) {
  if (actions.length === 1) {
    return actions[0];
  }

  const wantsPromotion = window.confirm("成りますか？\nOK: 成る / キャンセル: 成らない");
  return actions.find((action) => action.promote === wantsPromotion) ?? actions[0];
}

function commitAction(action) {
  const player = state.currentPlayer;
  const pieceBeforeMove =
    action.kind === "move" ? state.board[action.from.row][action.from.col] : createPiece(player, action.type);
  const result = applyActionSnapshot(state.board, state.hands, action, player);

  state.board = result.board;
  state.hands = result.hands;
  state.moveCount += 1;
  state.history.unshift(formatAction(action, player, pieceBeforeMove.type));
  state.history = state.history.slice(0, 40);
  state.lastAction = action;
  state.selected = null;

  const nextPlayer = getOpponent(player);
  const kingStillExists = Boolean(findKing(state.board, nextPlayer));

  if (!kingStillExists) {
    state.gameOver = true;
    state.winner = player;
    state.message = `${getPlayerLabel(player)}が玉を取りました。`;
    refreshLegalState();
    render();
    return;
  }

  state.currentPlayer = nextPlayer;
  state.gameOver = false;
  state.winner = null;
  refreshLegalState();

  if (state.legalActions.length === 0) {
    state.gameOver = true;
    state.winner = player;
    state.message = state.checkedPlayer
      ? `詰みです。${getPlayerLabel(player)}の勝ちです。`
      : `合法手がなくなりました。${getPlayerLabel(player)}の勝ちです。`;
    state.legalActions = [];
    render();
    return;
  }

  state.message = state.checkedPlayer
    ? `王手です。${getPlayerLabel(nextPlayer)}は応手してください。`
    : `${getPlayerLabel(nextPlayer)}の番です。`;

  render();
}

function getSelectedTargets() {
  if (!state.selected) {
    return [];
  }

  if (state.selected.kind === "board") {
    return state.legalActions.filter(
      (action) =>
        action.kind === "move" &&
        action.from.row === state.selected.row &&
        action.from.col === state.selected.col,
    );
  }

  return state.legalActions.filter(
    (action) =>
      action.kind === "drop" &&
      action.type === state.selected.type &&
      action.player === state.selected.owner,
  );
}

function isSelectedSquare(row, col) {
  return Boolean(
    state.selected &&
      state.selected.kind === "board" &&
      state.selected.row === row &&
      state.selected.col === col,
  );
}

function getSelectionText() {
  if (!state.selected) {
    return "盤上の駒、または自分の持ち駒を選択できます。";
  }

  if (state.selected.kind === "board") {
    const piece = state.board[state.selected.row][state.selected.col];
    if (!piece) {
      return "選択を解除しました。";
    }

    return `${getPlayerLabel(piece.owner)}の${PIECE_LABELS[piece.type]}を選択中。行き先をクリックしてください。`;
  }

  return `${getPlayerLabel(state.selected.owner)}の持ち駒 ${PIECE_LABELS[state.selected.type]} を打つ場所を選択してください。`;
}

function getAllLegalActions(board, hands, player) {
  const actions = [];

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const piece = board[row][col];
      if (!piece || piece.owner !== player) {
        continue;
      }

      const candidates = getPseudoMoves(board, row, col, piece);
      candidates.forEach((candidate) => {
        const result = applyActionSnapshot(board, hands, candidate, player);
        if (!isKingInCheck(result.board, player)) {
          actions.push(candidate);
        }
      });
    }
  }

  HAND_TYPES.forEach((type) => {
    if (hands[player][type] === 0) {
      return;
    }

    for (let row = 0; row < BOARD_SIZE; row += 1) {
      for (let col = 0; col < BOARD_SIZE; col += 1) {
        if (!canDropPiece(board, player, type, row, col)) {
          continue;
        }

        const candidate = {
          kind: "drop",
          player,
          type,
          to: { row, col },
        };
        const result = applyActionSnapshot(board, hands, candidate, player);
        if (!isKingInCheck(result.board, player)) {
          actions.push(candidate);
        }
      }
    }
  });

  return actions;
}

function getPseudoMoves(board, row, col, piece) {
  const definition = MOVEMENT_DEFINITIONS[piece.type];
  const moves = [];

  definition.steps.forEach(([baseRow, baseCol]) => {
    const [deltaRow, deltaCol] = orientVector(baseRow, baseCol, piece.owner);
    const nextRow = row + deltaRow;
    const nextCol = col + deltaCol;

    if (!isInsideBoard(nextRow, nextCol)) {
      return;
    }

    const target = board[nextRow][nextCol];
    if (target && target.owner === piece.owner) {
      return;
    }

    appendMoveOptions(moves, piece, row, col, nextRow, nextCol);
  });

  definition.slides.forEach(([baseRow, baseCol]) => {
    const [deltaRow, deltaCol] = orientVector(baseRow, baseCol, piece.owner);
    let nextRow = row + deltaRow;
    let nextCol = col + deltaCol;

    while (isInsideBoard(nextRow, nextCol)) {
      const target = board[nextRow][nextCol];
      if (target && target.owner === piece.owner) {
        break;
      }

      appendMoveOptions(moves, piece, row, col, nextRow, nextCol);

      if (target) {
        break;
      }

      nextRow += deltaRow;
      nextCol += deltaCol;
    }
  });

  return moves;
}

function appendMoveOptions(collection, piece, fromRow, fromCol, toRow, toCol) {
  const promotable =
    PROMOTABLE_TYPES.has(piece.type) &&
    (isPromotionZone(fromRow, piece.owner) || isPromotionZone(toRow, piece.owner));
  const mustPromote = needsPromotion(piece.type, piece.owner, toRow);

  if (mustPromote) {
    collection.push({
      kind: "move",
      from: { row: fromRow, col: fromCol },
      to: { row: toRow, col: toCol },
      promote: true,
    });
    return;
  }

  collection.push({
    kind: "move",
    from: { row: fromRow, col: fromCol },
    to: { row: toRow, col: toCol },
    promote: false,
  });

  if (promotable) {
    collection.push({
      kind: "move",
      from: { row: fromRow, col: fromCol },
      to: { row: toRow, col: toCol },
      promote: true,
    });
  }
}

function canDropPiece(board, player, type, row, col) {
  if (board[row][col]) {
    return false;
  }

  if (type === "P") {
    if (isLastRank(row, player)) {
      return false;
    }

    for (let scanRow = 0; scanRow < BOARD_SIZE; scanRow += 1) {
      const piece = board[scanRow][col];
      if (piece && piece.owner === player && piece.type === "P") {
        return false;
      }
    }
  }

  if (type === "L" && isLastRank(row, player)) {
    return false;
  }

  if (type === "N" && isKnightDeadEnd(row, player)) {
    return false;
  }

  return true;
}

function applyActionSnapshot(board, hands, action, player) {
  const nextBoard = cloneBoard(board);
  const nextHands = cloneHands(hands);

  if (action.kind === "move") {
    const movingPiece = nextBoard[action.from.row][action.from.col];
    const destination = nextBoard[action.to.row][action.to.col];

    nextBoard[action.from.row][action.from.col] = null;

    if (destination) {
      const capturedType = demoteType(destination.type);
      nextHands[player][capturedType] += 1;
    }

    nextBoard[action.to.row][action.to.col] = {
      owner: player,
      type: action.promote ? promoteType(movingPiece.type) : movingPiece.type,
    };
  } else {
    nextHands[player][action.type] -= 1;
    nextBoard[action.to.row][action.to.col] = createPiece(player, action.type);
  }

  return { board: nextBoard, hands: nextHands };
}

function isKingInCheck(board, player) {
  const king = findKing(board, player);
  if (!king) {
    return true;
  }

  return isSquareAttacked(board, king.row, king.col, getOpponent(player));
}

function isSquareAttacked(board, targetRow, targetCol, attacker) {
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const piece = board[row][col];
      if (!piece || piece.owner !== attacker) {
        continue;
      }

      if (pieceThreatensSquare(board, row, col, piece, targetRow, targetCol)) {
        return true;
      }
    }
  }

  return false;
}

function pieceThreatensSquare(board, row, col, piece, targetRow, targetCol) {
  const definition = MOVEMENT_DEFINITIONS[piece.type];

  for (const [baseRow, baseCol] of definition.steps) {
    const [deltaRow, deltaCol] = orientVector(baseRow, baseCol, piece.owner);
    if (row + deltaRow === targetRow && col + deltaCol === targetCol) {
      return true;
    }
  }

  for (const [baseRow, baseCol] of definition.slides) {
    const [deltaRow, deltaCol] = orientVector(baseRow, baseCol, piece.owner);
    let scanRow = row + deltaRow;
    let scanCol = col + deltaCol;

    while (isInsideBoard(scanRow, scanCol)) {
      if (scanRow === targetRow && scanCol === targetCol) {
        return true;
      }

      if (board[scanRow][scanCol]) {
        break;
      }

      scanRow += deltaRow;
      scanCol += deltaCol;
    }
  }

  return false;
}

function findKing(board, player) {
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const piece = board[row][col];
      if (piece && piece.owner === player && piece.type === "K") {
        return { row, col };
      }
    }
  }

  return null;
}

function cloneBoard(board) {
  return board.map((row) => row.map((piece) => (piece ? { ...piece } : null)));
}

function cloneHands(hands) {
  return {
    [SENTE]: { ...hands[SENTE] },
    [GOTE]: { ...hands[GOTE] },
  };
}

function isPromotionZone(row, owner) {
  return owner === SENTE ? row <= 2 : row >= 6;
}

function needsPromotion(type, owner, row) {
  if (type === "P" || type === "L") {
    return isLastRank(row, owner);
  }

  if (type === "N") {
    return isKnightDeadEnd(row, owner);
  }

  return false;
}

function isLastRank(row, owner) {
  return owner === SENTE ? row === 0 : row === BOARD_SIZE - 1;
}

function isKnightDeadEnd(row, owner) {
  return owner === SENTE ? row <= 1 : row >= BOARD_SIZE - 2;
}

function orientVector(deltaRow, deltaCol, owner) {
  return [deltaRow * (owner === SENTE ? 1 : -1), deltaCol];
}

function promoteType(type) {
  if (!PROMOTABLE_TYPES.has(type)) {
    return type;
  }

  return `+${type}`;
}

function demoteType(type) {
  return type.startsWith("+") ? type.slice(1) : type;
}

function formatAction(action, player, sourceType) {
  const destination = `${FILE_LABELS[action.to.col]}${RANK_LABELS[action.to.row]}`;
  const prefix = player === SENTE ? "▲" : "△";
  const suffix = action.kind === "drop" ? "打" : action.promote ? "成" : "";

  return `${prefix}${destination}${PIECE_LABELS[sourceType]}${suffix}`;
}

function getPlayerLabel(player) {
  return player === SENTE ? "先手" : "後手";
}

function getOpponent(player) {
  return player === SENTE ? GOTE : SENTE;
}

function isInsideBoard(row, col) {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}
