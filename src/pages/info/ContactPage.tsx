import { Mail, ShieldAlert } from 'lucide-react';
import { DraftNotice, InfoPage } from './InfoPage';

export default function ContactPage() {
  return (
    <InfoPage eyebrow="Contact" title="How can we help?" intro="Use email for account, privacy, safety, or abuse questions. Drop does not currently operate a staffed emergency line or a contact-form backend.">
      <DraftNotice>{'<TODO: Replace the placeholder email, add the organization address and support hours, and verify who monitors urgent safety reports.>'}</DraftNotice>
      <section className="grid gap-4 sm:grid-cols-2">
        <a href="mailto:hello@example.com?subject=Drop%20support" className="rounded-2xl border border-slate-200 p-5 no-underline hover:border-rose-200">
          <Mail className="w-6 h-6 text-primary mb-3" />
          <h2>General and privacy support</h2>
          <p className="text-sm">hello@example.com</p>
        </a>
        <a href="mailto:hello@example.com?subject=Drop%20safety%20report" className="rounded-2xl border border-slate-200 p-5 no-underline hover:border-rose-200">
          <ShieldAlert className="w-6 h-6 text-primary mb-3" />
          <h2>Safety or abuse report</h2>
          <p className="text-sm">Include the request URL and a concise description. Do not email passwords or OTPs.</p>
        </a>
      </section>
      <section>
        <h2>Medical emergencies</h2>
        <p>Do not wait for an email response. Contact the treating hospital, blood bank, and appropriate local emergency services directly. Drop cannot dispatch medical help or guarantee a donor response.</p>
      </section>
    </InfoPage>
  );
}
