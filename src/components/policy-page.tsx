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
        <div className="mx-auto max-w-5xl px-4 pb-16 pt-0 sm:px-6 lg:px-8 sm:pt-0">
          <Link href="/" className="inline-flex items-center text-sm text-slate-400 hover:text-white">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Link>
          <div className="mt-8 rounded-2xl border border-white/10 bg-slate-900/70 p-8">
            <h1 className="text-3xl font-semibold text-white">{defaultTitle}</h1>
            <div className="mt-8 flex items-center justify-center">
              <div className="text-center">
                <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-cyan-300" />
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
        <div className="mx-auto max-w-5xl px-4 pb-20 pt-0 sm:px-6 lg:px-8">
          <Link href="/" className="inline-flex items-center text-sm text-slate-400 hover:text-white">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Link>
          <div className="mt-8 rounded-2xl border border-white/10 bg-slate-900/70 p-8">
            <h1 className="text-3xl font-semibold text-white">{defaultTitle}</h1>
            <p className="mt-4 text-sm text-slate-400">
              {error ? `Error: ${error}` : 'Content temporarily unavailable. Please refresh the page.'}
            </p>
            <Link
              href="/"
              className="mt-6 inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition-colors hover:border-cyan-400/40"
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
      <div className="pointer-events-none absolute inset-0 bg-[url('/noise.svg')] opacity-20" />
      <div className="mx-auto max-w-5xl px-4 pb-20 pt-0 sm:px-6 lg:px-8 sm:pt-0">
        <Link href="/" className="inline-flex items-center text-sm text-slate-400 hover:text-white">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Home
        </Link>

        <div className="mt-8 rounded-2xl border border-white/10 bg-slate-900/60 p-6 sm:p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-2xl font-semibold text-white sm:text-3xl">{policyData.title || defaultTitle}</h1>
            {policyData.lastUpdated && (
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
                Last updated: {policyData.lastUpdated}
              </span>
            )}
          </div>

          {jumpItems.length > 0 && (
            <div className="mt-6 sm:hidden">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400" htmlFor="policy-quick-jump">
                Quick jump
              </label>
              <select
                id="policy-quick-jump"
                className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white focus:border-brand-cyan focus:outline-none"
                defaultValue=""
                onChange={handleJumpChange}
              >
                <option value="" disabled>
                  Select a section
                </option>
                {jumpItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="mt-6 space-y-6 text-sm text-slate-300">
            {enhancedHtml && (
              <div
                className="prose prose-invert max-w-none prose-headings:text-white prose-h2:text-xl sm:prose-h2:text-2xl prose-h2:font-semibold prose-h3:text-lg sm:prose-h3:text-xl prose-h3:font-semibold prose-a:text-cyan-300 prose-p:text-slate-300 prose-li:text-slate-300 prose-strong:text-brand-cyan prose-b:text-brand-cyan"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(enhancedHtml) }}
              />
            )}

            {!enhancedHtml && policyData.introduction && (
              <div className="space-y-4">
                {policyData.introduction.map((paragraph: string, index: number) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>
            )}

            {!enhancedHtml && policyData.sections &&
              policyData.sections.map((section: any, index: number) => (
                <div key={index} id={sectionIds[index]} className="space-y-3 border-t border-white/10 pt-6">
                  <h2 className="text-xl font-semibold text-white sm:text-2xl">{section.title}</h2>
                  {section.content &&
                    section.content.map((paragraph: string, pIndex: number) => (
                      <p key={pIndex}>{paragraph}</p>
                    ))}
                  {section.list && (
                    <ul className="list-disc pl-6 space-y-2">
                      {section.list.map((item: string, lIndex: number) => (
                        <li key={lIndex} dangerouslySetInnerHTML={{ __html: sanitizeHtml(item) }} />
                      ))}
                    </ul>
                  )}
                </div>
              ))}
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
