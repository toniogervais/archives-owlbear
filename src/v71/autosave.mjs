// Independent of the UI so retries, stale devices and in-flight edits can be tested.
export function autoBackup({cloud,capture,read,write,changed = () => {},timers = globalThis,delay = 8000}) {
  let binding = read(),running,version = 0,timer,closed = false,held = 0,blocked = false;
  let status = {state:binding?.enabled ? 'pending' : 'off',binding};
  function report(state,message = '') { status = {state,message,binding:binding && {...binding}};changed(status); }
  function persist() { write(binding); }
  function check(expected) {
    if (closed || held || !binding?.enabled || binding.campaignId !== expected.campaignId || binding.owner !== expected.owner || binding.project !== expected.project)
      throw Error('Sauvegarde suspendue. Les modifications restent sur cet appareil.');
  }
  async function save() {
    clearTimeout(timer);timer = null;
    if (running) return running;
    if (closed || held || !binding?.enabled || blocked) return;
    const current = {...binding},started = version;
    running = (async () => {
      try {
        report('saving');const ctx = await cloud.context();check(current);
        if (ctx.user.id !== current.owner || ctx.project !== current.project) throw Error('Reconnecte le compte MJ associé à cette sauvegarde.');
        const data = await capture();check(current);
        if (data.fingerprint === binding.fingerprint) {
          // Still check the head: this device must learn about another writer.
          const {rows} = await cloud.versions(current.campaignId);check(current);
          if ((rows[0]?.revision || 0) !== current.revision) { const error = Error('Une version plus récente existe en ligne. Ouvre Sauvegardes pour la consulter ou conserve ton travail dans une nouvelle campagne.');error.code='CONFLICT';throw error; }
        } else {
          const saved = await cloud.save({...data,campaignId:current.campaignId,expectedRevision:current.revision,check:async () => check(current)});
          check(current);binding = {...binding,revision:saved.revision,fingerprint:data.fingerprint,savedAt:saved.created_at};persist();
        }
        report(started === version ? 'saved' : 'pending');
      } catch (error) {
        if (closed) return;
        if (error.code === 'CONFLICT') blocked = true;
        report(error.code === 'CONFLICT' ? 'conflict' : 'error',error.message);
      } finally {
        running = null;
        if (!closed && version !== started && !blocked && !held) schedule();
      }
      return status;
    })();
    return running;
  }
  function schedule() {
    if (closed || held || !binding?.enabled || blocked) return;
    clearTimeout(timer);report('pending');timer = timers.setTimeout(() => { void save(); },delay);
  }
  return {
    status:() => status,
    binding:() => binding && {...binding},
    change() { version++;schedule(); },
    save,
    async bind(value) {
      if (running) throw Error('Attends la fin de la sauvegarde en cours.');
      binding = {...value,enabled:true};blocked = false;persist();version++;report('pending');return save();
    },
    pause() { clearTimeout(timer);binding = binding && {...binding,enabled:false};persist();report('off'); },
    hold() { held++;clearTimeout(timer);return () => { held=Math.max(0,held-1);if (!held) schedule(); }; },
    dispose() { closed=true;clearTimeout(timer); }
  };
}
