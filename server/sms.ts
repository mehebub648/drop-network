// SMS provider abstraction.
//
// No real SMS gateway is wired up yet, so `getSmsProvider()` returns null and
// the app currently runs without phone verification (the OTP endpoints were
// removed in 0.0.31; accounts start with `is_verified: false`).
//
// To add a real provider later:
//   1. Implement the SmsProvider interface (see the Twilio sketch below).
//   2. Add a `case` for it in `getSmsProvider()`, keyed off SMS_PROVIDER.
//   3. Set SMS_PROVIDER (and the provider's credentials) in the environment.
//   4. Reintroduce OTP endpoints in server/server.ts and gate registration on
//      a successful verification.

export interface SmsProvider {
  name: string;
  sendOtp(phone: string, code: string): Promise<void>;
}

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
