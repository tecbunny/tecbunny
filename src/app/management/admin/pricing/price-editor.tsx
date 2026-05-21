'use client';

import React, { useState, useCallback } from 'react';
import { Search, RefreshCw, Upload, Download, Save, X, IndianRupee } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Badge } from '../../../../components/ui/badge';
import { useToast } from '../../../../hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../components/ui/table';

interface Product {
  id: string;
  handle: string;
  title: string;
  price: number;
  mrp?: number;
  category: string;
}

interface PriceUpdate {
  id: string;
  originalPrice: number;
  originalMrp: number;
  newPrice: number;
  newMrp: number;
  changed: boolean;
}

export function PriceEditor() {
  const [products, setProducts] = useState<Product[]>([]);
  const [priceUpdates, setPriceUpdates] = useState<Map<string, PriceUpdate>>(new Map());
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const { toast } = useToast();

  // Fetch all products on mount
  React.useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/products?limit=1000');
      const result = await response.json();
      if (result.success) {
        setProducts(result.data || []);
      } else {
        throw new Error(result.error || 'Failed to fetch products');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load products',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const filteredProducts = React.useMemo(() => {
    if (!searchQuery) return products;
    const query = searchQuery.toLowerCase();
    return products.filter(
      (p) =>
        p.title.toLowerCase().includes(query) ||
        p.handle.toLowerCase().includes(query) ||
        p.category.toLowerCase().includes(query)
    );
  }, [products, searchQuery]);

  const updatePrice = (productId: string, field: 'price' | 'mrp', value: number) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    const current = priceUpdates.get(productId) || {
      id: productId,
      originalPrice: product.price,
      originalMrp: product.mrp || 0,
      newPrice: product.price,
      newMrp: product.mrp || 0,
      changed: false,
    };

    const updated = {
      ...current,
      [field === 'price' ? 'newPrice' : 'newMrp']: value,
      changed: value !== current[field === 'price' ? 'originalPrice' : 'originalMrp'],
    };

    setPriceUpdates((prev) => new Map(prev).set(productId, updated));
  };

  const saveChanges = async () => {
    const changedUpdates = Array.from(priceUpdates.values()).filter((u) => u.changed);
    if (changedUpdates.length === 0) {
      toast({
        title: 'No changes',
        description: 'No prices have been modified.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/products/batch-update-prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: changedUpdates.map((u) => ({
            id: u.id,
            price: u.newPrice,
            mrp: u.newMrp,
          })),
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to save prices');

      toast({
        title: 'Success',
        description: `Updated ${changedUpdates.length} product price(s)`,
      });

      setPriceUpdates(new Map());
      await fetchProducts();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save prices',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const resetChanges = () => {
    setPriceUpdates(new Map());
    toast({
      title: 'Changes cleared',
      description: 'All unsaved changes have been reset.',
    });
  };

  const exportPrices = () => {
    try {
      const csv =
        'handle,title,category,currentPrice,currentMrp\n' +
        products
          .map(
            (p) =>
              `"${p.handle}","${p.title}","${p.category}",${p.price},${p.mrp || ''}`
          )
          .join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `prices_export_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Exported',
        description: 'Prices exported to CSV',
      });
    } catch (error) {
      toast({
        title: 'Export failed',
        description: 'Could not export prices',
        variant: 'destructive',
      });
    }
  };

  const handleCsvImport = async (file: File) => {
    try {
      const text = await file.text();
      const lines = text.split('\n').filter((line) => line.trim());
      if (lines.length < 2) {
        throw new Error('CSV must have header and at least one data row');
      }

      const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
      const handleIdx = headers.indexOf('handle');
      const priceIdx = headers.indexOf('newprice');
      const mrpIdx = headers.indexOf('newmrp');

      if (handleIdx === -1 || priceIdx === -1) {
        throw new Error('CSV must have "handle", "newprice" columns');
      }

      let updated = 0;
      for (let i = 1; i < lines.length; i++) {
        const cells = lines[i].split(',').map((c) => c.trim());
        const handle = cells[handleIdx];
        const newPrice = parseFloat(cells[priceIdx]);
        const newMrp = mrpIdx !== -1 ? parseFloat(cells[mrpIdx]) : undefined;

        const product = products.find((p) => p.handle === handle);
        if (product && !isNaN(newPrice)) {
          updatePrice(product.id, 'price', newPrice);
          if (newMrp && !isNaN(newMrp)) {
            updatePrice(product.id, 'mrp', newMrp);
          }
          updated++;
        }
      }

      toast({
        title: 'Imported',
        description: `Updated ${updated} product price(s) from CSV`,
      });
      setCsvFile(null);
    } catch (error: any) {
      toast({
        title: 'Import failed',
        description: error.message || 'Could not import prices',
        variant: 'destructive',
      });
    }
  };

  const changedCount = Array.from(priceUpdates.values()).filter((u) => u.changed).length;

  return (
    <div className="min-h-screen bg-transparent p-6 text-slate-200">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-white">Quick Price Manager</h1>
            <p className="text-slate-400">Update product prices without editing all details</p>
          </div>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              onClick={exportPrices}
              className="flex items-center space-x-2"
            >
              <Download className="h-4 w-4" />
              <span>Export Prices</span>
            </Button>
            <label className="cursor-pointer">
              <Button
                variant="outline"
                onClick={(e) => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.csv';
                  input.onchange = (event: any) => {
                    const file = event.target.files[0];
                    if (file) handleCsvImport(file);
                  };
                  input.click();
                }}
                className="flex items-center space-x-2"
              >
                <Upload className="h-4 w-4" />
                <span>Import CSV</span>
              </Button>
            </label>
          </div>
        </div>

        {/* Changes Summary */}
        {changedCount > 0 && (
          <Card className="border-emerald-500/30 bg-emerald-950/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <IndianRupee className="h-6 w-6 text-emerald-400" />
                  <div>
                    <p className="font-semibold text-emerald-300">{changedCount} product(s) modified</p>
                    <p className="text-sm text-emerald-200/70">Review your changes before saving</p>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <Button
                    onClick={resetChanges}
                    variant="outline"
                    className="border-emerald-500/30 text-emerald-300"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Discard
                  </Button>
                  <Button
                    onClick={saveChanges}
                    disabled={isSaving}
                    className="bg-emerald-600 hover:bg-emerald-500"
                  >
                    {isSaving ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              placeholder="Search by product name, handle, or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            variant="outline"
            onClick={fetchProducts}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Products Table */}
        <Card>
          <CardHeader>
            <CardTitle>Product Prices</CardTitle>
            <CardDescription>
              Total: {filteredProducts.length} products
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin text-slate-500" />
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                No products found
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Handle</TableHead>
                      <TableHead>Product Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Current MRP</TableHead>
                      <TableHead>New MRP</TableHead>
                      <TableHead>Current Price</TableHead>
                      <TableHead>New Price</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.map((product) => {
                      const update = priceUpdates.get(product.id);
                      return (
                        <TableRow key={product.id}>
                          <TableCell className="font-mono text-sm">{product.handle}</TableCell>
                          <TableCell className="max-w-xs truncate">{product.title}</TableCell>
                          <TableCell className="text-sm">{product.category}</TableCell>
                          <TableCell>₹{(product.mrp || 0).toFixed(2)}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={update?.newMrp ?? product.mrp ?? 0}
                              onChange={(e) =>
                                updatePrice(product.id, 'mrp', parseFloat(e.target.value) || 0)
                              }
                              className="w-28 h-8 text-sm"
                            />
                          </TableCell>
                          <TableCell>₹{product.price.toFixed(2)}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={update?.newPrice ?? product.price}
                              onChange={(e) =>
                                updatePrice(product.id, 'price', parseFloat(e.target.value) || 0)
                              }
                              className="w-28 h-8 text-sm"
                            />
                          </TableCell>
                          <TableCell>
                            {update?.changed ? (
                              <Badge variant="default" className="bg-amber-600">
                                Modified
                              </Badge>
                            ) : (
                              <Badge variant="outline">—</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
