'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

import { 
  Plus, 
  Edit2, 
  Trash2, 
  Eye, 
  EyeOff, 
  Tag,
  TrendingUp,
  Gift,
  Users,
  RefreshCcw,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '../../hooks/use-toast';
import { useDebounce } from '../../hooks/use-debounce';
import { logger } from '@/lib/logger';
import type { Coupon, Discount } from '@/lib/types';

import { CreateDiscountDialog } from './CreateDiscountDialog';

interface Offer {
  id: string;
  title: string;
  description?: string;
  discount_type: 'percentage' | 'fixed_amount' | 'buy_x_get_y' | 'free_shipping';
  discount_value?: number;
  minimum_purchase_amount?: number;
  maximum_discount_amount?: number;
  offer_code?: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  is_featured: boolean;
  usage_limit?: number;
  usage_count: number;
  usage_limit_per_customer?: number;
  customer_eligibility: 'all' | 'new_customers' | 'existing_customers' | 'vip_customers';
  priority: number;
  display_on_homepage: boolean;
  banner_text?: string;
  banner_color?: string;
  terms_and_conditions?: string;
  created_at: string;
}

interface OffersManagementProps {
  initialTab?: 'offers' | 'discounts';
}

export default function OffersManagement({ initialTab = 'offers' }: OffersManagementProps) {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [offersLoading, setOffersLoading] = useState(false);
  const [offersError, setOffersError] = useState<string | null>(null);
  const [hasFetchedOffers, setHasFetchedOffers] = useState(false);
  const [offersUpdatedAt, setOffersUpdatedAt] = useState<Date | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'offers' | 'discounts'>(initialTab);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [discountLoading, setDiscountLoading] = useState(false);
  const [discountError, setDiscountError] = useState<string | null>(null);
  const [hasFetchedDiscounts, setHasFetchedDiscounts] = useState(false);
  const [discountsUpdatedAt, setDiscountsUpdatedAt] = useState<Date | null>(null);
  const [discountSearch, setDiscountSearch] = useState('');
  const [discountStatusFilter, setDiscountStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [discountTypeFilter, setDiscountTypeFilter] = useState<'all' | 'percentage' | 'fixed'>('all');
  const [discountActionId, setDiscountActionId] = useState<string | null>(null);
  const [discountPage, setDiscountPage] = useState(1);
  const [discountPageSize, setDiscountPageSize] = useState(25);
  const [discountTotal, setDiscountTotal] = useState(0);
  const { toast } = useToast();
  const debouncedDiscountSearch = useDebounce(discountSearch, 400);

  const offersControllerRef = useRef<AbortController | null>(null);
  const discountsControllerRef = useRef<AbortController | null>(null);

  const safeDiscountTotal = Math.max(discountTotal, 0);
  const totalDiscountPages = Math.max(1, Math.ceil(safeDiscountTotal / discountPageSize) || 1);
  const discountRangeStart = safeDiscountTotal === 0 ? 0 : (discountPage - 1) * discountPageSize + 1;
  const discountRangeEnd = safeDiscountTotal === 0 ? 0 : Math.min(discountPage * discountPageSize, safeDiscountTotal);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    discount_type: 'percentage' as 'percentage' | 'fixed_amount' | 'buy_x_get_y' | 'free_shipping',
    discount_value: '',
    minimum_purchase_amount: '',
    maximum_discount_amount: '',
    offer_code: '',
    start_date: '',
    end_date: '',
    is_active: true,
    is_featured: false,
    usage_limit: '',
    usage_limit_per_customer: '',
    customer_eligibility: 'all' as 'all' | 'new_customers' | 'existing_customers' | 'vip_customers',
    priority: '0',
    display_on_homepage: false,
    banner_text: '',
    banner_color: '#2563EB',
    terms_and_conditions: ''
  });

  const fetchOffers = useCallback(async () => {
    offersControllerRef.current?.abort();
    const controller = new AbortController();
    offersControllerRef.current = controller;

    setOffersLoading(true);
    setOffersError(null);

    try {
      const response = await fetch('/api/offers?include_expired=true', { signal: controller.signal });
      const data = await response.json();
      
      if (response.ok) {
        setOffers(data.offers || []);
        setOffersUpdatedAt(new Date());
        setHasFetchedOffers(true);
      } else {
        throw new Error(data.error || 'Failed to fetch offers');
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        return;
      }

      logger.error('Error fetching offers in OffersManagement', { error });
      setOffersError('Failed to fetch offers');
      setHasFetchedOffers(true);
      toast({
        title: 'Error',
        description: 'Failed to fetch offers',
        variant: 'destructive'
      });
    } finally {
      if (offersControllerRef.current === controller) {
        offersControllerRef.current = null;
      }
      setOffersLoading(false);
    }
  }, [toast]);

  const fetchDiscounts = useCallback(async () => {
    discountsControllerRef.current?.abort();
    const controller = new AbortController();
    discountsControllerRef.current = controller;

    setDiscountLoading(true);
    setDiscountError(null);

    try {
      const params = new URLSearchParams({
        page: String(discountPage),
        pageSize: String(discountPageSize)
      });

      const trimmedSearch = debouncedDiscountSearch.trim();
      if (trimmedSearch) {
        params.set('search', trimmedSearch);
      }
      if (discountStatusFilter !== 'all') {
        params.set('status', discountStatusFilter);
      }
      if (discountTypeFilter !== 'all') {
        params.set('type', discountTypeFilter);
      }

      const response = await fetch(`/api/discounts?${params.toString()}`, { signal: controller.signal });
      const data = await response.json();

      if (response.ok) {
        setDiscounts((data.discounts || []) as Discount[]);
        setDiscountTotal(typeof data.count === 'number' ? data.count : 0);
        setDiscountsUpdatedAt(new Date());
        setHasFetchedDiscounts(true);
      } else {
        throw new Error(data.error || 'Failed to fetch discounts');
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        return;
      }

      logger.error('Error fetching discounts in OffersManagement', { error });
      setDiscountError('Failed to fetch discounts');
      setHasFetchedDiscounts(true);
      toast({
        title: 'Error',
        description: 'Failed to fetch discounts',
        variant: 'destructive'
      });
    } finally {
      if (discountsControllerRef.current === controller) {
        discountsControllerRef.current = null;
      }
      setDiscountLoading(false);
    }
  }, [toast, discountPage, discountPageSize, debouncedDiscountSearch, discountStatusFilter, discountTypeFilter]);

    useEffect(() => () => {
      offersControllerRef.current?.abort();
      discountsControllerRef.current?.abort();
    }, []);

    useEffect(() => {
      if (activeTab === 'offers' && !hasFetchedOffers) {
        fetchOffers();
      }
    }, [activeTab, fetchOffers, hasFetchedOffers]);

    useEffect(() => {
      if (activeTab !== 'discounts') {
        return;
      }
      fetchDiscounts();
    }, [activeTab, fetchDiscounts]);

    useEffect(() => {
      setDiscountPage(1);
    }, [debouncedDiscountSearch, discountStatusFilter, discountTypeFilter]);

    useEffect(() => {
      const safeTotal = Math.max(discountTotal, 0);
      const maxPage = Math.max(1, Math.ceil(safeTotal / discountPageSize) || 1);
      if (discountPage > maxPage) {
        setDiscountPage(maxPage);
      }
    }, [discountTotal, discountPage, discountPageSize]);


  const visibleDiscounts = useMemo(() => {
    return [...discounts].sort((a, b) => {
      const priorityDiff = (b.priority ?? 0) - (a.priority ?? 0);
      if (priorityDiff !== 0) return priorityDiff;
      const dateA = new Date(a.updated_at ?? a.created_at ?? a.start_date).getTime();
      const dateB = new Date(b.updated_at ?? b.created_at ?? b.start_date).getTime();
      return dateB - dateA;
    });
  }, [discounts]);

  const handleDiscountCreated = (_created: Discount | Coupon) => {
    fetchDiscounts();
  };

  const toggleDiscountStatus = async (discount: Discount) => {
    const nextStatus = discount.status === 'active' ? 'inactive' : 'active';
    setDiscountActionId(discount.id);
    try {
      const response = await fetch('/api/discounts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: discount.id, status: nextStatus })
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to update discount');
      }
      setDiscounts((prev) => prev.map((d) => d.id === discount.id ? { ...d, status: nextStatus } : d));
      toast({
        title: 'Discount updated',
        description: `${discount.name} is now ${nextStatus}.`
      });
    } catch (error) {
      logger.error('Error toggling discount in OffersManagement', { error, discountId: discount.id });
      toast({
        title: 'Error',
        description: (error as Error).message,
        variant: 'destructive'
      });
    } finally {
      setDiscountActionId(null);
    }
  };

  const deleteDiscount = async (discount: Discount) => {
    if (!confirm(`Delete discount "${discount.name}"? This cannot be undone.`)) {
      return;
    }

    setDiscountActionId(discount.id);
    try {
      const response = await fetch(`/api/discounts?id=${discount.id}`, {
        method: 'DELETE'
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete discount');
      }
      fetchDiscounts();
      toast({
        title: 'Discount deleted',
        description: `${discount.name} has been removed.`
      });
    } catch (error) {
      logger.error('Error deleting discount in OffersManagement', { error, discountId: discount.id });
      toast({
        title: 'Error',
        description: (error as Error).message,
        variant: 'destructive'
      });
    } finally {
      setDiscountActionId(null);
    }
  };

  const handleSaveOffer = async () => {
    try {
      setIsSaving(true);

      // Validate required fields
      if (!formData.title || !formData.start_date || !formData.end_date) {
        toast({
          title: 'Error',
          description: 'Please fill in all required fields',
          variant: 'destructive'
        });
        return;
      }

      // Prepare the data
      const offerData = {
        ...formData,
        discount_value: formData.discount_value ? parseFloat(formData.discount_value) : null,
        minimum_purchase_amount: formData.minimum_purchase_amount ? parseFloat(formData.minimum_purchase_amount) : null,
        maximum_discount_amount: formData.maximum_discount_amount ? parseFloat(formData.maximum_discount_amount) : null,
        usage_limit: formData.usage_limit ? parseInt(formData.usage_limit) : null,
        usage_limit_per_customer: formData.usage_limit_per_customer ? parseInt(formData.usage_limit_per_customer) : null,
        priority: parseInt(formData.priority),
        offer_code: formData.offer_code || null
      };

      const url = '/api/offers';
      const method = editingOffer ? 'PUT' : 'POST';
      const body = editingOffer ? { id: editingOffer.id, ...offerData } : offerData;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const result = await response.json();

      if (response.ok) {
        toast({
          title: 'Success',
          description: result.message
        });
        
        await fetchOffers();
        handleCloseDialog();
      } else {
        throw new Error(result.error || 'Failed to save offer');
      }
    } catch (error) {
      logger.error('Error saving offer in OffersManagement', { error, formData });
      toast({
        title: 'Error',
        description: (error as Error).message,
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditOffer = (offer: Offer) => {
    setEditingOffer(offer);
    setFormData({
      title: offer.title,
      description: offer.description || '',
      discount_type: offer.discount_type,
      discount_value: offer.discount_value?.toString() || '',
      minimum_purchase_amount: offer.minimum_purchase_amount?.toString() || '',
      maximum_discount_amount: offer.maximum_discount_amount?.toString() || '',
      offer_code: offer.offer_code || '',
      start_date: offer.start_date.split('T')[0],
      end_date: offer.end_date.split('T')[0],
      is_active: offer.is_active,
      is_featured: offer.is_featured,
      usage_limit: offer.usage_limit?.toString() || '',
      usage_limit_per_customer: offer.usage_limit_per_customer?.toString() || '',
      customer_eligibility: offer.customer_eligibility,
      priority: offer.priority.toString(),
      display_on_homepage: offer.display_on_homepage,
      banner_text: offer.banner_text || '',
      banner_color: offer.banner_color || '#dc2626',
      terms_and_conditions: offer.terms_and_conditions || ''
    });
    setShowCreateDialog(true);
  };

  const handleDeleteOffer = async (offer: Offer) => {
    if (!confirm(`Are you sure you want to delete "${offer.title}"?`)) return;

    try {
      const response = await fetch(`/api/offers?id=${offer.id}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (response.ok) {
        toast({
          title: 'Success',
          description: result.message
        });
        await fetchOffers();
      } else {
        throw new Error(result.error || 'Failed to delete offer');
      }
    } catch (error) {
      logger.error('Error deleting offer in OffersManagement', { error, offerId: offer.id });
      toast({
        title: 'Error',
        description: (error as Error).message,
        variant: 'destructive'
      });
    }
  };

  const toggleOfferStatus = async (offer: Offer) => {
    try {
      const response = await fetch('/api/offers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: offer.id,
          is_active: !offer.is_active
        })
      });

      const result = await response.json();

      if (response.ok) {
        toast({
          title: 'Success',
          description: `Offer ${!offer.is_active ? 'activated' : 'deactivated'}`
        });
        await fetchOffers();
      } else {
        throw new Error(result.error || 'Failed to update offer');
      }
    } catch (error) {
      logger.error('Error toggling offer status in OffersManagement', { error, offerId: offer.id });
      toast({
        title: 'Error',
        description: (error as Error).message,
        variant: 'destructive'
      });
    }
  };

  const handleCloseDialog = () => {
    setShowCreateDialog(false);
    setEditingOffer(null);
    setFormData({
      title: '',
      description: '',
      discount_type: 'percentage' as 'percentage' | 'fixed_amount' | 'buy_x_get_y' | 'free_shipping',
      discount_value: '',
      minimum_purchase_amount: '',
      maximum_discount_amount: '',
      offer_code: '',
      start_date: '',
      end_date: '',
      is_active: true,
      is_featured: false,
      usage_limit: '',
      usage_limit_per_customer: '',
      customer_eligibility: 'all' as 'all' | 'new_customers' | 'existing_customers' | 'vip_customers',
      priority: '0',
      display_on_homepage: false,
      banner_text: '',
      banner_color: '#2563EB',
      terms_and_conditions: ''
    });
  };

  const getDiscountDisplay = (offer: Offer) => {
    switch (offer.discount_type) {
      case 'percentage':
        return `${offer.discount_value}%`;
      case 'fixed_amount':
        return `₹${offer.discount_value}`;
      case 'free_shipping':
        return 'Free Shipping';
      case 'buy_x_get_y':
        return 'Buy X Get Y';
      default:
        return '-';
    }
  };

  const getStatusBadge = (offer: Offer) => {
    const now = new Date();
    const endDate = new Date(offer.end_date);
    const startDate = new Date(offer.start_date);

    if (!offer.is_active) {
      return <Badge variant="secondary">Inactive</Badge>;
    } else if (now > endDate) {
      return <Badge variant="destructive">Expired</Badge>;
    } else if (now < startDate) {
      return <Badge variant="outline">Scheduled</Badge>;
    } else {
      return <Badge variant="default">Active</Badge>;
    }
  };

  const renderDiscountsSection = () => {
    if (discountLoading) {
      return <div className="py-8 text-center text-sm text-muted-foreground">Loading discounts...</div>;
    }

    if (!hasFetchedDiscounts) {
      return (
        <div className="py-8 text-center text-sm text-muted-foreground">
          Load this tab to fetch the latest discount rules.
        </div>
      );
    }

    if (discountError) {
      return <div className="py-8 text-center text-sm text-destructive">Unable to fetch discounts. Retry using Refresh.</div>;
    }

    if (visibleDiscounts.length === 0) {
      return (
        <div className="py-8 text-center text-sm text-muted-foreground">
          No discounts match your filters. Adjust the search criteria or add a new rule.
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Applies To</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleDiscounts.map((discount) => (
              <TableRow key={discount.id}>
                <TableCell className="font-medium">{discount.name}</TableCell>
                <TableCell className="capitalize">{discount.type}</TableCell>
                <TableCell>
                  {discount.type === 'fixed' ? `₹${discount.value}` : `${discount.value}%`}
                </TableCell>
                <TableCell>
                  <Badge variant={discount.status === 'active' ? 'secondary' : 'outline'} className="capitalize">
                    {discount.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {discount.applicable_product_id
                    ? `Product ${discount.applicable_product_id.substring(0, 8)}...`
                    : discount.applicable_category || 'All Products'}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{discount.priority ?? 0}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleDiscountStatus(discount)}
                      disabled={discountActionId === discount.id}
                    >
                      {discount.status === 'active' ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteDiscount(discount)}
                      disabled={discountActionId === discount.id}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {discountRangeStart}-{discountRangeEnd} of {safeDiscountTotal}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={String(discountPageSize)}
              onValueChange={(value) => {
                setDiscountPageSize(Number(value));
                setDiscountPage(1);
              }}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Page size" />
              </SelectTrigger>
              <SelectContent>
                {[10, 25, 50, 100].map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size} per page
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDiscountPage((prev) => Math.max(1, prev - 1))}
                disabled={discountPage === 1 || discountLoading}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDiscountPage((prev) => Math.min(totalDiscountPages, prev + 1))}
                disabled={discountPage >= totalDiscountPages || discountLoading}
              >
                Next
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-transparent p-6 text-foreground">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tech-heading">Offers & Discounts Hub</h1>
          <p className="tech-body">Create, monitor, and optimise every promotion from one screen.</p>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as 'offers' | 'discounts')}
          className="space-y-6"
        >
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="offers">Offers</TabsTrigger>
            <TabsTrigger value="discounts">Discounts</TabsTrigger>
          </TabsList>

          <TabsContent value="offers" className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-semibold tech-heading">Promotional Offers</h2>
                <p className="text-sm tech-body">Run banners, flash deals, and targeted incentives.</p>
              </div>
              <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogTrigger asChild>
                  <Button className="flex items-center space-x-2">
                    <Plus className="h-4 w-4" />
                    <span>Create Offer</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>
                      {editingOffer ? 'Edit Offer' : 'Create New Offer'}
                    </DialogTitle>
                    <DialogDescription>
                      {editingOffer ? 'Update the offer details below.' : 'Fill in the details to create a new promotional offer.'}
                    </DialogDescription>
                  </DialogHeader>

                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <Label htmlFor="title">Title *</Label>
                        <Input
                          id="title"
                          value={formData.title}
                          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                          placeholder="e.g., 50% Off Tech Accessories"
                        />
                      </div>
                      <div className="col-span-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                          id="description"
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          placeholder="Detailed description of the offer"
                          rows={3}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="discount_type">Discount Type *</Label>
                        <Select
                          value={formData.discount_type}
                          onValueChange={(value: any) => setFormData({ ...formData, discount_type: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="percentage">Percentage</SelectItem>
                            <SelectItem value="fixed_amount">Fixed Amount</SelectItem>
                            <SelectItem value="free_shipping">Free Shipping</SelectItem>
                            <SelectItem value="buy_x_get_y">Buy X Get Y</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {formData.discount_type !== 'free_shipping' && formData.discount_type !== 'buy_x_get_y' && (
                        <div>
                          <Label htmlFor="discount_value">
                            Discount Value {formData.discount_type === 'percentage' ? '(%)' : '(₹)'}
                          </Label>
                          <Input
                            id="discount_value"
                            type="number"
                            step="0.01"
                            value={formData.discount_value}
                            onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
                            placeholder={formData.discount_type === 'percentage' ? '10' : '100'}
                          />
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="offer_code">Offer Code (Optional)</Label>
                        <Input
                          id="offer_code"
                          value={formData.offer_code}
                          onChange={(e) => setFormData({ ...formData, offer_code: e.target.value.toUpperCase() })}
                          placeholder="SAVE20"
                        />
                      </div>
                      <div>
                        <Label htmlFor="priority">Priority</Label>
                        <Input
                          id="priority"
                          type="number"
                          value={formData.priority}
                          onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                          placeholder="0"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="start_date">Start Date *</Label>
                        <Input
                          id="start_date"
                          type="date"
                          value={formData.start_date}
                          onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="end_date">End Date *</Label>
                        <Input
                          id="end_date"
                          type="date"
                          value={formData.end_date}
                          onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="minimum_purchase_amount">Minimum Purchase (₹)</Label>
                        <Input
                          id="minimum_purchase_amount"
                          type="number"
                          step="0.01"
                          value={formData.minimum_purchase_amount}
                          onChange={(e) => setFormData({ ...formData, minimum_purchase_amount: e.target.value })}
                          placeholder="500"
                        />
                      </div>
                      <div>
                        <Label htmlFor="maximum_discount_amount">Maximum Discount (₹)</Label>
                        <Input
                          id="maximum_discount_amount"
                          type="number"
                          step="0.01"
                          value={formData.maximum_discount_amount}
                          onChange={(e) => setFormData({ ...formData, maximum_discount_amount: e.target.value })}
                          placeholder="1000"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="usage_limit">Total Usage Limit</Label>
                        <Input
                          id="usage_limit"
                          type="number"
                          value={formData.usage_limit}
                          onChange={(e) => setFormData({ ...formData, usage_limit: e.target.value })}
                          placeholder="100"
                        />
                      </div>
                      <div>
                        <Label htmlFor="usage_limit_per_customer">Usage Limit Per Customer</Label>
                        <Input
                          id="usage_limit_per_customer"
                          type="number"
                          value={formData.usage_limit_per_customer}
                          onChange={(e) => setFormData({ ...formData, usage_limit_per_customer: e.target.value })}
                          placeholder="1"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="customer_eligibility">Customer Eligibility</Label>
                      <Select
                        value={formData.customer_eligibility}
                        onValueChange={(value: any) => setFormData({ ...formData, customer_eligibility: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Customers</SelectItem>
                          <SelectItem value="new_customers">New Customers Only</SelectItem>
                          <SelectItem value="existing_customers">Existing Customers</SelectItem>
                          <SelectItem value="vip_customers">VIP Customers</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <Label htmlFor="banner_text">Banner Text</Label>
                        <Input
                          id="banner_text"
                          value={formData.banner_text}
                          onChange={(e) => setFormData({ ...formData, banner_text: e.target.value })}
                          placeholder="Limited Time: 50% Off All Tech Accessories"
                        />
                      </div>
                      <div>
                        <Label htmlFor="banner_color">Banner Color</Label>
                        <Input
                          id="banner_color"
                          type="color"
                          value={formData.banner_color}
                          onChange={(e) => setFormData({ ...formData, banner_color: e.target.value })}
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="terms_and_conditions">Terms and Conditions</Label>
                      <Textarea
                        id="terms_and_conditions"
                        value={formData.terms_and_conditions}
                        onChange={(e) => setFormData({ ...formData, terms_and_conditions: e.target.value })}
                        placeholder="Enter terms and conditions for this offer"
                        rows={3}
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        Supports basic HTML such as <code>&lt;strong&gt;</code>, <code>&lt;em&gt;</code>, <code>&lt;ul&gt;</code>, and links.
                      </p>
                    </div>

                    <div className="space-y-4">
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
                          id="is_featured"
                          checked={formData.is_featured}
                          onCheckedChange={(checked) => setFormData({ ...formData, is_featured: checked })}
                        />
                        <Label htmlFor="is_featured">Featured</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="display_on_homepage"
                          checked={formData.display_on_homepage}
                          onCheckedChange={(checked) => setFormData({ ...formData, display_on_homepage: checked })}
                        />
                        <Label htmlFor="display_on_homepage">Display on Homepage</Label>
                      </div>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button variant="outline" onClick={handleCloseDialog}>
                      Cancel
                    </Button>
                    <Button onClick={handleSaveOffer} disabled={isSaving}>
                      {isSaving ? 'Saving...' : editingOffer ? 'Update Offer' : 'Create Offer'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <Gift className="h-8 w-8 text-primary" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-muted-foreground">Total Offers</p>
                      <p className="text-2xl font-bold text-foreground">{offers.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <TrendingUp className="h-8 w-8 text-emerald-300" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-slate-400">Active Offers</p>
                      <p className="text-2xl font-bold text-white">
                        {offers.filter(o => o.is_active && new Date(o.end_date) > new Date()).length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <Tag className="h-8 w-8 text-purple-300" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-slate-400">Featured Offers</p>
                      <p className="text-2xl font-bold text-white">
                        {offers.filter(o => o.is_featured).length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <Users className="h-8 w-8 text-amber-300" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-slate-400">Total Usage</p>
                      <p className="text-2xl font-bold text-white">
                        {offers.reduce((sum, o) => sum + o.usage_count, 0)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle>All Offers</CardTitle>
                  <CardDescription>Manage every active, scheduled, or archived offer.</CardDescription>
                  {offersUpdatedAt && (
                    <p className="text-xs text-muted-foreground">Updated {offersUpdatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  )}
                  {offersError && (
                    <p className="text-xs text-destructive">{offersError}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={fetchOffers} disabled={offersLoading}>
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {offersLoading ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">Loading offers...</div>
                ) : !hasFetchedOffers ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    Data loads automatically when this tab is active. Use Refresh if it does not start.
                  </div>
                ) : offersError ? (
                  <div className="py-8 text-center text-sm text-destructive">Unable to fetch offers. Retry above.</div>
                ) : offers.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">No offers found. Create one to get started.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Discount</TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead>Period</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Usage</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {offers.map((offer) => (
                        <TableRow key={offer.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{offer.title}</div>
                              <div className="text-sm text-slate-400 line-clamp-1">
                                {offer.description}
                              </div>
                              <div className="mt-1 flex space-x-1">
                                {offer.is_featured && (
                                  <Badge variant="secondary" className="text-xs">Featured</Badge>
                                )}
                                {offer.display_on_homepage && (
                                  <Badge variant="outline" className="text-xs">Homepage</Badge>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="capitalize">
                            {offer.discount_type.replace('_', ' ')}
                          </TableCell>
                          <TableCell>{getDiscountDisplay(offer)}</TableCell>
                          <TableCell>
                            {offer.offer_code ? (
                              <code className="rounded bg-muted px-2 py-1 text-xs">
                                {offer.offer_code}
                              </code>
                            ) : (
                              <span className="text-slate-500">Auto-apply</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div>{new Date(offer.start_date).toLocaleDateString()}</div>
                              <div className="text-slate-400">to {new Date(offer.end_date).toLocaleDateString()}</div>
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(offer)}</TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div>{offer.usage_count}</div>
                              {offer.usage_limit && (
                                <div className="text-slate-400">of {offer.usage_limit}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleOfferStatus(offer)}
                              >
                                {offer.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditOffer(offer)}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteOffer(offer)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="discounts" className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-semibold tech-heading">Auto Discounts & Coupons</h2>
                <p className="text-sm tech-body">Cart rules, bulk savings, and coupon codes live together here.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={fetchDiscounts} disabled={discountLoading}>
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Refresh
                </Button>
                <CreateDiscountDialog onDiscountCreated={handleDiscountCreated}>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    New Discount
                  </Button>
                </CreateDiscountDialog>
                <CreateDiscountDialog onDiscountCreated={handleDiscountCreated} mode="coupon">
                  <Button variant="secondary">
                    <Plus className="mr-2 h-4 w-4" />
                    New Coupon
                  </Button>
                </CreateDiscountDialog>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="discount-search">Search</Label>
                <Input
                  id="discount-search"
                  placeholder="Name, category, or product..."
                  value={discountSearch}
                  onChange={(event) => setDiscountSearch(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={discountStatusFilter}
                  onValueChange={(value) => setDiscountStatusFilter(value as 'all' | 'active' | 'inactive')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={discountTypeFilter}
                  onValueChange={(value) => setDiscountTypeFilter(value as 'all' | 'percentage' | 'fixed')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="percentage">Percentage</SelectItem>
                    <SelectItem value="fixed">Fixed Amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Card>
              <CardHeader className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle>Discounts & Coupons</CardTitle>
                  <CardDescription>Auto-applied savings plus admin-created coupon codes.</CardDescription>
                  {discountsUpdatedAt && (
                    <p className="text-xs text-muted-foreground">Updated {discountsUpdatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  )}
                  {discountError && (
                    <p className="text-xs text-destructive">{discountError}</p>
                  )}
                </div>
                <Badge variant="outline">{safeDiscountTotal} records</Badge>
              </CardHeader>
              <CardContent>
                {renderDiscountsSection()}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}