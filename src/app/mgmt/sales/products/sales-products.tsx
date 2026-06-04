
'use client';

import * as React from 'react';

import { MoreHorizontal, PlusCircle, Download, Upload, Trash2, Pencil, Eye } from 'lucide-react';

import Image from 'next/image';

import Link from 'next/link';

import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import type { Product } from '@/lib/types';
import { Badge } from '@/components/ui/badge';


import { useToast } from '../../../../hooks/use-toast';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';


import { createClient } from '@/lib/supabase/client';

export default function ProductManagementPage() {
  const [productList, setProductList] = React.useState<Product[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const refresh = searchParams.get('refresh') || '';
  const [isClient, setIsClient] = React.useState(false);
  const supabase = createClient();

  const fetchProducts = React.useCallback(async () => {
    const { data, error } = await supabase.from('products').select('*');
    if (error) {
        console.error('Failed to fetch products:', error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch product list.'});
    } else {
        const normalized = (data as Product[] ?? []).map((product) => ({
          ...product,
          name: product?.name || product?.title || product?.model_number || 'Unnamed Product',
          price: Number(product?.price ?? product?.offer_price ?? product?.mrp ?? 0),
        }));
        setProductList(normalized);
    }
  }, [supabase, toast]);

  const handleInlineUpdate = async (productId: string, field: string, value: number) => {
    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) throw new Error('Update failed');
      toast({ title: 'Updated', description: `Product updated successfully.`, duration: 2000 });
      setProductList(prev => prev.map(p => p.id === productId ? { ...p, [field]: value } : p));
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Update failed', variant: 'destructive' });
    }
  };

  React.useEffect(() => {
    setIsClient(true);
    fetchProducts();
  }, [fetchProducts, refresh]);

  const handleExport = async () => {
    try {
      const response = await fetch('/api/products/bulk-edit');
      
      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `products_bulk_edit_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      // Safe cleanup without removeChild pitfalls
      try {
        (link as any)?.remove?.();
      } catch {}
      try { window.URL.revokeObjectURL(url); } catch {}

      toast({
        title: "Export Successful",
        description: "Products have been exported for bulk editing."
      });

    } catch (error) {
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: "Could not export products for bulk editing."
      });
      console.error('Export error:', error);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleDownloadTemplate = () => {
    const headers = [
        "name", "description", "price", "category", "image", 
        "brand", "mrp", "warranty", "hsnCode", "gstRate", "isSerialNumberCompulsory"
    ];
    
    // Add sample data to help users understand the format
    const sampleData = [
      [
        "Sample Product",
        "This is a sample product description for import template",
        "999.99",
        "Electronics",
        "https://example.com/image.jpg",
        "SampleBrand",
        "1299.99",
        "1 Year",
        "8517",
        "18",
        "false"
      ],
      [
        "Another Sample",
        "Another sample product with different category",
        "1499.99",
        "Accessories",
        "https://example.com/image2.jpg",
        "AnotherBrand",
        "1799.99",
        "2 Years",
        "8518",
        "12",
        "true"
      ]
    ];

    const csvContent = [
      headers.join(','),
      ...sampleData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.href) {
      URL.revokeObjectURL(link.href);
    }
    link.href = URL.createObjectURL(blob);
    link.download = 'product_template.csv';
    link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  try { (link as any)?.remove?.(); } catch {}
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/products/bulk-edit', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Import failed');
      }

      await fetchProducts();

      toast({
        title: "Import Successful",
        description: result.message
      });

      if (result.errors && result.errors.length > 0) {
        console.warn('Import warnings:', result.errors);
        toast({
          variant: "destructive",
          title: "Import Warnings",
          description: `${result.errors.length} rows had errors and were skipped.`
        });
      }

    } catch (error) {
      toast({
        variant: "destructive",
        title: "Import Failed",
        description: error instanceof Error ? error.message : "Could not import CSV file."
      });
      console.error("CSV import error:", error);
    }

    // Reset file input
    event.target.value = '';
  };
  
  const handleDelete = async (productId: string) => {
    const { error } = await supabase.from('products').delete().eq('id', productId);
    if (error) {
        toast({ variant: 'destructive', title: 'Delete Failed', description: error.message });
    } else {
        await fetchProducts();
        toast({
            title: "Product Deleted",
            description: "The product has been removed from the inventory.",
        });
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Product Management</h1>
        <p className="text-muted-foreground">
          Create, view, and modify product details.
        </p>
      </div>
      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <CardTitle>All Products</CardTitle>
            <CardDescription>
              A list of all products in your inventory.
            </CardDescription>
          </div>
          <div className="flex gap-2 flex-wrap">
             <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileChange}
              accept=".csv"
            />
            <Button variant="outline" onClick={handleImportClick}>
              <Upload className="mr-2 h-4 w-4" />
              Import
            </Button>
            <Button variant="outline" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
             <Button variant="outline" onClick={handleDownloadTemplate}>
              <Download className="mr-2 h-4 w-4" />
              Template
            </Button>
            <Button asChild>
              <Link href="/mgmt/sales/products/new">
                <PlusCircle className="mr-2 h-4 w-4" />
                Add New Product
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Image</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Popularity</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isClient ? productList.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    <Image
                      src={(product.image && !product.image.endsWith('.svg')) ? product.image : `https://placehold.co/48x48/0066cc/ffffff.png?text=${encodeURIComponent(product.name?.charAt(0) || 'P')}`}
                      alt={product.name}
                      width={48}
                      height={48}
                      className="rounded-md object-cover"
                    />
                  </TableCell>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{product.category}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <span className="text-slate-400 mr-1">₹</span>
                      <Input
                        type="number"
                        className="w-24 h-8 text-sm"
                        defaultValue={Number(product.price ?? 0)}
                        onBlur={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val) && val !== Number(product.price ?? 0)) {
                            handleInlineUpdate(product.id, 'price', val);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.currentTarget.blur();
                        }}
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      className="w-20 h-8 text-sm"
                      defaultValue={(product as any).stock_quantity ?? 0}
                      onBlur={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val) && val !== ((product as any).stock_quantity ?? 0)) {
                          handleInlineUpdate(product.id, 'stock_quantity', val);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.currentTarget.blur();
                      }}
                    />
                  </TableCell>
                  <TableCell>{product.popularity}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onSelect={() => router.push(`/mgmt/sales/products/edit/${product.id}`)}>
                           <Pencil className="mr-2 h-4 w-4" />
                           Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => router.push(`/products/${product.id}`)}>
                           <Eye className="mr-2 h-4 w-4" />
                           View Details
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <ConfirmDialog
                          onConfirm={() => handleDelete(product.id)}
                          title="Are you sure?"
                          description={`This will permanently delete the product "${product.name}".`}
                          trigger={
                            <Button variant="ghost" className="w-full justify-start text-sm text-destructive hover:text-destructive px-2 py-1.5 relative">
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                            </Button>
                          }
                        />
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={6} className="h-24 text-center">Loading products...</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
