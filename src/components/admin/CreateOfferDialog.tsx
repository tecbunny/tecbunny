'use client';

import * as React from 'react';

import { X } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import type { AutoOffer, OfferType, CustomerCategory } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';
import { useToast } from '../../hooks/use-toast';

interface CreateOfferDialogProps {
  children: React.ReactNode;
  onOfferCreated: (offer: AutoOffer) => void;
}

export function CreateOfferDialog({ children, onOfferCreated }: CreateOfferDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [formData, setFormData] = React.useState({
    title: '',
    description: '',
    type: 'category_discount' as OfferType,
    discount_percentage: '',
    discount_amount: '',
    priority: '50',
    max_discount_amount: '',
    minimum_order_value: '',
    customer_categories: [] as CustomerCategory[],
    applicable_categories: [] as string[],
    valid_from: '',
    valid_to: '',
    is_active: true,
    auto_apply: true,
  });

  const supabase = createClient();
  const { toast } = useToast();

  // Sample categories - in a real app, you'd fetch these from the database
  const productCategories = [
    'Laptops', 'Audio', 'Accessories', 'Monitors', 'Cameras', 
    'Tablets', 'Wearables', 'Furniture', 'Electronics'
  ];

  const customerCategories: CustomerCategory[] = ['Normal', 'Standard', 'Premium'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate form
      if (!formData.title || !formData.description || !formData.valid_from || !formData.valid_to) {
        toast({
          variant: 'destructive',
          title: 'Validation Error',
          description: 'Please fill in all required fields',
        });
        return;
      }

      if (!formData.discount_percentage && !formData.discount_amount) {
        toast({
          variant: 'destructive',
          title: 'Validation Error',
          description: 'Please provide either discount percentage or amount',
        });
        return;
      }

      // Prepare conditions object
      const conditions: any = {
        valid_from: formData.valid_from,
        valid_to: formData.valid_to,
      };

      if (formData.customer_categories.length > 0) {
        conditions.customer_category = formData.customer_categories;
      }

      if (formData.applicable_categories.length > 0) {
        conditions.applicable_categories = formData.applicable_categories;
      }

      if (formData.minimum_order_value) {
        conditions.minimum_order_value = parseFloat(formData.minimum_order_value);
      }

      // Prepare offer data
      const offerData = {
        title: formData.title,
        description: formData.description,
        type: formData.type,
        discount_percentage: formData.discount_percentage ? parseFloat(formData.discount_percentage) : null,
        discount_amount: formData.discount_amount ? parseFloat(formData.discount_amount) : null,
        conditions,
        is_active: formData.is_active,
        auto_apply: formData.auto_apply,
        priority: parseInt(formData.priority),
        max_discount_amount: formData.max_discount_amount ? parseFloat(formData.max_discount_amount) : null,
      };

      const { data, error } = await supabase
        .from('auto_offers')
        .insert(offerData)
        .select()
        .single();

      if (error) {
        throw error;
      }

      onOfferCreated(data);
      setOpen(false);
      
      // Reset form
      setFormData({
        title: '',
        description: '',
        type: 'category_discount',
        discount_percentage: '',
        discount_amount: '',
        priority: '50',
        max_discount_amount: '',
        minimum_order_value: '',
        customer_categories: [],
        applicable_categories: [],
        valid_from: '',
        valid_to: '',
        is_active: true,
        auto_apply: true,
      });

    } catch (error) {
      logger.error('Error creating offer in CreateOfferDialog', { error, formData });
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to create offer',
      });
    } finally {
      setLoading(false);
    }
  };

  const addCustomerCategory = (category: CustomerCategory) => {
    if (!formData.customer_categories.includes(category)) {
      setFormData({
        ...formData,
        customer_categories: [...formData.customer_categories, category]
      });
    }
  };

  const removeCustomerCategory = (category: CustomerCategory) => {
    setFormData({
      ...formData,
      customer_categories: formData.customer_categories.filter(c => c !== category)
    });
  };

  const addProductCategory = (category: string) => {
    if (!formData.applicable_categories.includes(category)) {
      setFormData({
        ...formData,
        applicable_categories: [...formData.applicable_categories, category]
      });
    }
  };

  const removeProductCategory = (category: string) => {
    setFormData({
      ...formData,
      applicable_categories: formData.applicable_categories.filter(c => c !== category)
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Auto-Offer</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Basic Information */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Summer Sale 2025"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="type">Offer Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value: OfferType) => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="category_discount">Category Discount</SelectItem>
                  <SelectItem value="customer_tier">Customer Tier</SelectItem>
                  <SelectItem value="minimum_order">Minimum Order</SelectItem>
                  <SelectItem value="seasonal">Seasonal</SelectItem>
                  <SelectItem value="product_specific">Product Specific</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Special summer discount on selected categories"
              required
            />
          </div>

          {/* Discount Value */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="discount_percentage">Discount %</Label>
              <Input
                id="discount_percentage"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={formData.discount_percentage}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  discount_percentage: e.target.value,
                  discount_amount: '' // Clear amount if percentage is set
                })}
                placeholder="25"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="discount_amount">Discount Amount (₹)</Label>
              <Input
                id="discount_amount"
                type="number"
                min="0"
                step="0.01"
                value={formData.discount_amount}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  discount_amount: e.target.value,
                  discount_percentage: '' // Clear percentage if amount is set
                })}
                placeholder="500"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Input
                id="priority"
                type="number"
                min="0"
                max="100"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                placeholder="50"
              />
            </div>
          </div>

          {/* Conditions */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="min_order">Minimum Order Value (₹)</Label>
              <Input
                id="min_order"
                type="number"
                min="0"
                step="0.01"
                value={formData.minimum_order_value}
                onChange={(e) => setFormData({ ...formData, minimum_order_value: e.target.value })}
                placeholder="1000"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="max_discount">Max Discount Amount (₹)</Label>
              <Input
                id="max_discount"
                type="number"
                min="0"
                step="0.01"
                value={formData.max_discount_amount}
                onChange={(e) => setFormData({ ...formData, max_discount_amount: e.target.value })}
                placeholder="1000"
              />
            </div>
          </div>

          {/* Customer Categories */}
          <div className="space-y-2">
            <Label>Target Customer Categories</Label>
            <div className="flex gap-2 mb-2">
              {customerCategories.map((category) => (
                <Button
                  key={category}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addCustomerCategory(category)}
                  disabled={formData.customer_categories.includes(category)}
                >
                  Add {category}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.customer_categories.map((category) => (
                <Badge key={category} variant="secondary" className="flex items-center gap-1">
                  {category}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0"
                    onClick={() => removeCustomerCategory(category)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
            </div>
          </div>

          {/* Product Categories */}
          <div className="space-y-2">
            <Label>Applicable Product Categories</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {productCategories.map((category) => (
                <Button
                  key={category}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addProductCategory(category)}
                  disabled={formData.applicable_categories.includes(category)}
                >
                  Add {category}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.applicable_categories.map((category) => (
                <Badge key={category} variant="secondary" className="flex items-center gap-1">
                  {category}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0"
                    onClick={() => removeProductCategory(category)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
            </div>
          </div>

          {/* Validity Period */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="valid_from">Valid From *</Label>
              <Input
                id="valid_from"
                type="datetime-local"
                value={formData.valid_from}
                onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="valid_to">Valid To *</Label>
              <Input
                id="valid_to"
                type="datetime-local"
                value={formData.valid_to}
                onChange={(e) => setFormData({ ...formData, valid_to: e.target.value })}
                required
              />
            </div>
          </div>

          {/* Settings */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="is_active">Active</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="auto_apply"
                checked={formData.auto_apply}
                onCheckedChange={(checked) => setFormData({ ...formData, auto_apply: checked })}
              />
              <Label htmlFor="auto_apply">Auto Apply</Label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Offer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}