// Build advanced browser fixtures by LEGAL play, never by trusting a custom board.
import {newMatch,newGame,play,legalActions,countPieces,capturable,isFlying,NEIGHBORS,MAX_ACTIONS} from '../src/game.js';
let seed=43891;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
const found={};
for(let n=0;n<200&&Object.keys(found).length<3;n++){
  let g=newGame(),m=newMatch();
  while(g.status==='playing'&&m.moves.length<MAX_ACTIONS){
    const actions=legalActions(g);
    if(!found.flying&&isFlying(g,g.turn)&&!g.capture){const a=actions.find(a=>!NEIGHBORS[a.from].includes(a.to));if(a)found.flying={match:structuredClone(m),action:a,player:g.turn};}
    if(g.capture){
      const targets=capturable(g),enemy=g.board.flatMap((p,i)=>p===3-g.turn?[i]:[]);
      if(!found.protected&&targets.length<enemy.length)found.protected={match:structuredClone(m),action:actions[0],protected:enemy.find(i=>!targets.includes(i)),targets:targets.length};
      if(!found.finish&&countPieces(g,3-g.turn)===3&&g.phase==='move')found.finish={match:structuredClone(m),action:actions[0],player:g.turn};
    }
    let candidates=actions;
    if(!g.capture&&random()<.65){const mills=actions.filter(a=>play(g,g.turn,a).capture);if(mills.length)candidates=mills;}
    const a=candidates[Math.floor(random()*candidates.length)];g=play(g,g.turn,a);m.moves.push(a);m.revision++;
  }
}
if(Object.keys(found).length!==3)throw new Error('Could not generate all advanced test scenarios.');
console.log(JSON.stringify(found));
