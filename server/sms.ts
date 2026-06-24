// SMS provider abstraction.
//
// Today no real SMS gateway is wired up, so `getSmsProvider()` returns null and
// the auth routes fall back to accepting FALLBACK_OTP ("123456") for testing.
//
// To add a real provider later:
//   1. Implement the SmsProvider interface (see the Twilio sketch below).
//   2. Add a `case` for it in `getSmsProvider()`, keyed off SMS_PROVIDER.
//   3. Set SMS_PROVIDER (and the provider's credentials) in the environment.
// Once a provider is configured, the fallback OTP is automatically disabled and
// only the real generated OTP is accepted.

export interface SmsProvider {
  name: string;
  sendOtp(phone: string, code: string): Promise<void>;
}

// OTP accepted only when no SMS provider is configured (local/dev/testing).
export const FALLBACK_OTP = '123456';

/**
 * Returns the active SMS provider, or null if none is configured.
 * Selection is driven by the SMS_PROVIDER environment variable.
 */
export function getSmsProvider(): SmsProvider | null {
  const provider = (process.env.SMS_PROVIDER || '').trim().toLowerCase();

  switch (provider) {
    // Example for when a real gateway is added:
    //
    // case 'twilio':
    //   return createTwilioProvider();

    case '':
    default:
      return null;
  }
}

/** True when a real SMS gateway is configured. */
export function isSmsConfigured(): boolean {
  return getSmsProvider() !== null;
}

// --- Provider implementations -------------------------------------------------
//
// Sketch of a real provider. Uncomment, install the SDK, and add the matching
// `case` in getSmsProvider() above.
//
// function createTwilioProvider(): SmsProvider {
//   const accountSid = process.env.TWILIO_ACCOUNT_SID;
//   const authToken = process.env.TWILIO_AUTH_TOKEN;
//   const from = process.env.TWILIO_FROM_NUMBER;
//   const client = require('twilio')(accountSid, authToken);
//   return {
//     name: 'twilio',
//     async sendOtp(phone, code) {
//       await client.messages.create({
//         to: phone,
//         from,
//         body: `Your verification code is ${code}`,
//       });
//     },
//   };
// }
