export interface SmsProvider {
  name: string;
  sendOtp(phone: string, code: string): Promise<void>;
}

export type SmsEnvironment = Readonly<Record<string, string | undefined>>;

/**
 * Provider-neutral HTTP gateway. The configured endpoint receives a JSON body
 * containing `phone`, `code`, and `message`. Authentication is sent through a
 * bearer token so deployments can use a small gateway adapter for their
 * preferred Bangladesh SMS vendor without coupling the app to one SDK.
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
        body: JSON.stringify({
          phone,
          code,
          message: `Your Drop verification code is ${code}. It expires in 10 minutes.`
        })
      });
      if (!response.ok) throw new Error(`SMS gateway returned ${response.status}`);
    }
  };
}

/**
 * Woven/Messavo automation transport. The deployment config stores only the
 * installation base URL; the stable v1 messages path is owned here so an
 * environment can move between Woven installations without editing code.
 */
function createWovenProvider(environment: SmsEnvironment): SmsProvider | null {
  const configuredBaseUrl = environment.SMS_API_BASE_URL?.trim();
  const token = environment.SMS_API_TOKEN?.trim();
  if (!configuredBaseUrl || !token) return null;

  let endpoint: URL;
  try {
    endpoint = new URL(configuredBaseUrl);
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(endpoint.protocol) || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
    return null;
  }
  endpoint.pathname = `${endpoint.pathname.replace(/\/+$/, '')}/api/v1/messages`;

  return {
    name: 'woven',
    async sendOtp(phone, code) {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          to: phone,
          message: `Your Drop verification code is ${code}. It expires in 10 minutes.`
        })
      });
      if (response.status !== 202) throw new Error(`Woven SMS API returned ${response.status}`);
    }
  };
}

function createDevelopmentConsoleProvider(environment: SmsEnvironment): SmsProvider | null {
  if (environment.NODE_ENV === 'production') return null;
  return {
    name: 'console',
    async sendOtp(phone, code) {
      console.info(JSON.stringify({ event: 'development_otp', phone, code }));
    }
  };
}

export function getSmsProvider(environment: SmsEnvironment = process.env): SmsProvider | null {
  const configuredProvider = (environment.SMS_PROVIDER || '').trim().toLowerCase();

  // Development remains a real OTP flow even without an external channel:
  // codes go to the process console. Production must always fail closed.
  if (!configuredProvider) return createDevelopmentConsoleProvider(environment);

  switch (configuredProvider) {
    case 'woven':
      return createWovenProvider(environment);
    case 'http':
      // An explicitly selected HTTP provider is never silently downgraded.
      return createHttpProvider(environment);
    case 'console':
      return createDevelopmentConsoleProvider(environment);
    default:
      return null;
  }
}

export function isSmsConfigured(environment: SmsEnvironment = process.env): boolean {
  return getSmsProvider(environment) !== null;
}
