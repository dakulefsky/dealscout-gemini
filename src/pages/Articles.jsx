import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import articles from '../../shared/articles.json';
import guide from '../../shared/buyingGuide.json';
import NotFound from './NotFound';

const catalog = [{ ...guide, path: `/guides/${guide.slug}` }, ...articles.map(article => ({ ...article, path: `/articles/${article.slug}` }))];

export default function Articles() {
  const { slug } = useParams();
  const article = articles.find(item => item.slug === slug);
  useEffect(() => { document.title = `${slug ? article?.title || 'Article not found' : 'Articles'} — DealScout`; }, [slug, article]);
  if (slug && !article) return <NotFound />;
  if (!slug) return <main className="ds-shell py-10 sm:py-14">
    <h1 className="text-3xl font-bold text-slate-900">Articles</h1>
    <p className="mt-3 max-w-2xl text-sm text-slate-600">Practical help comparing offers, understanding savings, and choosing a deal that fits what you need.</p>
    <div className="mt-8 max-w-3xl divide-y divide-slate-200">{catalog.map(item => <article key={item.path} className="py-6 first:pt-0">
      <h2 className="text-xl font-semibold text-slate-900"><Link to={item.path} className="hover:text-emerald-800 hover:underline">{item.title}</Link></h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.description}</p>
      <Link to={item.path} className="mt-3 inline-block text-sm font-semibold text-emerald-900 underline">Read article<span className="sr-only">: {item.title}</span></Link>
    </article>)}</div>
  </main>;
  return <article className="ds-shell py-10 sm:py-14">
    <nav aria-label="Breadcrumb" className="text-xs text-slate-500"><Link to="/articles" className="underline">Articles</Link> / {article.title}</nav>
    <header className="mt-6 max-w-3xl"><h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">{article.title}</h1><p className="mt-5 text-slate-600 leading-relaxed">{article.intro}</p></header>
    <div className="max-w-3xl">{article.sections.map(section => <section key={section.title} className="mt-9"><h2 className="text-xl font-semibold text-slate-900">{section.title}</h2>{section.paragraphs.map(paragraph => <p key={paragraph} className="mt-3 text-sm text-slate-600 leading-relaxed">{paragraph}</p>)}</section>)}
      <nav aria-label="Related reading" className="mt-10 border-t border-slate-200 pt-6"><h2 className="text-lg font-semibold">Useful next steps</h2><ul className="mt-3 space-y-2 text-sm">{article.links.map(link => <li key={link.path}><Link to={link.path} className="underline text-emerald-900">{link.label}</Link></li>)}</ul></nav>
      <p className="mt-6 text-xs text-slate-500">Examples illustrate comparisons; they are not live offers or hands-on product reviews.</p>
    </div>
  </article>;
}
