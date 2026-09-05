import test from 'node:test';
import assert from 'node:assert/strict';
import {VERSION,POINTS,MILLS,EDGES,NEIGHBORS,newGame,play,replay,legalActions,destinations,capturable,isFlying,countPieces,inHand,newMatch,act,gameOf,readMatch,QUIET_LIMIT,MAX_ACTIONS} from '../src/game.js';
import {roomCode,OnlineRoom} from '../src/online.js';
const put=to=>({type:'move',from:null,to}), move=(from,to)=>({type:'move',from,to}), take=at=>({type:'capture',at});
const apply=(g,a)=>play(g,g.turn,a);
export const opening=[0,3,1,4,2].map(put).concat(take(3),[3,5,6,7,8,9,10,11,12,13,14,15,16].map(put));
function position(a,b,extra={}){const g={...newGame(),placed:[9,9],phase:'move',...extra};for(const i of a)g.board[i]=1;for(const i of b){assert.equal(g.board[i],0);g.board[i]=2;}return g;}
function matchOf(actions){return actions.reduce((m,a)=>act(m,gameOf(m).turn,a),newMatch());}
function resigned(){return act(matchOf([put(0)]),2,{type:'resign'});}

test('24 unique points, 16 mills and 32 undirected links; no diagonals or center crossing',()=>{
  assert.equal(POINTS.length,24);assert.equal(new Set(POINTS.map(p=>p[0])).size,24);assert.equal(MILLS.length,16);assert.equal(EDGES.length,32);
  for(const [a,b]of EDGES){assert(NEIGHBORS[a].includes(b));assert(NEIGHBORS[b].includes(a));assert(POINTS[a][1]===POINTS[b][1]||POINTS[a][2]===POINTS[b][2]);}
  for(const [a,b]of [[0,3],[3,6],[7,16],[11,12],[0,2]])assert(!NEIGHBORS[a].includes(b));
  for(let i=0;i<24;i++){assert.equal(MILLS.filter(m=>m.includes(i)).length,2);assert(NEIGHBORS[i].length>=2);}
});
test('nine men in hand each; explicit starter and version 2',()=>{const g=newGame(2);assert.equal(g.turn,2);assert.equal(g.board.length,24);assert.equal(inHand(g,1),9);assert.equal(VERSION,2);assert.throws(()=>newGame(0));});
test('first mill grants a capture, retains turn, and DOES NOT win',()=>{const g=replay(opening.slice(0,5));assert.equal(g.capture,true);assert.equal(g.turn,1);assert.equal(g.status,'playing');assert.equal(g.winner,0);assert.equal(g.ply,4);assert.deepEqual(g.line,[0,1,2]);});
test('all sixteen mills earn a capture for either player',()=>{for(const p of[1,2])for(const line of MILLS){const enemy=POINTS.map((_,i)=>i).filter(i=>!line.includes(i)).slice(0,2);const g=position(p===1?line.slice(0,2):enemy,p===2?line.slice(0,2):enemy,{turn:p,phase:'place',placed:[2,2]});const n=play(g,p,put(line[2]));assert.equal(n.capture,true);assert.equal(n.turn,p);assert.equal(n.status,'playing');}});
test('diagonal-looking triples are not mills',()=>{const g=position([0,3],[2,5],{phase:'place',placed:[2,2]});const n=apply(g,put(6));assert.equal(n.capture,false);assert.equal(n.turn,2);});
test('capture is mandatory before opponent acts or another piece is placed',()=>{const g=replay(opening.slice(0,5));assert.throws(()=>apply(g,put(9)),/Capture/);assert.throws(()=>play(g,2,put(9)),/turn/);const n=apply(g,take(3));assert.equal(n.board[3],0);assert.equal(n.turn,2);assert.equal(n.ply,5);assert.deepEqual(n.placed,[3,2]);assert.equal(inHand(n,2),7);});
test('cannot capture before a mill, own piece, empty point or protected piece',()=>{assert.throws(()=>apply(newGame(),take(0)),/mill/);const g=position([6,7,8],[0,1,2,9],{capture:true});for(const i of[6,23,24,-1])assert.throws(()=>apply(g,take(i)));assert.deepEqual(capturable(g),[9]);assert.throws(()=>apply(g,take(0)),/protected/);assert.equal(apply(g,take(9)).board[9],0);});
test('any enemy piece can be captured when all enemy pieces belong to mills',()=>{const g=position([6,7,8,11],[0,1,2,18,19,20],{capture:true});assert.deepEqual(capturable(g),[0,1,2,18,19,20]);assert.equal(apply(g,take(1)).board[1],0);});
test('two mills closed at once still earn exactly one capture',()=>{const g=position([1,3,5,7],[0,2,6,8],{phase:'place',placed:[4,4]});const n=apply(g,put(4));assert.equal(n.line.length,5);const after=apply(n,take(0));assert.equal(after.capture,false);assert.equal(after.turn,2);assert.throws(()=>play(after,1,take(2)),/turn/);});
test('all eighteen placements must finish; captures do not reduce placement quota',()=>{assert.equal(replay(opening.slice(0,7)).phase,'place');const g=replay(opening);assert.equal(g.phase,'move');assert.deepEqual(g.placed,[9,9]);assert.equal(countPieces(g,1),9);assert.equal(countPieces(g,2),8);assert.equal(g.ply,18);assert.equal(g.turn,1);assert.equal(g.quiet,0);});
test('a mill on the final placement is resolved before starting movement',()=>{const g=position([0,1,2,9,10,11,15,16],[3,4,6,8,12,13,19,20],{phase:'place',placed:[9,8],turn:2});const n=apply(g,put(5));assert.equal(n.capture,true);assert.equal(n.phase,'place');assert.equal(n.turn,2);const done=apply(n,take(15));assert.equal(done.phase,'move');assert.equal(done.turn,1);});
test('sliding requires an empty ADJACENT point along a line',()=>{const g=replay(opening);assert.deepEqual(destinations(g,13),[20]);const n=apply(g,move(13,20));assert.equal(n.board[13],0);assert.equal(n.board[20],1);for(const a of[move(5,20),move(5,23),move(0,2),move(3,18),put(23)])assert.throws(()=>apply(g,a));});
test('exactly three pieces can fly; four cannot; placement cannot fly',()=>{const g=position([0,1,3],[2,4,5,9]);assert(isFlying(g,1));assert(destinations(g,0).includes(23));assert.equal(apply(g,move(0,23)).board[23],1);const four=position([0,1,3,6],[2,4,5,9]);assert(!isFlying(four,1));assert.throws(()=>apply(four,move(0,23)),/adjacent/);const placing={...g,phase:'place',placed:[3,4]};assert(!isFlying(placing,1));assert.throws(()=>apply(placing,move(0,23)));});
test('flying can form a mill and earns a capture',()=>{const g=position([0,1,23],[3,4,6,8]);const n=apply(g,move(23,2));assert(n.capture);assert.equal(n.turn,1);assert.deepEqual(n.line,[0,1,2]);});
test('breaking and reforming a mill earns another capture',()=>{let g=position([0,1,2,9],[3,6,8,10,14]);g=apply(g,move(1,4));assert(!g.capture);g=apply(g,move(14,23));g=apply(g,move(4,1));assert(g.capture);});
test('an unchanged existing mill earns no extra capture',()=>{const g=position([0,1,2,3],[6,8,12,14]);assert.equal(apply(g,move(3,10)).capture,false);});
test('capture reducing opponent to two wins; game then rejects further actions',()=>{const g=position([0,1,2,9],[6,7,8],{capture:true,line:[0,1,2]});const n=apply(g,take(6));assert.equal(n.status,'won');assert.equal(n.winner,1);assert.match(n.reason,/fewer than three/);assert.throws(()=>apply(n,move(7,4)),/ended/);});
test('reserves count toward survival during placement',()=>{const g=position([0,1,2],[3,4],{phase:'place',placed:[3,2],capture:true});const n=apply(g,take(3));assert.equal(n.status,'playing');assert.equal(countPieces(n,2),1);assert.equal(inHand(n,2),7);});
test('blocked opponent loses after a completed move; flight prevents false blockade',()=>{const g=position([0,2,6,8],[1,7,9,11,12,14,19],{turn:2});const n=apply(g,move(19,22));assert.equal(n.winner,2);assert.match(n.reason,/no legal move/);const three=position([0,2,6],[1,7,9,11,14,19],{turn:2});assert.equal(apply(three,move(19,22)).status,'playing');});
test('repetition is counted at complete turns, with the player-to-move',()=>{let g=position([0,3,6,15],[2,5,8,17]);g.seen[g.board.join('')+':1']=1;for(let n=0;n<2;n++)for(const a of[move(0,1),move(2,14),move(1,0),move(14,2)])g=apply(g,a);assert.equal(g.status,'draw');assert.match(g.reason,/three times/);});
test('50 moves each without capture draws; capture resets clock and repetition',()=>{const g=position([0,1,3,6],[2,4,5,8],{quiet:QUIET_LIMIT-1});assert.equal(apply(g,move(0,9)).status,'draw');const c=position([0,1,2,9],[6,7,8,12],{quiet:99,capture:true,seen:{old:2}});const n=apply(c,take(12));assert.equal(n.status,'playing');assert.equal(n.quiet,0);assert.equal(n.seen.old,undefined);});
test('a win takes precedence over the quiet-move draw',()=>{const g=position([0,2,6,8],[1,7,9,11,12,14,19],{turn:2,quiet:99});assert.equal(apply(g,move(19,22)).status,'won');});
test('bad coordinates, missing action, wrong turn and occupied points are rejected immutably',()=>{const g=apply(newGame(),put(0)),original=JSON.stringify(g);for(const to of[-1,24,2.5,'1',null,NaN,Infinity])assert.throws(()=>apply(g,put(to)));assert.throws(()=>apply(g,null));assert.throws(()=>play(g,1,put(1)));assert.throws(()=>apply(g,put(0)));assert.equal(JSON.stringify(g),original);});
test('replay preserves capture turns, matches direct play and does not mutate history',()=>{const copy=JSON.stringify(opening);assert.deepEqual(replay(opening),opening.reduce(apply,newGame()));assert.equal(JSON.stringify(opening),copy);assert.equal(readMatch(matchOf(opening)).version,2);});
test('save/rejoin preserves a pending capture exactly',()=>{const m=matchOf(opening.slice(0,5));const loaded=readMatch(JSON.parse(JSON.stringify(m)));assert(gameOf(loaded).capture);assert.equal(gameOf(loaded).turn,1);assert.equal(gameOf(act(loaded,1,take(3))).board[3],0);});
test('old three-piece saves and invalid capture snapshots are rejected',()=>{const m=newMatch();for(const v of[null,{}, {...m,version:1},{...m,starter:2},{...m,round:0},{...m,ready:[true,true]},{...m,moves:[put(0),put(0)],revision:2},{...m,moves:[put(0),take(0)],revision:2},{...m,moves:Array(MAX_ACTIONS+1).fill(put(0)),revision:MAX_ACTIONS+1}])assert.throws(()=>readMatch(v));});
test('untrusted extra board/actor fields are stripped, not used',()=>{const m=matchOf([put(0)]);assert.deepEqual(readMatch({...m,board:Array(24).fill(2),moves:[{...put(0),actor:2}]}),m);});
test('online rematch requires both players and alternates starter',()=>{const m=resigned();const r=act(m,1,{type:'rematch'});assert.equal(r.round,1);assert.throws(()=>act(r,1,{type:'rematch'}));const n=act(r,2,{type:'rematch'});assert.equal(n.round,2);assert.equal(gameOf(n).turn,2);assert.equal(n.moves.length,0);assert.deepEqual(readMatch(n),n);});
test('resignation works even during a pending capture; no new-game resign/rematch',()=>{const m=matchOf(opening.slice(0,5));for(const p of[1,2])assert.equal(gameOf(act(m,p,{type:'resign'})).winner,3-p);assert.throws(()=>act(newMatch(),1,{type:'resign'}));assert.throws(()=>act(newMatch(),1,{type:'rematch'}));});
test('duplicate capture packets and stale revisions cannot remove a second piece',()=>{const m=matchOf(opening.slice(0,5)),n=act(m,1,take(3));assert.throws(()=>act(n,1,take(4),m.round,m.revision),/changed/);assert.throws(()=>act(n,1,take(4)),/turn/);assert.equal(gameOf(n).board[4],2);});
test('room code parsing accepts invitations and rejects malformed input',()=>{for(const s of['a1b2-c3d4-e5f6','#room=A1B2C3D4E5F6','https://legedith.github.io/9-men-s-morris/#room=A1B2C3D4E5F6'])assert.equal(roomCode(s),'A1B2C3D4E5F6');for(const s of['','hello','https://example.com/','javascript:alert(1)','Z'.repeat(12)])assert.equal(roomCode(s),'');});
test('network host enforces guest identity and rejects old protocol',()=>{const r=new OnlineRoom({onChange:()=>{},onStatus:()=>{}});r.role='host';r.connected=true;r.conn={open:true,send:()=>{}};r.receive({app:'nine-mens-morris-v2',type:'action',round:1,revision:0,action:{...put(0),actor:1}});assert.equal(r.match.moves.length,0);r.match=matchOf([put(0)]);r.receive({app:'nanis-morris-v1',type:'action',round:1,revision:1,action:put(1)});assert.equal(r.match.moves.length,1);r.receive({app:'nine-mens-morris-v2',type:'action',round:1,revision:1,action:put(1)});assert.equal(r.match.moves.length,2);});
test('network guest refuses an illegal board without overwriting its state',()=>{const r=new OnlineRoom({onChange:()=>{},onStatus:()=>{}});r.role='guest';r.connected=true;r.conn={open:true,send:()=>{}};r.receive({app:'nine-mens-morris-v2',type:'state',match:{...newMatch(),revision:2,moves:[put(0),put(0)]}});assert.equal(r.connected,false);assert.equal(r.match.moves.length,0);});
test('100 seeded legal games preserve material, turn, adjacency and finite termination',()=>{
  let seed=93841,states=0,captures=0;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
  for(let n=0;n<100;n++){
    let g=newGame(n%2+1);const history=[];
    while(g.status==='playing'){
      const actions=legalActions(g);assert(actions.length);const a=actions[Math.floor(random()*actions.length)];const prev=g;g=apply(g,a);history.push(a);states++;
      for(const p of[1,2]){assert(countPieces(g,p)<=g.placed[p-1]);assert(g.placed[p-1]<=9);assert(inHand(g,p)>=0);}
      if(a.type==='capture'){captures++;assert.equal(countPieces(g,3-prev.turn),countPieces(prev,3-prev.turn)-1);assert.equal(g.turn,3-prev.turn);}
      else if(g.capture)assert.equal(g.turn,prev.turn);else assert.equal(g.turn,3-prev.turn);
      assert(history.length<MAX_ACTIONS);
    }
    assert.deepEqual(replay(history,n%2+1),g);
  }
  assert(captures>100);console.log(`Validated ${states} states and ${captures} captures across 100 completed games.`);
});
