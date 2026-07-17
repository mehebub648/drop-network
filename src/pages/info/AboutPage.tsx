import { Link } from 'react-router-dom';
import { DraftNotice, InfoPage } from './InfoPage';

export default function AboutPage() {
  return (
    <InfoPage eyebrow="About Drop" title="Neighbors helping neighbors, faster." intro="Drop connects people who need blood with compatible, available donors in the same district. It is designed for urgent coordination, honest information, and community action.">
      <section>
        <h2>Our mission</h2>
        <p>Finding blood in an emergency should not depend on how large someone’s personal network is. Drop helps a requester publish a clear need, identifies compatible donors nearby, and gives signed-in members a direct way to coordinate.</p>
      </section>
      <section>
        <h2>How matching works</h2>
        <ul>
          <li>A requester chooses a blood group, district, and needed-by date.</li>
          <li>Drop searches available donor profiles in medically compatible blood groups and sorts matches by approximate distance.</li>
          <li>Signed-in members can view contact details and coordinate directly. Request owners can update details and close the request.</li>
        </ul>
      </section>
      <section>
        <h2>What Drop is — and is not</h2>
        <p>Drop is a community-run matching and coordination service. It is not a hospital, blood bank, government registry, emergency service, or medical provider. We do not test blood, confirm donor eligibility, guarantee a match, arrange transport, or replace advice from qualified clinicians.</p>
      </section>
      <section>
        <h2>Built for accountability</h2>
        <p>Accounts, request ownership, availability status, donation history, and verification status help members understand who they are dealing with. Verification is not yet operational, so new accounts are shown honestly as unverified.</p>
        <p className="mt-3">Read our <Link to="/safety">safety guidance</Link> before meeting a donor or requester.</p>
      </section>
      <DraftNotice>{'<TODO: Add the organization legal name, founding story, team names, registration details, and office address.>'}</DraftNotice>
    </InfoPage>
  );
}
