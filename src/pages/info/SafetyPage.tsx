import { Link } from 'react-router';
import { InfoPage } from './InfoPage';

export default function SafetyPage() {
  return (
    <InfoPage eyebrow="Safety" title="Coordinate safely. Donate clinically." intro="Drop helps people find one another; hospitals and qualified blood-collection teams keep donation safe. Always complete the actual donation in an appropriate clinical setting.">
      <section>
        <h2>Before you meet</h2>
        <ul>
          <li>Confirm the patient, hospital or blood bank, blood group, required date, and a reliable contact number.</li>
          <li>Prefer the hospital’s official number when independently confirming a request.</li>
          <li>Do not share national ID documents, financial credentials, OTPs, or unrelated medical records through comments.</li>
          <li>Tell someone you trust where you are going, especially if the requester is unknown to you.</li>
        </ul>
      </section>
      <section>
        <h2>Donate only at a clinical facility</h2>
        <p>Meet at the named hospital, licensed blood bank, or recognized donation center. Staff should verify identities, confirm the need, use sterile equipment, screen the donor, test and label blood, and provide aftercare. Do not donate in a private home, vehicle, hotel, or other informal location.</p>
      </section>
      <section>
        <h2>Blood should never be a transaction</h2>
        <p>Do not pay for blood or ask to be paid for it. Legitimate facilities may have documented clinical or processing fees, but a donor or requester demanding personal payment is a warning sign. End the conversation and report suspicious behavior through our <Link to="/contact">contact channel</Link>.</p>
      </section>
      <section>
        <h2>Basic eligibility reminders</h2>
        <p>Drop uses a configurable 120-day whole-blood interval as a conservative educational reminder until local clinical review approves deployment policy. It is not medical clearance. Donation rules can depend on age, weight, hemoglobin, medicines, pregnancy, recent illness or surgery, infection risk, travel, and local clinical policy. Answer screening questions honestly and accept the clinician’s decision.</p>
      </section>
      <section>
        <h2>Read community health posts carefully</h2>
        <p>Community health suggestions are member-written general information, not diagnosis, treatment, or a substitute for advice from a qualified clinician. Do not delay urgent care because of a post. Report content that asks for payment, exposes private details, or makes unsafe medical claims.</p>
      </section>
      <section>
        <h2>After donating</h2>
        <p>Rest as instructed, drink fluids, avoid strenuous activity for the recommended period, and seek clinical help if you feel unwell. Update your donation history so the app’s next-eligibility reminder is based on the latest known donation.</p>
      </section>
    </InfoPage>
  );
}
