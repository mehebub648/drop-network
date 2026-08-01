import { Link } from 'react-router-dom';
import { InfoPage } from './InfoPage';

export default function TermsPage() {
  return (
    <InfoPage eyebrow="Legal" title="Terms of Use" intro="Effective 1 August 2026. These terms set expectations for using Drop responsibly. By using the service, you agree to provide honest information and use it only for legitimate blood-donation coordination.">
      <section>
        <h2>Who may use Drop</h2>
        <p>You must be able to agree to these terms under applicable law. If you are coordinating for a patient, you must have permission to share the details you submit. Keep your password private and tell us if you believe your account is being misused.</p>
      </section>
      <section>
        <h2>Acceptable use</h2>
        <p>Use Drop only for genuine blood-donation needs, voluntary donor coordination, donation stories, and responsible health education. Do not impersonate another person, publish false emergencies, scrape or harvest contact information, harass members, bypass access controls or rate limits, upload malicious content, publish phone numbers or sensitive medical details, give individualized diagnoses, or use the service to buy or sell blood.</p>
      </section>
      <section>
        <h2>Not a medical or emergency service</h2>
        <p>Drop is not a hospital, blood bank, ambulance service, diagnostic service, or medical adviser. A match is a compatibility lead, not clinical clearance. We do not guarantee that a donor will respond, arrive, be eligible, or be accepted by a hospital. For an emergency, contact the appropriate emergency and clinical services directly.</p>
      </section>
      <section>
        <h2>Donation eligibility and safety</h2>
        <p>The receiving hospital or blood collection center decides whether donation is appropriate after identity checks, health screening, testing, and professional assessment. Follow the facility’s instructions and review our <Link to="/safety">safety guidance</Link>.</p>
      </section>
      <section>
        <h2>Content and account action</h2>
        <p>You remain responsible for information you submit and must have permission to publish every story, name, and image. You allow Drop to store, process, display, and index published content as needed to operate the service. Health suggestions are general community information, not medical advice. We may hide or remove content, limit access, or suspend accounts when reasonably necessary to address abuse, privacy, safety, legal, or security concerns.</p>
      </section>
      <section>
        <h2>Availability and liability</h2>
        <p>Drop is provided on an “as available” basis. To the extent permitted by law, the operator does not promise uninterrupted service, successful matching, or the accuracy of member-provided information, and is not liable for indirect or consequential loss arising from use of the service. Nothing in these terms excludes rights or liability that cannot legally be excluded.</p>
      </section>
      <section>
        <h2>Questions about these terms</h2>
        <p>Applicable law may give you rights that these terms cannot limit. If you have a question about these terms or an account action, use the <Link to="/contact">contact page</Link> and keep the ticket reference for follow-up.</p>
      </section>
    </InfoPage>
  );
}
