'use client';

import * as React from 'react';

import { Plus, Trash2, Eye, EyeOff } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { AutoOffer } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';

import { logger } from '@/lib/logger';
import { useToast } from '../../hooks/use-toast';

import { CreateOfferDialog } from './CreateOfferDialog';

export default function AutoOffersManagement() {
  const [offers, setOffers] = React.useState<AutoOffer[]>([]);
  const [loading, setLoading] = React.useState(true);
  const supabase = createClient();
  const { toast } = useToast();

  const fetchOffers = React.useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('auto_offers')
      .select('*')
      .order('priority', { ascending: false });

    if (error) {
      logger.error('Error fetching auto offers', { error, context: 'AutoOffersManagement.fetchOffers' });
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch offers',
      });
    } else {
      setOffers(data || []);
    }
    setLoading(false);
  }, [supabase, toast]);

  React.useEffect(() => {
    fetchOffers();
  }, [fetchOffers]);

  const toggleOfferStatus = async (offerId: string, isActive: boolean) => {
    const { error } = await supabase
      .from('auto_offers')
      .update({ is_active: !isActive })
      .eq('id', offerId);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update offer status',
      });
    } else {
      setOffers(offers.map(offer => 
        offer.id === offerId ? { ...offer, is_active: !isActive } : offer
      ));
      toast({
        title: 'Success',
        description: `Offer ${!isActive ? 'activated' : 'deactivated'} successfully`,
      });
    }
  };

  const deleteOffer = async (offerId: string) => {
    if (!confirm('Are you sure you want to delete this offer?')) return;

    const { error } = await supabase
      .from('auto_offers')
      .delete()
      .eq('id', offerId);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to delete offer',
      });
    } else {
      setOffers(offers.filter(offer => offer.id !== offerId));
      toast({
        title: 'Success',
        description: 'Offer deleted successfully',
      });
    }
  };

  const getOfferTypeLabel = (type: string) => {
    switch (type) {
      case 'category_discount': return 'Category Discount';
      case 'customer_tier': return 'Customer Tier';
      case 'minimum_order': return 'Minimum Order';
      case 'seasonal': return 'Seasonal';
      case 'product_specific': return 'Product Specific';
      default: return type;
    }
  };

  const getOfferValueDisplay = (offer: AutoOffer) => {
    if (offer.discount_percentage) {
      return `${offer.discount_percentage}% OFF`;
    } else if (offer.discount_amount) {
      return `₹${offer.discount_amount} OFF`;
    }
    return 'N/A';
  };

  const getConditionsDisplay = (offer: AutoOffer) => {
    const conditions = [];
    
    if (offer.conditions.customer_category) {
      conditions.push(`Customers: ${offer.conditions.customer_category.join(', ')}`);
    }
    
    if (offer.conditions.minimum_order_value) {
      conditions.push(`Min Order: ₹${offer.conditions.minimum_order_value}`);
    }
    
    if (offer.conditions.applicable_categories) {
      conditions.push(`Categories: ${offer.conditions.applicable_categories.join(', ')}`);
    }
    
    return conditions.join(' | ') || 'General';
  };

  const handleOfferCreated = (newOffer: AutoOffer) => {
    setOffers([newOffer, ...offers]);
    toast({
      title: 'Success',
      description: 'Auto-offer created successfully',
    });
  };

  if (loading) {
    return <div className="p-6">Loading offers...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Auto-Offers Management</h1>
          <p className="text-muted-foreground">
            Create and manage automatic offers that apply to customer carts
          </p>
        </div>
        <CreateOfferDialog onOfferCreated={handleOfferCreated}>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Auto-Offer
          </Button>
        </CreateOfferDialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Auto-Offers</CardTitle>
          <CardDescription>
            Manage automatic offers that are applied to customer carts based on eligibility
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Conditions</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Valid Until</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {offers.map((offer) => (
                <TableRow key={offer.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{offer.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {offer.description}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {getOfferTypeLabel(offer.type)}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    {getOfferValueDisplay(offer)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{offer.priority}</Badge>
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <div className="text-xs text-muted-foreground">
                      {getConditionsDisplay(offer)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={offer.is_active ? 'default' : 'secondary'}>
                      {offer.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(offer.conditions.valid_to).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleOfferStatus(offer.id, offer.is_active)}
                      >
                        {offer.is_active ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteOffer(offer.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {offers.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No auto-offers found. Create your first offer to get started.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}