"use client";

import React, { useState, useEffect, useCallback } from 'react';

import { 
  ShoppingCart,
  Plus,
  Minus,
  Search,
  User,
  CreditCard,
  Package,
  IndianRupee,
  Phone,
  Mail,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle
} from 'lucide-react';

import { logger } from '@/lib/logger';

import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '../../hooks/use-toast';

interface Product {
  id: string;
  name: string;
  price: number;
  stock_quantity: number;
  discount_percentage?: number;
  category?: string;
  brand?: string;
}

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  customer_category: string;
}

interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  total: number;
}

interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  total?: number | string;
  total_amount?: number | string;
  amount?: number | string;
  status: string;
  created_at: string;
  profiles: Customer;
  order_items: Array<{
    product_name: string;
    quantity: number;
    price: number;
    total: number;
  }>;
}

export default function WalkInOrderManagement() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'create' | 'orders' | 'stats'>('create');
  
  // Create Order State
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [customerInfo, setCustomerInfo] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    address: ''
  });
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'upi'>('cash');
  const [discountCode, setDiscountCode] = useState('');
  const [notes, setNotes] = useState('');
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  
  // Orders State
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  
  // Stats State
  const [dailyStats, setDailyStats] = useState({
    totalOrders: 0,
    totalRevenue: 0,
    completedOrders: 0,
    pendingOrders: 0,
    paidOrders: 0,
    pendingPayments: 0
  });

  // Customer Search
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [searchedCustomers, setSearchedCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const fetchProducts = useCallback(async () => {
    try {
      const response = await fetch('/api/products?status=active');
      const data = await response.json();
      if (data.products) {
        setProducts(data.products);
      }
    } catch (error) {
      logger.error('Error fetching products', { error, context: 'WalkInOrderManagement.fetchProducts' });
      toast({
        title: "Error",
        description: "Failed to load products",
        variant: "destructive",
      });
    }
  }, [toast]);

  const fetchOrders = useCallback(async () => {
    setIsLoadingOrders(true);
    try {
      const response = await fetch(`/api/walk-in-orders?action=store-orders&date=${selectedDate}`);
      const data = await response.json();
      if (data.orders) {
        setOrders(data.orders);
      }
    } catch (error) {
      logger.error('Error fetching orders', { error, context: 'WalkInOrderManagement.fetchOrders', date: selectedDate });
      toast({
        title: "Error",
        description: "Failed to load orders",
        variant: "destructive",
      });
    } finally {
      setIsLoadingOrders(false);
    }
  }, [selectedDate, toast]);

  const fetchDailyStats = useCallback(async () => {
    try {
      const response = await fetch(`/api/walk-in-orders?action=daily-stats&date=${selectedDate}`);
      const data = await response.json();
      if (data.stats) {
        setDailyStats((prev) => ({
          ...prev,
          ...data.stats
        }));
      }
    } catch (error) {
      logger.error('Error fetching daily stats', { error, context: 'WalkInOrderManagement.fetchDailyStats', date: selectedDate });
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchProducts();
    fetchOrders();
    fetchDailyStats();
  }, [fetchProducts, fetchOrders, fetchDailyStats]);

  useEffect(() => {
    fetchOrders();
    fetchDailyStats();
  }, [selectedDate, fetchOrders, fetchDailyStats]);

  const searchCustomers = async (query: string) => {
    if (query.length < 2) {
      setSearchedCustomers([]);
      return;
    }
    
    try {
      const response = await fetch('/api/walk-in-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'search-customers', query })
      });
      const data = await response.json();
      if (data.customers) {
        setSearchedCustomers(data.customers);
      }
    } catch (error) {
      logger.error('Error searching customers', { error, context: 'WalkInOrderManagement.searchCustomers', query });
    }
  };

  const addToCart = (product: Product) => {
    const existingItem = cart.find(item => item.productId === product.id);
    
    if (existingItem) {
      if (existingItem.quantity >= product.stock_quantity) {
        toast({
          title: "Stock Limit",
          description: "Cannot add more items than available stock",
          variant: "destructive",
        });
        return;
      }
      setCart(cart.map(item =>
        item.productId === product.id
          ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.price }
          : item
      ));
    } else {
      setCart([...cart, {
        productId: product.id,
        productName: product.name,
        quantity: 1,
        price: product.price * (1 - (product.discount_percentage || 0) / 100),
        total: product.price * (1 - (product.discount_percentage || 0) / 100)
      }]);
    }
    toast({
      title: "Added to Cart",
      description: `${product.name} added to cart`,
    });
  };

  const updateCartQuantity = (productId: string, change: number) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    setCart(cart.map(item => {
      if (item.productId === productId) {
        const newQuantity = Math.max(0, Math.min(item.quantity + change, product.stock_quantity));
        if (newQuantity === 0) {
          return null;
        }
        return {
          ...item,
          quantity: newQuantity,
          total: newQuantity * item.price
        };
      }
      return item;
    }).filter(Boolean) as OrderItem[]);
  };

  const selectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setCustomerInfo({
      firstName: customer.first_name,
      lastName: customer.last_name,
      phone: customer.phone,
      email: customer.email,
      address: ''
    });
    setCustomerSearchTerm('');
    setSearchedCustomers([]);
  };

  const calculateTotals = () => {
    const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
    
    // Customer category discount
    let categoryDiscount = 0;
    if (selectedCustomer?.customer_category) {
      const discounts = { 'Normal': 0, 'Standard': 5, 'Premium': 10 };
      categoryDiscount = subtotal * ((discounts as any)[selectedCustomer.customer_category] || 0) / 100;
    }
    
    const total = subtotal - categoryDiscount;
    
    return { subtotal, categoryDiscount, total };
  };

  const createOrder = async () => {
    if (cart.length === 0) {
      toast({
        title: "Cart Empty",
        description: "Cart is empty",
        variant: "destructive",
      });
      return;
    }

    if (!customerInfo.firstName || !customerInfo.phone) {
      toast({
        title: "Required Fields",
        description: "Customer name and phone are required",
        variant: "destructive",
      });
      return;
    }

    setIsCreatingOrder(true);
    try {
      const response = await fetch('/api/walk-in-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-walk-in-order',
          customerInfo,
          items: cart,
          paymentMethod,
          discountCode: discountCode || null,
          salesPersonId: null, // Could be set from auth context
          notes
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create order');
      }

      toast({
        title: "Order Created",
        description: `Order ${data.order.order_number} created successfully!`,
      });
      
      // Reset form
      setCart([]);
      setCustomerInfo({
        firstName: '',
        lastName: '',
        phone: '',
        email: '',
        address: ''
      });
      setSelectedCustomer(null);
      setPaymentMethod('cash');
      setDiscountCode('');
      setNotes('');
      
      // Refresh orders and stats
      fetchOrders();
      fetchDailyStats();
      
      // Switch to orders tab to show the new order
      setActiveTab('orders');
      
    } catch (error) {
      logger.error('Error creating walk-in order', { error, context: 'WalkInOrderManagement.createOrder', customerInfo, cartItems: cart.length });
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to create order',
        variant: "destructive",
      });
    } finally {
      setIsCreatingOrder(false);
    }
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    try {
      const response = await fetch('/api/walk-in-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update-order-status',
          orderId,
          status
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update order');
      }

      toast({
        title: "Order Updated",
        description: "Order updated successfully",
      });
      fetchOrders();
      fetchDailyStats();
    } catch (error) {
      logger.error('Error updating order status', { error, context: 'WalkInOrderManagement.updateOrderStatus', orderId, status });
      toast({
        title: "Error",
        description: "Failed to update order",
        variant: "destructive",
      });
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.brand?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const { subtotal, categoryDiscount, total } = calculateTotals();

  const resolveOrderTotalAmount = (order: Order) => {
    const candidates = [order.total, order.total_amount, order.amount];
    for (const value of candidates) {
      const parsed = parseFloat(String(value ?? ''));
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
    return 0;
  };

  const derivePaymentState = (order: Order): 'Paid' | 'Pending' | 'Failed' => {
    const normalizedStatus = order.status?.toLowerCase() ?? '';

    if (['payment confirmed', 'completed', 'fulfilled', 'delivered', 'paid'].includes(normalizedStatus)) {
      return 'Paid';
    }

    if (['payment failed', 'failed', 'cancelled'].includes(normalizedStatus)) {
      return 'Failed';
    }

    return 'Pending';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed': 
      case 'Payment Confirmed': 
        return 'bg-primary/10 text-primary border border-primary/20';
      case 'Processing': 
      case 'Awaiting Payment': 
        return 'bg-zinc-800/80 text-zinc-300 border border-zinc-700';
      case 'Cancelled': 
      case 'Payment Failed': 
        return 'bg-zinc-950 text-zinc-400 border border-zinc-800';
      default: return 'bg-zinc-900 text-zinc-400 border border-zinc-800';
    }
  };

  const getPaymentStatusColor = (status: 'Paid' | 'Pending' | 'Failed') => {
    switch (status) {
      case 'Paid': return 'bg-primary/10 text-primary border border-primary/20';
      case 'Pending': return 'bg-zinc-800/80 text-zinc-300 border border-zinc-700';
      case 'Failed': return 'bg-zinc-950 text-zinc-400 border border-zinc-800';
      default: return 'bg-zinc-900 text-zinc-400 border border-zinc-800';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tech-heading">Walk-in Order Management</h1>
        <p className="tech-body">Manage in-store customer orders and transactions</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-muted border border-border p-1 rounded-lg mb-6">
        <button
          onClick={() => setActiveTab('create')}
          className={`px-4 py-2 rounded-md font-medium transition-colors flex items-center ${
            activeTab === 'create'
              ? 'bg-card text-primary shadow-sm border border-border'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <ShoppingCart className="w-4 h-4 mr-2" />
          Create Order
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`px-4 py-2 rounded-md font-medium transition-colors flex items-center ${
            activeTab === 'orders'
              ? 'bg-card text-primary shadow-sm border border-border'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Package className="w-4 h-4 mr-2" />
          Today's Orders
        </button>
        <button
          onClick={() => setActiveTab('stats')}
          className={`px-4 py-2 rounded-md font-medium transition-colors flex items-center ${
            activeTab === 'stats'
              ? 'bg-card text-primary shadow-sm border border-border'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <IndianRupee className="w-4 h-4 mr-2" />
          Daily Stats
        </button>
      </div>

      {/* Create Order Tab */}
      {activeTab === 'create' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Product Selection */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Select Products</CardTitle>
                <div className="relative">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search products..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                  {filteredProducts.map((product) => (
                    <div key={product.id} className="border border-zinc-800 bg-zinc-900/40 rounded-lg p-4">
                      <h4 className="font-medium text-zinc-100">{product.name}</h4>
                      <p className="text-sm text-zinc-400 mb-2">{product.category} • {product.brand}</p>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-lg font-bold text-primary">
                          ₹{(product.price * (1 - (product.discount_percentage || 0) / 100)).toFixed(2)}
                        </span>
                        {product.discount_percentage && (
                          <Badge variant="outline" className="border-primary/20 text-primary bg-primary/5">{product.discount_percentage}% OFF</Badge>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-zinc-400">Stock: {product.stock_quantity}</span>
                        <Button
                          size="sm"
                          onClick={() => addToCart(product)}
                          disabled={product.stock_quantity === 0}
                          className="bg-primary hover:bg-primary/90 text-white"
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Add
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Order Summary */}
          <div className="space-y-6">
            {/* Customer Info */}
            <Card>
              <CardHeader>
                <CardTitle>Customer Information</CardTitle>
                <div className="relative">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search existing customers..."
                    value={customerSearchTerm}
                    onChange={(e) => {
                      setCustomerSearchTerm(e.target.value);
                      searchCustomers(e.target.value);
                    }}
                    className="pl-10"
                  />
                  {searchedCustomers.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-card border border-border rounded-md shadow-lg z-10 mt-1">
                      {searchedCustomers.map((customer) => (
                        <div
                          key={customer.id}
                          className="p-3 hover:bg-muted cursor-pointer border-b border-border last:border-b-0 text-foreground"
                          onClick={() => selectCustomer(customer)}
                        >
                          <div className="font-medium">{customer.first_name} {customer.last_name}</div>
                          <div className="text-sm text-muted-foreground">{customer.phone} • {customer.customer_category}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedCustomer && (
                  <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <User className="w-4 h-4 text-primary" />
                      <span className="font-medium text-foreground">Selected Customer</span>
                      <Badge variant="outline">{selectedCustomer.customer_category}</Badge>
                    </div>
                    <div className="text-sm space-y-1">
                      <div>{selectedCustomer.first_name} {selectedCustomer.last_name}</div>
                      <div className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {selectedCustomer.phone}
                      </div>
                      {selectedCustomer.email && (
                        <div className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {selectedCustomer.email}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedCustomer(null);
                        setCustomerInfo({
                          firstName: '',
                          lastName: '',
                          phone: '',
                          email: '',
                          address: ''
                        });
                      }}
                      className="mt-2"
                    >
                      Clear Selection
                    </Button>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input
                      id="firstName"
                      value={customerInfo.firstName}
                      onChange={(e) => setCustomerInfo({...customerInfo, firstName: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={customerInfo.lastName}
                      onChange={(e) => setCustomerInfo({...customerInfo, lastName: e.target.value})}
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="phone">Phone *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={customerInfo.phone}
                    onChange={(e) => setCustomerInfo({...customerInfo, phone: e.target.value})}
                  />
                </div>
                
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={customerInfo.email}
                    onChange={(e) => setCustomerInfo({...customerInfo, email: e.target.value})}
                  />
                </div>
                
                <div>
                  <Label htmlFor="address">Address</Label>
                  <Textarea
                    id="address"
                    value={customerInfo.address}
                    onChange={(e) => setCustomerInfo({...customerInfo, address: e.target.value})}
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Cart */}
            <Card>
              <CardHeader>
                <CardTitle>Order Items ({cart.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {cart.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No items in cart</p>
                ) : (
                  <div className="space-y-3">
                    {cart.map((item) => (
                      <div key={item.productId} className="flex items-center justify-between p-3 border rounded">
                        <div className="flex-1">
                          <h5 className="font-medium">{item.productName}</h5>
                          <p className="text-sm text-gray-500">₹{item.price} each</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateCartQuantity(item.productId, -1)}
                          >
                            <Minus className="w-3 h-3" />
                          </Button>
                          <span className="w-8 text-center">{item.quantity}</span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateCartQuantity(item.productId, 1)}
                          >
                            <Plus className="w-3 h-3" />
                          </Button>
                          <span className="w-16 text-right font-medium">₹{item.total.toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Payment & Checkout */}
            <Card>
              <CardHeader>
                <CardTitle>Payment & Checkout</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="paymentMethod">Payment Method</Label>
                  <Select value={paymentMethod} onValueChange={(value: any) => setPaymentMethod(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="upi">UPI</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="discountCode">Discount Code</Label>
                  <Input
                    id="discountCode"
                    value={discountCode}
                    onChange={(e) => setDiscountCode(e.target.value)}
                    placeholder="Enter discount code"
                  />
                </div>

                <div>
                  <Label htmlFor="notes">Order Notes</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Special instructions..."
                    rows={2}
                  />
                </div>

                {/* Order Summary */}
                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>₹{subtotal.toFixed(2)}</span>
                  </div>
                  {categoryDiscount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Category Discount ({selectedCustomer?.customer_category}):</span>
                      <span>-₹{categoryDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg border-t pt-2">
                    <span>Total:</span>
                    <span>₹{total.toFixed(2)}</span>
                  </div>
                </div>

                <Button
                  onClick={createOrder}
                  disabled={cart.length === 0 || isCreatingOrder || !customerInfo.firstName || !customerInfo.phone}
                  className="w-full"
                  size="lg"
                >
                  {isCreatingOrder ? (
                    <>
                      <Clock className="w-4 h-4 mr-2 animate-spin" />
                      Creating Order...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4 mr-2" />
                      Create Order
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Orders Tab */}
      {activeTab === 'orders' && (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Label htmlFor="orderDate">Date:</Label>
            <Input
              id="orderDate"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-auto"
            />
            <Button onClick={fetchOrders} disabled={isLoadingOrders}>
              {isLoadingOrders ? 'Loading...' : 'Refresh'}
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Store Orders - {selectedDate}</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingOrders ? (
                <div className="text-center py-8">Loading orders...</div>
              ) : orders.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No orders found for selected date</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => {
                      const paymentState = derivePaymentState(order);
                      const orderTotal = resolveOrderTotalAmount(order);
                      const canMarkAsCompleted = ['Processing', 'Awaiting Payment'].includes(order.status);

                      return (
                        <TableRow key={order.id}>
                          <TableCell className="font-medium">{order.order_number}</TableCell>
                          <TableCell>
                            <div>
                              <div>{order.profiles.first_name} {order.profiles.last_name}</div>
                              <div className="text-sm text-gray-500">{order.profiles.phone}</div>
                              <Badge variant="outline" className="text-xs">
                                {order.profiles.customer_category}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {order.order_items.slice(0, 2).map((item, idx) => (
                                <div key={idx}>{item.product_name} x{item.quantity}</div>
                              ))}
                              {order.order_items.length > 2 && (
                                <div className="text-gray-500">+{order.order_items.length - 2} more</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">₹{orderTotal.toFixed(2)}</TableCell>
                          <TableCell>
                            <Badge className={getPaymentStatusColor(paymentState)}>
                              {paymentState}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(order.status)}>
                              {order.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(order.created_at).toLocaleTimeString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              {canMarkAsCompleted && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => updateOrderStatus(order.id, 'Completed')}
                                  title="Mark as Completed"
                                >
                                  <CheckCircle className="w-3 h-3" />
                                </Button>
                              )}
                              {paymentState === 'Pending' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => updateOrderStatus(order.id, 'Payment Confirmed')}
                                  title="Mark as Paid"
                                >
                                  <CreditCard className="w-3 h-3" />
                                </Button>
                              )}
                              {order.status !== 'Awaiting Payment' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => updateOrderStatus(order.id, 'Awaiting Payment')}
                                  title="Mark as Awaiting Payment"
                                >
                                  <Clock className="w-3 h-3" />
                                </Button>
                              )}
                              {order.status !== 'Payment Failed' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-zinc-400 border-zinc-800 hover:text-zinc-300 hover:bg-zinc-900"
                                  onClick={() => updateOrderStatus(order.id, 'Payment Failed')}
                                  title="Mark as Failed"
                                >
                                  <XCircle className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Stats Tab */}
      {activeTab === 'stats' && (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Label htmlFor="statsDate">Date:</Label>
            <Input
              id="statsDate"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-auto"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dailyStats.totalOrders}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                <IndianRupee className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">₹{dailyStats.totalRevenue.toFixed(2)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completed Orders</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dailyStats.completedOrders}</div>
                <p className="text-xs text-muted-foreground">
                  {dailyStats.totalOrders > 0 ? Math.round((dailyStats.completedOrders / dailyStats.totalOrders) * 100) : 0}% completion rate
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Orders</CardTitle>
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dailyStats.pendingOrders}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Paid Orders</CardTitle>
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dailyStats.paidOrders}</div>
                <p className="text-xs text-muted-foreground">
                  {dailyStats.totalOrders > 0 ? Math.round((dailyStats.paidOrders / dailyStats.totalOrders) * 100) : 0}% payment rate
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Payments</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dailyStats.pendingPayments}</div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}