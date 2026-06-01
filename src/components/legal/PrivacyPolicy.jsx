import React from 'react';
import { 
  FULL_COMPANY_NAME, 
  SUPPORT_EMAIL 
} from '../../constants/legal';

const PrivacyPolicy = () => {
  return (
    <article className="prose prose-invert max-w-none text-slate-300 leading-relaxed font-semibold">
      <h1 className="text-3xl font-black text-white mb-6 uppercase tracking-wider">Privacy Policy</h1>
      <p className="text-xs text-slate-500 font-extrabold mb-8 uppercase tracking-widest">Last Updated: May 22, 2026</p>

      <section className="mb-8">
        <h2 className="text-xl font-bold text-white mb-4">1. Introduction</h2>
        <p className="mb-4">
          Welcome to ustats.pro (the &quot;Platform&quot;), operated by <strong>{FULL_COMPANY_NAME}</strong> (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;). We are committed to protecting your personal data and respecting your privacy in accordance with the <strong>UK General Data Protection Regulation (UK GDPR)</strong> and the <strong>Data Protection Act 2018 (DPA 2018)</strong>.
        </p>
        <p>
          This Privacy Policy explains how we collect, use, process, and store your personal data when you use our web application, whether as a team administrator, coach, player, or spectator.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold text-white mb-4">2. The Data Controller</h2>
        <p className="mb-4">
          For the purposes of the UK GDPR, <strong>{FULL_COMPANY_NAME}</strong> is the Data Controller for the personal data collected through this Platform.
        </p>
        <p>
          If you have any questions about this Privacy Policy or how we handle your personal data, you can reach us at: <a href={`mailto:${SUPPORT_EMAIL}`} className="text-indigo-400 hover:text-indigo-300 underline font-black">{SUPPORT_EMAIL}</a>.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold text-white mb-4">3. Lawful Basis for Processing</h2>
        <p className="mb-4">
          We only process your personal data when we have a valid legal ground to do so. Under the UK GDPR, our primary lawful bases are:
        </p>
        <ul className="list-disc pl-6 space-y-2 mb-4">
          <li>
            <strong>Contractual Necessity (Article 6(1)(b) UK GDPR):</strong> To perform our agreement to provide the Platform services to you, manage your account, and enable Ultimate Frisbee statistics tracking.
          </li>
          <li>
            <strong>Legitimate Interests (Article 6(1)(f) UK GDPR):</strong> To continuously improve our services, optimize performance, secure our database, and verify users, provided these interests are not overridden by your fundamental rights.
          </li>
          <li>
            <strong>Consent (Article 6(1)(a) UK GDPR):</strong> Where you explicitly authorize us to connect with external wearable systems (e.g., Garmin data syncs).
          </li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold text-white mb-4">4. Personal Data We Collect</h2>
        <p className="mb-4">
          We collect and process the following categories of data in connection with the Platform:
        </p>
        
        <h3 className="text-lg font-bold text-indigo-400 mb-2">A. User Account Details</h3>
        <p className="mb-4">
          When you register or manage an account (e.g., as a coach or team administrator), we collect:
        </p>
        <ul className="list-disc pl-6 space-y-1 mb-4">
          <li>Full name and contact information</li>
          <li>Email address</li>
          <li>Encrypted password details (managed securely through Supabase Auth)</li>
          <li>Subscription billing status</li>
        </ul>

        <h3 className="text-lg font-bold text-indigo-400 mb-2">B. Player Roster Data</h3>
        <p className="mb-4">
          Coaches or administrators upload team and player details to perform statistic gathering:
        </p>
        <ul className="list-disc pl-6 space-y-1 mb-4">
          <li>Player name (or alias)</li>
          <li>Shirt/jersey number</li>
          <li>Gender matching preference (required for roster regulations)</li>
        </ul>

        <h3 className="text-lg font-bold text-indigo-400 mb-2">C. Game &amp; Athletic Stats</h3>
        <p className="mb-4">
          During game play, statistical events are tracked:
        </p>
        <ul className="list-disc pl-6 space-y-1 mb-4">
          <li>On-field game activities (Passes, Drops, Goals, Defences, Pull quality, Net Impact Scores)</li>
          <li>Garmin sync integrations (optional player heart rate, distance run, speed, and GPS path details where explicitly authorized)</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold text-white mb-4">5. Data Storage, Hosting, and Security</h2>
        <p className="mb-4">
          All data generated through the Platform is hosted securely using cloud infrastructure provided by <strong>Supabase</strong>. 
        </p>
        <p className="mb-4">
          <strong>Data Residency:</strong> The primary cloud server database instances are located securely in data centres within the <strong>United Kingdom (UK) / European Economic Area (EEA)</strong>. 
        </p>
        <p>
          We employ robust administrative, technical, and physical security measures (including row-level database security, SSL encryption, and isolated session IDs) to protect your data against unauthorized access, loss, or alteration.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold text-white mb-4">6. Your Data Rights</h2>
        <p className="mb-4">
          Under the UK GDPR, you have the following rights regarding your personal data:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Right of Access:</strong> Request a copy of the personal data we hold about you.</li>
          <li><strong>Right to Rectification:</strong> Ask us to correct inaccurate or incomplete data.</li>
          <li><strong>Right to Erasure (&quot;Right to be Forgotten&quot;):</strong> Request the deletion of your account and related data under specific legal conditions.</li>
          <li><strong>Right to Restriction:</strong> Request that we limit how we process your personal data.</li>
          <li><strong>Right to Portability:</strong> Obtain your team and player statistics in a structured, machine-readable format.</li>
          <li><strong>Right to Object:</strong> Oppose processing based on legitimate interests.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold text-white mb-4">7. Tournament Public Leaderboards &amp; Volunteer Scoring</h2>
        <p className="mb-4">
          When participating in organized tournaments, leagues, or events managed via the Platform:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong>Volunteer Scoring:</strong> Authorized volunteer scorers may log point-by-point telemetry, including player names, shirt numbers, and gender designations (MMP/FMP) in real time using 6-digit Pitch Codes, without requiring players to authenticate directly.
          </li>
          <li>
            <strong>Public Disclosures:</strong> Aggregated match telemetry, team scoring charts, play-by-play timelines, and AI-generated objective sports recaps are published publicly on spectator brackets, leaderboards, and tournament feeds.
          </li>
          <li>
            <strong>Legal Basis:</strong> The processing of this athletic tournament data is carried out on the basis of <strong>Legitimate Interests (Article 6(1)(f) UK GDPR)</strong> to facilitate organized athletic competitions, support public spectator features, and deliver automated sports journalism recaps. 
          </li>
          <li>
            <strong>Opt-Out &amp; Redaction:</strong> Players can request the anonymization or redaction of their statistical data on public tournament feeds by contacting their event coordinator or emailing us directly at <a href={`mailto:${SUPPORT_EMAIL}`} className="text-indigo-400 hover:text-indigo-300 underline font-black">{SUPPORT_EMAIL}</a>.
          </li>
        </ul>
      </section>
    </article>
  );
};

export default PrivacyPolicy;
