"use client";

import * as React from 'react';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import sanitizeHtml from '@/lib/sanitize-html';
import { usePageContent } from '../hooks/use-page-content';


interface PolicyPageProps {
  pageKey: string;
  defaultTitle?: string;
  initialContent?: any;
}

type JumpItem = {
  id: string;
  label: string;
  level: 'h2' | 'h3';
};

export default function PolicyPage({ pageKey, defaultTitle = 'Policy', initialContent }: PolicyPageProps) {
  const { content: clientContent, loading: clientLoading, error: clientError } = usePageContent(initialContent ? '' : pageKey);
  
  const content = initialContent || clientContent;
  const loading = initialContent ? false : clientLoading;
  const error = initialContent ? null : clientError;

  const policyData = content?.content || {};
  const rawDescription = extractRawDescription(policyData);
  const descriptionHtml = formatDescriptionAsHtml(rawDescription);
  const { html: enhancedHtml } = React.useMemo(
    () => enhanceHtmlWithAnchors(descriptionHtml),
    [descriptionHtml]
  );
  const { sectionIds } = React.useMemo(
    () => buildSectionJumpItems(policyData.sections),
    [policyData.sections]
  );

  if (loading) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
        <div className="pointer-events-none absolute inset-0 bg-noise opacity-10" />
        <div className="mx-auto max-w-5xl px-4 pb-16 pt-12 sm:px-6 lg:px-8">
          <Link 
            href="/" 
            className="group inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
            Back to Home
          </Link>
          <div className="mt-8 rounded-2xl border border-border bg-card p-8 backdrop-blur-md">
            <h1 className="text-3xl font-extrabold text-foreground">{defaultTitle}</h1>
            <div className="mt-12 flex items-center justify-center">
              <div className="text-center">
                <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <p className="text-sm text-muted-foreground">Loading {defaultTitle.toLowerCase()}...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !content) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
        <div className="pointer-events-none absolute inset-0 bg-noise opacity-20" />
        <div className="mx-auto max-w-5xl px-4 pb-20 pt-12 sm:px-6 lg:px-8">
          <Link 
            href="/" 
            className="group inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
            Back to Home
          </Link>
          <div className="mt-8 rounded-2xl border border-border bg-card p-8 backdrop-blur-md text-center">
            <h1 className="text-2xl font-bold text-foreground mb-4">Content Unavailable</h1>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
              {error ? `Error: ${error}` : 'The requested policy content is temporarily unavailable. Please try reloading the page.'}
            </p>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-lg bg-muted border border-border hover:bg-muted/80 px-5 py-2.5 text-sm font-bold text-foreground transition-colors"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <style dangerouslySetInnerHTML={{ __html: `
        .policy-content h2 {
          font-size: 1.5rem !important;
          font-weight: 700 !important;
          margin-top: 3rem !important;
          margin-bottom: 1.25rem !important;
          color: hsl(var(--foreground)) !important;
          border-bottom: 1px solid hsl(var(--border)) !important;
          padding-bottom: 0.625rem !important;
        }
        .policy-content h3 {
          font-size: 1.25rem !important;
          font-weight: 600 !important;
          margin-top: 2.25rem !important;
          margin-bottom: 1rem !important;
          color: hsl(var(--primary)) !important;
        }
        .policy-content p {
          margin-bottom: 1.5rem !important;
          line-height: 1.8 !important;
          color: hsl(var(--muted-foreground)) !important;
        }
        .policy-content ul, .policy-content ol {
          margin-top: 1rem !important;
          margin-bottom: 1.75rem !important;
          padding-left: 1.75rem !important;
          list-style-type: disc !important;
        }
        .policy-content li {
          margin-bottom: 0.875rem !important;
          line-height: 1.7 !important;
          color: hsl(var(--muted-foreground)) !important;
        }
        .policy-content strong, .policy-content b {
          color: hsl(var(--foreground)) !important;
          font-weight: 600 !important;
        }
      ` }} />
      <div className="pointer-events-none absolute inset-0 bg-noise opacity-10" />
      
      {/* Decorative Blur Orbs */}
      <div className="absolute top-10 left-10 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
 
      <div className="mx-auto max-w-5xl px-4 pb-24 pt-12 sm:px-6 lg:px-8">
        <Link 
          href="/" 
          className="group inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
          Back to Home
        </Link>
 
        {/* Main Policy Card Container */}
        <div className="mt-8 relative overflow-hidden rounded-2xl border border-border bg-card p-6 backdrop-blur-xl sm:p-10 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-8 mb-8">
            <h1 className="text-2xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-foreground via-foreground to-primary sm:text-3xl">
              {policyData.title || defaultTitle}
            </h1>
            {policyData.lastUpdated && (
              <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-500 ring-1 ring-inset ring-emerald-500/20">
                Last updated: {policyData.lastUpdated}
              </span>
            )}
          </div>
 
          <div className="policy-content mt-8 space-y-6 text-sm text-muted-foreground">
            {enhancedHtml && (
              <div
                className="prose prose-invert max-w-none"
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
                <div key={index} id={sectionIds[index]} className="space-y-4 border-t border-border pt-8 mt-8 first:mt-0 first:border-0 first:pt-0">
                  <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-foreground to-muted-foreground sm:text-2xl">
                    {section.title}
                  </h2>
                  {section.content &&
                    section.content.map((paragraph: string, pIndex: number) => (
                      <p key={pIndex} className="leading-relaxed">{paragraph}</p>
                    ))}
                  {section.list && (
                    <ul className="list-disc pl-6 space-y-2">
                      {section.list.map((item: string, lIndex: number) => (
                        <li key={lIndex} className="leading-relaxed marker:text-primary" dangerouslySetInnerHTML={{ __html: sanitizeHtml(item) }} />
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
