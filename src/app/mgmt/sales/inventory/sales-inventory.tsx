
'use client';

import * as React from 'react';

import Image from 'next/image';

import { Plus, Minus, Package, AlertTriangle } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import type { Product } from '@/lib/types';
import { ViewSerialsDialog } from '@/components/sales/ViewSerialsDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '../../../../hooks/use-toast';
import { logger } from '@/lib/logger';

interface ProductWithStock extends Product {
    stock_quantity: number;
    stock_label: string;
    warehouse_location?: string;
    minimum_stock?: number;
    available_serials?: number;
    last_updated?: string;
}

export default function InventoryManagementPage() {
    const [productList, setProductList] = React.useState<ProductWithStock[]>([]);
    const [selectedProduct, setSelectedProduct] = React.useState<ProductWithStock | null>(null);
    const [editingStock, setEditingStock] = React.useState<string | null>(null);
    const [newStockValue, setNewStockValue] = React.useState<number>(0);
    const [loading, setLoading] = React.useState(true);
    const supabase = createClient();
    const { toast } = useToast();

    const fetchInventory = React.useCallback(async () => {
        setLoading(true);
        try {
            // Prefer the inventory_items view for consolidated stock data
            const { data: inventoryData, error: inventoryError } = await supabase
                .from('inventory_items')
                .select('*')
                .order('name');

            if (inventoryError) {
                logger.warn("inventory_items unavailable, falling back to products", { inventoryError });
                const { data: productsData, error: productsError } = await supabase
                    .from('products')
                    .select('*')
                    .order('name');

                if (productsError) {
                    logger.error("Error fetching products in sales-inventory", { productsError });
                    toast({
                        title: "Error",
                        description: "Failed to fetch inventory data",
                        variant: "destructive",
                    });
                    return;
                }

                const mappedData = (productsData || []).map(product => {
                    const normalizedName = product?.name || product?.title || product?.model_number || 'Unnamed Product';
                    const stockQty = Number(product?.stock_quantity ?? product?.quantity ?? 0);
                    return {
                        ...product,
                        name: normalizedName,
                        stock_quantity: stockQty,
                        stock_label: stockQty === 0 ? 'Out of Stock' : stockQty <= 5 ? 'Low Stock' : 'In Stock',
                        warehouse_location: product?.warehouse_location || 'Main Warehouse',
                        minimum_stock: Number(product?.minimum_stock ?? 5),
                        available_serials: Array.isArray(product?.serial_numbers) ? product.serial_numbers.length : 0,
                    };
                });

                setProductList(mappedData);
            } else {
                const normalizedInventory = (inventoryData || []).map((item: any) => ({
                    ...item,
                    name: item?.name || item?.product_name || 'Unnamed Product',
                    stock_quantity: Number(item?.stock_quantity ?? 0),
                    category: item?.category || 'Uncategorized',
                }));
                setProductList(normalizedInventory as ProductWithStock[]);
            }
        } catch (error) {
            logger.error("Unexpected error in sales-inventory", { error });
            toast({
                title: "Error",
                description: "An unexpected error occurred",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    }, [supabase, toast]);

    React.useEffect(() => {
        fetchInventory();
    }, [fetchInventory]);

    const updateStock = async (productId: string, newStock: number) => {
        try {
            // Use the inventory API for consistent stock updates
            const response = await fetch('/api/inventory', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    product_id: productId,
                    new_quantity: newStock
                })
            });

            const result = await response.json();

            if (!response.ok) {
                logger.error('API Error in sales-inventory stock update', { result });
                toast({
                    title: "Update Failed",
                    description: result.error || "Failed to update stock quantity.",
                    variant: "destructive",
                });
                return;
            }

            // Success notification
            toast({
                title: "Stock Updated",
                description: `Stock quantity updated to ${newStock}`,
            });

            // Refresh inventory data
            await fetchInventory();
            toast({
                title: "Stock Updated",
                description: "Stock quantity has been updated successfully.",
            });
        } catch (error) {
            logger.error('Error updating stock in sales-inventory', { error });
            toast({
                title: "Update Failed",
                description: "An unexpected error occurred.",
                variant: "destructive",
            });
        }
    };

    const handleStockEdit = (productId: string, currentStock: number) => {
        setEditingStock(productId);
        setNewStockValue(currentStock);
    };

    const handleStockSave = async (productId: string) => {
        await updateStock(productId, newStockValue);
        setEditingStock(null);
    };

    const handleStockCancel = () => {
        setEditingStock(null);
        setNewStockValue(0);
    };

    const getStockBadge = (stock: number) => {
        if (stock === 0) {
            return <Badge variant="destructive" className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Out of Stock
            </Badge>;
        } else if (stock <= 5) {
            return <Badge variant="secondary" className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Low Stock ({stock})
            </Badge>;
        } else {
            return <Badge variant="default" className="flex items-center gap-1">
                <Package className="h-3 w-3" />
                In Stock ({stock})
            </Badge>;
        }
    };

    return (
        <>
            <div className="space-y-8">
                <div>
                    <h1 className="text-3xl font-bold">Inventory Management</h1>
                    <p className="text-muted-foreground">
                        View current stock levels and serial numbers for all products.
                    </p>
                </div>
                <Card>
                    <CardHeader>
                        <CardTitle>Current Inventory</CardTitle>
                        <CardDescription>
                            A live look at all products and their stock status.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[80px]">Image</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead className="text-center">Stock Status</TableHead>
                                    <TableHead className="text-center">Stock Quantity</TableHead>
                                    <TableHead className="text-center">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <TableRow key={`skeleton-${i}`}>
                                            <TableCell><Skeleton className="h-12 w-12 rounded-md" /></TableCell>
                                            <TableCell><Skeleton className="h-6 w-48 rounded-md" /></TableCell>
                                            <TableCell><Skeleton className="h-6 w-24 rounded-md" /></TableCell>
                                            <TableCell className="text-center"><Skeleton className="h-6 w-24 mx-auto rounded-md" /></TableCell>
                                            <TableCell className="text-center"><Skeleton className="h-6 w-12 mx-auto rounded-md" /></TableCell>
                                            <TableCell className="text-center"><Skeleton className="h-8 w-32 mx-auto rounded-md" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    productList.map((product) => (
                                        <TableRow key={product.id}>
                                            <TableCell>
                                                {product.image ? (
                                                    <Image
                                                        src={product.image}
                                                        alt={product.name}
                                                        width={48}
                                                        height={48}
                                                        className="rounded-md object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-12 h-12 rounded-md bg-gray-200 flex items-center justify-center text-gray-600 font-semibold">
                                                        {(product.name?.charAt(0) ?? '?').toUpperCase()}
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell className="font-medium">{product.name}</TableCell>
                                            <TableCell>{product.category}</TableCell>
                                            <TableCell className="text-center">
                                                {getStockBadge(product.stock_quantity || 0)}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {editingStock === product.id ? (
                                                    <div className="flex items-center gap-2 justify-center">
                                                        <Input
                                                            type="number"
                                                            value={newStockValue}
                                                            onChange={(e) => setNewStockValue(Number(e.target.value))}
                                                            className="w-20 text-center"
                                                            min="0"
                                                        />
                                                        <Button
                                                            size="sm"
                                                            onClick={() => handleStockSave(product.id)}
                                                        >
                                                            Save
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={handleStockCancel}
                                                        >
                                                            Cancel
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 justify-center">
                                                        <span className="font-bold text-lg">{product.stock_quantity || 0}</span>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => handleStockEdit(product.id, product.stock_quantity || 0)}
                                                        >
                                                            Edit
                                                        </Button>
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex items-center gap-2 justify-center">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => updateStock(product.id, Math.max(0, (product.stock_quantity || 0) - 1))}
                                                        disabled={(product.stock_quantity || 0) === 0 || editingStock === product.id}
                                                    >
                                                        <Minus className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => updateStock(product.id, (product.stock_quantity || 0) + 1)}
                                                        disabled={editingStock === product.id}
                                                    >
                                                        <Plus className="h-4 w-4" />
                                                    </Button>
                                                    {product.isSerialNumberCompulsory && (
                                                        <Button 
                                                            variant="outline" 
                                                            size="sm"
                                                            onClick={() => setSelectedProduct(product)}
                                                            disabled={(product.stock_quantity || 0) === 0}
                                                        >
                                                            View Serials ({product.available_serials || 0})
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
            {selectedProduct && (
                <ViewSerialsDialog 
                    product={selectedProduct}
                    onClose={() => setSelectedProduct(null)}
                />
            )}
        </>
    );
}
