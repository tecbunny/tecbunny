'use client';

import * as React from 'react';
import { Pencil, Plus, Trash2, MoreHorizontal, Loader2, Upload, Download } from 'lucide-react';
import { useToast } from '../../../../hooks/use-toast';
import { logger } from '@/lib/logger';
import type { Product } from '@/lib/types';
import { getProductDisplayImage } from '@/lib/image-utils';
import { usePathname } from 'next/navigation';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { CreateProductDialog } from '@/components/admin/CreateProductDialog';
import { EditProductDialog } from '@/components/admin/EditProductDialog';

export default function AdminProductsPage() {
  const pathname = usePathname();
  const isSuperadmin = pathname?.startsWith('/superadmin');
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
  const [products, setProducts] = React.useState<Product[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [importing, setImporting] = React.useState(false);
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [selectedProduct, setSelectedProduct] = React.useState<Product | null>(null);
  const [editedPrices, setEditedPrices] = React.useState<Record<string, { mrp: number; price: number }>>({});
  const [savingProductId, setSavingProductId] = React.useState<string | null>(null);

  const { toast } = useToast();

  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/products/simple-import', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to import CSV');
      }

      toast({
        title: 'Success',
        description: data.message || 'CSV imported successfully',
      });
      fetchProducts();
    } catch (error: any) {
      logger.error('Failed to import CSV', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to import CSV',
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const exportToCSV = () => {
    if (products.length === 0) {
      toast({
        title: 'Info',
        description: 'No products to export',
      });
      return;
    }

    const headers = [
      'Handle ID',
      'Type',
      'Title',
      'Brand',
      'Description',
      'Product Detail',
      'Image Link',
      'Warranty Details',
      'Stock Status',
      'Status'
    ];

    const rows = products.map((p: any) => [
      p.handle_id || p.id || '',
      p.entry_type || 'product',
      p.title || p.name || '',
      p.brand || '',
      p.description || '',
      p.product_detail || '',
      p.image_url || p.image || '',
      p.warranty_details || '',
      p.in_stock !== false ? 'In Stock' : 'Out of Stock',
      p.status || 'active'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) =>
        row
          .map((val) => {
            const clean = String(val).replace(/"/g, '""');
            return `"${clean}"`;
          })
          .join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'products_export.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadSampleCSV = () => {
    const headers = [
      'Handle ID',
      'Type',
      'Title',
      'Brand',
      'Description',
      'Product Detail',
      'Image Link',
      'Warranty Details',
      'Stock Status',
      'Status'
    ];

    const sampleRows = [
      [
        'TB-CCTV-001',
        'Product',
        'Hikvision 4MP IP Camera',
        'Hikvision',
        'High definition security camera with night vision',
        '4MP resolution; POE; Outdoor rated',
        'https://images.unsplash.com/photo-1557597774-9d273605dfa9',
        '2 Years Warranty',
        'In Stock',
        'Active'
      ],
      [
        'TB-CCTV-001',
        'Variant',
        'Hikvision 4MP IP Camera - Dome',
        'Hikvision',
        'Dome shape variant',
        'Ceiling mount; indoor use',
        'https://images.unsplash.com/photo-1557597774-9d273605dfa9',
        '2 Years Warranty',
        'In Stock',
        'Active'
      ]
    ];

    const csvContent = [
      headers.join(','),
      ...sampleRows.map((row) =>
        row
          .map((val) => {
            const clean = String(val).replace(/"/g, '""');
            return `"${clean}"`;
          })
          .join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'products_sample.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const fetchProducts = React.useCallback(async () => {
    setLoading(true);
    try {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 15000);

      const response = await fetch('/api/admin/products', {
        cache: 'no-store',
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => null);
      window.clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(payload?.error || `Failed to fetch products (${response.status})`);
      }

      const rows = Array.isArray(payload?.products) ? payload.products : [];
      setProducts(rows as Product[]);
    } catch (error) {
      logger.error('Failed to fetch products', { error });
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to fetch products',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleDeleteProduct = async () => {
    if (!selectedProduct) return;

    try {
      const response = await fetch(`/api/products?id=${selectedProduct.id}`, {
        method: 'DELETE',
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to delete product');
      }

      toast({
        title: 'Success',
        description: 'Product deleted successfully',
      });
      fetchProducts();
    } catch (error) {
      logger.error('Failed to delete product', { error });
      toast({
        title: 'Error',
        description: 'Failed to delete product',
        variant: 'destructive',
      });
    } finally {
      setDeleteDialogOpen(false);
      setSelectedProduct(null);
    }
  };

  const handleEditClick = (product: Product) => {
    setSelectedProduct(product);
    setEditDialogOpen(true);
  };

  const handleDeleteClick = (product: Product) => {
    setSelectedProduct(product);
    setDeleteDialogOpen(true);
  };

  const handlePriceChange = (productId: string, field: 'mrp' | 'price', value: number) => {
    setEditedPrices(prev => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [field]: value
      }
    }));
  };

  const handleSavePrices = async (productId: string) => {
    const edited = editedPrices[productId];
    if (!edited) return;

    setSavingProductId(productId);
    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mrp: edited.mrp, price: edited.price }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || 'Update failed');
      }
      toast({ title: 'Success', description: 'Prices updated successfully.', duration: 2000 });
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, mrp: edited.mrp, price: edited.price } : p));
      setEditedPrices(prev => {
        const newState = { ...prev };
        delete newState[productId];
        return newState;
      });
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Update failed', variant: 'destructive' });
    } finally {
      setSavingProductId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Products</h2>
          <p className="text-muted-foreground">
            Manage your product inventory, pricing, and details.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isSuperadmin && (
            <>
              <input
                type="file"
                accept=".csv"
                ref={fileInputRef}
                onChange={handleCSVImport}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={downloadSampleCSV}
              >
                <Download className="mr-2 h-4 w-4" />
                Download Sample
              </Button>
              <Button
                variant="outline"
                disabled={importing}
                onClick={() => fileInputRef.current?.click()}
              >
                {importing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Import CSV
              </Button>
              <Button
                variant="outline"
                onClick={exportToCSV}
                disabled={products.length === 0}
              >
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </>
          )}
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Product
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Products</CardTitle>
          <CardDescription>
            A list of all products available on the platform.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4 w-full min-h-[350px]">
              <div className="flex items-center space-x-4 border-b border-white/5 pb-4">
                <div className="h-4 bg-slate-800 rounded animate-pulse w-1/4" />
                <div className="h-4 bg-slate-800 rounded animate-pulse w-1/6" />
                <div className="h-4 bg-slate-800 rounded animate-pulse w-1/12" />
                <div className="h-4 bg-slate-800 rounded animate-pulse w-1/12" />
                <div className="h-4 bg-slate-800 rounded animate-pulse w-1/12" />
                <div className="h-4 bg-slate-800 rounded animate-pulse w-1/12" />
                <div className="h-4 bg-slate-800 rounded animate-pulse w-1/12 ml-auto" />
              </div>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center space-x-4 py-3 border-b border-white/5">
                  <div className="flex items-center gap-2 w-1/4">
                    <div className="w-8 h-8 rounded bg-slate-800 animate-pulse" />
                    <div className="h-4 bg-slate-800 rounded animate-pulse w-3/4" />
                  </div>
                  <div className="h-6 bg-slate-800 rounded animate-pulse w-1/6" />
                  <div className="h-8 bg-slate-800 rounded animate-pulse w-28" />
                  <div className="h-8 bg-slate-800 rounded animate-pulse w-28" />
                  <div className="h-4 bg-slate-800 rounded animate-pulse w-1/12" />
                  <div className="h-6 bg-slate-800 rounded animate-pulse w-16" />
                  <div className="h-8 bg-slate-800 rounded animate-pulse w-10 ml-auto" />
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No products found. Click "Add Product" to create one.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>MRP</TableHead>
                  <TableHead>Sale Price</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                             {getProductDisplayImage(product) ? (
                                <img src={getProductDisplayImage(product)!} alt={product.title} className="w-8 h-8 rounded object-cover" />
                             ) : (
                                <div className="w-8 h-8 rounded bg-muted flex items-center justify-center text-[10px] font-semibold text-muted-foreground">
                                    No Image
                                </div>
                             )}
                             <span>{product.title || product.name}</span>
                        </div>
                    </TableCell>
                    <TableCell>
                        <Badge variant="outline">{product.category}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 w-28">
                        <Input
                          type="number"
                          placeholder="MRP"
                          className="h-8 text-sm"
                          value={editedPrices[product.id]?.mrp ?? product.mrp ?? 0}
                          onChange={(e) => handlePriceChange(product.id, 'mrp', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 w-28">
                        <Input
                          type="number"
                          placeholder="Sale Price"
                          className="h-8 text-sm"
                          value={editedPrices[product.id]?.price ?? product.price ?? 0}
                          onChange={(e) => handlePriceChange(product.id, 'price', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                        {product.stock_quantity ?? 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={product.status === 'active' ? 'default' : 'secondary'}>
                        {product.status || 'Active'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        {editedPrices[product.id] && (
                          <Button
                            size="sm"
                            variant="default"
                            className="h-8 text-xs"
                            onClick={() => handleSavePrices(product.id)}
                            disabled={savingProductId === product.id}
                          >
                            {savingProductId === product.id ? 'Saving...' : 'Save'}
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleEditClick(product)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => handleDeleteClick(product)}
                              className="text-red-600 focus:text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CreateProductDialog 
        open={createDialogOpen} 
        onOpenChange={setCreateDialogOpen}
        onProductCreated={fetchProducts}
      />

      {selectedProduct && (
        <EditProductDialog 
            open={editDialogOpen}
            onOpenChange={setEditDialogOpen}
            product={selectedProduct}
            onProductUpdated={fetchProducts}
        />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the product
              "{selectedProduct?.title || selectedProduct?.name}" and remove it from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
                onClick={handleDeleteProduct}
                className="bg-red-600 focus:ring-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
