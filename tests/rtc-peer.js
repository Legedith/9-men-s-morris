/* TEST ONLY: PeerJS-shaped adapter with real RTCPeerConnection data channels.
   Signaling is supplied by the Python test broker, not the public PeerServer.
   Never loaded by production HTML. */
(() => {
  class Events {
    constructor(){this.handlers={};}
    on(name,fn){(this.handlers[name] ||= []).push(fn);return this;}
    emit(name,value){for(const fn of this.handlers[name] || [])fn(value);}
  }
  const gathered=pc=>new Promise(resolve=>{
    if(pc.iceGatheringState==='complete')return resolve();
    pc.addEventListener('icegatheringstatechange',()=>{if(pc.iceGatheringState==='complete')resolve();});
  });
  class Connection extends Events {
    constructor(owner,peer,metadata,id){super();this.owner=owner;this.peer=peer;this.metadata=metadata;this.id=id;this.open=false;this.ended=false;this.peerConnection=new RTCPeerConnection({iceServers:[]});owner.connections.set(id,this);}
    channel(dc){this.dc=dc;dc.onopen=()=>{this.open=true;this.emit('open');};dc.onmessage=e=>this.emit('data',JSON.parse(e.data));dc.onclose=()=>this.close();dc.onerror=e=>this.emit('error',e);}
    send(data){if(!this.open)throw new Error('Channel closed');this.dc.send(JSON.stringify(data));}
    close(){if(this.ended)return;this.ended=true;this.open=false;this.dc?.close();this.peerConnection.close();this.owner.connections.delete(this.id);this.emit('close');}
  }
  class TestPeer extends Events {
    constructor(id){super();this.id=id || crypto.randomUUID();this.connections=new Map();this.open=false;this.destroyed=false;this.disconnected=false;window.__testPeer=this;
      window.__signalReceive=async message=>{
        if(this.destroyed)return;
        if(message.type==='offer'){
          const c=new Connection(this,message.from,message.metadata,message.connection);
          c.peerConnection.ondatachannel=e=>c.channel(e.channel);
          this.emit('connection',c);
          await c.peerConnection.setRemoteDescription(message.sdp);
          await c.peerConnection.setLocalDescription(await c.peerConnection.createAnswer());
          await gathered(c.peerConnection);
          window.__signal({type:'answer',from:this.id,to:message.from,connection:c.id,sdp:c.peerConnection.localDescription.toJSON()});
        }else if(message.type==='answer'){
          const c=this.connections.get(message.connection);if(c)await c.peerConnection.setRemoteDescription(message.sdp);
        }else if(message.type==='unavailable')this.emit('error',{type:'peer-unavailable'});
      };
      window.__signal({type:'register',id:this.id}).then(()=>{if(!this.destroyed){this.open=true;this.emit('open',this.id);}});
    }
    connect(id,options){const c=new Connection(this,id,options.metadata,crypto.randomUUID());c.channel(c.peerConnection.createDataChannel('morris',{ordered:true}));
      (async()=>{await c.peerConnection.setLocalDescription(await c.peerConnection.createOffer());await gathered(c.peerConnection);await window.__signal({type:'offer',from:this.id,to:id,metadata:options.metadata,connection:c.id,sdp:c.peerConnection.localDescription.toJSON()});})().catch(e=>c.emit('error',e));return c;
    }
    reconnect(){this.open=true;this.disconnected=false;this.emit('open',this.id);}
    destroy(){this.destroyed=true;this.open=false;for(const c of this.connections.values())c.close();window.__signal({type:'unregister',id:this.id});this.emit('close');}
  }
  window.Peer=TestPeer;
})();
