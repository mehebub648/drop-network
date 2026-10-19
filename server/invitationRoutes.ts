import express from 'express';
import { randomInt, randomUUID } from 'node:crypto';
import {
  addImportedDonors,
  countImportedDonors,
  findImportedDonorsByPublicIds,
  getAllFromTable,
  queryImportedDonors,
  replaceImportedDonor,
  saveToTable
} from './db';
import {
  claimPathForImportedDonor,
  toImportedDonor,
  toImportedDonorRow,
  type ImportedDonor,
  type ScrapedRecordInput
} from './importedDonors';
import { SmsProviderError, type SmsProvider, type SmsDeliveryStatus } from './sms';
import { readContributionFile, saveContributionFile } from './contributionFiles';
import {
  CONTRIBUTION_FILE_TYPES,
  MAX_CONTRIBUTION_BATCH_BYTES,
  campaignSendTimes,
  createInvitation,
  deliveryAggregate,
  invitationIdempotencyKey,
  safeContributionFileName,
  validatePacing,
  type CampaignPacing,
  type ContributionBatch,
  type InvitationAttempt,
  type InvitationCampaign,
  type InvitationDeliveryStatus,
  type ProfileInvitation
} from './invitationOperations';

type InvitationUser = { id: string; name: string; phone: string };
type InvitationAuth = { user: InvitationUser };
type ImportedInput = { name: string; phone: string; blood_group: string; district: string; upazila: string };

type InvitationDependencies = {
  getAuth(req: express.Request): InvitationAuth | null;
  requireManager(req: express.Request, res: express.Response): InvitationAuth | null;
  normalizePhone(value: unknown): string | null;
  cleanString(value: unknown, maximum: number): string | null;
  parseImportedInput(value: unknown): ImportedInput | { error: string };
  resolveLocation(district: string): { lat: number; lng: number; area_name: string } | null;
  publicOrigin(req: express.Request): string;
  configuredOrigin(): string;
  smsProvider(): SmsProvider | null;
  registeredPhone(phone: string): boolean;
  maskPhone(phone: string): string;
  userSummary(id: string): { id: string; name: string; phone: string } | null;
  audit(actorId: string, action: string, targetType: string, targetId: string, details?: Record<string, unknown>): Promise<unknown>;
};

const DEFAULT_PACING: CampaignPacing = {
  start_per_minute: 2, peak_per_minute: 10, end_per_minute: 2,
  ramp_up_minutes: 10, steady_minutes: 20, ramp_down_minutes: 10
};
const RESEND_COOLDOWN_MS = 24 * 60 * 60_000;
const AMBIGUOUS_RETRY_MS = process.env.NODE_ENV === 'test' ? 1_000 : 60_000;
const FILE_LIMIT = express.raw({ type: () => true, limit: MAX_CONTRIBUTION_BATCH_BYTES });
const activeContributionUploads = new Set<string>();
const asyncRoute = (handler: (req: express.Request, res: express.Response) => Promise<unknown>) =>
  (req: express.Request, res: express.Response, next: express.NextFunction) => { void handler(req, res).catch(next); };
const receiveContributionFile = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  FILE_LIMIT(req, res, error => {
    if (error) return res.status(413).json({ error: 'File exceeds the 50 MB batch limit' });
    next();
  });
};
const invitationWrites = new class {
  private tail: Promise<unknown> = Promise.resolve();
  run<T>(task: () => Promise<T>) { const result = this.tail.then(task, task); this.tail = result.catch(() => undefined); return result; }
}();

function mapDeliveryStatus(status: SmsDeliveryStatus): InvitationDeliveryStatus {
  return status.toUpperCase() as InvitationDeliveryStatus;
}

function shuffle<T>(values: T[]) {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = randomInt(index + 1);
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy;
}

export function createInvitationRoutes(app: express.Express, deps: InvitationDependencies) {
  let invitations: ProfileInvitation[] = [];
  let campaigns: InvitationCampaign[] = [];
  let batches: ContributionBatch[] = [];

  const initialize = async () => {
    invitations = await getAllFromTable('common_profile_invitations') as ProfileInvitation[];
    campaigns = await getAllFromTable('common_invitation_campaigns') as InvitationCampaign[];
    batches = await getAllFromTable('common_contribution_batches') as ContributionBatch[];
  };

  const saveInvitation = async (invitation: ProfileInvitation) => {
    invitation.updated_at = new Date().toISOString();
    await saveToTable('common_profile_invitations', invitation);
  };
  const saveCampaign = async (campaign: InvitationCampaign) => {
    campaign.updated_at = new Date().toISOString();
    await saveToTable('common_invitation_campaigns', campaign);
  };
  const saveBatch = async (batch: ContributionBatch) => {
    batch.updated_at = new Date().toISOString();
    await saveToTable('common_contribution_batches', batch);
  };

  const publicInvitation = async (invitation: ProfileInvitation) => {
    const donor = await queryImportedDonors({ phone: invitation.donor_phone, includePrivate: true, includeRemoved: true, includeSuspended: true, limit: 1 }).then(items => items[0]);
    const campaign = invitation.campaign_id ? campaigns.find(item => item.id === invitation.campaign_id) : null;
    const lastAttempt = invitation.attempts.at(-1);
    return {
      id: invitation.id,
      status: invitation.status,
      delivery_status: invitation.delivery_status,
      outcome: invitation.outcome,
      masked_phone: deps.maskPhone(invitation.donor_phone),
      donor: donor ? { public_id: donor.public_id, name: donor.name, blood_group: donor.blood_group, district: donor.district, upazila: donor.upazila } : null,
      campaign_id: invitation.campaign_id,
      campaign: campaign ? { id: campaign.id, label: campaign.label } : null,
      attempts: invitation.attempts.length,
      delivery: {
        status: invitation.delivery_status,
        provider: 'messavo',
        attempts: invitation.attempts.length,
        updated_at: lastAttempt?.updated_at || invitation.updated_at,
        last_error: lastAttempt?.last_error
      },
      created_at: invitation.created_at,
      updated_at: invitation.updated_at,
      sent_at: invitation.sent_at,
      delivered_at: invitation.delivered_at,
      responded_at: invitation.responded_at,
      resend_eligible: invitation.status === 'ACTIVE' && (invitation.delivery_status === 'FAILED' || invitation.outcome === 'NO_RESPONSE') &&
        (!lastAttempt || Date.parse(lastAttempt.attempted_at) <= Date.now() - RESEND_COOLDOWN_MS)
    };
  };

  const campaignPayload = (campaign: InvitationCampaign) => ({
    id: campaign.id, label: campaign.label, status: campaign.status, mode: campaign.mode,
    target_count: campaign.target_count, pacing: campaign.pacing,
    counts: deliveryAggregate(invitations.filter(item => item.campaign_id === campaign.id)),
    created_at: campaign.created_at, updated_at: campaign.updated_at,
    started_at: campaign.started_at, paused_at: campaign.paused_at,
    completed_at: campaign.completed_at, canceled_at: campaign.canceled_at
  });

  const batchPayload = (batch: ContributionBatch, manager = false, includePastedText = false) => {
    const submitter = deps.userSummary(batch.submitter_id);
    return {
      id: batch.id, status: batch.status,
      ...(manager ? { ...(includePastedText ? { pasted_text: batch.pasted_text } : {}), pasted_text_preview: batch.pasted_text?.slice(0, 500), submitter: submitter ? { id: submitter.id, name: submitter.name, masked_phone: deps.maskPhone(submitter.phone) } : null } : { pasted_text: batch.pasted_text }),
      note: batch.note, total_bytes: batch.total_bytes,
      files: batch.files.map(file => ({
        id: file.id, name: file.name, content_type: file.content_type, size_bytes: file.size_bytes,
        uploaded: Boolean(file.uploaded_at), sha256: file.sha256,
        ...(manager && file.uploaded_at ? { download_path: `/api/admin/donor-contribution-batches/${batch.id}/files/${file.id}` } : {})
      })),
      reviewer_note: batch.reviewer_note, published_donor_ids: batch.published_donor_ids,
      created_at: batch.created_at, updated_at: batch.updated_at,
      submitted_at: batch.submitted_at, reviewed_at: batch.reviewed_at
    };
  };

  const reconcileInvitation = async (invitation: ProfileInvitation, donor?: ImportedDonor) => {
    if (donor?.listing_state === 'REMOVED' && invitation.outcome === 'PENDING') {
      invitation.outcome = 'REJECTED_REMOVED'; invitation.responded_at = donor.removed_at || new Date().toISOString();
      await saveInvitation(invitation);
      return;
    }
    if (donor?.claim_status === 'CLAIMED' && invitation.outcome === 'PENDING') {
      invitation.outcome = donor.claim_note?.includes('replacement') ? 'PHONE_CHANGED' : 'CLAIMED';
      invitation.responded_at = donor.claimed_at || new Date().toISOString();
      await saveInvitation(invitation);
      return;
    }
    if (donor?.claim_status === 'UNCLAIMED' && deps.registeredPhone(invitation.donor_phone) && invitation.outcome === 'PENDING') {
      invitation.outcome = 'SEPARATE_ACCOUNT'; invitation.responded_at = new Date().toISOString();
      await saveInvitation(invitation);
      return;
    }
    if (invitation.outcome === 'PENDING' && invitation.delivery_status === 'DELIVERED' && Date.parse(invitation.response_due_at) <= Date.now()) {
      invitation.outcome = 'NO_RESPONSE'; await saveInvitation(invitation);
    }
  };

  const processInvitations = async () => invitationWrites.run(async () => {
    const provider = deps.smsProvider();
    const unresolved = invitations.filter(item => item.status === 'ACTIVE' && item.outcome === 'PENDING');
    const donorsById = await findImportedDonorsByPublicIds([...new Set(unresolved.map(item => item.donor_public_id))]);
    for (const invitation of invitations) {
      if (invitation.status === 'ACTIVE' && invitation.outcome === 'PENDING') await reconcileInvitation(invitation, donorsById.get(invitation.donor_public_id));
      const last = invitation.attempts.at(-1);
      if (last?.job_id && ['QUEUED', 'SENT', 'UNKNOWN'].includes(last.delivery_status) && provider?.getDelivery) {
        try {
          const delivery = await provider.getDelivery(last.job_id);
          last.delivery_status = mapDeliveryStatus(delivery.status);
          last.updated_at = new Date().toISOString();
          invitation.delivery_status = last.delivery_status;
          if (last.delivery_status === 'SENT' && !invitation.sent_at) invitation.sent_at = last.updated_at;
          if (last.delivery_status === 'DELIVERED' && !invitation.delivered_at) invitation.delivered_at = last.updated_at;
          await saveInvitation(invitation);
        } catch {
          // Provider reachability cannot turn a carrier state into a failure.
          last.delivery_status = 'UNKNOWN'; invitation.delivery_status = 'UNKNOWN';
          last.updated_at = new Date().toISOString(); await saveInvitation(invitation);
        }
      } else if (last?.job_id && ['QUEUED', 'SENT'].includes(last.delivery_status) && !provider) {
        last.delivery_status = 'UNKNOWN'; invitation.delivery_status = 'UNKNOWN';
        last.updated_at = new Date().toISOString(); await saveInvitation(invitation);
      }
      if (!invitation.next_send_at || Date.parse(invitation.next_send_at) > Date.now() || invitation.status !== 'ACTIVE') continue;
      const campaign = invitation.campaign_id ? campaigns.find(item => item.id === invitation.campaign_id) : null;
      const processingResend = Boolean(invitation.resend_batch_id && invitation.resend_mode);
      if (campaign && !processingResend && campaign.status !== 'RUNNING') continue;
      if (campaign?.mode === 'RAMPED' && !processingResend) {
        const recentCutoff = Date.now() - 60_000;
        const recentAttempts = invitations.filter(item => item.campaign_id === campaign.id)
          .flatMap(item => item.attempts)
          .filter(item => Date.parse(item.updated_at) > recentCutoff).length;
        if (recentAttempts >= campaign.pacing.peak_per_minute) continue;
      }
      if (processingResend && invitation.resend_mode === 'RAMPED' && invitation.resend_batch_id && invitation.resend_pacing) {
        const recentCutoff = Date.now() - 60_000;
        const recentAttempts = invitations.filter(item => item.resend_batch_id === invitation.resend_batch_id)
          .flatMap(item => item.attempts)
          .filter(item => Date.parse(item.updated_at) > recentCutoff).length;
        if (recentAttempts >= invitation.resend_pacing.peak_per_minute) continue;
      }
      invitation.next_send_at = undefined;
      const attemptedAt = new Date().toISOString();
      const recoverableAttempt = last && last.delivery_status === 'UNKNOWN' && !last.job_id ? last : null;
      const attempt: InvitationAttempt = recoverableAttempt || { id: randomUUID(), provider: 'messavo', delivery_status: 'QUEUED', attempted_at: attemptedAt, updated_at: attemptedAt };
      if (!recoverableAttempt) invitation.attempts.push(attempt);
      if (!provider) {
        attempt.delivery_status = 'FAILED'; attempt.last_error = 'Messavo SIM 2 sender is unavailable';
        invitation.delivery_status = 'FAILED'; await saveInvitation(invitation); continue;
      }
      try {
        const delivery = await provider.sendMessage(
          invitation.donor_phone,
          `You were invited to review a donor profile on drop. Claim, change, or remove it: ${deps.configuredOrigin()}${invitation.claim_path}`,
          invitationIdempotencyKey(invitation.id, attempt.id)
        );
        attempt.job_id = delivery.jobId;
        attempt.delivery_status = mapDeliveryStatus(delivery.status);
        attempt.updated_at = new Date().toISOString();
        invitation.delivery_status = attempt.delivery_status;
        if (['SENT', 'DELIVERED'].includes(attempt.delivery_status)) invitation.sent_at = attempt.updated_at;
        if (attempt.delivery_status === 'DELIVERED') invitation.delivered_at = attempt.updated_at;
        await deps.audit('system', 'PROFILE_INVITATION_SENT', 'PROFILE_INVITATION', invitation.id, { delivery_status: attempt.delivery_status, campaign_id: invitation.campaign_id });
      } catch (error) {
        const definitive = error instanceof SmsProviderError && error.fallbackSafe;
        attempt.delivery_status = definitive ? 'FAILED' : 'UNKNOWN'; attempt.updated_at = new Date().toISOString();
        attempt.last_error = definitive ? 'Messavo SIM 2 did not accept the message' : 'Messavo acceptance is not confirmed';
        invitation.delivery_status = attempt.delivery_status;
        if (!definitive) invitation.next_send_at = new Date(Date.now() + AMBIGUOUS_RETRY_MS).toISOString();
        await deps.audit('system', definitive ? 'PROFILE_INVITATION_FAILED' : 'PROFILE_INVITATION_UNCONFIRMED', 'PROFILE_INVITATION', invitation.id, { reason: attempt.last_error, campaign_id: invitation.campaign_id });
      }
      await saveInvitation(invitation);
    }
    for (const campaign of campaigns.filter(item => item.status === 'RUNNING')) {
      const related = invitations.filter(item => item.campaign_id === campaign.id);
      if (related.length > 0 && related.every(item => !item.next_send_at)) {
        campaign.status = 'COMPLETED'; campaign.completed_at = new Date().toISOString(); await saveCampaign(campaign);
      }
    }
  });

  const limitContributionUpload = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const auth = deps.getAuth(req);
    if (!auth) return res.status(401).json({ error: 'Unauthorized' });
    if (activeContributionUploads.has(auth.user.id)) return res.status(429).json({ error: 'Wait for the current donor file upload to finish' });
    activeContributionUploads.add(auth.user.id);
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      activeContributionUploads.delete(auth.user.id);
    };
    res.once('finish', release); res.once('close', release); res.once('error', release);
    next();
  };

  app.post('/api/me/donor-contributions', asyncRoute(async (req, res) => {
    const auth = deps.getAuth(req);
    if (!auth) return res.status(401).json({ error: 'Unauthorized' });
    const input = deps.parseImportedInput(req.body);
    if ('error' in input) return res.status(400).json({ error: input.error });
    const duplicate = (await queryImportedDonors({ phone: input.phone, includePrivate: true, includeRemoved: true, includeSuspended: true, limit: 1 }))[0];
    if (deps.registeredPhone(input.phone) || duplicate?.claim_status === 'CLAIMED' || duplicate?.listing_state === 'REMOVED') {
      return res.status(202).json({ contribution: null, invitation: null, message: 'This number cannot be invited.' });
    }
    let invitation = invitations.find(item => item.donor_phone === input.phone && item.status === 'ACTIVE');
    if (!invitation) {
      const hourlyCutoff = Date.now() - 60 * 60_000;
      const recentMemberInvites = invitations.filter(item => item.submitted_by === auth.user.id && Date.parse(item.created_at) > hourlyCutoff).length;
      if (recentMemberInvites >= 10) return res.status(429).json({ error: 'You can send up to 10 new donor invitations per hour' });
    }
    let donor = duplicate;
    if (!donor) {
      const now = new Date().toISOString();
      donor = toImportedDonor({
        source_id: 'member-contribution', source_organization: 'Member suggestion',
        source_url: `${deps.publicOrigin(req)}/contribute`, scraped_at: now, source_ref: randomUUID(), ...input
      } satisfies ScrapedRecordInput, now, deps.resolveLocation);
      donor.publication_state = 'PRIVATE_PENDING'; donor.contributed_at = now;
      donor.contribution_expires_at = new Date(Date.now() + 30 * 24 * 60 * 60_000).toISOString();
      await addImportedDonors([toImportedDonorRow(donor)]);
    }
    if (!invitation) {
      invitation = createInvitation({ donor_public_id: donor.public_id, donor_phone: donor.phone, claim_path: claimPathForImportedDonor(donor), submitted_by: auth.user.id });
      invitations.push(invitation); await saveInvitation(invitation);
      await deps.audit(auth.user.id, 'PROFILE_INVITATION_CREATED', 'PROFILE_INVITATION', invitation.id, { donor_public_id: donor.public_id });
      await processInvitations();
    }
    return res.status(202).json({
      contribution: { id: donor.public_id, claim_path: claimPathForImportedDonor(donor), expires_at: donor.contribution_expires_at },
      invitation: {
        id: invitation.id, status: invitation.status, delivery_status: invitation.delivery_status,
        created_at: invitation.created_at, updated_at: invitation.updated_at
      },
      message: donor.publication_state === 'PRIVATE_PENDING' ? 'Invitation queued. The profile stays private until its owner verifies it.' : 'Invitation queued.'
    });
  }));

  app.post('/api/me/donor-contribution-batches', asyncRoute(async (req, res) => {
    const auth = deps.getAuth(req); if (!auth) return res.status(401).json({ error: 'Unauthorized' });
    if (req.body?.pasted_text !== undefined && typeof req.body.pasted_text !== 'string') return res.status(400).json({ error: 'Pasted donor information must be text' });
    const pastedText = typeof req.body?.pasted_text === 'string' ? req.body.pasted_text.trim() || undefined : undefined;
    if (pastedText && Buffer.byteLength(pastedText, 'utf8') > MAX_CONTRIBUTION_BATCH_BYTES) return res.status(413).json({ error: 'Pasted text and attachments exceed the 50 MB batch limit' });
    const note = req.body?.note === undefined ? undefined : deps.cleanString(req.body.note, 2_000);
    const requested = Array.isArray(req.body?.files) ? req.body.files : [];
    if ((!pastedText && requested.length === 0) || requested.length > 20) return res.status(400).json({ error: 'Paste donor information or attach up to 20 files' });
    const files = [];
    let totalBytes = pastedText ? Buffer.byteLength(pastedText, 'utf8') : 0;
    for (const value of requested) {
      const name = safeContributionFileName(value?.name);
      const contentType = deps.cleanString(value?.content_type, 120);
      const size = Number(value?.size_bytes);
      if (!name || !contentType || !CONTRIBUTION_FILE_TYPES.has(contentType) || !Number.isInteger(size) || size < 1) return res.status(400).json({ error: 'Choose supported text, document, spreadsheet, PDF, or image files' });
      totalBytes += size;
      files.push({ id: randomUUID(), storage_key: '', name, content_type: contentType, size_bytes: size });
    }
    if (totalBytes > MAX_CONTRIBUTION_BATCH_BYTES) return res.status(413).json({ error: 'Pasted text and attachments exceed the 50 MB batch limit' });
    const now = new Date().toISOString();
    const batch: ContributionBatch = { id: randomUUID(), submitter_id: auth.user.id, status: 'DRAFT', pasted_text: pastedText, note, files, total_bytes: totalBytes, created_at: now, updated_at: now };
    batches.push(batch); await saveBatch(batch);
    res.status(201).json({ batch: batchPayload(batch) });
  }));

  app.put('/api/me/donor-contribution-batches/:batchId/files/:fileId', limitContributionUpload, receiveContributionFile, asyncRoute(async (req, res) => {
    const auth = deps.getAuth(req); if (!auth) return res.status(401).json({ error: 'Unauthorized' });
    const batch = batches.find(item => item.id === req.params.batchId && item.submitter_id === auth.user.id);
    if (!batch || batch.status !== 'DRAFT') return res.status(404).json({ error: 'Draft batch not found' });
    const file = batch.files.find(item => item.id === req.params.fileId);
    if (!file) return res.status(404).json({ error: 'Upload slot not found' });
    if (file.uploaded_at) return res.status(409).json({ error: 'This file was already uploaded' });
    let uploadName = req.get('x-file-name') || '';
    try { uploadName = decodeURIComponent(uploadName); } catch { return res.status(400).json({ error: 'File name is invalid' }); }
    if (!Buffer.isBuffer(req.body) || req.body.length !== file.size_bytes || req.get('content-type')?.split(';')[0] !== file.content_type || uploadName !== file.name) return res.status(400).json({ error: 'Uploaded file does not match its reserved name, type, and size' });
    const fingerprint = req.get('x-content-fingerprint');
    if (!fingerprint || !/^[a-f0-9]{64}$/i.test(fingerprint)) return res.status(400).json({ error: 'A SHA-256 content fingerprint is required' });
    try {
      const stored = await saveContributionFile(req.body, { expectedSha256: fingerprint });
      file.storage_key = stored.key; file.sha256 = stored.sha256; file.uploaded_at = new Date().toISOString(); await saveBatch(batch);
      res.json({ file: { id: file.id, name: file.name, content_type: file.content_type, size_bytes: file.size_bytes, uploaded: true, sha256: file.sha256 } });
    } catch (error) {
      if ((error as Error).message === 'FINGERPRINT_MISMATCH') return res.status(400).json({ error: 'File fingerprint did not match' });
      throw error;
    }
  }));

  app.post('/api/me/donor-contribution-batches/:id/submit', asyncRoute(async (req, res) => {
    const auth = deps.getAuth(req); if (!auth) return res.status(401).json({ error: 'Unauthorized' });
    const batch = batches.find(item => item.id === req.params.id && item.submitter_id === auth.user.id);
    if (!batch || batch.status !== 'DRAFT') return res.status(404).json({ error: 'Draft batch not found' });
    if (batch.files.some(file => !file.uploaded_at)) return res.status(409).json({ error: 'Finish every file upload before submitting' });
    batch.status = 'SUBMITTED'; batch.submitted_at = new Date().toISOString(); await saveBatch(batch);
    await deps.audit(auth.user.id, 'DONOR_CONTRIBUTION_BATCH_SUBMITTED', 'CONTRIBUTION_BATCH', batch.id, { files: batch.files.length, total_bytes: batch.total_bytes });
    res.json({ batch: batchPayload(batch) });
  }));

  app.get('/api/me/donor-contribution-batches', (req, res) => {
    const auth = deps.getAuth(req); if (!auth) return res.status(401).json({ error: 'Unauthorized' });
    res.json({ batches: batches.filter(item => item.submitter_id === auth.user.id).map(item => batchPayload(item)) });
  });

  app.get('/api/admin/donor-contribution-batches', (req, res) => {
    const auth = deps.requireManager(req, res); if (!auth) return;
    const status = typeof req.query.status === 'string' ? req.query.status : '';
    res.json({ batches: batches.filter(item => !status || item.status === status).map(item => batchPayload(item, true)) });
  });
  app.get('/api/admin/donor-contribution-batches/:id', (req, res) => {
    const auth = deps.requireManager(req, res); if (!auth) return;
    const batch = batches.find(item => item.id === req.params.id); if (!batch) return res.status(404).json({ error: 'Batch not found' });
    res.json({ batch: batchPayload(batch, true, true) });
  });
  app.get('/api/admin/donor-contribution-batches/:batchId/files/:fileId', asyncRoute(async (req, res) => {
    const auth = deps.requireManager(req, res); if (!auth) return;
    const batch = batches.find(item => item.id === req.params.batchId);
    const file = batch?.files.find(item => item.id === req.params.fileId && item.uploaded_at);
    if (!file) return res.status(404).json({ error: 'File not found' });
    const bytes = await readContributionFile(file.storage_key); if (!bytes) return res.status(404).json({ error: 'File not found' });
    res.set('Content-Type', file.content_type); res.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`); res.set('Cache-Control', 'private, no-store'); res.send(bytes);
  }));

  app.patch('/api/admin/donor-contribution-batches/:id', asyncRoute(async (req, res) => invitationWrites.run(async () => {
    const auth = deps.requireManager(req, res); if (!auth) return;
    const batch = batches.find(item => item.id === req.params.id && item.status === 'SUBMITTED');
    if (!batch) return res.status(404).json({ error: 'Submitted batch not found' });
    const action = req.body?.action;
    const note = deps.cleanString(req.body?.note, 2_000);
    if (!['APPROVE', 'REJECT'].includes(action) || !note) return res.status(400).json({ error: 'Choose approve or reject and add a review note' });
    const published: Array<{ public_id: string; claim_path: string }> = [];
    if (action === 'APPROVE') {
      const donorInputs = Array.isArray(req.body?.donors) ? req.body.donors : [];
      if (donorInputs.length === 0 || donorInputs.length > 5_000) return res.status(400).json({ error: 'Review and provide between 1 and 5000 donor rows' });
      const reviewedPhones = new Set<string>();
      for (const value of donorInputs) {
        const input = deps.parseImportedInput(value); if ('error' in input) return res.status(400).json({ error: input.error });
        if (reviewedPhones.has(input.phone)) continue;
        reviewedPhones.add(input.phone);
        const duplicate = (await queryImportedDonors({ phone: input.phone, includePrivate: true, includeRemoved: true, includeSuspended: true, limit: 1 }))[0];
        if (duplicate?.listing_state === 'REMOVED') continue;
        if (duplicate) {
          if (duplicate.publication_state === 'PRIVATE_PENDING') {
            duplicate.publication_state = 'PUBLIC'; duplicate.contribution_expires_at = undefined; await replaceImportedDonor(toImportedDonorRow(duplicate));
          }
          published.push({ public_id: duplicate.public_id, claim_path: claimPathForImportedDonor(duplicate) }); continue;
        }
        const now = new Date().toISOString();
        const record = toImportedDonor({ source_id: 'reviewed-community-contribution', source_organization: 'Admin-reviewed contribution', source_url: 'private-batch', scraped_at: now, source_ref: randomUUID(), ...input }, now, deps.resolveLocation);
        record.publication_state = 'PUBLIC'; record.contributed_at = batch.submitted_at || now;
        await addImportedDonors([toImportedDonorRow(record)]); published.push({ public_id: record.public_id, claim_path: claimPathForImportedDonor(record) });
      }
      batch.status = 'APPROVED'; batch.published_donor_ids = published.map(item => item.public_id);
    } else batch.status = 'REJECTED';
    batch.reviewer_note = note; batch.reviewed_by = auth.user.id; batch.reviewed_at = new Date().toISOString(); await saveBatch(batch);
    await deps.audit(auth.user.id, `DONOR_CONTRIBUTION_BATCH_${action}D`, 'CONTRIBUTION_BATCH', batch.id, { published_count: published.length, note });
    res.json({ batch: batchPayload(batch, true, true), published });
  })));

  app.post('/api/admin/invitation-campaigns', asyncRoute(async (req, res) => invitationWrites.run(async () => {
    const auth = deps.requireManager(req, res); if (!auth) return;
    const label = deps.cleanString(req.body?.label, 100); const count = Number(req.body?.count); const mode = req.body?.mode;
    if (!label || !Number.isInteger(count) || count < 1 || count > 5_000 || !['INSTANT', 'RAMPED'].includes(mode)) return res.status(400).json({ error: 'Choose a label, mode, and invite count from 1 to 5000' });
    if (mode === 'INSTANT' && count > 20) return res.status(400).json({ error: 'Instant campaigns support at most 20 invitations' });
    const pacing = mode === 'INSTANT' ? DEFAULT_PACING : validatePacing(req.body?.pacing);
    if (!pacing) return res.status(400).json({ error: 'Choose valid slow, peak, and ending campaign rates' });
    const invitedPhones = new Set(invitations
      .filter(item => item.status === 'ACTIVE' || item.attempts.length > 0)
      .map(item => item.donor_phone));
    const eligibleTotal = await countImportedDonors({ claimStatus: 'UNCLAIMED' });
    const eligible = eligibleTotal ? await queryImportedDonors({ claimStatus: 'UNCLAIMED', limit: eligibleTotal }) : [];
    const uniquePhones = new Set<string>();
    const candidates: ImportedDonor[] = [];
    for (const donor of eligible) {
      if (!donor.phone || invitedPhones.has(donor.phone) || uniquePhones.has(donor.phone)) continue;
      uniquePhones.add(donor.phone); candidates.push(donor);
    }
    if (candidates.length < count) return res.status(409).json({ error: `Only ${candidates.length} never-invited donors are eligible` });
    const now = new Date().toISOString();
    const campaign: InvitationCampaign = { id: randomUUID(), label, status: 'DRAFT', mode, target_count: count, pacing, invitation_ids: [], created_by: auth.user.id, created_at: now, updated_at: now };
    for (const donor of shuffle(candidates).slice(0, count)) {
      const invitation = createInvitation({ donor_public_id: donor.public_id, donor_phone: donor.phone, claim_path: claimPathForImportedDonor(donor), campaign_id: campaign.id, next_send_at: undefined, now });
      invitation.next_send_at = undefined; invitations.push(invitation); campaign.invitation_ids.push(invitation.id); await saveInvitation(invitation);
    }
    campaigns.push(campaign); await saveCampaign(campaign);
    await deps.audit(auth.user.id, 'INVITATION_CAMPAIGN_CREATED', 'INVITATION_CAMPAIGN', campaign.id, { target_count: count, mode });
    res.status(201).json({ campaign: campaignPayload(campaign) });
  })));

  app.get('/api/admin/invitation-campaigns', (req, res) => {
    const auth = deps.requireManager(req, res); if (!auth) return;
    res.json({ campaigns: campaigns.map(campaignPayload) });
  });
  app.get('/api/admin/invitation-campaigns/:id', asyncRoute(async (req, res) => {
    const auth = deps.requireManager(req, res); if (!auth) return;
    const campaign = campaigns.find(item => item.id === req.params.id); if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    res.json({ campaign: campaignPayload(campaign), invitations: await Promise.all(invitations.filter(item => item.campaign_id === campaign.id).map(publicInvitation)) });
  }));

  const changeCampaign = (action: 'start' | 'pause' | 'cancel') => async (req: express.Request, res: express.Response) => invitationWrites.run(async () => {
    const auth = deps.requireManager(req, res); if (!auth) return;
    const campaign = campaigns.find(item => item.id === req.params.id); if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    const now = new Date().toISOString();
    if (action === 'start') {
      if (!['DRAFT', 'PAUSED'].includes(campaign.status)) return res.status(409).json({ error: 'Campaign cannot be started' });
      campaign.status = 'RUNNING'; campaign.started_at ||= now; campaign.paused_at = undefined;
      const pending = campaign.invitation_ids.map(id => invitations.find(item => item.id === id)).filter((item): item is ProfileInvitation => Boolean(item && item.attempts.length === 0));
      const times = campaignSendTimes(pending.length, now, campaign.mode, campaign.pacing);
      for (const [index, invitation] of pending.entries()) { invitation.next_send_at = times[index]; await saveInvitation(invitation); }
    } else if (action === 'pause') {
      if (campaign.status !== 'RUNNING') return res.status(409).json({ error: 'Campaign is not running' });
      campaign.status = 'PAUSED'; campaign.paused_at = now;
    } else {
      if (['COMPLETED', 'CANCELED'].includes(campaign.status)) return res.status(409).json({ error: 'Campaign is already closed' });
      campaign.status = 'CANCELED'; campaign.canceled_at = now;
      for (const invitation of invitations.filter(item => item.campaign_id === campaign.id && item.attempts.length === 0)) { invitation.status = 'CANCELED'; invitation.delivery_status = 'CANCELED'; invitation.next_send_at = undefined; await saveInvitation(invitation); }
    }
    await saveCampaign(campaign); await deps.audit(auth.user.id, `INVITATION_CAMPAIGN_${action.toUpperCase()}`, 'INVITATION_CAMPAIGN', campaign.id);
    if (action === 'start') setImmediate(() => { void processInvitations(); });
    res.json({ campaign: campaignPayload(campaign) });
  });
  app.post('/api/admin/invitation-campaigns/:id/start', asyncRoute(changeCampaign('start')));
  app.post('/api/admin/invitation-campaigns/:id/pause', asyncRoute(changeCampaign('pause')));
  app.post('/api/admin/invitation-campaigns/:id/cancel', asyncRoute(changeCampaign('cancel')));

  app.get('/api/admin/invitations', asyncRoute(async (req, res) => {
    const auth = deps.requireManager(req, res); if (!auth) return;
    const filtered = invitations.filter(item =>
      (!req.query.delivery_status || item.delivery_status === req.query.delivery_status) &&
      (!req.query.outcome || item.outcome === req.query.outcome) &&
      (!req.query.campaign_id || item.campaign_id === req.query.campaign_id));
    res.json({ invitations: await Promise.all(filtered.map(publicInvitation)), total: filtered.length });
  }));

  app.post('/api/admin/invitations/resend', asyncRoute(async (req, res) => invitationWrites.run(async () => {
    const auth = deps.requireManager(req, res); if (!auth) return;
    const rawIds = Array.isArray(req.body?.invitation_ids) ? req.body.invitation_ids : req.body?.ids;
    const ids = Array.isArray(rawIds) ? rawIds.filter((id: unknown): id is string => typeof id === 'string') : null;
    const filter = req.body?.filter;
    const noResponseFilter = filter === 'NO_RESPONSE' || filter?.outcome === 'NO_RESPONSE';
    const campaignId = typeof req.body?.campaign_id === 'string' ? req.body.campaign_id : typeof filter?.campaign_id === 'string' ? filter.campaign_id : undefined;
    if ((!ids || ids.length === 0) && !noResponseFilter) return res.status(400).json({ error: 'Choose invitation IDs or the no-response filter' });
    const cutoff = Date.now() - RESEND_COOLDOWN_MS;
    const selected = invitations.filter(item => {
      const chosen = ids ? ids.includes(item.id) : item.outcome === 'NO_RESPONSE' && (!campaignId || item.campaign_id === campaignId);
      const lastAttempt = item.attempts.at(-1);
      return chosen && item.status === 'ACTIVE' && item.delivery_status !== 'UNKNOWN' && (!lastAttempt || Date.parse(lastAttempt.attempted_at) <= cutoff);
    });
    if (selected.length > 5_000) return res.status(400).json({ error: 'Resend at most 5000 invitations at once' });
    const mode = req.body?.mode === undefined ? (selected.length <= 20 ? 'INSTANT' : 'RAMPED') : req.body.mode;
    if (!['INSTANT', 'RAMPED'].includes(mode)) return res.status(400).json({ error: 'Choose instant or ramped resend pacing' });
    if (mode === 'INSTANT' && selected.length > 20) return res.status(400).json({ error: 'Instant resend supports at most 20 invitations' });
    const pacing = mode === 'RAMPED' ? (req.body?.pacing === undefined ? DEFAULT_PACING : validatePacing(req.body.pacing)) : DEFAULT_PACING;
    if (!pacing) return res.status(400).json({ error: 'Choose valid slow, peak, and ending resend rates' });
    const now = new Date().toISOString();
    const sendTimes = campaignSendTimes(selected.length, now, mode, pacing);
    const resendBatchId = randomUUID();
    for (const [index, invitation] of selected.entries()) { invitation.next_send_at = sendTimes[index]; invitation.resend_batch_id = resendBatchId; invitation.resend_mode = mode; invitation.resend_pacing = pacing; invitation.outcome = 'PENDING'; invitation.response_due_at = new Date(Date.now() + 14 * 24 * 60 * 60_000).toISOString(); invitation.status = 'ACTIVE'; await saveInvitation(invitation); }
    await deps.audit(auth.user.id, 'PROFILE_INVITATIONS_RESENT', 'PROFILE_INVITATION_SET', resendBatchId, { count: selected.length, mode, pacing });
    setImmediate(() => { void processInvitations(); });
    res.status(202).json({ queued: selected.length, mode, pacing, resend_batch_id: resendBatchId, invitations: await Promise.all(selected.map(publicInvitation)) });
  })));

  return { initialize, processInvitations };
}
