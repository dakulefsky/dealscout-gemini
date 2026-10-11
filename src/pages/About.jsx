import { Link } from 'react-router-dom';
import content from '../../shared/aboutContent.json';
export default function About() {
  return <article className="ds-shell py-12"><div className="max-w-3xl"><h1 className="text-3xl font-bold text-emerald-950">{content.title}</h1><p className="mt-4 text-slate-600">{content.intro}</p>{content.sections.map(section => <section key={section.title} className="mt-8"><h2 className="text-xl font-semibold">{section.title}</h2><p className="mt-3 text-slate-600 leading-relaxed">{section.text}</p></section>)}<p className="mt-8 text-sm"><Link to="/how-we-find-deals" className="underline">Our verification process</Link> · <Link to="/disclosure" className="underline">Affiliate disclosure</Link> · <Link to="/support" className="underline">Report a problem</Link></p></div></article>;
}
