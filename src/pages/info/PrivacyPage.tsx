import { Link } from 'react-router-dom';
import { InfoPage } from './InfoPage';

export default function PrivacyPage() {
  return (
    <InfoPage eyebrow="Legal" title="Privacy Policy" intro="Effective 29 July 2026. This policy explains what Drop currently collects, why it is used, where it is stored, and when another member can see it.">
      <section>
        <h2>Information we collect</h2>
        <p>When you create or use an account, Drop can store your name, phone number, password hash, blood group, district and approximate district coordinates, availability, verification status, last donation date, and donation-history entries. Blood requests can include patient and requester names, blood group, district, needed-by date, contact people, comments, status, and creation time.</p>
      </section>
      <section>
        <h2>How we use it</h2>
        <p>We use this information to authenticate you, maintain your donor profile, identify compatible nearby donors, display and manage blood requests, prevent basic abuse, and keep request ownership intact. We do not sell personal information or use it for advertising.</p>
      </section>
      <section>
        <h2>Who can see phone numbers</h2>
        <p>Public donor searches can show an opted-in member’s name, blood group, approximate location or distance, verification signal, and current availability, but never their phone number. A signed-in member can see the phone number only while that registered donor has explicitly marked themselves available.</p>
        <p className="mt-3">Imported listings from other public sources stay in a separate archive. Browsing that archive never shows a phone number: they are masked for everyone, including signed-in members, because publication elsewhere is not consent to be listed here.</p>
        <p className="mt-3">There is one exception, and it is deliberately narrow. A member with a verified phone who has published a blood request can open one imported number at a time, and only for donors in that request's own district and upazila. Every reveal is recorded, and the next one is refused until the outcome of the previous call is reported. A revealed number is for that one call and must not be reshared or stored.</p>
        <p className="mt-3">Public request lists do not include private contact details. Request contacts are limited to the request owner and donors who accept an invitation for that request. Information you add to comments may be visible publicly, so do not post phone numbers or sensitive medical details there.</p>
      </section>
      <section>
        <h2>Storage and security</h2>
        <p>Drop currently stores application records in a LanceDB datastore. Passwords and verification codes are bcrypt-hashed. Login state uses an httpOnly, SameSite session cookie that browser JavaScript cannot read. A legacy random <code>drop_fingerprint</code> remains in localStorage for older comment attribution and ownership migration; new blood requests require a verified account. Security headers, JSON-only request handling, restricted production CORS, and rate limits reduce common risks, but no online service can promise absolute security.</p>
      </section>
      <section>
        <h2>Sharing and service providers</h2>
        <p>Drop does not send account data to advertising networks. When an SMS channel is configured, the destination phone number and one-time verification message are sent to that delivery provider. We may also disclose limited information when required by law, to protect people from credible harm, or to infrastructure providers needed to operate the service.</p>
      </section>
      <section>
        <h2>Verification and OTP</h2>
        <p>Registration and password recovery use a short-lived, purpose-bound code. Verification confirms control of a phone number and must not be treated as identity or clinical confirmation. In non-production development environments only, if no OTP delivery channel is configured, the code is printed to protected server logs so developers can complete the flow. Production never falls back to console delivery.</p>
      </section>
      <section>
        <h2>Your choices</h2>
        <p>You can update donor information, download a server-side account export, and delete your account from profile settings. Deletion revokes sessions, removes donor and private patient/contact information, cancels active requests, and anonymizes coordination and safety records that must be retained. You can also send an access, correction, or deletion question through the <Link to="/contact">contact page</Link>.</p>
      </section>
      <section>
        <h2>Questions and changes</h2>
        <p>This policy describes the service as it operates today. Material changes will be reflected on this page with a revised effective date. Send privacy questions or requests through the <Link to="/contact">contact page</Link>.</p>
      </section>
    </InfoPage>
  );
}
