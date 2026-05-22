import React from 'react';
import { 
  FULL_COMPANY_NAME, 
  SUPPORT_EMAIL 
} from '../../constants/legal';

const AiDisclosure = () => {
  return (
    <article className="prose prose-invert max-w-none text-slate-300 leading-relaxed font-semibold">
      <h1 className="text-3xl font-black text-white mb-6 uppercase tracking-wider">AI Transparency Disclosure</h1>
      <p className="text-xs text-slate-500 font-extrabold mb-8 uppercase tracking-widest">Last Updated: May 22, 2026</p>

      <section className="mb-8">
        <h2 className="text-xl font-bold text-white mb-4">1. Automated Intelligence and Guidance</h2>
        <p className="mb-4">
          At ustats.pro, we utilize state-of-the-art analytical technologies to assist coaches and teams in performing at their peak. We believe in absolute transparency regarding how we compute insights, in full compliance with the <strong>Digital Markets, Competition and Consumers Act (DMCC) 2025/2026</strong> and the latest guidance from the <strong>Information Commissioner&apos;s Office (ICO)</strong>.
        </p>
        <p className="bg-slate-950 border border-indigo-500/30 p-5 rounded-2xl text-slate-200 text-sm font-black leading-relaxed mb-4">
          <strong>AI-GENERATED TACTICAL BRIEFING:</strong> Please note that all coaching advice, tactical recommendations, and sideline commentary generated within the &quot;Coach Advisor&quot; or &quot;Coach Pro&quot; dashboards are generated automatically by advanced artificial intelligence algorithms and large language models (LLMs).
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold text-white mb-4">2. No Real-time Human Analysis</h2>
        <p className="mb-4">
          We want to make it absolutely clear that <strong>no human sports analyst</strong> is reviewing your live match feed, roster statistics, or playbook selections in real time. 
        </p>
        <p>
          The tactical briefings, suggested rotations, defensive adjustments, and pull assessments are entirely automated calculations computed from the mathematical statistics recorded on the pitch. While these models are trained extensively on elite Ultimate Frisbee strategies, they operate without human intervention or real-time professional human review.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold text-white mb-4">3. Responsible Use of Automated Recommendations</h2>
        <p className="mb-4">
          As a coach or team captain, you should treat all automated briefings as supplementary strategic suggestions rather than absolute guidelines. Athletic performance tracking, field wind conditions, and athlete wellness are complex, physical variables that are best analyzed by qualified coaching staff.
        </p>
        <p>
          We strongly advise reviewing automated advice with professional coaching discretion, ensuring player safety and well-being remain your ultimate sideline priority.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold text-white mb-4">4. Compliance &amp; Concerns</h2>
        <p className="mb-4">
          We are committed to the highest ethical and transparency standards in sports technology. If you have any feedback regarding the accuracy, tone, or safety of the automated strategic coaching advice generated on this Platform, please contact our compliance desk:
        </p>
        <p>
          Email: <a href={`mailto:${SUPPORT_EMAIL}`} className="text-indigo-400 hover:text-indigo-300 underline font-black">{SUPPORT_EMAIL}</a>.
        </p>
      </section>
    </article>
  );
};

export default AiDisclosure;
