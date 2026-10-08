import { createHash, createSign } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { getAllFromTable, saveToTable } from './db';

type Device = { id: string; user_id: string; session_id: string; token: string; enabled: boolean; updated_at: string };
type Delivery = { id: string; notification_id: string; device_id: string; user_id: string; session_id: string; attempts: number; next_at: number; state: 'PENDING' | 'SENT' | 'FAILED' };
type Notice = { id: string; user_id: string; created_at: string; read_at?: string };
export const pushConfigured = () => Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_FILE && existsSync(process.env.FIREBASE_SERVICE_ACCOUNT_FILE));
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
let working = false;
let access: { token: string; until: number } | undefined;

export async function registerPush(userId: string, sessionId: string, token: string, enabled: boolean) {
  if (token.length < 20 || token.length > 4096 || /\s/.test(token)) throw new Error('Invalid device token');
  const existing = (await getAllFromTable('common_push_devices') as Device[]).find(item => item.id === digest(token));
  const device: Device = { id: digest(token), user_id: userId, session_id: sessionId, token, enabled, updated_at: existing?.enabled && existing.user_id === userId && existing.session_id === sessionId ? existing.updated_at : new Date().toISOString() };
  await saveToTable('common_push_devices', device);
}

export async function removePush(userId: string, token?: string, sessionId?: string) {
  const devices = await getAllFromTable('common_push_devices') as Device[];
  for (const item of devices.filter(item => item.user_id === userId && (!token || item.id === digest(token)) && (!sessionId || item.session_id === sessionId))) {
    await saveToTable('common_push_devices', { ...item, enabled: false, token: '' });
  }
}

async function send(device: Device, notificationId: string) {
  const credentials = JSON.parse(await readFile(process.env.FIREBASE_SERVICE_ACCOUNT_FILE!, 'utf8'));
  if (!credentials.project_id || !credentials.client_email || !credentials.private_key) throw new Error('Invalid push configuration');
  if (!access || access.until < Date.now()) {
    const now = Math.floor(Date.now() / 1000);
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ iss: credentials.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })}`;
    const signature = createSign('RSA-SHA256').update(unsigned).sign(credentials.private_key, 'base64url');
    const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }), signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('Push authentication unavailable');
    const data = await response.json();
    if (!data.access_token) throw new Error('Push authentication unavailable');
    access = { token: data.access_token, until: Date.now() + 50 * 60_000 };
  }
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(credentials.project_id)}/messages:send`, {
    method: 'POST', headers: { Authorization: `Bearer ${access.token}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15000),
    body: JSON.stringify({ message: { token: device.token, notification: { title: 'Drop update', body: 'You have a new update. Open Drop to view it.' }, data: { notification_id: notificationId }, android: { ttl: '86400s', collapse_key: notificationId, notification: { channel_id: 'drop_updates', tag: notificationId } } } }),
  });
  if (response.ok) return 'SENT' as const;
  const error = await response.json().catch(() => ({}));
  if (error.error?.details?.some((item: { errorCode?: string }) => item.errorCode === 'UNREGISTERED')) return 'INVALID' as const;
  throw new Error('Push delivery unavailable');
}

/** Persisted inbox is the outbox source: a restart cannot lose newly created notifications. */
export async function deliverPush(notifications: Notice[], activeSession: (id: string, userId: string) => boolean) {
  if (working || !pushConfigured()) return;
  working = true;
  try {
    const devices = await getAllFromTable('common_push_devices') as Device[];
    const deliveries = new Map((await getAllFromTable('common_push_deliveries') as Delivery[]).map(item => [item.id, item]));
    let processed = 0;
    for (const notice of notifications) {
      if (notice.read_at || Date.parse(notice.created_at) < Date.now() - 86400_000) continue;
      for (const device of devices) {
        if (!device.enabled || device.user_id !== notice.user_id || !activeSession(device.session_id, device.user_id) || notice.created_at < device.updated_at) continue;
        const id = digest(`${notice.id}:${device.id}:${device.session_id}`);
        const delivery = deliveries.get(id) || { id, notification_id: notice.id, device_id: device.id, user_id: device.user_id, session_id: device.session_id, attempts: 0, next_at: 0, state: 'PENDING' as const };
        if (delivery.state !== 'PENDING' || delivery.next_at > Date.now()) continue;
        if (++processed > 30) return;
        delivery.attempts++;
        delivery.next_at = Date.now() + Math.min(3600_000, 30_000 * 2 ** delivery.attempts);
        await saveToTable('common_push_deliveries', delivery);
        try {
          // Re-read to avoid delivering to a device reassigned or disabled since this batch started.
          const current = (await getAllFromTable('common_push_devices') as Device[]).find(item => item.id === device.id);
          if (!current?.enabled || current.user_id !== device.user_id || current.session_id !== device.session_id || !activeSession(device.session_id, device.user_id)) { delivery.state = 'FAILED'; }
          else {
            const result = await send(current, notice.id);
            delivery.state = result === 'SENT' ? 'SENT' : 'FAILED';
            if (result === 'INVALID') await saveToTable('common_push_devices', { ...current, enabled: false, token: '' });
          }
        } catch { if (delivery.attempts >= 5) delivery.state = 'FAILED'; }
        await saveToTable('common_push_deliveries', delivery);
      }
    }
  } finally { working = false; }
}
