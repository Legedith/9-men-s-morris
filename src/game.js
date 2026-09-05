/** The family's 3-piece, free-movement Morris variant. No DOM or networking. */
export const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
export const MAX_MOVES = 206; // Six placements + 200 moves: a finite round.
const cell = n => Number.isInteger(n) && n >= 0 && n < 9;
const player = n => n === 1 || n === 2;
const key = g => `${g.board.join('')}:${g.turn}:${g.phase}`;
export function newGame(starter = 1) {
  if (!player(starter)) throw new Error('Invalid starting player.');
  return { board: Array(9).fill(0), turn: starter, starter, placed: [0,0], phase: 'place',
    status: 'playing', winner: 0, line: [], reason: '', ply: 0, last: null, seen: {} };
}
export function play(game, actor, move) {
  if (game.status !== 'playing') throw new Error('This round has ended.');
  if (actor !== game.turn) throw new Error('Wait for your turn.');
  if (!move || !cell(move.to)) throw new Error('Choose a spot on the board.');
  if (game.board[move.to] !== 0) throw new Error('That spot is occupied.');
  const g = { ...game, board: [...game.board], placed: [...game.placed], seen: { ...game.seen } };
  if (g.phase === 'place') {
    if (move.from !== null || g.placed[actor - 1] >= 3) throw new Error('Place a piece first.');
    g.placed[actor - 1]++;
  } else {
    if (!cell(move.from) || g.board[move.from] !== actor) throw new Error('Select one of your own pieces.');
    g.board[move.from] = 0;
  }
  g.board[move.to] = actor;
  g.last = { from: move.from, to: move.to, player: actor };
  g.ply++;
  g.turn = 3 - actor;
  if (g.placed[0] === 3 && g.placed[1] === 3) g.phase = 'move';
  g.line = LINES.find(line => line.every(i => g.board[i] === actor)) || [];
  if (g.line.length) { g.status = 'won'; g.winner = actor; g.reason = 'Three in a row'; }
  else if (g.phase === 'move') {
    const k = key(g);
    g.seen[k] = (g.seen[k] || 0) + 1;
    if (g.seen[k] >= 3) { g.status = 'draw'; g.reason = 'The same position and turn occurred three times'; }
    else if (g.ply >= MAX_MOVES) { g.status = 'draw'; g.reason = '200 moves without a winner'; }
  }
  return g;
}
export function replay(moves, starter = 1) {
  if (!Array.isArray(moves) || moves.length > MAX_MOVES) throw new Error('Invalid move history.');
  return moves.reduce((g, m) => play(g, g.turn, m), newGame(starter));
}
export function newMatch() {
  return { version: 1, round: 1, revision: 0, starter: 1, moves: [], resigned: 0, ready: [false, false] };
}
export function gameOf(match) {
  const g = replay(match.moves, match.starter);
  if (match.resigned) { g.status = 'won'; g.winner = 3 - match.resigned; g.reason = 'Opponent resigned'; }
  return g;
}
/** Validate an untrusted snapshot by replay, rather than trusting a received board. */
export function readMatch(value) {
  if (!value || value.version !== 1 || !Number.isSafeInteger(value.round) || value.round < 1 ||
      !Number.isSafeInteger(value.revision) || value.revision < 0 || !player(value.starter) ||
      value.starter !== (value.round % 2 ? 1 : 2) ||
      ![0,1,2].includes(value.resigned) || !Array.isArray(value.ready) || value.ready.length !== 2 ||
      value.ready.some(v => typeof v !== 'boolean')) throw new Error('Invalid match data.');
  const g = replay(value.moves, value.starter);
  if (value.resigned && (g.status !== 'playing' || g.ply === 0)) throw new Error('Invalid resignation.');
  if (!value.resigned && g.status === 'playing' && value.ready.some(Boolean)) throw new Error('Invalid rematch.');
  if (value.ready.every(Boolean) || value.revision < value.moves.length) throw new Error('Invalid match revision.');
  return { version: 1, round: value.round, revision: value.revision, starter: value.starter,
    moves: value.moves.map(m => ({from:m.from, to:m.to})), resigned: value.resigned, ready: [...value.ready] };
}
/** One authority applies actions; stale packets and illegal turns never change state. */
export function act(match, actor, action, round = match.round, revision = match.revision) {
  if (!player(actor) || !action || round !== match.round || revision !== match.revision) throw new Error('The board changed. Please try again.');
  const g = gameOf(match);
  const next = { ...match, moves: [...match.moves], ready: [...match.ready], revision: match.revision + 1 };
  if (action.type === 'move') {
    play(g, actor, action);
    next.moves.push({from:action.from, to:action.to});
  } else if (action.type === 'resign') {
    if (g.status !== 'playing' || g.ply === 0) throw new Error('There is no active round to resign.');
    next.resigned = actor;
  } else if (action.type === 'rematch') {
    if (g.status === 'playing' || next.ready[actor - 1]) throw new Error('A rematch is not available yet.');
    next.ready[actor - 1] = true;
    if (next.ready.every(Boolean)) {
      next.round++; next.starter = 3 - next.starter; next.moves = []; next.resigned = 0; next.ready = [false,false];
    }
  } else throw new Error('Unknown action.');
  return next;
}
export function coordinate(i) { return `${'ABC'[i % 3]}${Math.floor(i / 3) + 1}`; }
