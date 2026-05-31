'use client';

import * as React from 'react';

import { Crown, Star, User, Percent } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { CustomerCategory } from '@/lib/types';

interface CustomerCategoryBadgeProps {
  category: CustomerCategory | undefined;
  discountPercentage?: number;
  showDetails?: boolean;
  className?: string;
}

export function CustomerCategoryBadge({ 
  category, 
  discountPercentage, 
  showDetails = false,
  className = "" 
}: CustomerCategoryBadgeProps) {
  if (!category) {
    return null;
  }

  const getCategoryIcon = () => {
    switch (category) {
      case 'Premium':
        return <Crown className="h-4 w-4 text-yellow-500" />;
      case 'Standard':
        return <Star className="h-4 w-4 text-blue-500" />;
      default:
        return <User className="h-4 w-4 text-gray-500" />;
    }
  };

  const getCategoryColor = () => {
    switch (category) {
      case 'Premium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Standard':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getCategoryBenefits = () => {
    switch (category) {
      case 'Premium':
        return [
          'VIP customer support',
          'Exclusive product offers',
          'Free shipping on all orders',
          'Extended warranty options'
        ];
      case 'Standard':
        return [
          'Priority customer support',
          'Early access to sales',
          'Special discount rates'
        ];
      default:
        return ['Standard customer benefits'];
    }
  };

  if (showDetails) {
    return (
      <Card className={`${getCategoryColor()} border ${className}`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            {getCategoryIcon()}
            <span className="font-semibold">{category} Customer</span>
            {discountPercentage && discountPercentage > 0 && (
              <Badge variant="outline" className="flex items-center gap-1">
                <Percent className="h-3 w-3" />
                {discountPercentage}% Off
              </Badge>
            )}
          </div>
          <div className="text-sm space-y-1">
            {getCategoryBenefits().map((benefit, index) => (
              <div key={index} className="flex items-center gap-1">
                <span className="text-xs">•</span>
                <span>{benefit}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Badge 
      variant="outline" 
      className={`${getCategoryColor()} flex items-center gap-1 ${className}`}
    >
      {getCategoryIcon()}
      <span>{category}</span>
      {discountPercentage && discountPercentage > 0 && (
        <span className="ml-1">({discountPercentage}%)</span>
      )}
    </Badge>
  );
}