// Complete campaigns stay in a private, owner-only bucket. No signed/public links
// and no campaign bytes pass through Owlbear's shared metadata or player channels.
import {digest} from '../v60/files.mjs';
export const BACKUP_BUCKET = 'archives-campaign-backups';
export const PART_BYTES = 4 * 1024 * 1024;
const maxBytes = 512 * 1024 * 1024;
const uuid = value => /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value || '');
const hash = value => /^[a-f0-9]{64}$/.test(value || '');
const unwrap = result => { if (result.error) throw result.error;return result.data; };
export function cloudError(error) {
  if (/ARCHIVES_BACKUP_CONFLICT/.test(error.message || '')) {
    const conflict = Error('Une version plus récente existe en ligne. Ouvre Sauvegardes pour la consulter ou conserve ton travail dans une nouvelle campagne.');
    conflict.code = 'CONFLICT';return conflict;
  }
  if (/PGRST20[25]|42P01|42883/.test(error.code || '') || /bucket.*not found|archives_campaign_backups.*does not exist/i.test(error.message || '')) {
    const setup = Error('Le stockage des sauvegardes doit être activé une fois dans Supabase. Ouvre « Activer le stockage » dans Sauvegardes.');setup.code = 'SETUP';return setup;
  }
  return error instanceof Error ? error : Error(error.message || 'Sauvegarde en ligne indisponible.');
}
export function validCloudRecord(row,owner,campaign) {
  return !!row && uuid(row.id) && row.owner_id === owner && row.campaign_id === campaign &&
    Number.isSafeInteger(row.revision) && row.revision > 0 && hash(row.sha256) && hash(row.fingerprint) &&
    Number.isSafeInteger(row.byte_size) && row.byte_size > 0 && row.byte_size <= maxBytes &&
    Array.isArray(row.parts) && row.parts.length > 0 && row.parts.length <= 128 &&
    row.parts.every(part => Number.isInteger(part.bytes) && part.bytes > 0 && part.bytes <= PART_BYTES && hash(part.hash)) &&
    row.parts.reduce((total,part) => total + part.bytes,0) === row.byte_size;
}
export function createCloud(getClient) {
  async function context() {
    const client = getClient(),user = unwrap(await client.auth.getUser())?.user;
    if (!uuid(user?.id)) throw Error('Connecte-toi avec ton compte MJ dans « Comptes & campagnes ».');
    const project = new URL(client.supabaseUrl).origin;
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(project)) throw Error('Projet Supabase invalide.');
    return {client,user,project};
  }
  async function owned(ctx,id) {
    if (!uuid(id)) throw Error('Choisis une campagne.');
    const campaign = unwrap(await ctx.client.from('campaigns').select('id,name,owner_id').eq('id',id).maybeSingle());
    if (campaign?.owner_id !== ctx.user.id) throw Error('Les sauvegardes complètes sont réservées au propriétaire de la campagne.');
    return campaign;
  }
  async function same(ctx,check) {
    await check();const current = await context();
    if (current.user.id !== ctx.user.id || current.project !== ctx.project) throw Error('Le compte ou le projet a changé. Reconnecte la sauvegarde.');
  }
  async function versions(id) {
    const ctx = await context();await owned(ctx,id);
    const rows = unwrap(await ctx.client.from('archives_campaign_backups').select('*').eq('campaign_id',id).order('revision',{ascending:false}).limit(10)) || [];
    if (!rows.every(row => validCloudRecord(row,ctx.user.id,id))) throw Error('La liste des sauvegardes est invalide.');
    return {ctx,rows};
  }
  return {
    context,
    async campaigns() {
      const ctx = await context();
      return {ctx,rows:unwrap(await ctx.client.from('campaigns').select('id,name,owner_id').eq('owner_id',ctx.user.id).order('name')) || []};
    },
    async create(name) {
      const ctx = await context(),title = String(name || '').trim().slice(0,120);
      if (!title) throw Error('Donne un nom à la campagne.');
      return unwrap(await ctx.client.from('campaigns').insert({name:title,owner_id:ctx.user.id}).select('id,name,owner_id').single());
    },
    versions,
    async save({campaignId,expectedRevision,blob,summary,fingerprint,check = async () => {}}) {
      const ctx = await context();await owned(ctx,campaignId);await same(ctx,check);
      if (!(blob instanceof Blob) || !blob.size || blob.size > maxBytes || !hash(fingerprint) || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0)
        throw Error('Sauvegarde invalide.');
      const heads = await versions(campaignId),head = heads.rows[0];
      if ((head?.revision || 0) !== expectedRevision) throw cloudError({message:'ARCHIVES_BACKUP_CONFLICT'});
      const id = crypto.randomUUID(),prefix = ctx.user.id+'/'+campaignId+'/'+id+'/',bucket = ctx.client.storage.from(BACKUP_BUCKET),parts = [],uploaded = [];
      let publishing = false;
      try {
        const sha256 = await digest(blob);
        for (let offset = 0;offset < blob.size;offset += PART_BYTES) {
          await same(ctx,check);const part = blob.slice(offset,offset+PART_BYTES),path = prefix+parts.length;
          const partHash = await digest(part);
          unwrap(await bucket.upload(path,part,{contentType:'application/octet-stream',upsert:false,cacheControl:'0'}));
          uploaded.push(path);parts.push({bytes:part.size,hash:partHash});
        }
        await same(ctx,check);publishing = true;
        const args = {p_campaign_id:campaignId,p_id:id,p_expected_revision:expectedRevision,p_parts:parts,p_sha256:sha256,p_fingerprint:fingerprint,p_summary:summary};
        let reply = await ctx.client.rpc('archives_commit_backup',args);
        // The same immutable id makes a lost-response retry idempotent.
        if (reply.error && !/ARCHIVES_BACKUP_CONFLICT/.test(reply.error.message || '')) { await same(ctx,check);reply = await ctx.client.rpc('archives_commit_backup',args); }
        const result = unwrap(reply);
        if (!validCloudRecord(result?.backup,ctx.user.id,campaignId)) throw Error('La sauvegarde n’a pas été confirmée par le serveur.');
        await same(ctx,check);
        const removed = (result.removed || []).filter(path => typeof path === 'string' && path.startsWith(ctx.user.id+'/'+campaignId+'/'));
        // Published metadata is authoritative; pruning failure must not erase a successful save.
        if (removed.length) await bucket.remove(removed).catch(() => {});
        return result.backup;
      } catch (error) {
        // After an ambiguous commit response, preserve bytes that might be published.
        if (!publishing && uploaded.length) await bucket.remove(uploaded).catch(() => {});
        throw cloudError(error);
      }
    },
    async download(campaignId,id,check = async () => {}) {
      const {ctx,rows} = await versions(campaignId),row = rows.find(row => row.id === id);
      if (!row) throw Error('Cette version n’est plus disponible. Actualise la liste des sauvegardes.');
      const parts = [],bucket = ctx.client.storage.from(BACKUP_BUCKET);
      for (let index = 0;index < row.parts.length;index++) {
        await same(ctx,check);
        const part = unwrap(await bucket.download(ctx.user.id+'/'+campaignId+'/'+row.id+'/'+index));
        if (!(part instanceof Blob) || part.size !== row.parts[index].bytes || await digest(part) !== row.parts[index].hash)
          throw Error('La sauvegarde reçue est incomplète ou endommagée. Aucune restauration n’a été faite.');
        parts.push(part);
      }
      const blob = new Blob(parts,{type:'application/octet-stream'});
      if (blob.size !== row.byte_size || await digest(blob) !== row.sha256) throw Error('La sauvegarde est endommagée. Aucune restauration n’a été faite.');
      await same(ctx,check);return {blob,row,head:rows[0],ctx};
    }
  };
}
