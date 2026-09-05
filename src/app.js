import {POINTS,newMatch,readMatch,gameOf,act,coordinate,countPieces,inHand,isFlying,destinations,capturable,inMill} from './game.js?v=2';
import {OnlineRoom,roomCode} from './online.js?v=2';
const $=id=>document.getElementById(id), names=['Amber','Forest'], STORE='nine-mens-morris-local-v2';
let local=newMatch(),match,selected=null,mode='local',room=null,feedbackTimer;
try { const raw=localStorage.getItem(STORE); if(raw) local=readMatch(JSON.parse(raw)); } catch { /* Ignore invalid or incompatible saves. */ }
match=local;
const spots=POINTS.map(([name,x,y],i)=>{
  const b=document.createElement('button'); b.className='spot'; b.dataset.cell=i;
  b.style.gridColumn=x+1; b.style.gridRow=y+1;
  b.innerHTML='<span class="piece"></span><span class="position"></span>';
  b.querySelector('.position').textContent=name; $('board').append(b); return b;
});
function feedback(text='') { clearTimeout(feedbackTimer); $('feedback').textContent=text; if(text) feedbackTimer=setTimeout(()=>$('feedback').textContent='',7000); }
function save(){try{localStorage.setItem(STORE,JSON.stringify(local));}catch{}}
const myTurn=g=>mode==='local'||!!(room?.connected&&!room.pending&&room.seat===g.turn);
function render(){
  const g=gameOf(match),online=mode==='online',active=myTurn(g),flying=isFlying(g,g.turn);
  if(g.status!=='playing'||!active||g.capture||(selected!==null&&g.board[selected]!==g.turn))selected=null;
  $('local-mode').classList.toggle('active',!online); $('online-mode').classList.toggle('active',online);
  $('local-mode').setAttribute('aria-pressed',!online); $('online-mode').setAttribute('aria-pressed',online);
  $('local-info').hidden=online; $('online-setup').hidden=!online||!!room; $('room-panel').hidden=!room; $('online-disclaimer').hidden=!online;
  $('round-label').textContent=`ROUND ${String(match.round).padStart(2,'0')}`;
  $('phase').textContent=g.status!=='playing'?'ROUND OVER':g.capture?'CAPTURE':g.phase==='place'?'01 / PLACE':flying?'03 / FLY':'02 / SLIDE';
  $('phase').classList.toggle('capture',g.capture);
  let status=`${names[g.turn-1]}, ${g.capture?'capture a piece.':g.phase==='place'?'place a piece.':flying?'you can fly.':'move a piece.'}`;
  let instruction=g.capture?'Mill formed! Choose a highlighted opposing piece to remove.':g.phase==='place'?'Place your nine pieces. A mill earns a capture, not a win.':flying?'Three pieces left: move one to any empty point.':selected===null?'Select your piece, then an adjacent empty point along a line.':'Choose a highlighted adjacent point. You cannot jump over pieces.';
  if(online&&!room){status='Invite a friend to play.';instruction='Create a room or join with an invitation above.';}
  else if(online&&!room.connected){status=room.role==='host'?'Waiting for your friend…':'Connecting to the board…';instruction='Play is paused until both players are connected.';}
  else if(online&&room.pending){status='Confirming your action…';instruction='Waiting for the host to update both boards.';}
  else if(online&&room.seat!==g.turn&&g.status==='playing'){status=`${names[g.turn-1]}’s turn.`;instruction=g.capture?'Your friend formed a mill and is choosing a piece to capture.':'Your friend is thinking. Your turn is next.';}
  if(g.status==='won'){status=`${names[g.winner-1]} wins!`;instruction=g.reason+'.';}
  if(g.status==='draw'){status='This round is a draw.';instruction=g.reason+'.';}
  $('status').textContent=status; $('instruction').textContent=instruction;
  const targets=g.capture?capturable(g):selected!==null?destinations(g,selected):[];
  spots.forEach((b,i)=>{
    const p=g.board[i],legal=g.status==='playing'&&active&&(g.capture?targets.includes(i):g.phase==='place'?p===0:p===g.turn?destinations(g,i).length>0:targets.includes(i));
    b.className=`spot${p?` p${p}`:''}${i===selected?' selected':''}${legal?' legal':''}${legal&&p===0&&selected!==null?' destination':''}${g.capture&&targets.includes(i)&&active?' removable':''}${g.line.includes(i)?' mill':''}`;
    b.querySelector('.piece').textContent=p===1?'×':p===2?'○':'';
    b.setAttribute('aria-label',`${coordinate(i)}, ${p?names[p-1]:'empty'}${i===selected?', selected':''}${g.capture&&p===3-g.turn&&!targets.includes(i)?', protected by a mill':''}${legal?', available':''}`);
    b.setAttribute('aria-pressed',i===selected);b.setAttribute('aria-disabled',!legal);
  });
  for(const p of [1,2]){
    const hand=inHand(g,p),onBoard=countPieces(g,p),lost=g.placed[p-1]-onBoard;
    $(`player-${p}`).classList.toggle('active',g.status==='playing'&&g.turn===p);$(`you-${p}`).hidden=!room||room.seat!==p;
    $(`player-detail-${p}`).textContent=`${hand} in hand · ${onBoard} on board`;
    $(`captured-${p}`).textContent=`${lost} captured${isFlying(g,p)?' · Flying enabled':''}`;
    $(`reserve-${p}`).replaceChildren(...Array.from({length:9},(_,n)=>{const d=document.createElement('i');if(n>=hand)d.className='used';return d;}));
  }
  $('last-move').textContent=g.last?`${names[g.last.player-1]} · ${g.last.from===null?'placed at ':coordinate(g.last.from)+' → '}${coordinate(g.last.to)}${g.last.captured!==null?' · captured '+coordinate(g.last.captured):''}`:'Nine pieces each. Make every mill count.';
  $('result').hidden=g.status==='playing'; $('result-title').textContent=g.status==='draw'?'Call it a draw.':`${names[g.winner-1]||''} takes this one.`;
  $('result-detail').textContent=online&&match.ready.some(Boolean)?(match.ready[room?.seat-1]?'Waiting for your friend to agree to a rematch.':'Your friend wants a rematch. Ready?'):`${g.reason}. ${names[2-match.starter]} starts next.`;
  $('rematch').textContent=online&&match.ready[room?.seat-1]?'Rematch requested':'Play again';
  $('rematch').disabled=online&&(!room?.connected||room.pending||match.ready[room.seat-1]);
  $('restart').textContent=online?'Resign this round':'Start over';$('restart').disabled=online&&(!room?.connected||room.pending||!match.moves.length||g.status!=='playing');
  $('reconnect').disabled=!!room?.connected;
  if(room){$('room-code').textContent=room.code?.match(/.{1,4}/g)?.join('-')||'';const invite=new URL(location.href);invite.search='';invite.hash=`room=${room.code}`;$('invite').value=invite.href;
    $('seat-hint').textContent=`You are ${names[room.seat-1]}. ${room.role==='host'?'Keep this tab open; closing or refreshing it ends the room.':'Rejoin from this tab after a refresh while the host stays open.'}`;}
}
function submit(action){try{if(mode==='online'){if(!room)throw new Error('Create or join a room first.');room.submit(action);}else{local=act(local,gameOf(local).turn,action);match=local;save();}selected=null;feedback();render();}catch(e){feedback(e.message);}}
spots.forEach((b,i)=>b.onclick=()=>{
  const g=gameOf(match);if(g.status!=='playing')return;
  if(!myTurn(g)){feedback(room?.connected?'Wait for your turn.':'Connect both players to begin.');return;}
  if(g.capture){submit({type:'capture',at:i});return;}
  if(g.phase==='move'&&g.board[i]===g.turn){selected=selected===i?null:i;feedback(destinations(g,i).length?'':'This piece is blocked. Choose a different one.');render();}
  else if(g.board[i]!==0)feedback('That point is occupied. Choose an empty one.');
  else if(g.phase==='move'&&selected===null)feedback('Select one of your own pieces first.');
  else submit({type:'move',from:selected,to:i});
});
$('board').addEventListener('keydown',e=>{
  const i=spots.indexOf(document.activeElement);if(i<0)return;
  const dirs={ArrowRight:[1,0],ArrowLeft:[-1,0],ArrowDown:[0,1],ArrowUp:[0,-1]};let target;
  if(dirs[e.key]){const [dx,dy]=dirs[e.key],[,x,y]=POINTS[i];const candidates=POINTS.map(([,xx,yy],j)=>({j,a:(xx-x)*dx+(yy-y)*dy,b:Math.abs((xx-x)*dy-(yy-y)*dx)})).filter(c=>c.a>0).sort((a,b)=>(a.b*10+a.a)-(b.b*10+b.a));target=candidates[0]?.j??i;}
  if(e.key==='Home')target=0;if(e.key==='End')target=23;
  if(target!==undefined){e.preventDefault();spots[target].focus();}if(e.key==='Escape'){selected=null;render();}
});
function confirmAction(title,text,fn){$('confirm-title').textContent=title;$('confirm-copy').textContent=text;$('confirm-yes').onclick=()=>{$('confirm-dialog').close();fn();};$('confirm-dialog').showModal();}
function leaveRoom(){room?.close();room=null;selected=null;history.replaceState(null,'',location.pathname+location.search);match=local;feedback();}
$('local-mode').onclick=()=>{const go=()=>{leaveRoom();mode='local';render();};if(room)confirmAction('Leave this room?','Your opponent will be disconnected. Your local board is kept separately.',go);else go();};
$('online-mode').onclick=()=>{if(mode==='online')return;mode='online';match=newMatch();selected=null;feedback();render();};
async function startRoom(role,code=''){
  if(room)return;if(role==='guest'&&!roomCode(code)){feedback('Enter a 12-character room code or a full invitation link.');$('join-code').focus();return;}
  mode='online';selected=null;match=newMatch();feedback();
  const active=new OnlineRoom({onChange:value=>{if(room!==active)return;const changed=match.revision!==value.revision;match=value;if(changed)selected=null;render();},onStatus:(text,kind)=>{if(room!==active)return;$('connection-status').textContent=text;$('connection-dot').className=`connection-dot ${kind}`;}});room=active;
  try{await active.start(role,code);if(room===active){if(role==='guest')history.replaceState(null,'',`#room=${active.code}`);render();}}
  catch(e){if(room===active){leaveRoom();mode='online';match=newMatch();render();feedback(e.message);}}
}
$('host').onclick=()=>startRoom('host');$('join-form').onsubmit=e=>{e.preventDefault();startRoom('guest',$('join-code').value);};
$('leave').onclick=()=>confirmAction('Leave this room?','Leaving as host ends the room. Your local game will not change.',()=>{leaveRoom();mode='online';match=newMatch();render();});
$('reconnect').onclick=()=>room?.reconnect();
$('copy-invite').onclick=async()=>{try{await navigator.clipboard.writeText($('invite').value);$('copy-invite').textContent='Copied';setTimeout(()=>$('copy-invite').textContent='Copy',2000);}catch{$('invite').focus();$('invite').select();feedback('Select and copy the invitation link.');}};
$('restart').onclick=()=>{if(mode==='online')confirmAction('Resign this round?','Your friend wins this round. Both players can then agree to a rematch.',()=>submit({type:'resign'}));else confirmAction('Start a fresh board?','This clears only the current local round.',()=>{local=newMatch();match=local;selected=null;save();feedback();render();});};
$('rematch').onclick=()=>{if(mode==='online')submit({type:'rematch'});else{local=act(local,1,{type:'rematch'});local=act(local,2,{type:'rematch'});match=local;selected=null;save();feedback();render();}};
for(const [b,d] of [['rules-open','rules-dialog'],['privacy-open','privacy-dialog']])$(b).onclick=()=>$(d).showModal();
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const b=d.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)d.close();}}));
window.addEventListener('beforeunload',e=>{if(room?.role==='host'&&room.connected){e.preventDefault();e.returnValue='';}});
window.addEventListener('pagehide',()=>room?.close());
function receiveInvite(){const code=roomCode(location.hash);if(!code||room)return;mode='online';match=newMatch();selected=null;$('join-code').value=code;feedback('Your invitation is ready. Press Join to connect.');render();}
window.addEventListener('hashchange',receiveInvite);
window.addEventListener('pageshow',e=>{if(e.persisted&&room?.closed){room=null;mode='online';match=newMatch();receiveInvite();render();}});
receiveInvite();render();
