import { Link } from 'react-router';
import { InfoPage } from './InfoPage';

export default function PrivacyPage() {
  return (
    <InfoPage eyebrow="Legal" title="Privacy Policy" intro="Effective 26 August 2026. This policy explains what Drop currently collects, why it is used, where it is stored, and when another member can see it.">
      <section>
        <h2>Information we collect</h2>
        <p>When you create or use an account, Drop can store your name, phone number, password hash, blood group, district and approximate district coordinates, availability, an optional private reason when you are unavailable, optional self-reported age and weight, an optional private description of a medical condition or current sickness, verification status, your exact or approximate last-donation declaration, lifetime donation count, and private donation-history entries. Blood requests can include patient and requester names, blood group, district, needed-by date, contact people, comments, status, and creation time. Community posts store the title, Markdown body, post type, author account, publication state and times, and one processed image for a donation story when you choose to upload it.</p>
      </section>
      <section>
        <h2>How we use it</h2>
        <p>We use this information to authenticate you, maintain your donor profile, identify compatible nearby donors, display and manage blood requests, prevent basic abuse, and keep request ownership intact. We do not sell personal information or use it for advertising.</p>
      </section>
      <section>
        <h2>Who can see phone numbers</h2>
        <p>Public donor searches can show an opted-in member’s name, blood group, approximate location or distance, verification signal, current availability, and the self-reported last-donation summary and lifetime donation count when provided, but never their detailed donation records or hospital and organization names. A signed-in member can see the phone number only while that registered donor has explicitly marked themselves available.</p>
        <p className="mt-3">Your age, weight, availability reason, and medical-condition or current-sickness note stay private to your account and authorized operators. They are not published in donor search and are not medical clearance; the collection facility makes the final eligibility decision.</p>
        <p className="mt-3">Imported listings from other public sources stay in separate storage. Drop does not provide a browsable donor directory. A listing can appear only in a scoped blood-group, district, and upazila search, and its phone number stays masked for everyone until a verified requester publishes a matching request.</p>
        <p className="mt-3">To reduce bulk collection, each account and IP address may use up to three districts, three blood groups, and nine unique searches per Dhaka day. Moving between result pages for the same blood-group, district, and upazila search does not count again. Standard short-term request limits still apply.</p>
        <p className="mt-3">There is one exception, and it is deliberately narrow. A member with a verified phone who has published a blood request can open one imported number at a time, and only for donors in that request's own district and upazila. Every reveal is recorded. After a number is opened, a blocking call-outcome dialog stays over every page and the rest of Drop cannot be used until the outcome is saved; opening another number is also refused. A revealed number is for that one call and must not be reshared or stored.</p>
        <p className="mt-3">If one of those numbers is yours, you can take it off this directory at <a href="/directory/remove" className="font-bold text-primary underline">/directory/remove</a> without creating an account. We verify the number by SMS so that only you can remove it, then stop showing it in search and stop it being revealed to anyone — including if we import from that source again. The organisation that originally published it keeps its own copy, so ask them separately.</p>
        <p className="mt-3">Public request lists do not include private contact details. Request contacts are limited to the request owner and donors who accept an invitation for that request. Information you add to comments may be visible publicly, so do not post phone numbers or sensitive medical details there.</p>
        <p className="mt-3">Your detailed donation dates, organizations, private notes, and linked Drop requests stay private to your account and authorized operators. Donor cards may show only the resulting total and safe last-donation summary. When you choose “Share this donation,” you decide whether the private draft receives your story text, donation date, organization, total, and an optional image. Drop never copies the private note, linked request, patient information, request contacts, or medical details into that draft.</p>
        <p className="mt-3">Published community posts are public, indexed pages that show your display name, reviewed post text, publication time, and story image when supplied. Drafts are private to you and authorized operators; hidden and deleted posts stop being publicly available. Uploaded images are resized, converted to WebP, and stripped of embedded metadata before storage.</p>
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
        <p>Registration and password recovery normally use a short-lived, purpose-bound code. Verification confirms control of a phone number and must not be treated as identity or clinical confirmation. Codes, recipient numbers, API keys, and message bodies are not written to application logs, and Drop fails closed when no delivery channel is configured. During controlled non-production testing, a superadmin can explicitly enable the visibly labelled OTP bypass mode; while it is active, Drop does not prove phone ownership.</p>
      </section>
      <section>
        <h2>Your choices</h2>
        <p>You can update donor information, download a server-side account export including your community posts, delete individual posts, and delete your account from profile settings. Account deletion revokes sessions, removes donor and private patient/contact information, removes authored community content and images, cancels active requests, and anonymizes coordination and safety records that must be retained. You can also send an access, correction, or deletion question through the <Link to="/contact">contact page</Link>.</p>
      </section>
      <section>
        <h2>Questions and changes</h2>
        <p>This policy describes the service as it operates today. Material changes will be reflected on this page with a revised effective date. Send privacy questions or requests through the <Link to="/contact">contact page</Link>.</p>
      </section>
    </InfoPage>
  );
}
