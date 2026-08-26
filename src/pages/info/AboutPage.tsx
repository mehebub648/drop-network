import { Link } from 'react-router-dom';
import { InfoPage } from './InfoPage';

export default function AboutPage() {
  return (
    <InfoPage eyebrow="About Drop" title="Neighbors helping neighbors, faster." intro="Drop connects people who need blood with compatible, available donors in the same district. It is designed for urgent coordination, honest information, and community action.">
      <section>
        <h2>Our mission</h2>
        <p>Finding blood in an emergency should not depend on how large someone’s personal network is. Drop lets anyone search available, opted-in donors nearby without an account. A verified account is only required before a participating donor’s phone number can be shown.</p>
      </section>
      <section>
        <h2>How matching works</h2>
        <ul>
          <li>Anyone can search by blood group and district, or a verified requester can publish a complete blood request.</li>
          <li>Drop searches available donor profiles in medically compatible blood groups and sorts matches by approximate distance.</li>
          <li>Public search results never include phone numbers. Signed-in members can view the number of an opted-in, available Drop donor.</li>
          <li>Request contact details remain limited to the request owner and donors who accept an invitation. Request owners can update details and close the request.</li>
        </ul>
      </section>
      <section>
        <h2>What Drop is — and is not</h2>
        <p>Drop is a community-run matching and coordination service. It is not a hospital, blood bank, government registry, emergency service, or medical provider. We do not test blood, confirm donor eligibility, guarantee a match, arrange transport, or replace advice from qualified clinicians.</p>
      </section>
      <section>
        <h2>Built for accountability</h2>
        <p>Accounts, verified mobile ownership, availability status, donation history, and request timelines help members understand who they are dealing with. Verification confirms control of a phone number; it is not identity or clinical verification.</p>
        <p className="mt-3">Imported public listings are kept separately because those people have not opted in to Drop. There is no browsable donor directory: a masked listing appears only in a blood-group, district, and upazila search. Its number opens only through a published blood request in that upazila, one call at a time, and every reveal is recorded.</p>
        <p className="mt-3">Read our <Link to="/safety">safety guidance</Link> before meeting a donor or requester.</p>
      </section>
      <section>
        <h2>How to reach the team</h2>
        <p>Questions about an account, a safety concern, privacy, or a potential partnership can be sent through the <Link to="/contact">contact form</Link>. Do not use that form for a medical emergency; contact the treating facility directly.</p>
      </section>
    </InfoPage>
  );
}
