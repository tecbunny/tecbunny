'use client';

import * as React from 'react';

import { Search, X, Filter, SortAsc, SortDesc } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

export interface SearchFilter {
  id: string;
  label: string;
  type: 'select' | 'checkbox' | 'range' | 'date';
  options?: { value: string; label: string }[];
  value?: any;
}

export interface SortOption {
  value: string;
  label: string;
}

interface UniversalSearchProps {
  placeholder?: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  filters?: SearchFilter[];
  onFilterChange?: (filterId: string, value: any) => void;
  sortOptions?: SortOption[];
  sortValue?: string;
  sortDirection?: 'asc' | 'desc';
  onSortChange?: (value: string, direction: 'asc' | 'desc') => void;
  activeFiltersCount?: number;
  onClearFilters?: () => void;
  className?: string;
}

export function UniversalSearch({
  placeholder = "Search...",
  searchValue,
  onSearchChange,
  filters = [],
  onFilterChange,
  sortOptions = [],
  sortValue,
  sortDirection = 'asc',
  onSortChange,
  activeFiltersCount = 0,
  onClearFilters,
  className = ""
}: UniversalSearchProps) {
  const [showFilters, setShowFilters] = React.useState(false);

  const handleSortDirectionToggle = () => {
    if (sortValue && onSortChange) {
      const newDirection = sortDirection === 'asc' ? 'desc' : 'asc';
      onSortChange(sortValue, newDirection);
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Main Search Bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={placeholder}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 pr-4"
          />
          {searchValue && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
              onClick={() => onSearchChange('')}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* Filter Button */}
        {filters.length > 0 && (
          <Popover open={showFilters} onOpenChange={setShowFilters}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filters
                {activeFiltersCount > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {activeFiltersCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Filters</h4>
                  {activeFiltersCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        onClearFilters?.();
                        setShowFilters(false);
                      }}
                    >
                      Clear All
                    </Button>
                  )}
                </div>

                {filters.map((filter) => (
                  <div key={filter.id} className="space-y-2">
                    <Label className="text-sm font-medium">{filter.label}</Label>
                    
                    {filter.type === 'select' && (
                      <Select
                        value={filter.value || '__all__'}
                        onValueChange={(value) => onFilterChange?.(filter.id, value === '__all__' ? '' : value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={`Select ${filter.label.toLowerCase()}`} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all__">All</SelectItem>
                          {filter.options?.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    {filter.type === 'checkbox' && (
                      <div className="space-y-2">
                        {filter.options?.map((option) => (
                          <div key={option.value} className="flex items-center space-x-2">
                            <Checkbox
                              id={`${filter.id}-${option.value}`}
                              checked={filter.value?.includes(option.value) || false}
                              onCheckedChange={(checked) => {
                                const currentValues = filter.value || [];
                                const newValues = checked
                                  ? [...currentValues, option.value]
                                  : currentValues.filter((v: string) => v !== option.value);
                                onFilterChange?.(filter.id, newValues);
                              }}
                            />
                            <Label
                              htmlFor={`${filter.id}-${option.value}`}
                              className="text-sm"
                            >
                              {option.label}
                            </Label>
                          </div>
                        ))}
                      </div>
                    )}

                    {filter.type === 'range' && (
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          type="number"
                          placeholder="Min"
                          value={filter.value?.min || ''}
                          onChange={(e) => 
                            onFilterChange?.(filter.id, {
                              ...filter.value,
                              min: e.target.value
                            })
                          }
                        />
                        <Input
                          type="number"
                          placeholder="Max"
                          value={filter.value?.max || ''}
                          onChange={(e) => 
                            onFilterChange?.(filter.id, {
                              ...filter.value,
                              max: e.target.value
                            })
                          }
                        />
                      </div>
                    )}

                    {filter.type === 'date' && (
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          type="date"
                          value={filter.value?.from || ''}
                          onChange={(e) => 
                            onFilterChange?.(filter.id, {
                              ...filter.value,
                              from: e.target.value
                            })
                          }
                        />
                        <Input
                          type="date"
                          value={filter.value?.to || ''}
                          onChange={(e) => 
                            onFilterChange?.(filter.id, {
                              ...filter.value,
                              to: e.target.value
                            })
                          }
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Sort Options */}
        {sortOptions.length > 0 && (
          <div className="flex gap-1">
            <Select
              value={sortValue || ''}
              onValueChange={(value) => onSortChange?.(value, sortDirection)}
            >
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Button
              variant="outline"
              size="icon"
              onClick={handleSortDirectionToggle}
              disabled={!sortValue}
            >
              {sortDirection === 'asc' ? (
                <SortAsc className="h-4 w-4" />
              ) : (
                <SortDesc className="h-4 w-4" />
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Active Filters */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.map((filter) => {
            if (!filter.value || 
                (Array.isArray(filter.value) && filter.value.length === 0) ||
                (filter.type === 'range' && !filter.value.min && !filter.value.max) ||
                (filter.type === 'date' && !filter.value.from && !filter.value.to)) {
              return null;
            }

            return (
              <Badge key={filter.id} variant="secondary" className="flex items-center gap-1">
                <span className="text-xs">
                  {filter.label}: {
                    filter.type === 'select' 
                      ? filter.options?.find(opt => opt.value === filter.value)?.label || filter.value
                      : filter.type === 'checkbox'
                      ? filter.value.length > 1 
                        ? `${filter.value.length} selected`
                        : filter.options?.find(opt => opt.value === filter.value[0])?.label
                      : filter.type === 'range'
                      ? `${filter.value.min || '0'} - ${filter.value.max || '∞'}`
                      : filter.type === 'date'
                      ? `${filter.value.from || ''} to ${filter.value.to || ''}`
                      : filter.value
                  }
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-3 w-3 p-0 hover:bg-transparent"
                  onClick={() => onFilterChange?.(filter.id, filter.type === 'checkbox' ? [] : '')}
                >
                  <X className="h-2 w-2" />
                </Button>
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}