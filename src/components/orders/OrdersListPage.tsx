'use client';

import React, { useEffect, useState } from 'react';

import { Package, Search, Calendar, MapPin, CreditCard, Eye } from 'lucide-react';

import { formatOrderNumber } from '@/lib/order-utils';

import { ORDER_STATUS_FLOW, SERVICE_ORDER_STATUS_FLOW } from '@/lib/data';

import { useAuth } from '@/lib/hooks';
import { useRouter } from 'next/navigation';
import { useOrder } from '../../context/OrderProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Order, OrderStatus } from '@/lib/types';

export default function OrdersListPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { orders, getOrders, cancelOrder } = useOrder();
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/auth/signin?redirect=/orders');
      return;
    }

    let active = true;
    const fetchOrders = async () => {
      setLoading(true);
      try {
        await getOrders(user.id);
      } catch (err) {
        console.error('Failed to fetch orders:', err);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchOrders();

    // Failsafe timeout to prevent permanent loading spinner
    const timer = setTimeout(() => {
      if (active) {
        setLoading(false);
      }
    }, 5000);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [authLoading, user, getOrders, router]);

  useEffect(() => {
    let filtered = orders;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(order =>
        order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.items.some(item => 
          item.name.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => order.status === statusFilter);
    }

    setFilteredOrders(filtered);
  }, [orders, searchTerm, statusFilter]);

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case 'Pending': return 'bg-yellow-500/15 text-yellow-200 border border-yellow-500/30';
      case 'Awaiting Payment': return 'bg-amber-500/15 text-amber-200 border border-amber-500/30';
      case 'Payment Failed': return 'bg-red-500/15 text-red-200 border border-red-500/30';
      case 'Payment Confirmed': return 'bg-primary/15 text-primary border border-primary/30';
      case 'Confirmed': return 'bg-blue-500/15 text-blue-200 border border-blue-500/30';
      case 'Processing': return 'bg-purple-500/15 text-purple-200 border border-purple-500/30';
      case 'Ready to Ship': return 'bg-indigo-500/15 text-indigo-200 border border-indigo-500/30';
      case 'Shipped': return 'bg-indigo-500/15 text-indigo-200 border border-indigo-500/30';
      case 'Ready for Pickup': return 'bg-sky-500/15 text-sky-200 border border-sky-500/30';
      case 'Ready for Delivery': return 'bg-sky-500/15 text-sky-200 border border-sky-500/30';
      case 'Delivered':
      case 'Delivered/Picked Up':
        return 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/30';
      case 'Completed': return 'bg-emerald-600/15 text-emerald-200 border border-emerald-500/30';
      case 'On Hold': return 'bg-orange-500/15 text-orange-200 border border-orange-500/30';
      case 'Visit Scheduled':
      case 'Visit Completed': return 'bg-teal-500/15 text-teal-200 border border-teal-500/30';
      case 'Diagnosis Done': return 'bg-blue-500/15 text-blue-200 border border-blue-500/30';
      case 'Quote Sent':
      case 'Awaiting Customer Approval': return 'bg-primary/15 text-primary border border-primary/30';
      case 'Approved': return 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/30';
      case 'Parts Ordered': return 'bg-indigo-500/15 text-indigo-200 border border-indigo-500/30';
      case 'Work In Progress': return 'bg-purple-500/15 text-purple-200 border border-purple-500/30';
      case 'Quality Check': return 'bg-fuchsia-500/15 text-fuchsia-200 border border-fuchsia-500/30';
      case 'Warranty/Support Active': return 'bg-lime-500/15 text-lime-200 border border-lime-500/30';
      case 'Cancelled': return 'bg-red-500/15 text-red-200 border border-red-500/30';
      case 'Rejected': return 'bg-rose-500/15 text-rose-200 border border-rose-500/30';
      default: return 'bg-slate-700/40 text-slate-200 border border-white/10';
    }
  };

  const statusOptions = Array.from(new Set([...ORDER_STATUS_FLOW, ...SERVICE_ORDER_STATUS_FLOW]));

  const handleCancelOrder = async (orderId: string) => {
    if (cancellingOrderId) return;
    const confirmed = window.confirm('Are you sure you want to cancel this order?');
    if (!confirmed) return;

    setCancellingOrderId(orderId);
    const success = await cancelOrder(orderId);
    setCancellingOrderId(null);

    if (success) {
      await getOrders();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090B] py-8">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-slate-300">Loading your orders...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090B] py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Your Orders</h1>
          <p className="text-slate-300">Track and manage your order history</p>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search by order ID, customer name, or product..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="w-full md:w-48">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Orders</SelectItem>
                    {statusOptions.map((status) => (
                      <SelectItem key={status} value={status}>{status}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Orders List */}
        {filteredOrders.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Package className="h-16 w-16 mx-auto text-slate-400 mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">
                {orders.length === 0 ? 'No Orders Yet' : 'No Orders Found'}
              </h3>
              <p className="text-slate-300 mb-6">
                {orders.length === 0 
                  ? 'You haven\'t placed any orders yet. Start shopping to see your orders here.'
                  : 'Try adjusting your search or filter criteria.'
                }
              </p>
              {orders.length === 0 && (
                <Button 
                  onClick={() => window.location.href = '/products'}
                  className="bg-primary hover:opacity-90 text-white"
                >
                  Start Shopping
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => (
              <Card key={order.id} className="border-white/10 bg-slate-900/40 hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-lg">
                          Order #{formatOrderNumber(order.id)}
                        </h3>
                        <Badge className={getStatusColor(order.status)}>
                          {order.status}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-slate-300">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          {new Date(order.created_at).toLocaleDateString('en-IN')}
                        </div>
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4" />
                          {order.items.length} item{order.items.length > 1 ? 's' : ''}
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          {order.type}
                        </div>
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-4 w-4" />
                          ₹{order.total.toFixed(2)}
                        </div>
                        {order.payment_reference && (
                          <div className="flex items-center gap-2">
                            <CreditCard className="h-4 w-4" />
                            Ref: {order.payment_reference}
                          </div>
                        )}
                      </div>

                      <div className="space-y-1">
                        <p className="font-medium text-sm">Customer: {order.customer_name}</p>
                        <p className="text-sm text-slate-300">
                          Items: {order.items.map(item => item.name).join(', ')}
                        </p>
                        {order.delivery_address && (
                          <p className="text-sm text-slate-300">
                            Delivery: {order.delivery_address}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2">
                       {(order.status === 'Pending' || order.status === 'Awaiting Payment' || order.status === 'Payment Failed') && (
                        <Button
                          variant="default"
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white border-none flex items-center gap-2"
                          onClick={() => window.location.href = `/payment/payu/${order.id}`}
                        >
                          <CreditCard className="h-4 w-4" />
                          Pay Now
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.location.href = `/orders/${order.id}`}
                        className="flex items-center gap-2"
                      >
                        <Eye className="h-4 w-4" />
                        View Details
                      </Button>
                      {order.status === 'Pending' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-300 hover:text-red-200 border-red-500/30 hover:border-red-500/50"
                          disabled={cancellingOrderId === order.id}
                          onClick={() => handleCancelOrder(order.id)}
                        >
                          {cancellingOrderId === order.id ? 'Cancelling...' : 'Cancel Order'}
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* 4. REAL-TIME TECHNICAL DISPATCH COMPLEMENTARY ACCESSORIES ASSIGNER */}
                  {(order.status === 'Visit Scheduled' || order.status === 'Processing') && (
                    <div className="mt-6 overflow-hidden rounded-xl border border-primary/20 bg-primary/5">
                      <div className="flex items-center justify-between bg-primary/10 px-4 py-2 border-b border-primary/20">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                          <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Technician Dispatch Optimization</span>
                        </div>
                        <span className="text-[10px] font-medium text-primary/70">Arriving Soon</span>
                      </div>
                      <div className="p-4 flex flex-col sm:flex-row items-center gap-4">
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-white">Complementary Accessories</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">Have your dispatched technician deliver this addition directly with your configuration today.</p>
                        </div>
                        <div className="flex items-center gap-3 w-full sm:w-auto">
                          <div className="flex items-center gap-2 rounded-lg bg-white/5 p-2 border border-white/10">
                            <div className="h-8 w-8 rounded bg-slate-800 flex items-center justify-center text-[10px] font-bold text-primary">64GB</div>
                            <div>
                              <p className="text-[10px] font-bold text-white">Surveillance SD</p>
                              <p className="text-[9px] text-primary">₹899.00</p>
                            </div>
                          </div>
                          <Button 
                            size="sm" 
                            className="bg-primary hover:bg-white hover:text-zinc-950 text-white text-[10px] font-bold h-8 px-3"
                            onClick={() => {
                              // Logic to add to order/dispatch would go here
                              alert('Accessory added to technician dispatch!');
                            }}
                          >
                            + Add to Dispatch
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Summary Stats */}
        {orders.length > 0 && (
          <Card className="mt-8 border-white/10 bg-slate-900/40">
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-primary">{orders.length}</p>
                  <p className="text-sm text-slate-300">Total Orders</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-emerald-300">
                    {orders.filter(o => o.status === 'Delivered').length}
                  </p>
                  <p className="text-sm text-slate-300">Delivered</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-300">
                    {orders.filter(o => ['Pending', 'Confirmed', 'Processing', 'Shipped'].includes(o.status)).length}
                  </p>
                  <p className="text-sm text-slate-300">In Progress</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-violet-300">
                    ₹{orders.reduce((total, order) => total + order.total, 0).toFixed(2)}
                  </p>
                  <p className="text-sm text-slate-300">Total Spent</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}