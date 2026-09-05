/** Nine Men's Morris: 24 points, nine men, mill captures, sliding and flying.
 * Pure rules: no DOM, storage or network access. Turn includes any earned capture.
 */
export const VERSION = 2;
export const QUIET_LIMIT = 100; // Explicit house draw: 50 moves each without a capture.
export const MAX_ACTIONS = 2048; // Above the maximum possible round under the draw rule.
export const POINTS = Object.freeze([
  ['A7',0,0],['D7',3,0],['G7',6,0],['B6',1,1],['D6',3,1],['F6',5,1],
  ['C5',2,2],['D5',3,2],['E5',4,2],['A4',0,3],['B4',1,3],['C4',2,3],
  ['E4',4,3],['F4',5,3],['G4',6,3],['C3',2,4],['D3',3,4],['E3',4,4],
  ['B2',1,5],['D2',3,5],['F2',5,5],['A1',0,6],['D1',3,6],['G1',6,6]
].map(Object.freeze));
export const MILLS = Object.freeze([
  [0,1,2],[3,4,5],[6,7,8],[9,10,11],[12,13,14],[15,16,17],[18,19,20],[21,22,23],
  [0,9,21],[3,10,18],[6,11,15],[1,4,7],[16,19,22],[8,12,17],[5,13,20],[2,14,23]
].map(Object.freeze));
export const EDGES = Object.freeze(MILLS.flatMap(([a,b,c]) => [Object.freeze([a,b]),Object.freeze([b,c])]));
export const NEIGHBORS = Object.freeze(POINTS.map((_,i) => Object.freeze(EDGES.filter(e=>e.includes(i)).map(e=>e[0]===i?e[1]:e[0]))));
const isCell = i => Number.isInteger(i) && i >= 0 && i < 24;
const isPlayer = p => p === 1 || p === 2;
export const coordinate = i => POINTS[i]?.[0] || '?';
export const countPieces = (g,p) => g.board.filter(v=>v===p).length;
export const inHand = (g,p) => 9-g.placed[p-1];
export const isFlying = (g,p) => g.phase === 'move' && countPieces(g,p) === 3;
export const millsFor = (board,p) => MILLS.filter(line=>line.every(i=>board[i]===p));
export const inMill = (board,i) => isCell(i) && board[i] !== 0 && MILLS.some(line=>line.includes(i) && line.every(j=>board[j]===board[i]));
export function capturable(g) {
  if (!g.capture || g.status !== 'playing') return [];
  const enemy = g.board.flatMap((p,i)=>p===3-g.turn?[i]:[]);
  const exposed = enemy.filter(i=>!inMill(g.board,i));
  return exposed.length ? exposed : enemy;
}
export function destinations(g,from,p=g.turn) {
  if (g.status !== 'playing' || g.capture || g.phase !== 'move' || !isCell(from) || g.board[from] !== p) return [];
  return (isFlying(g,p) ? POINTS.map((_,i)=>i) : NEIGHBORS[from]).filter(i=>g.board[i]===0);
}
export function newGame(starter=1) {
  if (!isPlayer(starter)) throw new Error('Invalid starting player.');
  return {board:Array(24).fill(0),placed:[0,0],turn:starter,starter,phase:'place',capture:false,
    status:'playing',winner:0,line:[],reason:'',ply:0,quiet:0,last:null,seen:{}};
}
function finishTurn(g,actor,captured=false) {
  g.capture=false; g.turn=3-actor; g.ply++;
  if (captured || g.phase==='place') { g.quiet=0; g.seen={}; }
  else g.quiet++;
  if (g.placed.every(n=>n===9)) g.phase='move';
  if (countPieces(g,g.turn)+inHand(g,g.turn)<3) {
    g.status='won'; g.winner=actor; g.reason='Opponent has fewer than three pieces remaining';
  } else if (g.phase==='move' && !g.board.some((p,i)=>p===g.turn && destinations(g,i).length)) {
    g.status='won'; g.winner=actor; g.reason='Opponent has no legal move';
  } else if (g.phase==='move') {
    const key=g.board.join('')+':'+g.turn;
    g.seen[key]=(g.seen[key]||0)+1;
    if (g.seen[key]>=3) { g.status='draw'; g.reason='The same position and turn occurred three times'; }
    else if (g.quiet>=QUIET_LIMIT) { g.status='draw'; g.reason='50 moves each without a capture'; }
  }
  return g;
}
/** Apply one placement, slide, flight or capture; never mutate the input. */
export function play(game,actor,action) {
  if (game.status!=='playing') throw new Error('This round has ended.');
  if (!isPlayer(actor) || actor!==game.turn) throw new Error('Wait for your turn.');
  if (!action || typeof action!=='object') throw new Error('Choose a legal action.');
  const g={...game,board:[...game.board],placed:[...game.placed],line:[],seen:{...game.seen}};
  if (game.capture) {
    if (action.type!=='capture') throw new Error('Capture an opposing piece to finish your turn.');
    if (!isCell(action.at) || g.board[action.at]!==3-actor) throw new Error('Choose an opposing piece.');
    if (!capturable(game).includes(action.at)) throw new Error('That piece is protected by a mill. Capture an exposed piece.');
    g.board[action.at]=0;
    g.line=[...game.line]; g.last={...game.last,captured:action.at};
    return finishTurn(g,actor,true);
  }
  if (action.type!=='move') throw new Error('Form a mill before capturing a piece.');
  const {from,to}=action;
  if (!isCell(to)) throw new Error('Choose a point on the board.');
  if (g.board[to]!==0) throw new Error('That point is occupied.');
  if (g.phase==='place') {
    if (from!==null || inHand(g,actor)<=0) throw new Error('Place one of your pieces from hand.');
    g.placed[actor-1]++;
  } else {
    if (!isCell(from) || g.board[from]!==actor) throw new Error('Select one of your own pieces.');
    if (!destinations(game,from,actor).includes(to)) throw new Error('Move along a line to an adjacent empty point.');
    g.board[from]=0;
  }
  g.board[to]=actor; g.last={from,to,player:actor,captured:null};
  // Only a mill formed by THIS action earns a capture. An existing mill does not.
  const formed=MILLS.filter(line=>line.includes(to) && line.every(i=>g.board[i]===actor));
  if (formed.length && countPieces(g,3-actor)>0) {
    g.capture=true; g.line=[...new Set(formed.flat())];
    return g; // One capture even if this action closes two mills.
  }
  return finishTurn(g,actor);
}
export function legalActions(g) {
  if (g.status!=='playing') return [];
  if (g.capture) return capturable(g).map(at=>({type:'capture',at}));
  if (g.phase==='place') return g.board.flatMap((p,to)=>p===0?[{type:'move',from:null,to}]:[]);
  return g.board.flatMap((p,from)=>p===g.turn?destinations(g,from).map(to=>({type:'move',from,to})):[]);
}
function cleanAction(a) {
  return a.type==='capture'?{type:'capture',at:a.at}:{type:'move',from:a.from,to:a.to};
}
export function replay(moves,starter=1) {
  if (!Array.isArray(moves) || moves.length>MAX_ACTIONS) throw new Error('Invalid move history.');
  return moves.reduce((g,a)=>play(g,g.turn,a),newGame(starter));
}
export function newMatch() { return {version:VERSION,round:1,revision:0,starter:1,moves:[],resigned:0,ready:[false,false]}; }
export function gameOf(match) {
  const g=replay(match.moves,match.starter);
  if (match.resigned) { g.status='won'; g.winner=3-match.resigned; g.reason='Opponent resigned'; g.capture=false; }
  return g;
}
/** Untrusted network and storage snapshots are reconstructed by legal replay. */
export function readMatch(v) {
  if (!v || v.version!==VERSION || !Number.isSafeInteger(v.round) || v.round<1 || v.round>1000000 ||
      !Number.isSafeInteger(v.revision) || v.revision<0 || v.revision>100000000 ||
      v.starter!==(v.round%2?1:2) || ![0,1,2].includes(v.resigned) ||
      !Array.isArray(v.ready) || v.ready.length!==2 || v.ready.some(x=>typeof x!=='boolean')) throw new Error('Invalid or incompatible match data.');
  const g=replay(v.moves,v.starter);
  if (v.resigned && (g.status!=='playing' || !v.moves.length)) throw new Error('Invalid resignation.');
  if (!v.resigned && g.status==='playing' && v.ready.some(Boolean)) throw new Error('Invalid rematch.');
  if (v.ready.every(Boolean) || v.revision<v.moves.length) throw new Error('Invalid match revision.');
  return {version:VERSION,round:v.round,revision:v.revision,starter:v.starter,moves:v.moves.map(cleanAction),resigned:v.resigned,ready:[...v.ready]};
}
export function act(match,actor,action,round=match.round,revision=match.revision) {
  if (!isPlayer(actor) || !action || round!==match.round || revision!==match.revision) throw new Error('The board changed. Please try again.');
  const g=gameOf(match), next={...match,moves:[...match.moves],ready:[...match.ready],revision:match.revision+1};
  if (action.type==='move' || action.type==='capture') {
    play(g,actor,action); next.moves.push(cleanAction(action));
  } else if (action.type==='resign') {
    if (g.status!=='playing' || !match.moves.length) throw new Error('There is no active round to resign.');
    next.resigned=actor;
  } else if (action.type==='rematch') {
    if (g.status==='playing' || next.ready[actor-1]) throw new Error('A rematch is not available yet.');
    next.ready[actor-1]=true;
    if (next.ready.every(Boolean)) {
      next.round++; next.starter=3-next.starter; next.moves=[]; next.resigned=0; next.ready=[false,false];
    }
  } else throw new Error('Unknown action.');
  return next;
}
