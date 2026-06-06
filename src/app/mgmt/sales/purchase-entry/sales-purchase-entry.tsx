
'use client';

import * as React from 'react';

import { PlusCircle, Search, Trash2 } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Product, PurchaseItem } from '@/lib/types';
import { Separator } from '@/components/ui/separator';
import CreateProductDialog from '@/components/sales/CreateProductDialog';
import { PurchaseSerialNumberDialog } from '@/components/sales/PurchaseSerialNumberDialog';
import { useToast } from '../../../../hooks/use-toast';
import { createClient } from '@/lib/supabase/client';

export default function PurchaseEntryPage() {
    const { toast } = useToast();
    const supabase = createClient();
    const [allProducts, setAllProducts] = React.useState<Product[]>([]);
    const [purchaseItems, setPurchaseItems] = React.useState<PurchaseItem[]>([]);
    
    const [searchTerm, setSearchTerm] = React.useState('');
    const [searchResults, setSearchResults] = React.useState<Product[]>([]);
    const [isCreateProductDialogOpen, setCreateProductDialogOpen] = React.useState(false);
    const [itemForSerialEntry, setItemForSerialEntry] = React.useState<PurchaseItem | null>(null);

    const [supplierName, setSupplierName] = React.useState('');
    const [supplierInvoice, setSupplierInvoice] = React.useState('');

    React.useEffect(() => {
        const fetchProducts = async () => {
            const { data, error } = await supabase.from('products').select('*');
            if (error) {
                console.error("Error fetching products", error);
                toast({ variant: 'destructive', title: 'Unable to load products', description: error.message });
                return;
            }

            const normalizedProducts = (data ?? []).map((product: any) => {
                const normalizedName = product?.name || product?.title || product?.model_number || 'Unnamed Product';
                const normalizedPrice = Number(product?.price ?? product?.offer_price ?? product?.mrp ?? 0);
                const normalizedCategory = product?.category || product?.product_type || 'Uncategorized';
                const normalizedImage = product?.image || (Array.isArray(product?.images) ? product.images[0] : '') || '';
                const requiresSerial = Boolean(
                    product?.isSerialNumberCompulsory ??
                    product?.serial_required ??
                    product?.requires_serial_number ??
                    false
                );

                return {
                    ...product,
                    name: normalizedName,
                    title: product?.title || normalizedName,
                    price: normalizedPrice,
                    category: normalizedCategory,
                    image: normalizedImage,
                    isSerialNumberCompulsory: requiresSerial,
                } as Product;
            });

            setAllProducts(normalizedProducts);
        };
        fetchProducts();
    }, [supabase, toast]);

    React.useEffect(() => {
        const trimmedTerm = searchTerm.trim().toLowerCase();
        if (trimmedTerm) {
            const matches = allProducts.filter((product) => {
                const name = (product.name || '').toLowerCase();
                const title = (product.title || '').toLowerCase();
                const model = (product.model_number || '').toLowerCase();
                return name.includes(trimmedTerm) || title.includes(trimmedTerm) || model.includes(trimmedTerm);
            });
            setSearchResults(matches);
        } else {
            setSearchResults([]);
        }
    }, [searchTerm, allProducts]);

    const handleAddItem = (product: Product) => {
        if (!purchaseItems.some(item => item.id === product.id)) {
            const basePrice = Number((product as any)?.purchase_price ?? product.price ?? product.offer_price ?? product.mrp ?? 0);
            setPurchaseItems(prev => [...prev, { ...product, quantity: 1, purchase_price: basePrice, serialNumbers: [] }]);
        }
        setSearchTerm('');
        setSearchResults([]);
    };

    const handleProductCreated = (newProduct: Product) => {
        setAllProducts(prev => [...prev, newProduct]);
        handleAddItem(newProduct);
        setCreateProductDialogOpen(false);
    }

    const handleUpdateItem = (id: string, field: 'quantity' | 'purchase_price', value: number) => {
        setPurchaseItems(prev => prev.map(item => {
            if (item.id === id) {
                if (field === 'quantity' && item.isSerialNumberCompulsory) {
                    return { ...item, [field]: value, serialNumbers: [] };
                }
                return { ...item, [field]: value };
            }
            return item;
        }));
    };

    const handleRemoveItem = (id: string) => {
        setPurchaseItems(prev => prev.filter(item => item.id !== id));
    };
    
    const handleSaveSerials = (productId: string, serials: string[]) => {
        setPurchaseItems(prev => prev.map(item => item.id === productId ? { ...item, serialNumbers: serials } : item));
        setItemForSerialEntry(null);
    };

    const subTotal = purchaseItems.reduce((acc, item) => acc + (item.quantity * item.purchase_price), 0);
    const taxAmount = subTotal * 0.18; // Example 18% tax
    const grandTotal = subTotal + taxAmount;

    const handleSavePurchase = async () => {
        if (!supplierName || !supplierInvoice) {
            toast({ variant: 'destructive', title: 'Missing Information', description: 'Please enter supplier name and invoice number.' });
            return;
        }
        if (purchaseItems.length === 0) {
            toast({ variant: 'destructive', title: 'No Items', description: 'Please add products to the purchase entry.' });
            return;
        }

        for (const item of purchaseItems) {
            if (item.isSerialNumberCompulsory && item.serialNumbers?.length !== item.quantity) {
                toast({ variant: 'destructive', title: 'Serial Number Mismatch', description: `Please enter ${item.quantity} serial number(s) for ${item.name}.` });
                return;
            }
        }

        const { data: purchase, error: purchaseError } = await supabase
            .from('purchases')
            .insert({
                supplier_name: supplierName,
                supplier_invoice: supplierInvoice,
                items: purchaseItems.map(({id, quantity, purchase_price, serialNumbers}) => ({ productId: id, quantity, purchase_price, serialNumbers})),
                total: grandTotal,
            })
            .select()
            .single();
        
        if (purchaseError) {
            toast({ variant: 'destructive', title: 'Failed to Save Purchase', description: purchaseError.message });
            return;
        }
        
        for (const item of purchaseItems) {
            const response = await fetch('/api/inventory/transactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    product_id: item.id,
                    movement_type: 'purchase_receipt',
                    quantity: item.quantity,
                    serial_numbers: item.serialNumbers || [],
                    reference_id: purchase?.id || supplierInvoice,
                    reference_type: 'purchase_order',
                    notes: `Purchase receipt from ${supplierName}`,
                }),
            });

            if (!response.ok) {
                const payload = await response.json().catch(() => null);
                toast({
                    variant: 'destructive',
                    title: 'Purchase Saved, Inventory Update Failed',
                    description: payload?.error || `Unable to update inventory for ${item.name}.`,
                });
                return;
            }
        }
        
        toast({ title: 'Purchase Entry Saved', description: 'Inventory has been updated successfully.' });

        setSupplierName('');
        setSupplierInvoice('');
        setPurchaseItems([]);
        setSearchTerm('');
    };

    return (
        <>
            <div className="space-y-8">
                <div>
                    <h1 className="text-3xl font-bold">Purchase Entry</h1>
                    <p className="text-muted-foreground">Record new stock received from suppliers.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                    <div className="lg:col-span-2 space-y-8">
                        <Card>
                            <CardHeader>
                                <CardTitle>Supplier Information</CardTitle>
                                <CardDescription>Enter the details from the supplier's invoice.</CardDescription>
                            </CardHeader>
                            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="supplier-name">Supplier Name</Label>
                                    <Input id="supplier-name" placeholder="e.g., Global Tech Distributors" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="supplier-invoice">Supplier Invoice No.</Label>
                                    <Input id="supplier-invoice" placeholder="e.g., INV-2025-1234" value={supplierInvoice} onChange={(e) => setSupplierInvoice(e.target.value)} />
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Products</CardTitle>
                                <CardDescription>Add the products received in this purchase order.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="relative mb-4">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input 
                                        placeholder="Search for products to add..." 
                                        className="pl-10"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                    {searchTerm && (
                                        <div className="absolute z-10 w-full bg-background border rounded-md mt-1 shadow-lg max-h-60 overflow-y-auto">
                                            {searchResults.length > 0 ? (
                                                searchResults.map(product => (
                                                    <div 
                                                        key={product.id} 
                                                        className="p-2 hover:bg-muted cursor-pointer"
                                                        onClick={() => handleAddItem(product)}
                                                    >
                                                        <div className="font-medium">{product.name}</div>
                                                        <div className="text-xs text-muted-foreground flex items-center justify-between gap-2">
                                                            <span>{product.model_number || product.category || 'Uncategorized'}</span>
                                                            <span>₹{Number(product.price ?? product.offer_price ?? product.mrp ?? 0).toFixed(2)}</span>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div 
                                                    className="p-2 hover:bg-muted cursor-pointer flex items-center gap-2"
                                                    onClick={() => setCreateProductDialogOpen(true)}
                                                >
                                                    <PlusCircle className="h-4 w-4"/>
                                                    <span>Create new product: "{searchTerm}"</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-[30%]">Product</TableHead>
                                                <TableHead>Qty</TableHead>
                                                <TableHead>Purchase Price</TableHead>
                                                <TableHead>Serial Numbers</TableHead>
                                                <TableHead>Total</TableHead>
                                                <TableHead>Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {purchaseItems.length > 0 ? purchaseItems.map(item => (
                                                <TableRow key={item.id}>
                                                    <TableCell className="font-medium">{item.name}</TableCell>
                                                    <TableCell>
                                                        <Input 
                                                            type="number"
                                                            value={item.quantity}
                                                            onChange={(e) => handleUpdateItem(item.id, 'quantity', parseInt(e.target.value) || 0)}
                                                            className="w-20"
                                                            min="1"
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Input 
                                                            type="number"
                                                            value={item.purchase_price}
                                                            onChange={(e) => handleUpdateItem(item.id, 'purchase_price', parseFloat(e.target.value) || 0)}
                                                            className="w-28"
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        {item.isSerialNumberCompulsory ? (
                                                            <Button variant="outline" size="sm" onClick={() => setItemForSerialEntry(item)}>
                                                                {item.serialNumbers?.length || 0} / {item.quantity} Serials
                                                            </Button>
                                                        ) : (
                                                            <span>N/A</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>₹{(item.quantity * item.purchase_price).toFixed(2)}</TableCell>
                                                    <TableCell>
                                                        <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)}>
                                                            <Trash2 className="h-4 w-4 text-destructive"/>
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            )) : (
                                                <TableRow>
                                                    <TableCell colSpan={6} className="text-center h-24">No products added yet.</TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                    <div className="lg:col-span-1 space-y-6 sticky top-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Purchase Summary</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Subtotal</span>
                                    <span>₹{subTotal.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Taxes (18%)</span>
                                    <span>₹{taxAmount.toFixed(2)}</span>
                                </div>
                                <Separator />
                                <div className="flex justify-between font-bold text-lg">
                                    <span>Grand Total</span>
                                    <span>₹{grandTotal.toFixed(2)}</span>
                                </div>
                                <Button className="w-full" size="lg" disabled={purchaseItems.length === 0} onClick={handleSavePurchase}>
                                    Save Purchase Entry
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
            {isCreateProductDialogOpen && (
                 <CreateProductDialog 
                    open={isCreateProductDialogOpen}
                    onClose={() => setCreateProductDialogOpen(false)}
                    onProductCreated={handleProductCreated}
                    initialName={searchTerm}
                />
            )}
            {itemForSerialEntry && (
                <PurchaseSerialNumberDialog
                    item={itemForSerialEntry}
                    onClose={() => setItemForSerialEntry(null)}
                    onSave={handleSaveSerials}
                />
            )}
        </>
    );
}
