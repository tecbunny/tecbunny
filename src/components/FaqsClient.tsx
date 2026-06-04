"use client";

import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';

interface FAQ {
  id: string;
  category: string;
  question: string;
  answer: string;
  display_order: number;
}

interface FaqsClientProps {
  initialFaqs: FAQ[];
}

export default function FaqsClient({ initialFaqs }: FaqsClientProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');

  const categories = useMemo(() => {
    const cats = Array.from(new Set(initialFaqs.map((f) => f.category)));
    return ['All', ...cats];
  }, [initialFaqs]);

  const filteredFaqs = useMemo(() => {
    return initialFaqs.filter((faq) => {
      const matchesCategory = activeCategory === 'All' || faq.category === activeCategory;
      const qLower = faq.question.toLowerCase();
      const aLower = faq.answer.toLowerCase();
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        qLower.includes(searchLower) || aLower.includes(searchLower);

      return matchesCategory && matchesSearch;
    });
  }, [initialFaqs, activeCategory, searchQuery]);

  return (
    <div className="space-y-8">
      {/* Search Input Box with explicit min-height to prevent layout shift */}
      <div className="relative max-w-xl mx-auto min-h-[48px] w-full">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center text-muted-foreground pointer-events-none">
          <Search className="h-5 w-5" />
        </div>
        <Input
          type="text"
          placeholder="Search questions or answers..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 h-12 text-base rounded-full shadow-sm w-full border-muted focus-visible:ring-primary"
        />
      </div>

      {/* Category Pills Container with fixed height to prevent layout shifts when switching categories */}
      {categories.length > 1 && (
        <div className="min-h-[56px] flex items-center justify-center">
          <div className="flex flex-wrap justify-center gap-2 p-1 bg-muted/30 rounded-full border border-muted/50">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                  activeCategory === category
                    ? 'bg-primary text-primary-foreground shadow-md scale-105'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* FAQ Accordion container with min-height and stable layout rules */}
      <div className="min-h-[400px] w-full transition-all duration-300">
        {filteredFaqs.length > 0 ? (
          <Accordion type="multiple" className="w-full space-y-4">
            {filteredFaqs.map((faq) => (
              <AccordionItem
                key={faq.id}
                value={faq.id}
                className="bg-card border border-muted rounded-xl px-5 shadow-sm hover:shadow-md hover:border-primary/20 transition-all duration-200 overflow-hidden"
              >
                <AccordionTrigger className="text-left font-semibold text-lg py-4 hover:no-underline text-foreground hover:text-primary transition-colors">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-4 leading-relaxed whitespace-pre-wrap text-[15px] border-t border-muted/20 pt-3 animate-accordion-down">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        ) : (
          <div className="text-center py-16 border-2 border-dashed border-muted rounded-2xl flex flex-col items-center justify-center p-6 min-h-[300px]">
            <p className="text-lg font-medium text-muted-foreground">No FAQs found matching your criteria.</p>
            <p className="text-sm text-muted-foreground/75 mt-1">Try modifying your search or choosing another category.</p>
          </div>
        )}
      </div>
    </div>
  );
}
