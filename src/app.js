import {newMatch, readMatch, gameOf, act, coordinate} from './game.js';
import {OnlineRoom, roomCode} from './online.js';
const $ = id => document.getElementById(id);
const names = ['Amber','Forest'];
const STORE = 'nanis-morris-local-v1';
let local = newMatch(), match, selected = null, mode = 'local', room = null, feedbackTimer;
try { const raw = localStorage.getItem(STORE); if (raw) local = readMatch(JSON.parse(raw)); } catch { /* Storage may be blocked or corrupt. */ }
match = local;
const spots = [...document.querySelectorAll('.spot')];
function feedback(message = '') { clearTimeout(feedbackTimer); $('feedback').textContent = message; if (message) feedbackTimer = setTimeout(() => $('feedback').textContent = '', 7000); }
function save() { try { localStorage.setItem(STORE, JSON.stringify(local)); } catch { /* Game remains playable without storage. */ } }
function myTurn(g) { return mode === 'local' || !!(room?.connected && !room.pending && room.seat === g.turn); }
function render() {
  const g = gameOf(match), online = mode === 'online';
  if (g.status !== 'playing' || !myTurn(g) || (selected !== null && g.board[selected] !== g.turn)) selected = null;
  $('local-mode').classList.toggle('active', !online); $('online-mode').classList.toggle('active', online);
  $('local-mode').setAttribute('aria-pressed', String(!online)); $('online-mode').setAttribute('aria-pressed', String(online));
  $('local-info').hidden = online; $('online-setup').hidden = !online || !!room; $('room-panel').hidden = !room;
  $('online-disclaimer').hidden = !online;
  $('round-label').textContent = `ROUND ${String(match.round).padStart(2,'0')}`;
  $('phase').textContent = g.status !== 'playing' ? 'ROUND / OVER' : g.phase === 'place' ? '01 / PLACE' : '02 / MOVE';
  let status = `${names[g.turn-1]}, ${g.phase === 'place' ? 'place a piece.' : 'make your move.'}`;
  let instruction = g.phase === 'place' ? 'Choose any empty spot. You each have three pieces.' : selected === null ? 'Select your piece, then move it to any empty spot.' : 'Now choose an empty spot. Any distance is allowed.';
  if (online && !room) { status = 'Invite a friend to play.'; instruction = 'Create a room or join with an invitation above.'; }
  else if (online && !room.connected) { status = room.role === 'host' ? 'Waiting for your friend…' : 'Connecting to the board…'; instruction = 'The board stays paused until both players are connected.'; }
  else if (online && room.pending) { status = 'Confirming your move…'; instruction = 'Waiting for the host. Your move will appear on both screens.'; }
  else if (online && room.seat !== g.turn && g.status === 'playing') { status = `${names[g.turn-1]}’s turn.`; instruction = 'Your friend is thinking. Your turn is next.'; }
  if (g.status === 'won') { status = `${names[g.winner-1]} wins!`; instruction = g.reason === 'Three in a row' ? 'Three in a line. Nicely played.' : 'The round ended by resignation.'; }
  if (g.status === 'draw') { status = 'A well-matched pair.'; instruction = 'This round is a draw. Time for a fresh board?'; }
  $('status').textContent = status; $('instruction').textContent = instruction;
  spots.forEach((button, i) => {
    const piece = g.board[i];
    const legal = g.status === 'playing' && myTurn(g) && (piece === 0 ? g.phase === 'place' || selected !== null : g.phase === 'move' && piece === g.turn);
    button.className = `spot${piece ? ` p${piece}` : ''}${selected === i ? ' selected' : ''}${legal ? ' legal' : ''}${legal && piece === 0 && selected !== null ? ' destination' : ''}${g.line.includes(i) ? ' winning' : ''}`;
    button.querySelector('.piece').textContent = piece === 1 ? '×' : piece === 2 ? '○' : '';
    button.setAttribute('aria-label', `${coordinate(i)}, ${piece ? names[piece-1] : 'empty'}${selected === i ? ', selected' : ''}${legal && piece === 0 ? ', available' : ''}`);
    button.setAttribute('aria-pressed', String(selected === i)); button.setAttribute('aria-disabled', String(!legal));
  });
  for (const p of [1,2]) {
    $(`player-${p}`).classList.toggle('active', g.status === 'playing' && g.turn === p);
    $(`you-${p}`).hidden = !room || room.seat !== p;
    $(`player-detail-${p}`).textContent = g.status === 'won' && g.winner === p ? 'Round winner' :
      g.phase === 'place' ? `${3-g.placed[p-1]} ${3-g.placed[p-1] === 1 ? 'piece' : 'pieces'} to place` : '3 pieces on the board';
    $(`reserve-${p}`).style.color = p === 1 ? 'var(--amber)' : 'var(--green)';
    $(`reserve-${p}`).replaceChildren(...Array.from({length:3}, (_, n) => { const dot = document.createElement('i'); if (n < g.placed[p-1]) dot.className = 'used'; return dot; }));
  }
  $('last-move').textContent = g.last ? `${names[g.last.player-1]} · ${g.last.from === null ? 'placed at ' : `${coordinate(g.last.from)} → `}${coordinate(g.last.to)}` : 'A familiar game. A fresh start.';
  $('result').hidden = g.status === 'playing';
  $('result-title').textContent = g.status === 'draw' ? 'Call it a draw.' : `${names[g.winner-1] || ''} takes this one.`;
  $('result-detail').textContent = online && match.ready.some(Boolean) ? (match.ready[room?.seat-1] ? 'Waiting for your friend to agree to a rematch.' : 'Your friend wants a rematch. Ready?') : `${g.reason}. ${names[2-match.starter]} starts next.`;
  $('rematch').textContent = online && match.ready[room?.seat-1] ? 'Rematch requested' : 'Play again';
  $('rematch').disabled = online && (!room?.connected || room.pending || match.ready[room.seat-1]);
  $('restart').textContent = online ? 'Resign this round' : 'Start over';
  $('restart').disabled = online && (!room?.connected || room.pending || !g.ply || g.status !== 'playing');
  $('reconnect').disabled = !!room?.connected;
  if (room) {
    $('room-code').textContent = room.code?.match(/.{1,4}/g)?.join('-') || '';
    const invite = new URL(location.href); invite.search = ''; invite.hash = `room=${room.code}`;
    $('invite').value = invite.href;
    $('seat-hint').textContent = `You are ${names[room.seat-1]}. ${room.role === 'host' ? 'Keep this tab open; closing or refreshing it ends the room.' : 'Keep the host’s tab open. This tab can rejoin after a refresh.'}`;
  }
}
function submit(action) {
  try {
    if (mode === 'online') { if (!room) throw new Error('Create or join a room first.'); room.submit(action); }
    else { local = act(local, gameOf(local).turn, action); match = local; save(); }
    selected = null; feedback(); render();
  } catch (e) { feedback(e.message); }
}
spots.forEach((button, i) => button.addEventListener('click', () => {
  const g = gameOf(match);
  if (g.status !== 'playing') return;
  if (!myTurn(g)) { feedback(room?.connected ? 'Wait for your turn.' : 'Connect both players to begin.'); return; }
  if (g.phase === 'move' && g.board[i] === g.turn) { selected = selected === i ? null : i; feedback(); render(); }
  else if (g.board[i] !== 0) feedback('That spot is occupied. Choose an empty one.');
  else if (g.phase === 'move' && selected === null) feedback('Select one of your own pieces first.');
  else submit({type:'move',from:selected,to:i});
}));
$('board').addEventListener('keydown', e => {
  const i = spots.indexOf(document.activeElement); if (i < 0) return;
  let target;
  if (e.key === 'ArrowRight') target = Math.floor(i/3)*3 + (i+1)%3;
  if (e.key === 'ArrowLeft') target = Math.floor(i/3)*3 + (i+2)%3;
  if (e.key === 'ArrowDown') target = (i+3)%9;
  if (e.key === 'ArrowUp') target = (i+6)%9;
  if (e.key === 'Home') target = 0;
  if (e.key === 'End') target = 8;
  if (target !== undefined) { e.preventDefault(); spots[target].focus(); }
  if (e.key === 'Escape') { selected = null; render(); }
});
function confirmAction(title, copy, action) {
  $('confirm-title').textContent = title; $('confirm-copy').textContent = copy;
  $('confirm-yes').onclick = () => { $('confirm-dialog').close(); action(); };
  $('confirm-dialog').showModal();
}
function leaveRoom() { room?.close(); room = null; selected = null; history.replaceState(null,'',location.pathname+location.search); match = local; feedback(); }
$('local-mode').onclick = () => {
  const go = () => { leaveRoom(); mode = 'local'; render(); };
  if (room) confirmAction('Leave this room?', 'Your opponent will be disconnected. Returning to same-device play restores your local board.', go); else go();
};
$('online-mode').onclick = () => { if (mode === 'online') return; mode = 'online'; match = newMatch(); selected = null; feedback(); render(); };
async function startRoom(role, code = '') {
  if (room) return;
  if (role === 'guest' && !roomCode(code)) { feedback('Enter a 12-character room code or a full invitation link.'); $('join-code').focus(); return; }
  mode = 'online'; selected = null; match = newMatch(); feedback();
  const active = new OnlineRoom({
    onChange: (value) => { if (room !== active) return; const changed = match.revision !== value.revision; match = value; if (changed) selected = null; render(); },
    onStatus: (text, kind) => { if (room !== active) return; $('connection-status').textContent = text; $('connection-dot').className = `connection-dot ${kind}`; }
  });
  room = active;
  try { await active.start(role, code); if (room === active) render(); }
  catch (e) { if (room === active) { leaveRoom(); mode = 'online'; match = newMatch(); render(); feedback(e.message); } }
}
$('host').onclick = () => startRoom('host');
$('join-form').onsubmit = e => { e.preventDefault(); startRoom('guest', $('join-code').value); };
$('leave').onclick = () => confirmAction('Leave this room?', 'Leaving as host ends the room. Your local game will not be changed.', () => { leaveRoom(); mode = 'online'; match = newMatch(); render(); });
$('reconnect').onclick = () => room?.reconnect();
$('copy-invite').onclick = async () => {
  try { await navigator.clipboard.writeText($('invite').value); $('copy-invite').textContent = 'Copied'; setTimeout(() => $('copy-invite').textContent = 'Copy', 2000); }
  catch { $('invite').focus(); $('invite').select(); feedback('Select and copy the invitation link shown in the room panel.'); }
};
$('restart').onclick = () => {
  if (mode === 'online') confirmAction('Resign this round?', 'Your friend will win this round. You can both agree to play again afterwards.', () => submit({type:'resign'}));
  else confirmAction('Start a fresh board?', 'This clears the current local round. Online rooms and other tabs are not affected.', () => { local = newMatch(); match = local; selected = null; save(); feedback(); render(); });
};
$('rematch').onclick = () => {
  if (mode === 'online') submit({type:'rematch'});
  else { try { local = act(local,1,{type:'rematch'}); local = act(local,2,{type:'rematch'}); match = local; save(); selected = null; feedback(); render(); } catch(e) { feedback(e.message); } }
};
for (const [button,dialog] of [['rules-open','rules-dialog'],['privacy-open','privacy-dialog']]) $(button).onclick = () => $(dialog).showModal();
document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => b.closest('dialog').close());
document.querySelectorAll('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d) { const b = d.getBoundingClientRect(); if (e.clientX < b.left || e.clientX > b.right || e.clientY < b.top || e.clientY > b.bottom) d.close(); } }));
window.addEventListener('beforeunload', e => { if (room?.role === 'host' && room.connected) { e.preventDefault(); e.returnValue = ''; } });
window.addEventListener('pagehide', () => room?.close());
const inviteCode = roomCode(location.hash);
if (inviteCode) { mode = 'online'; match = newMatch(); $('join-code').value = inviteCode; feedback('Your invitation is ready. Press Join to connect to your friend.'); }
render();
