'use client';

import * as React from 'react';
import { Plus, Search, Filter, Edit, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '../../../../hooks/use-toast';

interface ProductPricing {
  id: string;
  product_id: string;
  product_title?: string;
  customer_type: 'B2C' | 'B2B';
  customer_category?: string;
  price: number;
  min_quantity?: number;
  max_quantity?: number;
  valid_from?: string;
  valid_to?: string;
  is_active: boolean;
  created_at: string;
}

interface Product {
  id: string;
  title: string;
  price: number;
  category: string;
}

export function AdminPricing() {
  const [pricingRules, setPricingRules] = React.useState<ProductPricing[]>([]);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [filterType, setFilterType] = React.useState<string>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
  const [editingRule, setEditingRule] = React.useState<ProductPricing | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = React.useState({
    product_id: '',
    customer_type: 'B2C' as 'B2C' | 'B2B',
    customer_category: '',
    price: '',
    min_quantity: '',
    max_quantity: '',
    valid_from: '',
    valid_to: '',
    is_active: true,
  });

  const fetchPricingRules = React.useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/pricing');
      if (!response.ok) throw new Error('Failed to fetch pricing rules');
      const data = await response.json();
      setPricingRules(data.rules || []);
    } catch (error) {
      console.error('Error fetching pricing rules:', error);
      toast({
        title: 'Error',
        description: 'Failed to load pricing rules',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchProducts = React.useCallback(async () => {
    try {
      const response = await fetch('/api/admin/products');
      if (!response.ok) throw new Error('Failed to fetch products');
      const data = await response.json();
      setProducts(data.products || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  }, []);

  React.useEffect(() => {
    fetchPricingRules();
    fetchProducts();
  }, [fetchPricingRules, fetchProducts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const payload = {
        ...formData,
        price: parseFloat(formData.price),
        min_quantity: formData.min_quantity ? parseInt(formData.min_quantity) : null,
        max_quantity: formData.max_quantity ? parseInt(formData.max_quantity) : null,
        valid_from: formData.valid_from || null,
        valid_to: formData.valid_to || null,
      };

      const url = editingRule
        ? `/api/admin/pricing/${editingRule.id}`
        : '/api/admin/pricing';
      
      const method = editingRule ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Failed to save pricing rule');

      toast({
        title: 'Success',
        description: editingRule
          ? 'Pricing rule updated successfully'
          : 'Pricing rule created successfully',
      });

      setIsAddDialogOpen(false);
      setEditingRule(null);
      resetForm();
      fetchPricingRules();
    } catch (error) {
      console.error('Error saving pricing rule:', error);
      toast({
        title: 'Error',
        description: 'Failed to save pricing rule',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this pricing rule?')) return;

    try {
      const response = await fetch(`/api/admin/pricing/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete pricing rule');

      toast({
        title: 'Success',
        description: 'Pricing rule deleted successfully',
      });

      fetchPricingRules();
    } catch (error) {
      console.error('Error deleting pricing rule:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete pricing rule',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (rule: ProductPricing) => {
    setEditingRule(rule);
    setFormData({
      product_id: rule.product_id,
      customer_type: rule.customer_type,
      customer_category: rule.customer_category || '',
      price: rule.price.toString(),
      min_quantity: rule.min_quantity?.toString() || '',
      max_quantity: rule.max_quantity?.toString() || '',
      valid_from: rule.valid_from?.split('T')[0] || '',
      valid_to: rule.valid_to?.split('T')[0] || '',
      is_active: rule.is_active,
    });
    setIsAddDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      product_id: '',
      customer_type: 'B2C',
      customer_category: '',
      price: '',
      min_quantity: '',
      max_quantity: '',
      valid_from: '',
      valid_to: '',
      is_active: true,
    });
  };

  const filteredRules = pricingRules.filter(rule => {
    const matchesSearch = rule.product_title?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || rule.customer_type === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Product Pricing Management</h1>
          <p className="text-muted-foreground">
            Manage customer-specific pricing rules and volume discounts
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
          setIsAddDialogOpen(open);
          if (!open) {
            setEditingRule(null);
            resetForm();
          }
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Pricing Rule
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingRule ? 'Edit Pricing Rule' : 'Add New Pricing Rule'}
              </DialogTitle>
              <DialogDescription>
                Create custom pricing for specific customer types and categories
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="product_id">Product *</Label>
                  <Select
                    value={formData.product_id}
                    onValueChange={(value) => setFormData({ ...formData, product_id: value })}
                    required
                  >
                    <SelectTrigger id="product_id">
                      <SelectValue placeholder="Select product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customer_type">Customer Type *</Label>
                  <Select
                    value={formData.customer_type}
                    onValueChange={(value: 'B2C' | 'B2B') => setFormData({ ...formData, customer_type: value })}
                    required
                  >
                    <SelectTrigger id="customer_type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="B2C">B2C (Consumer)</SelectItem>
                      <SelectItem value="B2B">B2B (Business)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customer_category">Customer Category</Label>
                  <Select
                    value={formData.customer_category}
                    onValueChange={(value) => setFormData({ ...formData, customer_category: value })}
                  >
                    <SelectTrigger id="customer_category">
                      <SelectValue placeholder="Select category (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {formData.customer_type === 'B2C' ? (
                        <>
                          <SelectItem value="Normal">Normal</SelectItem>
                          <SelectItem value="Standard">Standard</SelectItem>
                          <SelectItem value="Premium">Premium</SelectItem>
                        </>
                      ) : (
                        <>
                          <SelectItem value="Bronze">Bronze</SelectItem>
                          <SelectItem value="Silver">Silver</SelectItem>
                          <SelectItem value="Gold">Gold</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="price">Price *</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="min_quantity">Minimum Quantity</Label>
                  <Input
                    id="min_quantity"
                    type="number"
                    min="1"
                    placeholder="Optional"
                    value={formData.min_quantity}
                    onChange={(e) => setFormData({ ...formData, min_quantity: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max_quantity">Maximum Quantity</Label>
                  <Input
                    id="max_quantity"
                    type="number"
                    min="1"
                    placeholder="Optional"
                    value={formData.max_quantity}
                    onChange={(e) => setFormData({ ...formData, max_quantity: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="valid_from">Valid From</Label>
                  <Input
                    id="valid_from"
                    type="date"
                    value={formData.valid_from}
                    onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="valid_to">Valid To</Label>
                  <Input
                    id="valid_to"
                    type="date"
                    value={formData.valid_to}
                    onChange={(e) => setFormData({ ...formData, valid_to: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="is_active" className="cursor-pointer">
                  Active Rule
                </Label>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsAddDialogOpen(false);
                    setEditingRule(null);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  {editingRule ? 'Update' : 'Create'} Pricing Rule
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pricing Rules</CardTitle>
          <CardDescription>
            Manage dynamic pricing for different customer types and quantities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[180px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="B2C">B2C</SelectItem>
                <SelectItem value="B2B">B2B</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Customer Type</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Quantity Range</TableHead>
                  <TableHead>Validity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      Loading pricing rules...
                    </TableCell>
                  </TableRow>
                ) : filteredRules.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No pricing rules found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell className="font-medium">
                        {rule.product_title || 'Unknown Product'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={rule.customer_type === 'B2B' ? 'default' : 'secondary'}>
                          {rule.customer_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {rule.customer_category || 'All'}
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold text-green-600">
                          ₹{rule.price.toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {rule.min_quantity && rule.max_quantity
                          ? `${rule.min_quantity} - ${rule.max_quantity}`
                          : rule.min_quantity
                          ? `${rule.min_quantity}+`
                          : rule.max_quantity
                          ? `Up to ${rule.max_quantity}`
                          : 'Any'}
                      </TableCell>
                      <TableCell className="text-xs">
                        {rule.valid_from && rule.valid_to
                          ? `${new Date(rule.valid_from).toLocaleDateString()} - ${new Date(rule.valid_to).toLocaleDateString()}`
                          : rule.valid_from
                          ? `From ${new Date(rule.valid_from).toLocaleDateString()}`
                          : rule.valid_to
                          ? `Until ${new Date(rule.valid_to).toLocaleDateString()}`
                          : 'Unlimited'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={rule.is_active ? 'default' : 'secondary'}>
                          {rule.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(rule)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(rule.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
