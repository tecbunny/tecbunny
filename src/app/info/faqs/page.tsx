"use client";

import { useEffect, useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
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

export default function FaqsPage() {
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');

  useEffect(() => {
    async function fetchFaqs() {
      try {
        const response = await fetch('/api/faqs');
        const result = await response.json();
        if (result.success) {
          setFaqs(result.data.faqs);
        }
      } catch (error) {
        console.error('Failed to fetch FAQs:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchFaqs();
  }, []);

  const categories = useMemo(() => {
    const cats = Array.from(new Set(faqs.map((f) => f.category)));
    return ['All', ...cats];
  }, [faqs]);

  const filteredFaqs = useMemo(() => {
    return faqs.filter((faq) => {
      const matchesCategory = activeCategory === 'All' || faq.category === activeCategory;
      const qLower = faq.question.toLowerCase();
      const aLower = faq.answer.toLowerCase();
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        qLower.includes(searchLower) || aLower.includes(searchLower);

      return matchesCategory && matchesSearch;
    });
  }, [faqs, activeCategory, searchQuery]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <LoadingSpinner size="lg" text="Loading FAQs..." />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl mb-4 bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
          Frequently Asked Questions
        </h1>
        <p className="text-lg text-muted-foreground">
          Find answers to common questions about our services.
        </p>
      </div>

      <div className="relative mb-8 max-w-xl mx-auto">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search questions or answers..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 h-12 text-base rounded-full shadow-sm"
        />
      </div>

      {categories.length > 1 && (
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeCategory === category
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      )}

      {filteredFaqs.length > 0 ? (
        <div className="space-y-4">
          <Accordion type="multiple" className="w-full">
            {filteredFaqs.map((faq) => (
              <AccordionItem
                key={faq.id}
                value={faq.id}
                className="bg-card mb-4 border rounded-lg px-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <AccordionTrigger className="text-left font-semibold text-lg py-4">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-4 leading-relaxed whitespace-pre-wrap">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No FAQs found matching your criteria.</p>
        </div>
      )}
    </div>
  );
}
