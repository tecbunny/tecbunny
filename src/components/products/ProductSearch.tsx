
'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { useDebounce } from '../../hooks/use-debounce';

export function ProductSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchTerm, setSearchTerm] = React.useState(searchParams.get('q') || '');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const handleSearch = (term: string) => {
    const params = new URLSearchParams(searchParams);
    if (term) {
      params.set('q', term);
    } else {
      params.delete('q');
    }
    // Navigate to the products listing with the proper query param
    router.push(`/products?${params.toString()}`);
  };

  React.useEffect(() => {
    // This effect is for live search updates as the user types
    // It only triggers on the debounced term to avoid excessive re-renders
    // It's commented out by default to prefer form submission, but can be enabled.
    // if (debouncedSearchTerm) {
    //   handleSearch(debouncedSearchTerm);
    // }
  }, [debouncedSearchTerm]);

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    handleSearch(searchTerm);
  };

  return (
    <form onSubmit={handleSearchSubmit} className="relative w-full">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-400" />
      <Input
        type="search"
        placeholder="Search for products..."
        className="w-full pl-10 bg-blue-50 border-blue-200 focus:bg-white focus:border-blue-400 focus:ring-blue-200 placeholder:text-blue-400 text-blue-800"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
    </form>
  );
}