'use client';

import * as React from 'react';

import { 
  Percent, 
  Gift, 
  Trash2, 
  Crown, 
  Star, 
  User,
  Calendar,
  Tag
} from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '../../hooks/use-toast';
import { createClient } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';
import type { CustomerDiscount, CustomerOffer, CustomerCategory } from '@/lib/types';

interface DiscountOffersDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DiscountOffersDialog({ isOpen, onClose }: DiscountOffersDialogProps) {
  const [discounts, setDiscounts] = React.useState<CustomerDiscount[]>([]);
  const [offers, setOffers] = React.useState<CustomerOffer[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState('discounts');
  
  // Form states
  const [discountForm, setDiscountForm] = React.useState({
    category: 'Normal' as CustomerCategory,
    discountPercentage: 0,
    description: '',
    isActive: true,
  });

  const [offerForm, setOfferForm] = React.useState({
    title: '',
    description: '',
    discountPercentage: 0,
    targetCategories: [] as CustomerCategory[],
    validFrom: '',
    validTo: '',
    isActive: true,
    minimumOrderValue: 0,
    maxDiscountAmount: 0,
  });

  const { toast } = useToast();
  const supabase = createClient();

  const fetchDiscounts = React.useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('customer_discounts')
        .select('*')
        .order('category');

      if (error) throw error;
      setDiscounts(data || []);
    } catch (error) {
      logger.error('Error fetching discounts in DiscountOffersDialog', { error });
    }
  }, [supabase]);

  const fetchOffers = React.useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('customer_offers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOffers(data || []);
    } catch (error) {
      logger.error('Error fetching offers in DiscountOffersDialog', { error });
    }
  }, [supabase]);

  const handleSaveDiscount = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('customer_discounts')
        .upsert({
          category: discountForm.category,
          discount_percentage: discountForm.discountPercentage,
          description: discountForm.description,
          is_active: discountForm.isActive,
        }, {
          onConflict: 'category'
        });

      if (error) throw error;

      toast({
        title: "Discount Updated",
        description: `${discountForm.category} customer discount has been updated.`,
      });

      fetchDiscounts();
      setDiscountForm({
        category: 'Normal',
        discountPercentage: 0,
        description: '',
        isActive: true,
      });
    } catch (error) {
      logger.error('Error saving discount in DiscountOffersDialog', { error, discountForm });
      toast({
        title: "Error",
        description: "Failed to save discount. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveOffer = async () => {
    if (!offerForm.title || !offerForm.description || !offerForm.validFrom || !offerForm.validTo) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('customer_offers')
        .insert({
          title: offerForm.title,
          description: offerForm.description,
          discount_percentage: offerForm.discountPercentage,
          target_categories: offerForm.targetCategories,
          valid_from: offerForm.validFrom,
          valid_to: offerForm.validTo,
          is_active: offerForm.isActive,
          minimum_order_value: offerForm.minimumOrderValue || null,
          max_discount_amount: offerForm.maxDiscountAmount || null,
        });

      if (error) throw error;

      toast({
        title: "Offer Created",
        description: "New customer offer has been created successfully.",
      });

      fetchOffers();
      setOfferForm({
        title: '',
        description: '',
        discountPercentage: 0,
        targetCategories: [],
        validFrom: '',
        validTo: '',
        isActive: true,
        minimumOrderValue: 0,
        maxDiscountAmount: 0,
      });
    } catch (error) {
      logger.error('Error saving offer in DiscountOffersDialog', { error, offerForm });
      toast({
        title: "Error",
        description: "Failed to create offer. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteOffer = async (offerId: string) => {
    try {
      const { error } = await supabase
        .from('customer_offers')
        .delete()
        .eq('id', offerId);

      if (error) throw error;

      toast({
        title: "Offer Deleted",
        description: "Customer offer has been deleted successfully.",
      });

      fetchOffers();
    } catch (error) {
      logger.error('Error deleting offer in DiscountOffersDialog', { error, offerId });
      toast({
        title: "Error",
        description: "Failed to delete offer. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getCategoryIcon = (category: CustomerCategory) => {
    switch (category) {
      case 'Premium':
        return <Crown className="h-4 w-4 text-yellow-500" />;
      case 'Standard':
        return <Star className="h-4 w-4 text-blue-500" />;
      default:
        return <User className="h-4 w-4 text-gray-500" />;
    }
  };

  const getCategoryColor = (category: CustomerCategory) => {
    switch (category) {
      case 'Premium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Standard':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Percent className="h-5 w-5" />
            Discounts & Offers Management
          </DialogTitle>
          <DialogDescription>
            Configure customer category discounts and create targeted offers.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="discounts" className="flex items-center gap-2">
              <Percent className="h-4 w-4" />
              Category Discounts
            </TabsTrigger>
            <TabsTrigger value="offers" className="flex items-center gap-2">
              <Gift className="h-4 w-4" />
              Special Offers
            </TabsTrigger>
          </TabsList>

          <TabsContent value="discounts" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Discount Form */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Update Category Discount</CardTitle>
                  <CardDescription>Set default discount percentages for customer categories</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="discountCategory">Customer Category</Label>
                    <Select value={discountForm.category} onValueChange={(value: CustomerCategory) => setDiscountForm({ ...discountForm, category: value })}>
                      <SelectTrigger>
                        <SelectValue>
                          <div className="flex items-center gap-2">
                            {getCategoryIcon(discountForm.category)}
                            <span>{discountForm.category}</span>
                          </div>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Normal">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-gray-500" />
                            Normal
                          </div>
                        </SelectItem>
                        <SelectItem value="Standard">
                          <div className="flex items-center gap-2">
                            <Star className="h-4 w-4 text-blue-500" />
                            Standard
                          </div>
                        </SelectItem>
                        <SelectItem value="Premium">
                          <div className="flex items-center gap-2">
                            <Crown className="h-4 w-4 text-yellow-500" />
                            Premium
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="discountPercentage">Discount Percentage</Label>
                    <Input
                      id="discountPercentage"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={discountForm.discountPercentage}
                      onChange={(e) => setDiscountForm({ ...discountForm, discountPercentage: parseFloat(e.target.value) || 0 })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="discountDescription">Description</Label>
                    <Textarea
                      id="discountDescription"
                      value={discountForm.description}
                      onChange={(e) => setDiscountForm({ ...discountForm, description: e.target.value })}
                      placeholder="Describe the discount benefits..."
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="discountActive"
                      checked={discountForm.isActive}
                      onCheckedChange={(checked) => setDiscountForm({ ...discountForm, isActive: checked })}
                    />
                    <Label htmlFor="discountActive" className="text-sm">
                      Active
                    </Label>
                  </div>

                  <Button onClick={handleSaveDiscount} disabled={isLoading} className="w-full">
                    {isLoading ? 'Saving...' : 'Update Discount'}
                  </Button>
                </CardContent>
              </Card>

              {/* Current Discounts */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Current Category Discounts</CardTitle>
                  <CardDescription>Active discount rates for each customer category</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {discounts.map((discount) => (
                      <div key={discount.id} className={`p-3 rounded-lg border ${getCategoryColor(discount.category)}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {getCategoryIcon(discount.category)}
                            <span className="font-medium">{discount.category}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={discount.isActive ? "default" : "secondary"}>
                              {discount.discountPercentage}%
                            </Badge>
                            {!discount.isActive && (
                              <Badge variant="outline">Inactive</Badge>
                            )}
                          </div>
                        </div>
                        <p className="text-xs mt-1 opacity-75">{discount.description}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="offers" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Offer Form */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Create Special Offer</CardTitle>
                  <CardDescription>Create targeted offers for specific customer categories</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="offerTitle">Offer Title</Label>
                    <Input
                      id="offerTitle"
                      value={offerForm.title}
                      onChange={(e) => setOfferForm({ ...offerForm, title: e.target.value })}
                      placeholder="e.g., Holiday Special 20% Off"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="offerDescription">Description</Label>
                    <Textarea
                      id="offerDescription"
                      value={offerForm.description}
                      onChange={(e) => setOfferForm({ ...offerForm, description: e.target.value })}
                      placeholder="Describe the offer details..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="offerDiscount">Discount %</Label>
                      <Input
                        id="offerDiscount"
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={offerForm.discountPercentage}
                        onChange={(e) => setOfferForm({ ...offerForm, discountPercentage: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="minOrder">Min Order Value</Label>
                      <Input
                        id="minOrder"
                        type="number"
                        min="0"
                        value={offerForm.minimumOrderValue}
                        onChange={(e) => setOfferForm({ ...offerForm, minimumOrderValue: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="validFrom">Valid From</Label>
                      <Input
                        id="validFrom"
                        type="datetime-local"
                        value={offerForm.validFrom}
                        onChange={(e) => setOfferForm({ ...offerForm, validFrom: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="validTo">Valid To</Label>
                      <Input
                        id="validTo"
                        type="datetime-local"
                        value={offerForm.validTo}
                        onChange={(e) => setOfferForm({ ...offerForm, validTo: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Target Categories</Label>
                    <div className="flex gap-2">
                      {(['Normal', 'Standard', 'Premium'] as CustomerCategory[]).map((category) => (
                        <Button
                          key={category}
                          type="button"
                          variant={offerForm.targetCategories.includes(category) ? "default" : "outline"}
                          size="sm"
                          onClick={() => {
                            const newCategories = offerForm.targetCategories.includes(category)
                              ? offerForm.targetCategories.filter(c => c !== category)
                              : [...offerForm.targetCategories, category];
                            setOfferForm({ ...offerForm, targetCategories: newCategories });
                          }}
                        >
                          {getCategoryIcon(category)}
                          <span className="ml-1">{category}</span>
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="offerActive"
                      checked={offerForm.isActive}
                      onCheckedChange={(checked) => setOfferForm({ ...offerForm, isActive: checked })}
                    />
                    <Label htmlFor="offerActive" className="text-sm">
                      Active
                    </Label>
                  </div>

                  <Button onClick={handleSaveOffer} disabled={isLoading} className="w-full">
                    {isLoading ? 'Creating...' : 'Create Offer'}
                  </Button>
                </CardContent>
              </Card>

              {/* Active Offers */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Active Offers</CardTitle>
                  <CardDescription>Current special offers and promotions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {offers.map((offer) => (
                      <div key={offer.id} className="p-3 border rounded-lg">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Tag className="h-4 w-4" />
                              <span className="font-medium text-sm">{offer.title}</span>
                              <Badge variant="outline">{offer.discountPercentage}%</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mb-2">{offer.description}</p>
                            <div className="flex flex-wrap gap-1 mb-2">
                              {offer.targetCategories.map((category) => (
                                <Badge key={category} variant="secondary" className="text-xs">
                                  {category}
                                </Badge>
                              ))}
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(offer.validFrom).toLocaleDateString()} - {new Date(offer.validTo).toLocaleDateString()}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteOffer(offer.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    {offers.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <Gift className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No offers created yet.</p>
                        <p className="text-sm">Create your first special offer to get started.</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end space-x-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}