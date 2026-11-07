export function createPresence() {
  const players = new Map();
  return {
    party(values) {
      const present = new Set();
      for (const player of values) if (player.role === 'PLAYER' && typeof player.connectionId === 'string') {
        present.add(player.connectionId);
        const old = players.get(player.connectionId);
        players.set(player.connectionId,{id:player.connectionId,name:String(player.name || 'Joueur').slice(0,120),
          connected:true,screen:old?.connected ? old.screen : 'UNKNOWN',pending:old?.connected ? old.pending : false});
      }
      for (const [id,player] of players) if (!present.has(id)) players.set(id,{...player,connected:false,pending:false});
      if (players.size > 100) for (const [id,player] of players) { if (!player.connected) players.delete(id);if (players.size <= 100) break; }
    },
    report(id,data) {
      const player = players.get(id);
      if (!player?.connected || !['ARCHIVES','OWLBEAR'].includes(data?.screen) || typeof data.pending !== 'boolean') return false;
      players.set(id,{...player,screen:data.screen,pending:data.pending});return true;
    },
    list:() => Array.from(players.values(),player => ({...player}))
  };
}
