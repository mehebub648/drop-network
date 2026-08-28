export type SmsDeliveryStatus = 'queued' | 'sent' | 'delivered' | 'failed' | 'canceled';

export type SmsSendResult = {
  jobId?: string;
  status: SmsDeliveryStatus;
};

export interface SmsProvider {
  name: string;
  sendOtp(phone: string, code: string, idempotencyKey: string): Promise<SmsSendResult>;
  getStatus?(jobId: string): Promise<SmsDeliveryStatus>;
  cancel?(jobId: string): Promise<boolean>;
}

export type SmsEnvironment = Readonly<Record<string, string | undefined>>;

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
    async sendOtp(phone, code) {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ phone, code, message: otpMessage(code) })
      });
      if (!response.ok) throw new Error(`SMS gateway returned ${response.status}`);
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

  return {
    name: 'messavo',
    async sendOtp(phone, code, idempotencyKey) {
      const response = await fetch(messagesEndpoint, {
        method: 'POST',
        headers: { ...headers, 'idempotency-key': idempotencyKey },
        body: JSON.stringify({ to: phone, message: otpMessage(code) })
      });
      if (response.status !== 202) throw new Error(`Messavo SMS API returned ${response.status}`);
      const result = await response.json().catch(() => null) as { id?: unknown; status?: unknown } | null;
      const jobId = typeof result?.id === 'string' ? result.id : '';
      if (!jobId) throw new Error('Messavo SMS API returned an invalid job');
      if (result?.status === 'pending_approval') {
        try {
          await fetch(jobEndpoint(jobId), {
            method: 'DELETE',
            headers: { authorization: headers.authorization }
          });
        } catch {
          // A manual key is never accepted for OTP. Best-effort cancellation
          // prevents a later human approval from sending an invalidated code.
        }
        throw new Error('Messavo SMS API did not queue the message');
      }
      const status = mapMessavoState(result?.status);
      if (!status || status === 'failed' || status === 'canceled') {
        throw new Error('Messavo SMS API did not queue the message');
      }
      return { jobId, status };
    },
    async getStatus(jobId) {
      const response = await fetch(jobEndpoint(jobId), {
        headers: { authorization: headers.authorization }
      });
      if (!response.ok) throw new Error(`Messavo status API returned ${response.status}`);
      const result = await response.json().catch(() => null) as { message?: { status?: unknown } } | null;
      const status = mapMessavoState(result?.message?.status);
      if (!status) throw new Error('Messavo status API returned an invalid state');
      return status;
    },
    async cancel(jobId) {
      const response = await fetch(jobEndpoint(jobId), {
        method: 'DELETE',
        headers: { authorization: headers.authorization }
      });
      if (response.status === 204) return true;
      if (response.status === 404 || response.status === 409) return false;
      throw new Error(`Messavo cancellation API returned ${response.status}`);
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
