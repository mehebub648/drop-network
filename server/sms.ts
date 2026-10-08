import type { OutageReason } from './emergencyAccess';

export type SmsDeliveryStatus = 'queued' | 'sent' | 'delivered' | 'failed' | 'canceled';
export type SmsDelivery = { status: SmsDeliveryStatus; outageReason?: OutageReason };

export class SmsProviderError extends Error {
  constructor(message: string, public readonly outageReason?: OutageReason, public readonly fallbackSafe = false) { super(message); }
}

const SENDER_FAILURES = new Set(['device_offline', 'active_sync_device_required', 'subscription_unavailable',
  'device_disconnected', 'device_disconnected_while_sending', 'radio_off', 'no_service']);
export function smsOutageReason(status: number, code?: unknown): OutageReason | undefined {
  if ((status === 0 || status === 409) && typeof code === 'string' && SENDER_FAILURES.has(code)) return 'SENDER_UNAVAILABLE';
  if (status >= 500 && status <= 599) return 'SERVICE_UNAVAILABLE';
  if (status === 401 || status === 403) return 'PROVIDER_CONFIGURATION';
  return undefined;
}

async function smsFetch(input: string | URL, init: RequestInit, timeoutMs = 25_000) {
  try { return await fetch(input, { ...init, signal: AbortSignal.timeout(timeoutMs) }); }
  catch (error) {
    // Only a transport failure from our server is classified here. Client
    // connectivity, datastore failures and malformed responses never enter it.
    if (error instanceof TypeError || (error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name))) {
      throw new SmsProviderError('SMS service connection failed', 'SERVICE_UNAVAILABLE');
    }
    throw error;
  }
}

async function smsResponseError(response: Response) {
  const body = await response.json().catch(() => null) as { error?: unknown } | null;
  return new SmsProviderError(`SMS service returned ${response.status}`, smsOutageReason(response.status, body?.error), true);
}

export type SmsSendResult = {
  jobId?: string;
  status: SmsDeliveryStatus;
  providerId?: string;
};

export interface SmsProvider {
  name: string;
  sendMessage(phone: string, message: string, idempotencyKey: string): Promise<SmsSendResult>;
  sendOtp(phone: string, code: string, idempotencyKey: string): Promise<SmsSendResult>;
  getStatus?(jobId: string): Promise<SmsDeliveryStatus>;
  getDelivery?(jobId: string): Promise<SmsDelivery>;
  cancel?(jobId: string): Promise<boolean>;
}

export type SmsEnvironment = Readonly<Record<string, string | undefined>>;

export type RankedMessavoConfig = {
  id: string;
  baseUrl: string;
  token: string;
  priority: number;
  enabled?: boolean;
};

export type SmsProviderAttempt = {
  providerId: string;
  kind: 'message' | 'otp';
  outcome: 'ATTEMPTED' | 'SUCCEEDED' | 'FAILED';
  status?: SmsDeliveryStatus;
  reason?: string;
};

function otpMessage(code: string) {
  return `Your Drop verification code is ${code}. It expires in 10 minutes.`;
}

/**
 * Provider-neutral HTTP gateway retained for deployments that already use a
 * small private adapter. It has no delivery-status or cancellation contract.
 */
function createHttpProvider(environment: SmsEnvironment): SmsProvider | null {
  const endpoint = environment.SMS_HTTP_ENDPOINT?.trim();
  const token = environment.SMS_HTTP_TOKEN?.trim();
  if (!endpoint || !token) return null;

  return {
    name: 'http',
    async sendMessage(phone, message) {
      const response = await smsFetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ phone, message })
      });
      if (!response.ok) throw await smsResponseError(response);
      return { status: 'sent' };
    },
    async sendOtp(phone, code) {
      const response = await smsFetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ phone, code, message: otpMessage(code) })
      });
      if (!response.ok) throw await smsResponseError(response);
      return { status: 'sent' };
    }
  };
}

type MessavoState = 'pending_approval' | 'scheduled' | 'ready' | 'leased' | 'sent' | 'delivered' | 'failed' | 'canceled';

export function mapMessavoState(state: unknown): SmsDeliveryStatus | null {
  switch (state as MessavoState) {
    case 'scheduled':
    case 'ready':
    case 'leased':
      return 'queued';
    case 'sent':
      return 'sent';
    case 'delivered':
      return 'delivered';
    case 'failed':
      return 'failed';
    case 'canceled':
      return 'canceled';
    default:
      return null;
  }
}

function createMessavoProvider(environment: SmsEnvironment): SmsProvider | null {
  const configuredBaseUrl = environment.SMS_API_BASE_URL?.trim();
  const token = environment.SMS_API_TOKEN?.trim();
  if (!configuredBaseUrl || !token) return null;

  let messagesEndpoint: URL;
  try {
    messagesEndpoint = new URL(configuredBaseUrl);
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(messagesEndpoint.protocol) || messagesEndpoint.username || messagesEndpoint.password || messagesEndpoint.search || messagesEndpoint.hash) {
    return null;
  }
  messagesEndpoint.pathname = `${messagesEndpoint.pathname.replace(/\/+$/, '')}/api/v1/messages`;

  const headers = {
    'content-type': 'application/json',
    authorization: `Bearer ${token}`
  };
  const jobEndpoint = (jobId: string) => new URL(`${messagesEndpoint.toString().replace(/\/+$/, '')}/${encodeURIComponent(jobId)}`);
  const sendMessage = async (phone: string, message: string, idempotencyKey: string) => {
    const response = await smsFetch(messagesEndpoint, {
      method: 'POST',
      headers: { ...headers, 'idempotency-key': idempotencyKey },
      body: JSON.stringify({ to: phone, message })
    });
    if (response.status !== 202) throw await smsResponseError(response);
    const result = await response.json().catch(() => null) as { id?: unknown; status?: unknown } | null;
    const jobId = typeof result?.id === 'string' ? result.id : '';
    if (!jobId) throw new Error('Messavo SMS API returned an invalid job');
    if (result?.status === 'pending_approval') {
      let canceled = false;
      try {
        const cancellation = await smsFetch(jobEndpoint(jobId), { method: 'DELETE', headers: { authorization: headers.authorization } }, 5_000);
        canceled = cancellation.status === 204;
      } catch {
        // A manual key is never accepted for automatic messages.
      }
      throw new SmsProviderError('Messavo SMS API did not queue the message', 'PROVIDER_CONFIGURATION', canceled);
    }
    const status = mapMessavoState(result?.status);
    if (!status || status === 'failed' || status === 'canceled') throw new Error('Messavo SMS API did not queue the message');
    return { jobId, status };
  };

  const getDelivery = async (jobId: string): Promise<SmsDelivery> => {
    const response = await smsFetch(jobEndpoint(jobId), { headers: { authorization: headers.authorization } }, 8_000);
    if (!response.ok) throw await smsResponseError(response);
    const result = await response.json().catch(() => null) as { message?: { status?: unknown; error?: unknown } } | null;
    const status = mapMessavoState(result?.message?.status);
    if (!status) throw new Error('Messavo status API returned an invalid state');
    return { status, ...(status === 'failed' ? { outageReason: smsOutageReason(0, result?.message?.error) } : {}) };
  };

  return {
    name: 'messavo',
    sendMessage,
    async sendOtp(phone, code, idempotencyKey) {
      return sendMessage(phone, otpMessage(code), idempotencyKey);
    },
    getDelivery,
    async getStatus(jobId) { return (await getDelivery(jobId)).status; },
    async cancel(jobId) {
      const response = await smsFetch(jobEndpoint(jobId), {
        method: 'DELETE',
        headers: { authorization: headers.authorization }
      }, 5_000);
      if (response.status === 204) return true;
      if (response.status === 404 || response.status === 409) return false;
      throw new Error(`Messavo cancellation API returned ${response.status}`);
    }
  };
}

function encodePoolJob(providerId: string, jobId: string) {
  return `${Buffer.from(providerId).toString('base64url')}.${Buffer.from(jobId).toString('base64url')}`;
}

function decodePoolJob(value: string) {
  const [provider, job, extra] = value.split('.');
  if (!provider || !job || extra) return null;
  try {
    return { providerId: Buffer.from(provider, 'base64url').toString(), jobId: Buffer.from(job, 'base64url').toString() };
  } catch {
    return null;
  }
}

/** Tries enabled Messavo credentials in ascending priority order. */
export function createRankedMessavoProvider(
  configs: RankedMessavoConfig[],
  onAttempt?: (event: SmsProviderAttempt) => void | Promise<void>,
  validateConfig?: (config: RankedMessavoConfig) => void | Promise<void>
): SmsProvider | null {
  const providers = configs
    .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id))
    .map(config => ({
      config,
      provider: createMessavoProvider({ SMS_API_BASE_URL: config.baseUrl, SMS_API_TOKEN: config.token })
    }))
    .filter((item): item is { config: RankedMessavoConfig; provider: SmsProvider } => Boolean(item.provider));
  if (!providers.length) return null;
  const sendProviders = providers.filter(item => item.config.enabled !== false);
  if (!sendProviders.length) return null;

  const send = async (kind: 'message' | 'otp', phone: string, content: string, idempotencyKey: string) => {
    let lastError: unknown;
    for (const { config, provider } of sendProviders) {
      await Promise.resolve(onAttempt?.({ providerId: config.id, kind, outcome: 'ATTEMPTED' })).catch(() => undefined);
      try {
        try { await validateConfig?.(config); }
        catch { throw new SmsProviderError('Messavo API endpoint is unavailable', 'PROVIDER_CONFIGURATION', true); }
        const result = kind === 'otp'
          ? await provider.sendOtp(phone, content, idempotencyKey)
          : await provider.sendMessage(phone, content, idempotencyKey);
        const sent = {
          ...result,
          providerId: config.id,
          ...(result.jobId ? { jobId: encodePoolJob(config.id, result.jobId) } : {})
        };
        await Promise.resolve(onAttempt?.({ providerId: config.id, kind, outcome: 'SUCCEEDED', status: result.status })).catch(() => undefined);
        return sent;
      } catch (error) {
        lastError = error;
        await Promise.resolve(onAttempt?.({ providerId: config.id, kind, outcome: 'FAILED',
          reason: error instanceof SmsProviderError && error.outageReason ? error.outageReason : 'PROVIDER_REJECTED' })).catch(() => undefined);
        // A timeout, lost connection, or malformed accepted response may mean
        // the first provider queued the SMS. Trying another could send a
        // duplicate code, so only an explicit pre-acceptance rejection falls
        // through to the next ranked provider.
        if (!(error instanceof SmsProviderError) || !error.fallbackSafe) throw error;
      }
    }
    throw lastError instanceof Error ? lastError : new SmsProviderError('Every Messavo provider failed', 'SERVICE_UNAVAILABLE');
  };

  const resolveJob = (value: string) => {
    const decoded = decodePoolJob(value);
    if (!decoded) return null;
    const match = providers.find(item => item.config.id === decoded.providerId);
    return match ? { ...match, jobId: decoded.jobId } : null;
  };

  return {
    name: 'messavo',
    sendMessage(phone, message, idempotencyKey) { return send('message', phone, message, idempotencyKey); },
    sendOtp(phone, code, idempotencyKey) { return send('otp', phone, code, idempotencyKey); },
    async getDelivery(jobId) {
      const job = resolveJob(jobId);
      if (!job?.provider.getDelivery) throw new Error('Messavo delivery provider is unavailable');
      await validateConfig?.(job.config);
      return await job.provider.getDelivery(job.jobId);
    },
    async getStatus(jobId) {
      const job = resolveJob(jobId);
      if (!job?.provider.getStatus) throw new Error('Messavo delivery provider is unavailable');
      await validateConfig?.(job.config);
      return await job.provider.getStatus(job.jobId);
    },
    async cancel(jobId) {
      const job = resolveJob(jobId);
      if (job) await validateConfig?.(job.config);
      return job?.provider.cancel ? await job.provider.cancel(job.jobId) : false;
    }
  };
}

export function getSmsProvider(environment: SmsEnvironment = process.env): SmsProvider | null {
  const configuredProvider = (environment.SMS_PROVIDER || '').trim().toLowerCase();
  switch (configuredProvider) {
    case 'messavo':
    case 'woven':
      // `woven` is a compatibility alias only. Public responses
      // and operational surfaces consistently name the provider Messavo.
      return createMessavoProvider(environment);
    case 'http':
      return createHttpProvider(environment);
    default:
      return null;
  }
}

export function isSmsConfigured(environment: SmsEnvironment = process.env): boolean {
  return getSmsProvider(environment) !== null;
}

/** Uses a dedicated automatic-send credential when configured. */
export function getFollowUpSmsProvider(environment: SmsEnvironment = process.env): SmsProvider | null {
  const followUpToken = environment.SMS_FOLLOWUP_API_TOKEN?.trim();
  if (!followUpToken) return null;
  return getSmsProvider({
    ...environment,
    SMS_API_TOKEN: followUpToken,
    SMS_API_BASE_URL: environment.SMS_FOLLOWUP_API_BASE_URL?.trim() || environment.SMS_API_BASE_URL,
    SMS_HTTP_TOKEN: followUpToken,
    SMS_HTTP_ENDPOINT: environment.SMS_FOLLOWUP_HTTP_ENDPOINT?.trim() || environment.SMS_HTTP_ENDPOINT
  });
}

export function isFollowUpSmsConfigured(environment: SmsEnvironment = process.env) {
  return getFollowUpSmsProvider(environment) !== null;
}
