import { newMatch, readMatch, act } from './game.js?v=2';
// A new namespace prevents clients using the old 3x3 rules from sharing a room.
const APP = 'nine-mens-morris-v2';
const validCode = s => /^[A-F0-9]{12}$/.test(s);
const randomHex = size => Array.from(crypto.getRandomValues(new Uint8Array(size)), n => n.toString(16).padStart(2,'0')).join('').toUpperCase();
export function roomCode(input) {
  let s = String(input).trim();
  try { if (/^https?:/i.test(s)) s = new URL(s).hash.slice(1); } catch { return ''; }
  s = s.replace(/^#?(room=)?/i, '').replace(/[\s-]/g,'').toUpperCase();
  return validCode(s) ? s : '';
}
let peerLibrary;
async function loadPeer() {
  if (globalThis.Peer) return globalThis.Peer;
  if (!globalThis.RTCPeerConnection) throw new Error('Online play needs a browser with WebRTC. Try a recent Chrome, Firefox, Edge or Safari.');
  if (!peerLibrary) peerLibrary = (async () => {
    for (const host of ['https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js', 'https://unpkg.com/peerjs@1.5.5/dist/peerjs.min.js']) {
      try {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script'); s.src = host; s.crossOrigin = 'anonymous';
          const timer = setTimeout(() => { s.remove(); reject(new Error('Library load timed out.')); }, 12000);
          s.onload = () => { clearTimeout(timer); resolve(); };
          s.onerror = () => { clearTimeout(timer); s.remove(); reject(new Error('Could not load the connection library.')); };
          document.head.append(s);
        });
        if (globalThis.Peer) return globalThis.Peer;
      } catch { /* Try the second pinned CDN; local play does not load either. */ }
    }
    throw new Error('The connection library could not load. Check your internet or content blocker; local play still works.');
  })().catch(e => { peerLibrary = null; throw e; });
  return peerLibrary;
}
/** Ephemeral two-seat room. The host validates actions; guests replay snapshots. */
export class OnlineRoom {
  constructor({onChange, onStatus}) {
    this.onChange = onChange; this.onStatus = onStatus; this.match = newMatch();
    this.closed = false; this.connected = false; this.pending = false;
    this.attempts = 0; this.timers = new Set(); this.connections = new Set();
  }
  later(fn, ms) {
    const id = setTimeout(() => { this.timers.delete(id); if (!this.closed) fn(); }, ms);
    this.timers.add(id); return id;
  }
  status(text, kind = 'waiting') { if (!this.closed) this.onStatus(text, kind); }
  change() { if (!this.closed) this.onChange(this.match, this); }
  async start(role, code = '') {
    this.role = role; this.seat = role === 'host' ? 1 : 2;
    this.code = role === 'host' ? randomHex(6) : roomCode(code);
    if (!validCode(this.code)) throw new Error('Enter a 12-character room code or an invitation link.');
    this.token = randomHex(16);
    if (role === 'guest') {
      try { this.token = sessionStorage.getItem(`${APP}:${this.code}`) || this.token;
        sessionStorage.setItem(`${APP}:${this.code}`, this.token); } catch { /* In-memory fallback. */ }
    }
    this.status('Opening a secure connection…'); this.change();
    const Peer = await loadPeer();
    if (this.closed) return;
    // Preserve PeerJS 1.5.5's public STUN and TURN defaults.
    this.peer = new Peer(role === 'host' ? `${APP}-${this.code}` : undefined, {secure:true, debug:0});
    const opening = this.later(() => { if (!this.peer.open) this.status('The connection service did not respond. Leave the room and try again.', 'error'); }, 18000);
    this.peer.on('open', () => {
      clearTimeout(opening);
      if (this.closed) return;
      if (this.role === 'host') this.status(this.connected ? 'Connected to your friend' : 'Room open. Send the invite to your friend.', this.connected ? 'online' : 'waiting');
      else if (!this.connected) this.connectGuest();
    });
    this.peer.on('connection', conn => {
      if (this.closed) { conn.close(); return; }
      if (this.role !== 'host') { this.reject(conn, 'This player is not hosting.'); return; }
      this.attach(conn);
    });
    this.peer.on('disconnected', () => {
      if (!this.connected) this.status('Reconnecting to the connection service…');
      this.later(() => { if (!this.peer.destroyed && this.peer.disconnected) { try { this.peer.reconnect(); } catch {} } }, 2500);
    });
    this.peer.on('error', error => {
      if (this.closed) return;
      if (error.type === 'peer-unavailable' && this.role === 'guest') {
        this.status('Host not reachable yet. Keep their tab open; retrying…'); this.retrySoon();
      } else if (!this.connected) {
        this.status(error.type === 'unavailable-id' ? 'This room address is already in use. Leave and create a new room.' :
          'Could not connect. Check your internet, try another network, or leave and create a new room.', 'error'); this.change();
      }
    });
    this.pulse = setInterval(() => {
      if (this.closed || !this.conn?.open || !this.connected) return;
      if (Date.now() - this.lastSeen > 25000) { const c=this.conn; c.close(); this.lost(c); return; }
      this.send({type:'ping'});
    }, 5000);
  }
  reject(conn, message) {
    conn.on('error', () => {});
    const send = () => { try { conn.send({app:APP,type:'reject',message}); } catch {} this.later(() => conn.close(), 250); };
    if (conn.open) send(); else { conn.on('open', send); this.later(() => conn.close(), 10000); }
  }
  connectGuest() {
    if (this.closed || this.connected || !this.peer?.open || this.connecting) return;
    if (this.attempts >= 8) { this.status('Connection timed out. Keep the host tab open and try another network, then press Reconnect.', 'error'); return; }
    this.attempts++; this.connecting = true;
    const conn = this.peer.connect(`${APP}-${this.code}`, {reliable:true, serialization:'json', metadata:{app:APP,token:this.token}});
    this.attach(conn);
  }
  attach(conn) {
    this.connections.add(conn);
    conn.on('error', () => this.lost(conn));
    conn.on('close', () => { this.connections.delete(conn); this.lost(conn); });
    let admitted = false;
    const timeout = this.later(() => { if (!admitted) { conn.close(); this.lost(conn); } }, 15000);
    conn.on('open', () => {
      if (this.closed) { conn.close(); return; }
      if (this.role === 'host') {
        const meta = conn.metadata;
        if (!meta || meta.app !== APP || !/^[A-F0-9]{32}$/.test(meta.token || '') ||
          (this.guestToken && this.guestToken !== meta.token) || this.conn?.open) {
          this.reject(conn, 'This room already has two players, or the invitation is incompatible.'); return;
        }
        this.guestToken = meta.token;
      }
      admitted = true; clearTimeout(timeout);
      this.conn = conn; this.connecting = false; this.lastSeen = Date.now(); this.pending = false;
      if (this.role === 'host') { this.status('Friend connected. Synchronizing the board…'); this.sync(); }
      else this.status('Connected. Receiving the board…');
    });
    conn.on('data', data => {
      if (this.closed) return;
      if (data?.app === APP && data.type === 'reject' && this.role === 'guest') {
        this.attempts = 8; this.status('This room is full. Ask your friend to create a new room.', 'error'); conn.close(); return;
      }
      if (admitted && conn === this.conn) this.receive(data);
    });
  }
  send(data) {
    if (!this.conn?.open) return false;
    try { this.conn.send({app:APP, ...data}); return true; }
    catch { this.lost(this.conn); return false; }
  }
  sync() { this.send({type:'state', match:this.match}); }
  receive(data) {
    if (!data || typeof data !== 'object' || data.app !== APP) return;
    this.lastSeen = Date.now();
    if (data.type === 'ping') { this.send({type:'pong'}); return; }
    if (data.type === 'pong') return;
    if (this.role === 'host') {
      if (data.type === 'ack' && data.revision === this.match.revision) {
        this.connected = true; this.attempts = 0; this.status('Connected to your friend', 'online'); this.change();
      } else if (data.type === 'sync') this.sync();
      else if (data.type === 'action' && this.connected) {
        try { this.match = act(this.match, 2, data.action, data.round, data.revision); }
        catch (e) { this.send({type:'notice',message:e.message}); }
        this.sync(); this.change();
      }
    } else if (data.type === 'state') {
      try {
        const next = readMatch(data.match);
        if (next.revision < this.match.revision || next.round < this.match.round) throw new Error('An outdated board was received.');
        this.match = next; this.pending = false; this.connected = true; this.attempts = 0;
        this.send({type:'ack',revision:next.revision}); this.status('Connected to your friend', 'online'); this.change();
      } catch {
        this.status('The other player sent an invalid board. Play is paused; leave and start a new room.', 'error');
        this.connected = false; this.change();
      }
    } else if (data.type === 'notice') {
      this.pending = false; this.status('The move was not accepted. Synchronizing the board…'); this.send({type:'sync'}); this.change();
    }
  }
  submit(action) {
    if (!this.connected || !this.conn?.open) throw new Error('Wait until both players are connected.');
    if (this.pending) throw new Error('Waiting for the host to confirm your move.');
    const next = act(this.match, this.seat, action);
    if (this.role === 'host') { this.match = next; this.sync(); this.change(); }
    else {
      this.pending = true;
      if (!this.send({type:'action',round:this.match.round,revision:this.match.revision,action})) {
        this.pending = false; throw new Error('Connection lost. Reconnect to continue.');
      }
      this.change();
      const revision = this.match.revision;
      this.later(() => { if (this.pending && this.match.revision === revision) {
        this.status('Confirmation delayed. Checking the board…'); this.send({type:'sync'});
      } }, 6000);
    }
  }
  lost(conn) {
    if (this.closed || (this.conn && conn !== this.conn)) return;
    this.connected = false; this.pending = false; this.connecting = false; this.conn = null;
    if (this.attempts < 8) this.status(this.role === 'host' ? 'Friend disconnected. Board saved; waiting for them to reconnect.' : 'Connection lost. Reconnecting without resetting the board…');
    this.change(); if (this.role === 'guest') this.retrySoon();
  }
  retrySoon() {
    if (this.retryTimer || this.closed) return;
    this.retryTimer = this.later(() => { this.retryTimer = null; this.connectGuest(); }, 2500);
  }
  reconnect() {
    this.attempts = 0;
    if (!this.peer || this.peer.destroyed) { this.status('Leave this room and create or join a new one.', 'error'); return; }
    if (this.peer.disconnected) { try { this.peer.reconnect(); } catch {} }
    else if (this.role === 'guest') this.connectGuest();
    else this.status('Room is open. Your friend can use the same invite again.');
  }
  close() {
    this.closed = true; clearInterval(this.pulse); this.timers.forEach(clearTimeout);
    this.connections.forEach(c => c.close()); this.peer?.destroy(); this.connected = false;
  }
}
