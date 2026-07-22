import { Link } from 'react-router-dom';
import { DraftNotice, InfoPage } from './InfoPage';

export default function PrivacyPage() {
  return (
    <InfoPage eyebrow="Legal" title="Privacy Policy" intro="This draft explains what Drop currently collects, why it is used, where it is stored, and when another member can see it.">
      <DraftNotice>{'<TODO: Insert the legal entity, privacy contact, jurisdiction, effective date, retention periods, and obtain local legal review.>'}</DraftNotice>
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
        <p>Public request lists do not include phone numbers or contact details. On a request page, signed-in members can see the request contact details and donor phone numbers so they can coordinate. The request creator’s account phone number is reserved for the request owner. Information you add to comments may be visible publicly, so do not post phone numbers or sensitive medical details there.</p>
      </section>
      <section>
        <h2>Storage and security</h2>
        <p>Drop currently stores application records in a LanceDB datastore. Passwords and verification codes are bcrypt-hashed. Login state uses an httpOnly, SameSite session cookie that browser JavaScript cannot read. A legacy random <code>drop_fingerprint</code> remains in localStorage for older comment attribution and ownership migration; new blood requests require a verified account. Security headers, JSON-only request handling, restricted production CORS, and rate limits reduce common risks, but no online service can promise absolute security.</p>
      </section>
      <section>
        <h2>Sharing and service providers</h2>
        <p>Drop does not currently send account data to advertising networks or an SMS provider. We may disclose information when required by law, to protect people from credible harm, or to infrastructure providers needed to operate the service once those providers are introduced. This policy should be updated before such a provider is enabled.</p>
      </section>
      <section>
        <h2>Verification and OTP</h2>
        <p>Registration uses a short-lived SMS code. Verification confirms control of a phone number and must not be treated as identity or clinical confirmation. OTP challenges are purpose-bound and expire; operational retention will be finalized before production launch.</p>
      </section>
      <section>
        <h2>Your choices</h2>
        <p>You can update donor information, download a server-side account export, and delete your account from profile settings. Deletion revokes sessions, removes donor and private patient/contact information, cancels active requests, and anonymizes coordination and safety records that must be retained. You can also send an access, correction, or deletion question through the <Link to="/contact">contact page</Link>.</p>
      </section>
    </InfoPage>
  );
}
