import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame, play, replay, newMatch, act, readMatch, gameOf, LINES, MAX_MOVES} from '../src/game.js';
import {roomCode, OnlineRoom} from '../src/online.js';
const place = to => ({from:null,to});
const move = (from,to) => ({from,to});
const setup = [0,1,2,3,4,8].map(place);
const apply = (g,m) => play(g,g.turn,m);
function wonMatch() { let m=newMatch(); for (const i of [0,3,1,4,2]) m=act(m,gameOf(m).turn,{type:'move',...place(i)}); return m; }
test('empty board and explicit starter', () => { assert.equal(newGame(2).turn,2); assert.deepEqual(newGame().board,Array(9).fill(0)); assert.throws(()=>newGame(0)); });
test('alternating placement reaches movement only after six pieces', () => { const g=replay(setup); assert.equal(g.phase,'move'); assert.deepEqual(g.placed,[3,3]); assert.equal(g.turn,1); });
test('occupied placement rejected and input state unchanged', () => { const g=apply(newGame(),place(0)), before=JSON.stringify(g); assert.throws(()=>apply(g,place(0)),/occupied/); assert.equal(JSON.stringify(g),before); });
test('out-of-turn, missing, negative, fractional and oversized moves rejected', () => { const g=newGame(); assert.throws(()=>play(g,2,place(0)),/turn/); for (const to of [-1,9,1.2,'1',NaN,Infinity,null]) assert.throws(()=>apply(g,place(to))); assert.throws(()=>apply(g,null)); assert.throws(()=>apply(g,{from:0,to:1})); });
test('all eight lines recognized during placement for either starter', () => { for (const starter of [1,2]) for (const line of LINES) { const other=[...Array(9).keys()].filter(i=>!line.includes(i)); const seq=[line[0],other[0],line[1],other[1],line[2]].map(place); const g=replay(seq,starter); assert.equal(g.winner,starter); assert.equal(g.ply,5); assert.equal(g.status,'won'); assert.deepEqual(g.line,line); } });
test('placement win is immediate; cannot move after game over', () => { const g=gameOf(wonMatch()); assert.throws(()=>apply(g,place(8)),/ended/); });
test('movement allows any empty spot, not just adjacent spots', () => { const g=replay(setup); const next=apply(g,move(0,7)); assert.equal(next.board[0],0); assert.equal(next.board[7],1); assert.deepEqual(next.placed,[3,3]); });
test('movement cannot take opponent piece or place fourth piece', () => { const g=replay(setup); assert.throws(()=>apply(g,move(1,7)),/own/); assert.throws(()=>apply(g,move(null,7)),/own/); assert.throws(()=>apply(g,move(4,1)),/occupied/); assert.throws(()=>apply(g,move(4,4)),/occupied/); });
test('movement win recognized', () => { const g=apply(replay(setup),move(0,6)); assert.equal(g.winner,1); assert.deepEqual(g.line,[2,4,6]); });
test('third repeated position with same player to move is a draw', () => { let g=replay(setup); const cycle=[move(0,5),move(1,7),move(5,0),move(7,1)]; for (let n=0;n<2;n++) for (const m of cycle) g=apply(g,m); assert.equal(g.status,'draw'); assert.match(g.reason,/three times/); });
test('move cap ends a non-winning round', () => { const g={...replay(setup),ply:MAX_MOVES-1,seen:{}}; assert.equal(apply(g,move(0,5)).status,'draw'); });
test('replay matches live play and does not mutate move list', () => { const before=JSON.stringify(setup); assert.deepEqual(replay(setup),setup.reduce(apply,newGame())); assert.equal(JSON.stringify(setup),before); });
test('rematch requires consent of both players and alternates starter', () => { const m=wonMatch(); const ready=act(m,1,{type:'rematch'}); assert.equal(ready.round,1); assert.throws(()=>act(ready,1,{type:'rematch'})); const next=act(ready,2,{type:'rematch'}); assert.equal(next.round,2); assert.equal(next.starter,2); assert.equal(gameOf(next).turn,2); assert.deepEqual(next.moves,[]); assert.deepEqual(next.ready,[false,false]); });
test('no rematch in a live round; no initial resignation', () => { assert.throws(()=>act(newMatch(),1,{type:'rematch'})); assert.throws(()=>act(newMatch(),1,{type:'resign'})); });
test('either connected player can resign after the round begins', () => { const m=act(newMatch(),1,{type:'move',...place(0)}); for (const p of [1,2]) { const r=act(m,p,{type:'resign'}); assert.equal(gameOf(r).winner,3-p); assert.equal(readMatch(r).resigned,p); assert.throws(()=>act(r,2,{type:'move',...place(1)})); } });
test('stale, duplicate and previous-round actions rejected', () => { const first=act(newMatch(),1,{type:'move',...place(0)}); assert.throws(()=>act(first,2,{type:'move',...place(1)},1,0)); assert.throws(()=>act(first,2,{type:'move',...place(1)},2,1)); assert.throws(()=>act(first,0,{type:'resign'})); assert.throws(()=>act(first,2,{type:'hack'})); });
test('snapshot validation replays legal history and strips unexpected fields', () => { const m=wonMatch(); assert.deepEqual(readMatch({...m,board:[9,9,9],evil:true}),m); const bad=[null,{}, {...m,version:2},{...m,starter:0},{...m,round:2},{...m,revision:-1},{...m,ready:[true,true]},{...m,ready:['yes',false]},{...m,resigned:2},{...newMatch(),ready:[true,false]},{...m,moves:Array(MAX_MOVES+1).fill(place(0))},{...m,moves:[place(0),place(0)]}]; for (const value of bad) assert.throws(()=>readMatch(value)); });
test('room codes accept invites and separators; reject arbitrary URLs and malformed codes', () => { for(const s of ['a1b2-c3d4-e5f6','A1B2C3D4E5F6','#room=A1B2C3D4E5F6','https://legedith.github.io/9-men-s-morris/#room=A1B2C3D4E5F6']) assert.equal(roomCode(s),'A1B2C3D4E5F6'); for (const s of ['','hello','https://example.com/','javascript:alert(1)','Z'.repeat(12),'A'.repeat(500)]) assert.equal(roomCode(s),''); });
test('online host ignores claimed actor and validates guest as seat two', () => { const r=new OnlineRoom({onChange:()=>{},onStatus:()=>{}}); r.role='host'; r.connected=true; r.conn={open:true,send:()=>{}}; r.receive({app:'nanis-morris-v1',type:'action',round:1,revision:0,action:{type:'move',player:1,...place(0)}}); assert.equal(r.match.moves.length,0); r.match=act(r.match,1,{type:'move',...place(0)}); r.receive({app:'nanis-morris-v1',type:'action',round:1,revision:1,action:{type:'move',...place(1)}}); assert.equal(r.match.moves.length,2); });
test('guest rejects invalid state without replacing its board', () => { const r=new OnlineRoom({onChange:()=>{},onStatus:()=>{}}); r.role='guest'; r.connected=true; r.conn={open:true,send:()=>{}}; r.receive({app:'nanis-morris-v1',type:'state',match:{...newMatch(),moves:[place(0),place(0)]}}); assert.equal(r.connected,false); assert.equal(r.match.moves.length,0); });
test('all reachable non-repeating positions satisfy piece and turn invariants', () => {
  const visited=new Set(); let count=0;
  function visit(g){ const k=g.board.join('')+g.turn+g.phase+g.status; if(visited.has(k))return; visited.add(k); count++;
    assert(g.board.filter(x=>x===1).length<=3); assert(g.board.filter(x=>x===2).length<=3);
    if(g.status!=='playing')return;
    for(let to=0;to<9;to++)if(g.board[to]===0){ if(g.phase==='place')visit(apply(g,place(to))); else for(let from=0;from<9;from++)if(g.board[from]===g.turn)visit(apply(g,move(from,to))); }
  }
  visit(newGame()); assert(count>3000); console.log(`Checked ${count} reachable positions.`);
});
