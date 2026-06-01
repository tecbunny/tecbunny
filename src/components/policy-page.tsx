"use client";

import * as React from 'react';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import sanitizeHtml from '@/lib/sanitize-html';
import { usePageContent } from '../hooks/use-page-content';


interface PolicyPageProps {
  pageKey: string;
  defaultTitle?: string;
}

type JumpItem = {
  id: string;
  label: string;
  level: 'h2' | 'h3';
};

export default function PolicyPage({ pageKey, defaultTitle = 'Policy' }: PolicyPageProps) {
  const { content, loading, error } = usePageContent(pageKey);
  const [activeId, setActiveId] = React.useState('');
  const policyData = content?.content || {};
  const rawDescription = extractRawDescription(policyData);
  const descriptionHtml = formatDescriptionAsHtml(rawDescription);
  const { html: enhancedHtml, items: htmlJumpItems } = React.useMemo(
    () => enhanceHtmlWithAnchors(descriptionHtml),
    [descriptionHtml]
  );
  const { sectionJumpItems, sectionIds } = React.useMemo(
    () => buildSectionJumpItems(policyData.sections),
    [policyData.sections]
  );
  const jumpItems = htmlJumpItems.length > 0 ? htmlJumpItems : sectionJumpItems;

  React.useEffect(() => {
    if (jumpItems.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries.find((entry) => entry.isIntersecting);
        if (visibleEntry) {
          setActiveId(visibleEntry.target.id);
        }
      },
      { rootMargin: '-10% 0px -75% 0px' }
    );

    jumpItems.forEach((item) => {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [jumpItems]);

  const handleJumpChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const id = event.target.value;
    if (!id) return;
    const target = document.getElementById(id);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.history.replaceState(null, '', `#${id}`);
    }
  };

  if (loading) {
    return (
      <div className="relative min-h-[60vh] overflow-hidden bg-slate-950 text-slate-200">
        <div className="pointer-events-none absolute inset-0 bg-[url('/noise.svg')] opacity-10" />
        <div className="mx-auto max-w-5xl px-4 pb-16 pt-12 sm:px-6 lg:px-8">
          <Link 
            href="/" 
            className="group inline-flex items-center text-sm font-medium text-slate-400 hover:text-cyan-300 transition-colors"
          >
            <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
            Back to Home
          </Link>
          <div className="mt-8 rounded-2xl border border-white/10 bg-slate-900/60 p-8 backdrop-blur-md">
            <h1 className="text-3xl font-extrabold text-white">{defaultTitle}</h1>
            <div className="mt-12 flex items-center justify-center">
              <div className="text-center">
                <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
                <p className="text-sm text-slate-400">Loading {defaultTitle.toLowerCase()}...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !content) {
    return (
      <div className="relative min-h-[60vh] overflow-hidden bg-slate-950 text-slate-200">
        <div className="pointer-events-none absolute inset-0 bg-[url('/noise.svg')] opacity-20" />
        <div className="mx-auto max-w-5xl px-4 pb-20 pt-12 sm:px-6 lg:px-8">
          <Link 
            href="/" 
            className="group inline-flex items-center text-sm font-medium text-slate-400 hover:text-cyan-300 transition-colors"
          >
            <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
            Back to Home
          </Link>
          <div className="mt-8 rounded-2xl border border-red-500/20 bg-slate-900/60 p-8 backdrop-blur-md text-center">
            <h1 className="text-2xl font-bold text-white mb-4">Content Unavailable</h1>
            <p className="text-sm text-slate-400 max-w-md mx-auto mb-6">
              {error ? `Error: ${error}` : 'The requested policy content is temporarily unavailable. Please try reloading the page.'}
            </p>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 px-5 py-2.5 text-sm font-bold text-white transition-colors"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden bg-slate-950 text-slate-200">
      <div className="pointer-events-none absolute inset-0 bg-[url('/noise.svg')] opacity-10" />
      
      {/* Decorative Blur Orbs */}
      <div className="absolute top-10 left-10 w-[400px] h-[400px] bg-cyan-500/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-purple-500/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="mx-auto max-w-5xl px-4 pb-24 pt-12 sm:px-6 lg:px-8">
        <Link 
          href="/" 
          className="group inline-flex items-center text-sm font-medium text-slate-400 hover:text-cyan-300 transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
          Back to Home
        </Link>

        <div className="mt-8 grid gap-8 md:grid-cols-4 md:items-start">
          {/* Table of Contents Sticky Sidebar */}
          {jumpItems.length > 0 && (
            <aside className="hidden md:block md:col-span-1 md:sticky md:top-24 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
              <div className="rounded-xl border border-white/5 bg-slate-900/20 p-4 backdrop-blur-md shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 px-2">On this page</p>
                <nav className="space-y-1">
                  {jumpItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        const target = document.getElementById(item.id);
                        if (target) {
                          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          window.history.replaceState(null, '', `#${item.id}`);
                        }
                      }}
                      className={`block w-full text-left text-xs py-1.5 px-3 rounded-lg transition-all duration-300 ${
                        activeId === item.id
                          ? 'text-cyan-300 bg-cyan-500/10 font-bold border-l-2 border-cyan-400 pl-2'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 pl-3'
                      } ${item.level === 'h3' ? 'text-[11px] opacity-80 pl-5' : ''}`}
                    >
                      {item.label}
                    </button>
                  ))}
                </nav>
              </div>
            </aside>
          )}

          {/* Main Policy Card Container */}
          <div className={`${jumpItems.length > 0 ? 'md:col-span-3' : 'md:col-span-4'} relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900/80 to-slate-900/40 p-6 backdrop-blur-xl sm:p-10 shadow-[0_0_50px_rgba(6,182,212,0.03)]`}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-white/5 pb-6">
              <h1 className="text-2xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-cyan-300 sm:text-3xl">
                {policyData.title || defaultTitle}
              </h1>
              {policyData.lastUpdated && (
                <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-300 ring-1 ring-inset ring-emerald-500/20">
                  Last updated: {policyData.lastUpdated}
                </span>
              )}
            </div>

            {/* Quick jump for mobile views */}
            {jumpItems.length > 0 && (
              <div className="mt-6 md:hidden">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400" htmlFor="policy-quick-jump">
                  Quick jump
                </label>
                <select
                  id="policy-quick-jump"
                  className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950/80 px-3 py-2.5 text-sm text-slate-200 focus:border-cyan-400 focus:outline-none"
                  defaultValue=""
                  onChange={handleJumpChange}
                >
                  <option value="" disabled>
                    Select a section
                  </option>
                  {jumpItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.level === 'h3' ? '  ' : ''}{item.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="mt-8 space-y-6 text-sm text-slate-300">
              {enhancedHtml && (
                <div
                  className="prose prose-invert max-w-none prose-headings:text-white prose-h2:text-xl sm:prose-h2:text-2xl prose-h2:font-bold prose-h2:mt-10 prose-h2:pb-2 prose-h2:border-b prose-h2:border-white/5 prose-h3:text-lg prose-h3:mt-6 prose-h3:text-cyan-300 prose-p:text-slate-300 prose-p:leading-relaxed prose-li:text-slate-300 prose-strong:text-cyan-300 prose-b:text-cyan-300 prose-a:text-cyan-400 hover:prose-a:text-cyan-300 prose-a:underline"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(enhancedHtml) }}
                />
              )}

              {!enhancedHtml && policyData.introduction && (
                <div className="space-y-4">
                  {policyData.introduction.map((paragraph: string, index: number) => (
                    <p key={index} className="leading-relaxed">{paragraph}</p>
                  ))}
                </div>
              )}

              {!enhancedHtml && policyData.sections &&
                policyData.sections.map((section: any, index: number) => (
                  <div key={index} id={sectionIds[index]} className="space-y-4 border-t border-white/5 pt-8 mt-8 first:mt-0 first:border-0 first:pt-0">
                    <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-200 sm:text-2xl">
                      {section.title}
                    </h2>
                    {section.content &&
                      section.content.map((paragraph: string, pIndex: number) => (
                        <p key={pIndex} className="leading-relaxed">{paragraph}</p>
                      ))}
                    {section.list && (
                      <ul className="list-disc pl-6 space-y-2">
                        {section.list.map((item: string, lIndex: number) => (
                          <li key={lIndex} className="leading-relaxed marker:text-cyan-400" dangerouslySetInnerHTML={{ __html: sanitizeHtml(item) }} />
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function extractRawDescription(policyData: Record<string, any>): string {
  if (typeof policyData?.description === 'string') {
    return policyData.description;
  }
  if (typeof policyData?.descriptionHtml === 'string') {
    return policyData.descriptionHtml;
  }
  return '';
}

function formatDescriptionAsHtml(rawDescription: string): string {
  if (!rawDescription) return '';
  const trimmed = rawDescription.trim();
  if (!trimmed) return '';
  const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(trimmed);
  if (looksLikeHtml) {
    return trimmed;
  }
  const paragraphs = trimmed
    .split(/\n{2,}/)
    .map((paragraph: string) => paragraph.replace(/\n/g, '<br />'));
  return paragraphs.map((paragraph: string) => `<p>${paragraph}</p>`).join('');
}

function enhanceHtmlWithAnchors(html: string): { html: string; items: JumpItem[] } {
  if (!html) return { html, items: [] };
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const headingNodes = Array.from(doc.querySelectorAll('h2, h3'));
    const used = new Map<string, number>();
    const items = headingNodes.map((heading) => {
      const label = heading.textContent?.trim() || 'Section';
      const id = slugify(label, used);
      heading.setAttribute('id', id);
      return {
        id,
        label,
        level: heading.tagName.toLowerCase() as 'h2' | 'h3',
      };
    });
    return { html: doc.body.innerHTML, items };
  } catch {
    return { html, items: [] };
  }
}

function buildSectionJumpItems(sections: any[]): { sectionJumpItems: JumpItem[]; sectionIds: string[] } {
  if (!Array.isArray(sections) || sections.length === 0) {
    return { sectionJumpItems: [], sectionIds: [] };
  }
  const used = new Map<string, number>();
  const sectionJumpItems: JumpItem[] = [];
  const sectionIds = sections.map((section) => {
    const label = section?.title?.trim() || 'Section';
    const id = slugify(label, used);
    sectionJumpItems.push({ id, label, level: 'h2' });
    return id;
  });
  return { sectionJumpItems, sectionIds };
}

function slugify(text: string, used: Map<string, number>): string {
  const base = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
  const safeBase = base || 'section';
  const count = used.get(safeBase) ?? 0;
  used.set(safeBase, count + 1);
  return count === 0 ? safeBase : `${safeBase}-${count + 1}`;
}
