import React from 'react';
import { 
  FULL_COMPANY_NAME, 
  SUPPORT_EMAIL 
} from '../../constants/legal';

const TermsOfService = () => {
  return (
    <article className="prose prose-invert max-w-none text-slate-300 leading-relaxed font-semibold">
      <h1 className="text-3xl font-black text-white mb-6 uppercase tracking-wider">Terms of Service</h1>
      <p className="text-xs text-slate-500 font-extrabold mb-8 uppercase tracking-widest">Last Updated: May 22, 2026</p>

      <section className="mb-8">
        <h2 className="text-xl font-bold text-white mb-4">1. Agreement to Terms</h2>
        <p>
          By creating an account, accessing, or using ustats.pro (the &quot;Service&quot;), you agree to be bound by these Terms of Service. The Service is operated by <strong>{FULL_COMPANY_NAME}</strong> (&quot;Company&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;). If you do not agree with any of these terms, you are prohibited from using the Service.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold text-white mb-4">2. Liability Disclaimer (Limitation of Liability)</h2>
        <p className="mb-4 bg-slate-950 border border-amber-500/30 p-5 rounded-2xl text-slate-200 text-sm font-black leading-relaxed">
          <strong>IMPORTANT NOTICE ON SPORTING LIABILITY:</strong> ustats.pro is an analytical utility designed to record athletic performance. Ultimate Frisbee is a high-intensity sport. We assume zero responsibility for athletic, physical, or personal injury sustained by players, coaches, or spectators. By using our platform, you acknowledge and agree that:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-slate-300">
          <li>
            <strong>Physical Safety:</strong> You are solely responsible for ensuring safe playing conditions. We are not liable for any injuries, medical emergencies, or health conditions resulting from training, matches, or advice generated on the Platform.
          </li>
          <li>
            <strong>Garmin &amp; Sync Integrity:</strong> The accuracy of statistical records relies on local storage devices, user inputs, and third-party hardware integrations (such as Garmin smartwatch syncs). We are not liable for sync failures, missing data points, data corruption, or network dropouts on the field.
          </li>
          <li>
            <strong>Competitive Outcome:</strong> AI tactical recommendations, roster optimizations, or Net Impact Scores (NIS) are mathematical estimations. We assume zero liability for matches lost, tournament outcomes, or tactical decisions executed on the pitch.
          </li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold text-white mb-4">3. Data Ownership &amp; Intellectual Property</h2>
        <p className="mb-4">
          To maintain transparency and clarify intellectual property boundaries:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong>User Data Ownership:</strong> You retain full ownership, title, and intellectual property rights over all raw match statistics, player logs, team rosters, and custom data uploaded to your account.
          </li>
          <li>
            <strong>Platform &amp; Algorithm Ownership:</strong> All proprietary source code, software, analytical engines, Net Impact Score (NIS) computational logic, user interfaces, design assets, and AI-driven coaching algorithms are the exclusive property of <strong>{FULL_COMPANY_NAME}</strong> and are protected under international copyright and trade secret laws.
          </li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold text-white mb-4">4. Cookie and Local Storage Disclosures (DUAA 2025/2026 Update)</h2>
        <p className="mb-4">
          Under the <strong>Data Use and Access Act (DUAA) 2025/2026</strong> guidelines, cookie consent banners are not required for strictly necessary tracking mechanisms. ustats.pro does not run third-party advertising tracking. We only store strictly necessary cookies and local storage tokens to ensure core application functionality:
        </p>
        <div className="overflow-x-auto mb-4">
          <table className="min-w-full text-xs border border-slate-800 text-left">
            <thead>
              <tr className="bg-slate-950 text-slate-200 border-b border-slate-800 uppercase tracking-wider font-extrabold">
                <th className="p-3">Identifier</th>
                <th className="p-3">Type</th>
                <th className="p-3">Strictly Necessary Purpose</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-850">
                <td className="p-3 font-black text-indigo-400">sb-access-token</td>
                <td className="p-3 font-extrabold text-slate-400">Cookie / Storage</td>
                <td className="p-3">Maintains your authenticated session with Supabase secure systems.</td>
              </tr>
              <tr className="border-b border-slate-850">
                <td className="p-3 font-black text-indigo-400">ufstats_game</td>
                <td className="p-3 font-extrabold text-slate-400">Local Storage</td>
                <td className="p-3">Caches the active match details locally so data is not lost if the device reboots.</td>
              </tr>
              <tr className="border-b border-slate-850">
                <td className="p-3 font-black text-indigo-400">ufstats_offline_queue</td>
                <td className="p-3 font-extrabold text-slate-400">Local Storage</td>
                <td className="p-3">Enables our offline-first sync engine to queue points on the sideline and auto-upload.</td>
              </tr>
              <tr>
                <td className="p-3 font-black text-indigo-400">ufstats_beach_mode</td>
                <td className="p-3 font-extrabold text-slate-400">Local Storage</td>
                <td className="p-3">Saves your accessibility preference for high contrast mode to help visually-impaired users.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold text-white mb-4">5. Termination and Contact</h2>
        <p className="mb-4">
          We reserve the right to restrict or terminate access to our Service without notice if we detect a breach of these Terms, account sharing violation, or fraudulent activity.
        </p>
        <p>
          For enquiries regarding these terms, please contact: <a href={`mailto:${SUPPORT_EMAIL}`} className="text-indigo-400 hover:text-indigo-300 underline font-black">{SUPPORT_EMAIL}</a>.
        </p>
      </section>
    </article>
  );
};

export default TermsOfService;
