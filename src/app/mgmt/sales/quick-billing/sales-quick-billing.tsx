
'use client';

import * as React from 'react';

import { Search, ShoppingCart, CreditCard, Minus, Plus } from 'lucide-react';

import Image from 'next/image';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';


import type { Product, CartItem, Order, User as CustomerType } from '@/lib/types';
import { useToast } from '../../../../hooks/use-toast';
import { CreateCustomerDialog } from '@/components/sales/CreateCustomerDialog';
import { Label } from '@/components/ui/label';
import { InvoiceTemplate, type CompanySettings } from '@/components/invoices/InvoiceTemplate';
import { SerialNumberDialog } from '@/components/sales/SerialNumberDialog';
import { useAuth } from '@/lib/hooks';
import { createClient } from '@/lib/supabase/client';
import { getGstRateForProduct, type CategoryGstRates } from '@/lib/utils';


const defaultCompanySettings: CompanySettings = {
    name: 'TecBunny',
    address: 'Parcem, Pernem, Goa - 403512',
    logoUrl: 'https://fbcsagupcxheyiusjfak.supabase.co/storage/v1/object/public/TecBunny%20Solution/TECBUNNY_SOLUTIONS_PVT_LTD-removebg-preview.png'
};

export default function QuickBillingPage() {
        const [companySettings, setCompanySettings] = React.useState<CompanySettings>(defaultCompanySettings);

        React.useEffect(() => {
                fetch('/company-info.json')
                    .then(r => r.ok ? r.json() : null)
                    .then((data) => {
                        if (data) {
                            setCompanySettings({
                                name: data.companyName || defaultCompanySettings.name,
                                address: data.registeredAddress || defaultCompanySettings.address,
                                gstin: data.gstin || undefined,
                                pan: data.pan || undefined,
                                tan: data.tan || undefined,
                                cin: data.cin || undefined,
                                logoUrl: defaultCompanySettings.logoUrl,
                            });
                        }
                    })
                    .catch(() => {});
        }, []);
    const { toast } = useToast();
    const { user: staffUser } = useAuth();
    const supabase = createClient();
    const [searchMobile, setSearchMobile] = React.useState('');
    const [customer, setCustomer] = React.useState<CustomerType | null>(null);
    const [cart, setCart] = React.useState<CartItem[]>([]);
    const [paymentMethod, setPaymentMethod] = React.useState<'Cash' | 'UPI' | 'Credit' | null>(null);
    const [completedOrder, setCompletedOrder] = React.useState<Order | null>(null);
    const [productForSerial, setProductForSerial] = React.useState<Product | null>(null);
    const [products, setProducts] = React.useState<Product[]>([]);
    const [categoryGstRates, setCategoryGstRates] = React.useState<CategoryGstRates | null>(null);


    React.useEffect(() => {
        const fetchProducts = async () => {
            const { data, error } = await supabase.from('products').select('*');
            if (error) console.error("Error fetching products", error);
            else setProducts(data || []);
        }
        fetchProducts();
    }, [supabase]);

    React.useEffect(() => {
        const fetchCategoryGstRates = async () => {
            const { data: settings, error } = await supabase.from('settings').select('*').eq('key', 'categoryGstRates').single();
            if (error) {
                console.error("Error fetching category GST rates", error);
            } else if (settings) {
                try {
                    setCategoryGstRates(JSON.parse(settings.value));
                } catch (e) {
                    console.error("Error parsing category GST rates", e);
                }
            }
        }
        fetchCategoryGstRates();
    }, [supabase]);


    const subtotal = cart.reduce((total, item) => {
        const price = item.price;
        const gstRate = item.gstRate || 0;
        const basePrice = price / (1 + (gstRate / 100));
        return total + basePrice * item.quantity;
    }, 0);
    const cartTotal = cart.reduce((total, item) => total + item.price * item.quantity, 0);
    const gstAmount = cartTotal - subtotal;

    const handleSearch = async () => {
        const { data: foundUser, error } = await supabase.from('profiles').select('*').eq('mobile', searchMobile).single();
        if(foundUser && !error) {
            setCustomer(foundUser);
            toast({ title: 'Customer Found', description: `Loaded profile for ${foundUser.name}.`});
        } else {
            setCustomer(null);
            toast({ variant: 'destructive', title: 'Customer Not Found', description: 'No existing customer with that mobile number.' });
        }
    };

    const handleCustomerCreated = async (newCustomerData: { name: string; mobile: string; email?: string; gstin?: string }) => {
        const { data, error } = await supabase.from('profiles').insert({ ...newCustomerData, role: 'customer' }).select().single();
        
        if (error || !data) {
            toast({ variant: 'destructive', title: 'Failed to create customer', description: error?.message });
            return;
        }

        const newCustomer = data as CustomerType;
        setCustomer(newCustomer);
        setSearchMobile(newCustomer.mobile);
        toast({ title: 'Customer Created', description: `Customer ${newCustomer.name} has been added.` });
    };
    
    const addToCart = (product: Product, quantity = 1, serialNumbers?: string[]) => {
       if (product.isSerialNumberCompulsory && !serialNumbers) {
           setProductForSerial(product);
           return;
       }
       
       // Calculate GST rate based on category
       const gstRate = getGstRateForProduct(product, categoryGstRates || undefined);
       const productWithGst = { ...product, gstRate };
       
       setCart((prevCart) => {
        const existingItem = prevCart.find((item) => item.id === product.id);
        if (existingItem) {
            const newQuantity = existingItem.quantity + quantity;
            if (product.isSerialNumberCompulsory) {
                // For serial number items, we just replace them for simplicity
                 return [...prevCart.filter(item => item.id !== product.id), { ...productWithGst, quantity, serialNumbers }];
            }
            return prevCart.map((item) =>
            item.id === product.id ? { ...item, quantity: newQuantity, gstRate } : item
            );
        }
        return [...prevCart, { ...productWithGst, quantity, serialNumbers }];
        });
        toast({ title: 'Added to cart', description: `${product.name} was added.`});
    };
    
    const updateQuantity = (productId: string, newQuantity: number) => {
        if (newQuantity < 1) {
            setCart(prev => prev.filter(item => item.id !== productId));
            return;
        }

        const product = products.find(p => p.id === productId);
        if(product?.isSerialNumberCompulsory) {
            // Re-trigger serial number selection for the new quantity
            setProductForSerial(product);
            // remove item from cart first
            setCart(prev => prev.filter(item => item.id !== productId));
        } else {
            setCart(prev => prev.map(item => item.id === productId ? { ...item, quantity: newQuantity } : item));
        }
    }

    const handleSerialNumbersSelected = (product: Product, serials: string[]) => {
        addToCart(product, serials.length, serials);
        setProductForSerial(null);
    }
    
    const handleProcessPayment = async () => {
        if (!customer || !paymentMethod || cart.length === 0 || !staffUser) return;

        const orderToInsert = {
            customer_name: customer.name,
            customer_id: customer.id,
            status: 'Completed',
            subtotal,
            gst_amount: gstAmount,
            total: cartTotal,
            type: 'Pickup',
            items: cart.map(item => ({ 
                productId: item.id, 
                quantity: item.quantity, 
                price: item.price,
                gstRate: item.gstRate,
                hsnCode: item.hsnCode,
                name: item.name,
                serialNumbers: item.serialNumbers,
            })),
            processed_by: staffUser.id
        };

        const { data: newOrder, error } = await supabase
            .from('orders')
            .insert(orderToInsert)
            .select()
            .single();

        if (error || !newOrder) {
            toast({ variant: 'destructive', title: 'Failed to create order', description: error?.message });
            return;
        }

        for (const cartItem of cart) {
            const { error: rpcError } = await supabase.rpc('decrement_stock_with_serials', {
                p_product_id: cartItem.id,
                p_quantity: cartItem.quantity,
                p_serials: cartItem.serialNumbers || []
            });

            if (rpcError) {
                console.error('Failed to update inventory for', cartItem.name, rpcError);
                // Note: Order is already created. In a real transaction, we would roll back.
                // For now, we just alert.
                toast({ variant: 'destructive', title: 'Inventory Error', description: `Failed to update stock for ${cartItem.name}. Please check inventory.` });
            }
        }
        
        setCompletedOrder(newOrder as Order);
        toast({ title: 'Payment Processed', description: `Paid via ${paymentMethod}. Invoice generated.`});
    };

    const handleNewBill = () => {
        setCompletedOrder(null);
        setCart([]);
        setCustomer(null);
        setSearchMobile('');
        setPaymentMethod(null);
    }

    if (completedOrder) {
        return (
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <h1 className="text-3xl font-bold">Generated Invoice</h1>
                    <Button onClick={handleNewBill}>Create New Bill</Button>
                </div>
                <InvoiceTemplate order={completedOrder} settings={companySettings} />
            </div>
        )
    }

    return (
        <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                <div className="lg:col-span-2 space-y-8">
                    <div>
                        <h1 className="text-3xl font-bold">Quick Billing</h1>
                        <p className="text-muted-foreground">Process orders for walk-in customers quickly.</p>
                    </div>
                    <Card>
                        <CardHeader>
                            <CardTitle>Customer</CardTitle>
                            <CardDescription>Search for an existing customer by mobile or create a new one.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex gap-2">
                                <Input 
                                    placeholder="Enter customer mobile number..." 
                                    value={searchMobile}
                                    onChange={(e) => setSearchMobile(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                />
                                <Button onClick={handleSearch}><Search className="mr-2 h-4 w-4"/> Search</Button>
                            </div>
                            {customer ? (
                                <div className="p-4 bg-secondary rounded-lg">
                                    <p className="font-semibold">Customer: {customer.name}</p>
                                    <p className="text-sm text-secondary-foreground">{customer.mobile}</p>
                                    {customer.email && <p className="text-sm text-secondary-foreground">{customer.email}</p>}
                                    {customer.gstin && <p className="text-sm text-secondary-foreground">GSTIN: {customer.gstin}</p>}
                                </div>
                            ) : (
                                <div className="p-4 border border-dashed rounded-lg flex items-center justify-between">
                                    <p className="text-muted-foreground">Search for a customer to begin.</p>
                                    <CreateCustomerDialog onCustomerCreated={handleCustomerCreated} />
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Product Selection</CardTitle>
                            <CardDescription>Add products to the order.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Input placeholder="Search for products by name or ID..." />
                            <div className="max-h-96 overflow-y-auto space-y-2 p-2 border rounded-md">
                                {products.map(product => (
                                    <div key={product.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted">
                                        <div className="flex items-center gap-4">
                                                                                        {product.image ? (
                                              <Image 
                                                src={product.image}
                                                alt={product.name}
                                                width={40}
                                                height={40}
                                                className="rounded-md"
                                                data-ai-hint={product.category}
                                              />
                                            ) : (
                                              <div className="w-10 h-10 rounded-md bg-gray-200 flex items-center justify-center text-gray-600 font-semibold text-sm">
                                                                                                {(product.name?.charAt(0) ?? '?').toUpperCase()}
                                              </div>
                                            )}
                                            <div>
                                                <p className="font-medium">{product.name}</p>
                                                <p className="text-sm text-muted-foreground">₹{product.price.toFixed(2)}</p>
                                                <p className="text-xs text-blue-600">
                                                  GST: {getGstRateForProduct(product, categoryGstRates || undefined)}%
                                                </p>
                                            </div>
                                        </div>
                                        <Button size="sm" onClick={() => addToCart(product)}>Add</Button>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
                
                <div className="lg:col-span-1 space-y-6 sticky top-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                            <span>Order Summary</span> 
                            <ShoppingCart className="h-5 w-5 text-muted-foreground"/>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                        {cart.length > 0 ? (
                                <div className="space-y-4 max-h-60 overflow-y-auto">
                                    {cart.map((item) => (
                                        <div key={item.id} className="flex justify-between items-start text-sm">
                                            <div>
                                                <p className="font-medium">{item.name}</p>
                                                <p className="text-xs text-blue-600">GST: {item.gstRate || 0}%</p>
                                                {item.serialNumbers && item.serialNumbers.length > 0 && (
                                                    <p className="text-xs text-muted-foreground">Serials: {item.serialNumbers.join(', ')}</p>
                                                )}
                                                <div className="flex items-center gap-2 mt-1">
                                                     <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateQuantity(item.id, item.quantity - 1)} disabled={item.isSerialNumberCompulsory}>
                                                        <Minus className="h-3 w-3" />
                                                    </Button>
                                                    <span className="w-6 text-center">{item.quantity}</span>
                                                    <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateQuantity(item.id, item.quantity + 1)} disabled={item.isSerialNumberCompulsory}>
                                                        <Plus className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </div>
                                            <span className="font-medium">₹{(item.price * item.quantity).toFixed(2)}</span>
                                        </div>
                                    ))}
                                </div>
                        ) : (
                            <p className="text-sm text-muted-foreground text-center py-4">No items in cart.</p>
                        )}
                        <Separator />
                        <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Subtotal</span>
                                    <span>₹{subtotal.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">GST</span>
                                    <span>₹{gstAmount.toFixed(2)}</span>
                                </div>
                        </div>
                        <Separator />
                        <div className="flex justify-between font-bold text-lg">
                            <span>Total</span>
                            <span>₹{cartTotal.toFixed(2)}</span>
                        </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                            <span>Payment</span> 
                            <CreditCard className="h-5 w-5 text-muted-foreground"/>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Payment Method</Label>
                                <div className="grid grid-cols-3 gap-2">
                                    <Button variant={paymentMethod === 'Cash' ? 'default' : 'outline'} onClick={() => setPaymentMethod('Cash')}>Cash</Button>
                                    <Button variant={paymentMethod === 'UPI' ? 'default' : 'outline'} onClick={() => setPaymentMethod('UPI')}>UPI</Button>
                                    <Button variant={paymentMethod === 'Credit' ? 'default' : 'outline'} onClick={() => setPaymentMethod('Credit')}>Credit</Button>
                                </div>
                            </div>
                            <Button className="w-full" size="lg" disabled={cart.length === 0 || !customer || !paymentMethod} onClick={handleProcessPayment}>
                                Process Payment
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
            {productForSerial && (
                <SerialNumberDialog
                    product={productForSerial}
                    onClose={() => setProductForSerial(null)}
                    onSave={handleSerialNumbersSelected}
                />
            )}
        </>
    );
}
