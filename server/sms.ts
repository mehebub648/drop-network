export interface SmsProvider {
  name: string;
  sendOtp(phone: string, code: string): Promise<void>;
}

/**
 * Provider-neutral HTTP gateway. The configured endpoint receives a JSON body
 * containing `phone`, `code`, and `message`. Authentication is sent through a
 * bearer token so deployments can use a small gateway adapter for their
 * preferred Bangladesh SMS vendor without coupling the app to one SDK.
 */
function createHttpProvider(): SmsProvider | null {
  const endpoint = process.env.SMS_HTTP_ENDPOINT?.trim();
  const token = process.env.SMS_HTTP_TOKEN?.trim();
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

function createDevelopmentConsoleProvider(): SmsProvider | null {
  if (process.env.NODE_ENV === 'production') return null;
  return {
    name: 'console',
    async sendOtp(phone, code) {
      console.info(JSON.stringify({ event: 'development_otp', phone, code }));
    }
  };
}

export function getSmsProvider(): SmsProvider | null {
  switch ((process.env.SMS_PROVIDER || '').trim().toLowerCase()) {
    case 'http':
      return createHttpProvider();
    case 'console':
      return createDevelopmentConsoleProvider();
    default:
      return null;
  }
}

export function isSmsConfigured(): boolean {
  return getSmsProvider() !== null;
}
