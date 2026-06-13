'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

import { ShoppingCart, CreditCard, MapPin, User, Wallet, Banknote, QrCode, Tag, Sparkles, ArrowLeft, CheckCircle, Shield, ChevronDown } from 'lucide-react';

import { useCart, useAuth } from '@/lib/hooks';
import { useOrder } from '../../context/OrderProvider';
import { usePaymentMethods } from '../../hooks/use-payment-methods';
import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { LoginDialog } from '@/components/auth/LoginDialog';
import { Badge } from '../ui/badge';
import type { OrderStatus, OrderType } from '@/lib/types';
import { formatPlaceOfSupply, resolveIndianStateInfo, TECBUNNY_REGISTERED_STATE } from '@/lib/indian-tax';

const PICKUP_STORES = [
  {
    id: 'tecbunny-store-parcem',
    name: 'TecBunny Store Parcem',
    address: 'TecBunny Store, Chawdewada, Parcem, Pernem, Goa'
  }
] as const;

export default function CheckoutPage() {
  const {
    cartItems,
    cartCount,
    cartSubtotal,
    cartGst,
    pricing,
    refreshPricing,
    removeCoupon,
  } = useCart();
  const { createOrder, isProcessingOrder } = useOrder();
  const { getEnabledPaymentMethods, loading: paymentLoading } = usePaymentMethods();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const quoteId = searchParams.get('quoteId');
  const pickupStores = PICKUP_STORES;
  
  const [quote, setQuote] = useState<any>(null);
  const [isPartPayment, setIsPartPayment] = useState(false);
  const [partPaymentAmount, setPartPaymentAmount] = useState('');
  const [loadingQuote, setLoadingQuote] = useState(false);
  
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    email: '',
    phone: '',
    gstin: '',
    address: '',
    city: '',
    pincode: '',
    state: '',
    notes: '',
    installDate: '',
    siteStatus: ''
  });
  const [isFetchingGst, setIsFetchingGst] = useState(false);
  const [gstError, setGstError] = useState('');

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    if (customerInfo.gstin && customerInfo.gstin.length === 15) {
      const fetchGstDetails = async () => {
        setIsFetchingGst(true);
        setGstError('');
        try {
          const res = await fetch(`/api/gst-verify?gstin=${customerInfo.gstin.toUpperCase()}`);
          const data = await res.json();
          if (data.success && data.data) {
            setCustomerInfo(prev => ({
              ...prev,
              name: prev.name || data.data.businessName,
              address: prev.address || data.data.address,
              city: prev.city || data.data.city,
              state: data.data.state || prev.state,
              pincode: prev.pincode || data.data.pincode
            }));
            toast({ title: 'GST Details Auto-filled', description: 'Address and name pre-filled from your GSTIN.' });
          } else if (!data.success && data.error) {
            setGstError(data.error);
          }
        } catch (error) {
          console.error(error);
        } finally {
          setIsFetchingGst(false);
        }
      };
      
      timeoutId = setTimeout(fetchGstDetails, 600);
    } else {
      setGstError('');
    }
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [customerInfo.gstin, toast]);

  useEffect(() => {
    if (!quoteId) return;
    setLoadingQuote(true);
    fetch(`/api/quotes/${quoteId}`)
      .then(res => {
        if (!res.ok) throw new Error('Quote not found');
        return res.json();
      })
      .then(data => {
        setQuote(data);
        setCustomerInfo(prev => ({
          ...prev,
          name: data.customer_name || prev.name,
          email: data.customer_email || prev.email,
          phone: data.customer_phone || prev.phone,
          address: data.customer_address || prev.address,
        }));
        setLoadingQuote(false);
      })
      .catch(err => {
        console.error(err);
        toast({ title: 'Error', description: 'Failed to load quote details.', variant: 'destructive' });
        setLoadingQuote(false);
      });
  }, [quoteId, toast]);
  
  const [orderType, setOrderType] = useState<OrderType>('Delivery');
  const [selectedPickupStoreId, setSelectedPickupStoreId] = useState<string>('tecbunny-store-parcem');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');
  const [orderError, setOrderError] = useState<string>('');
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    pincode: ''
  });
  const selectedPickupStore = pickupStores.find(store => store.id === selectedPickupStoreId) || pickupStores[0];

  const serviceOnlyCart = React.useMemo(() => {
    if (!cartItems.length) return false;
    return cartItems.every(item => item.product_type === 'service' || item.id.startsWith('service-'));
  }, [cartItems]);

  const hasServiceItem = React.useMemo(() => {
    if (!cartItems.length) return false;
    return cartItems.some(item => 
      item.product_type === 'service' || 
      item.id?.startsWith('service-') || 
      item.id?.startsWith('pricing-')
    );
  }, [cartItems]);

  useEffect(() => {
    void refreshPricing();
  }, [refreshPricing]);

  // Pre-fill user information when user data is available
  useEffect(() => {
    if (user) {
      setCustomerInfo(prev => ({
        ...prev,
        name: user.name || '',
        email: user.email || '',
        phone: user.mobile || '',
        address: user.address || '',
        // Keep existing values for city, pincode, state, notes if user doesn't have them
      }));
    }
  }, [user]);

  // Auto-select first available payment method
  useEffect(() => {
    if (paymentLoading) {
      return;
    }

    const enabledMethods = getEnabledPaymentMethods();
    if (enabledMethods.length === 0) {
      if (selectedPaymentMethod) {
        setSelectedPaymentMethod('');
      }
      return;
    }

    const selectedStillAvailable = enabledMethods.some(method => method.id === selectedPaymentMethod);
    if (!selectedStillAvailable) {
      setSelectedPaymentMethod(enabledMethods[0].id);
    }
  }, [paymentLoading, selectedPaymentMethod, getEnabledPaymentMethods]);

  // Clear error when payment method changes
  useEffect(() => {
    if (orderError && selectedPaymentMethod) {
      setOrderError('');
    }
  }, [selectedPaymentMethod, orderError]);

  useEffect(() => {
    if (orderType === 'Pickup' && !selectedPickupStore && PICKUP_STORES.length > 0) {
      setSelectedPickupStoreId(PICKUP_STORES[0].id);
    }
  }, [orderType, selectedPickupStore]);

  useEffect(() => {
    if (hasServiceItem && orderType !== 'Delivery') {
      setOrderType('Delivery');
    }
  }, [hasServiceItem, orderType]);

  const validateField = (field: string, value: string) => {
    let error = '';
    if (field === 'name') {
      if (!value.trim()) {
        error = 'Name is required';
      } else if (value.trim().length < 3) {
        error = 'Name must be at least 3 characters';
      }
    } else if (field === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!value.trim()) {
        error = 'Email is required';
      } else if (!emailRegex.test(value.trim())) {
        error = 'Invalid email format';
      }
    } else if (field === 'phone') {
      const cleanPhone = value.replace(/[^\d]/g, '');
      if (!value.trim()) {
        error = 'Phone number is required';
      } else if (cleanPhone.length < 10 || cleanPhone.length > 12) {
        error = 'Phone must be a valid 10-12 digit number';
      }
    } else if (field === 'pincode' && orderType === 'Delivery') {
      if (!value.trim()) {
        error = 'Pincode is required';
      } else if (!/^\d{6}$/.test(value.trim())) {
        error = 'Pincode must be exactly 6 digits';
      }
    } else if (field === 'address' && orderType === 'Delivery') {
      if (!value.trim()) {
        error = 'Address is required';
      } else if (value.trim().length < 10) {
        error = 'Please provide a more complete address';
      }
    } else if (field === 'city' && orderType === 'Delivery') {
      if (!value.trim()) {
        error = 'City is required';
      }
    } else if (field === 'state' && orderType === 'Delivery') {
      if (!value.trim()) {
        error = 'State is required';
      } else if (!resolveIndianStateInfo(value)) {
        error = 'Enter a valid Indian state or union territory';
      }
    }

    setFieldErrors(prev => ({
      ...prev,
      [field]: error
    }));

    return !error;
  };

  const handleInputChange = (field: string, value: string) => {
    setCustomerInfo(prev => ({
      ...prev,
      [field]: value
    }));
    if (fieldErrors[field]) {
      setFieldErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const handleInputBlur = (field: string, value: string) => {
    void validateField(field, value);
  };

  const handlePincodeChange = async (pincode: string) => {
    handleInputChange('pincode', pincode);
    
    if (pincode.length === 6 && /^\d+$/.test(pincode)) {
      try {
        const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
        const data = await res.json();
        if (data?.[0]?.Status === 'Success' && data[0].PostOffice) {
          const postOffice = data[0].PostOffice[0];
          setCustomerInfo(prev => ({
            ...prev,
            city: postOffice.District || prev.city,
            state: postOffice.State || prev.state
          }));
          setFieldErrors(prev => ({
            ...prev,
            city: '',
            state: '',
            pincode: ''
          }));
        }
      } catch (e) {
        logger.warn('Pincode API lookup failed', { pincode, error: e });
      }
    } else if (pincode.length > 0 && !/^\d{0,6}$/.test(pincode)) {
      setFieldErrors(prev => ({
        ...prev,
        pincode: 'Pincode must contain numeric digits only'
      }));
    }
  };

  const fallbackTotals = React.useMemo(() => {
    if (!cartItems.length) {
      return { subtotal: 0, gstAmount: 0, total: 0 };
    }

    const subtotalValue = cartItems.reduce((totalValue, item) => {
      const price = item.price;
      const gstRate = item.gstRate || 18;
      const basePrice = price / (1 + (gstRate / 100));
      return totalValue + basePrice * item.quantity;
    }, 0);

    const gstAmountValue = cartItems.reduce((totalValue, item) => {
      const price = item.price;
      const gstRate = item.gstRate || 18;
      const basePrice = price / (1 + (gstRate / 100));
      const gst = basePrice * (gstRate / 100);
      return totalValue + gst * item.quantity;
    }, 0);

    return {
      subtotal: Math.round(subtotalValue * 100) / 100,
      gstAmount: Math.round(gstAmountValue * 100) / 100,
      total: Math.round((subtotalValue + gstAmountValue) * 100) / 100,
    };
  }, [cartItems]);

  const {
    subtotal: pricingSubtotal,
    gstAmount: pricingGstAmount,
    finalTotal: pricingFinalTotal,
    autoOffer,
    autoOfferDiscount,
    appliedCoupon,
    couponDiscount,
    totalDiscount,
  } = pricing;

  const displayItems = React.useMemo(() => {
    if (quote) {
      return (quote.selections?.items || []).map((item: any, idx: number) => ({
        id: item.id || `quote-item-${idx}`,
        name: item.description || item.name,
        price: item.sale,
        quantity: item.quantity || 1,
        gstRate: item.gstRate || 18,
      }));
    }
    return cartItems;
  }, [quote, cartItems]);

  const displaySubtotal = React.useMemo(() => {
    if (quote) {
      const qTotal = quote.counter_price || quote.bidded_price || quote.selections?.totals?.sale || 0;
      return quote.selections?.totals?.subtotal || (quote.gst_included ? qTotal / 1.18 : qTotal);
    }
    return cartItems.length
      ? (pricingSubtotal || cartSubtotal || fallbackTotals.subtotal)
      : 0;
  }, [quote, cartItems.length, pricingSubtotal, cartSubtotal, fallbackTotals.subtotal]);

  const displayGstAmount = React.useMemo(() => {
    if (quote) {
      const qTotal = quote.counter_price || quote.bidded_price || quote.selections?.totals?.sale || 0;
      const qSubtotal = quote.selections?.totals?.subtotal || (quote.gst_included ? qTotal / 1.18 : qTotal);
      return quote.selections?.totals?.gst || (qTotal - qSubtotal);
    }
    return cartItems.length
      ? (typeof pricingGstAmount === 'number' && pricingGstAmount > 0
          ? pricingGstAmount
          : cartGst || fallbackTotals.gstAmount)
      : 0;
  }, [quote, cartItems.length, pricingGstAmount, cartGst, fallbackTotals.gstAmount]);

  const displayTotal = React.useMemo(() => {
    if (quote) {
      return quote.counter_price || quote.bidded_price || quote.selections?.totals?.sale || quote.selections?.totals?.overall?.sale || 0;
    }
    return cartItems.length
      ? (
          typeof pricingFinalTotal === 'number' && pricingFinalTotal >= 0
            ? pricingFinalTotal
            : Math.max(0, (pricingSubtotal || cartSubtotal || fallbackTotals.subtotal) + (typeof pricingGstAmount === 'number' && pricingGstAmount > 0 ? pricingGstAmount : cartGst || fallbackTotals.gstAmount) - (totalDiscount || 0))
        )
      : 0;
  }, [quote, cartItems.length, pricingFinalTotal, pricingSubtotal, cartSubtotal, fallbackTotals.subtotal, pricingGstAmount, cartGst, totalDiscount]);

  const handlePlaceOrder = async () => {
    try {
      setOrderError('');

      // Guest checkout is supported; sign in only if you want to save order history.
      // Run field validation
      let isValid = true;
      const fieldsToValidate = ['name', 'email', 'phone'];
      if (orderType === 'Delivery') {
        fieldsToValidate.push('address', 'city', 'pincode', 'state');
      }
      
      fieldsToValidate.forEach(field => {
        const value = customerInfo[field as keyof typeof customerInfo] || '';
        if (!validateField(field, value)) {
          isValid = false;
        }
      });

      if (!isValid) {
        setOrderError('Please correct the validation errors in the form.');
        return;
      }

      if (hasServiceItem && orderType === 'Pickup') {
        setOrderError('Service requests cannot be scheduled for store pickup. Please choose delivery.');
        setOrderType('Delivery');
        return;
      }

      if (!selectedPaymentMethod) {
        setOrderError('Please select a payment method');
        return;
      }

      if (!privacyAccepted) {
        setOrderError('Please accept the Privacy Policy and Terms to continue.');
        return;
      }

      const pickupAddress = selectedPickupStore ? selectedPickupStore.address : '';
      const destinationState = orderType === 'Delivery'
        ? resolveIndianStateInfo(customerInfo.state)
        : TECBUNNY_REGISTERED_STATE;

      // Convert display items to order items format
      const orderItems = displayItems.map((item: any) => ({
        productId: item.id,
        quantity: item.quantity,
        price: item.price,
        gstRate: item.gstRate || 18,
        hsnCode: item.hsnCode,
        name: item.name,
        serialNumbers: item.serialNumbers || []
      }));

      const paymentMethod = selectedPaymentMethod.toLowerCase();
      const initialStatus: OrderStatus = paymentMethod === 'upi' ? 'Awaiting Payment' : 'Pending';
      const initialPaymentStatus = (() => {
        if (paymentMethod === 'upi') {
          return 'Payment Confirmation Pending';
        }
        if (paymentMethod === 'cod') {
          return 'Payment Due on Delivery';
        }
        return 'Awaiting Payment';
      })();

      const appendedNotes = [
        customerInfo.notes?.trim(),
        customerInfo.installDate ? `Preferred install date: ${customerInfo.installDate}` : '',
        customerInfo.siteStatus ? `Site status: ${customerInfo.siteStatus}` : '',
        customerInfo.gstin ? `GSTIN: ${customerInfo.gstin}` : ''
      ].filter(Boolean).join(' | ');

      const orderData = {
        customer_name: customerInfo.name,
        customer_email: customerInfo.email,
        customer_phone: customerInfo.phone,
        type: hasServiceItem ? 'Delivery' : orderType,
        delivery_address: orderType === 'Delivery' ? 
          `${customerInfo.address}, ${customerInfo.city}, ${customerInfo.state} - ${customerInfo.pincode}` : 
          pickupAddress || undefined,
        pickup_store: orderType === 'Pickup' && !hasServiceItem ? pickupAddress : undefined,
        customer_state: destinationState?.name || customerInfo.state,
        customer_state_code: destinationState?.code,
        place_of_supply: formatPlaceOfSupply(destinationState, customerInfo.state),
        place_of_supply_state_code: destinationState?.code,
        seller_state_code: TECBUNNY_REGISTERED_STATE.code,
        notes: appendedNotes,
        status: initialStatus,
        payment_method: paymentMethod,
        payment_status: initialPaymentStatus,
        subtotal: displaySubtotal,
        gst_amount: displayGstAmount,
        total: displayTotal,
        discount_amount: totalDiscount,
        coupon_code: appliedCoupon?.code || undefined,
        items: orderItems,
        part_payment_amount: isPartPayment ? Number(partPaymentAmount) : null,
        quote_id: quote?.id || null
      };

      let order = await createOrder(orderData);
      
      // If OrderProvider fails, try API endpoint as fallback
      if (!order) {
        try {
          const response = await fetch('/api/orders', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(orderData),
          });

          const data = await response.json();
          
          if (response.ok && data.success) {
            order = data.order;
          } else {
            logger.error('API order creation failed', { error: data.error, orderData });
          }
        } catch (apiError) {
          logger.error('API request failed', { error: apiError, orderData });
        }
      }
      
      if (order) {
        // Handle different payment methods
        if (selectedPaymentMethod === 'cod') {
          // Redirect to order confirmation page for COD
          window.location.href = `/orders/${order.id}`;
        } else if (selectedPaymentMethod === 'upi') {
          // Show UPI QR code or redirect to UPI payment
          window.location.href = `/payment/upi/${order.id}`;
        } else if (selectedPaymentMethod === 'payu') {
          window.location.href = `/payment/payu/${order.id}`;
        } else {
          // Redirect to other online payment gateway
          window.location.href = `/payment/${selectedPaymentMethod}/${order.id}`;
        }
      } else {
        setOrderError('Failed to create order. Please try again.');
      }
    } catch (error) {
      logger.error('Checkout order creation failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      setOrderError('An error occurred while creating your order. Please try again.');
    }
  };

  const selectedMethod = getEnabledPaymentMethods().find(method => method.id === selectedPaymentMethod);
  const showAdvance = selectedMethod?.type === 'online' || selectedPaymentMethod === 'upi' || selectedPaymentMethod === 'payu';
  const advanceAmount = Math.round(displayTotal * 0.5 * 100) / 100;

  if (authLoading || loadingQuote) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="text-muted-foreground">Loading checkout details...</div>
      </div>
    );
  }

  // Show empty cart message if no items
  if (!quote && cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-background py-16 text-foreground">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mb-4 border border-border">
            <ShoppingCart className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-bold tech-heading mb-2">Your Cart is Empty</h2>
          <p className="text-muted-foreground mb-6">Add some products to your cart before checkout.</p>
          <Button onClick={() => window.location.href = '/products'} className="bg-primary text-white hover:bg-primary/90 font-semibold font-medium">
            Continue Shopping
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20 selection:text-foreground">
      <section className="pt-32 pb-24 relative">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f2937_1px,transparent_1px),linear-gradient(to_bottom,#1f2937_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-[0.15] pointer-events-none"></div>

        <div className="max-w-6xl mx-auto px-6 relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground font-sans tech-heading">Checkout</h1>
              <p className="text-sm text-muted-foreground mt-1">Review your details and complete your purchase.</p>
            </div>
            <button
              type="button"
              onClick={() => window.location.href = '/cart'}
              className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors self-start md:self-auto"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Cart
            </button>
          </div>

          <div className="hidden md:flex justify-center mb-16">
            <div className="flex items-center gap-4 text-[10px] tracking-wider uppercase font-semibold text-muted-foreground">
              <span className="text-muted-foreground">01 Cart</span>
              <span className="text-border">/</span>
              <span className="text-foreground border-b border-foreground pb-0.5 font-bold">02 Details</span>
              <span className="text-border">/</span>
              <span className="text-muted-foreground/50">03 Done</span>
            </div>
          </div>

          <form
            className="grid grid-cols-1 lg:grid-cols-3 gap-10 items-start"
            onSubmit={(event) => {
              event.preventDefault();
              void handlePlaceOrder();
            }}
          >
            <div className="lg:col-span-2 space-y-8">
              <div className="bento-card p-8 space-y-6">
                <div className="flex items-center gap-3 pb-2 border-b border-border">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-bold text-foreground uppercase tracking-wider font-sans tech-heading">Contact & Billing</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="name" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Full Name</label>
                    <input
                      type="text"
                      id="name"
                      required
                      value={customerInfo.name}
                      onChange={(event) => handleInputChange('name', event.target.value)}
                      onBlur={(event) => handleInputBlur('name', event.target.value)}
                      className={`w-full bg-muted/10 border rounded-lg px-4 py-3 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/50 ${fieldErrors.name ? 'border-red-500/80 focus:ring-2 focus:ring-red-500/20 focus:border-red-500' : 'border-border focus:ring-2 focus:ring-primary/20 focus:border-primary'}`}
                      placeholder="John Doe"
                    />
                    {fieldErrors.name && (
                      <span className="text-[10px] text-red-400 mt-1 block pl-1">{fieldErrors.name}</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="phone" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Phone Number</label>
                    <input
                      type="tel"
                      id="phone"
                      required
                      value={customerInfo.phone}
                      onChange={(event) => handleInputChange('phone', event.target.value)}
                      onBlur={(event) => handleInputBlur('phone', event.target.value)}
                      className={`w-full bg-muted/10 border rounded-lg px-4 py-3 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/50 ${fieldErrors.phone ? 'border-red-500/80 focus:ring-2 focus:ring-red-500/20 focus:border-red-500' : 'border-border focus:ring-2 focus:ring-primary/20 focus:border-primary'}`}
                      placeholder="e.g. 9876543210"
                    />
                    {fieldErrors.phone && (
                      <span className="text-[10px] text-red-400 mt-1 block pl-1">{fieldErrors.phone}</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="email" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Email Address</label>
                    <input
                      type="email"
                      id="email"
                      required
                      value={customerInfo.email}
                      onChange={(event) => handleInputChange('email', event.target.value)}
                      onBlur={(event) => handleInputBlur('email', event.target.value)}
                      className={`w-full bg-muted/10 border rounded-lg px-4 py-3 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/50 ${fieldErrors.email ? 'border-red-500/80 focus:ring-2 focus:ring-red-500/20 focus:border-red-500' : 'border-border focus:ring-2 focus:ring-primary/20 focus:border-primary'}`}
                      placeholder="john@example.com"
                    />
                    {fieldErrors.email && (
                      <span className="text-[10px] text-red-400 mt-1 block pl-1">{fieldErrors.email}</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <label htmlFor="gstin" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">GSTIN (Optional)</label>
                      {isFetchingGst && <span className="h-3 w-3 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>}
                    </div>
                    <input
                      type="text"
                      id="gstin"
                      maxLength={15}
                      value={customerInfo.gstin}
                      onChange={(event) => handleInputChange('gstin', event.target.value.toUpperCase())}
                      className={`w-full bg-muted/10 border rounded-lg px-4 py-3 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/50 ${gstError ? 'border-red-500/80 focus:ring-2 focus:ring-red-500/20 focus:border-red-500' : 'border-border focus:ring-2 focus:ring-primary/20 focus:border-primary'}`}
                      placeholder="15-character GSTIN"
                    />
                    {gstError && (
                      <span className="text-[10px] text-red-400 mt-1 block pl-1">{gstError}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="bento-card p-8 space-y-6">
                <div className="flex items-center gap-3 pb-2 border-b border-border">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-bold text-foreground uppercase tracking-wider font-sans tech-heading">
                    {hasServiceItem ? 'Installation / Service Address' : (!!quote ? 'Delivery & Installation' : 'Delivery Address')}
                  </h2>
                </div>
                <div className="space-y-6">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="address" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {hasServiceItem ? 'Installation / Service Address' : (!!quote ? 'Installation Address (Goa)' : 'Complete Delivery Address')}
                    </label>
                    <textarea
                      id="address"
                      rows={3}
                      required={orderType === 'Delivery'}
                      value={customerInfo.address}
                      onChange={(event) => handleInputChange('address', event.target.value)}
                      onBlur={(event) => handleInputBlur('address', event.target.value)}
                      className={`w-full bg-muted/10 border rounded-lg px-4 py-3 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/50 ${fieldErrors.address ? 'border-red-500/80 focus:ring-2 focus:ring-red-500/20 focus:border-red-500' : 'border-border focus:ring-2 focus:ring-primary/20 focus:border-primary'}`}
                      placeholder="Apartment, suite, unit, building, street address"
                    ></textarea>
                    {fieldErrors.address && (
                      <span className="text-[10px] text-red-400 mt-1 block pl-1">{fieldErrors.address}</span>
                    )}
                  </div>

                  {!!quote && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="flex flex-col gap-1.5">
                        <label htmlFor="date" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Preferred Install Date</label>
                        <input
                           type="date"
                           id="date"
                           value={customerInfo.installDate}
                           onChange={(event) => handleInputChange('installDate', event.target.value)}
                           className="w-full bg-muted/10 border border-border rounded-lg px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-muted-foreground/50"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label htmlFor="readiness" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Site Status</label>
                        <div className="relative">
                          <select
                            id="readiness"
                            value={customerInfo.siteStatus}
                            onChange={(event) => handleInputChange('siteStatus', event.target.value)}
                            className="w-full bg-muted/10 border border-border rounded-lg px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all appearance-none pr-10"
                          >
                            <option value="" className="bg-card text-foreground">Select Status</option>
                            <option value="ready" className="bg-card text-foreground">Site Ready (Plaster/Paint Done)</option>
                            <option value="construction" className="bg-card text-foreground">Under Construction (Cabling Phase)</option>
                            <option value="renovation" className="bg-card text-foreground">Renovation (Retrofit)</option>
                          </select>
                          <ChevronDown className="absolute right-4 top-3.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="city" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">City</label>
                      <input
                        type="text"
                        id="city"
                        required={orderType === 'Delivery'}
                        value={customerInfo.city}
                        onChange={(event) => handleInputChange('city', event.target.value)}
                        onBlur={(event) => handleInputBlur('city', event.target.value)}
                        className={`w-full bg-muted/10 border rounded-lg px-4 py-3 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/50 ${fieldErrors.city ? 'border-red-500/80 focus:ring-2 focus:ring-red-500/20 focus:border-red-500' : 'border-border focus:ring-2 focus:ring-primary/20 focus:border-primary'}`}
                        placeholder="Panaji"
                      />
                      {fieldErrors.city && (
                        <span className="text-[10px] text-red-400 mt-1 block pl-1">{fieldErrors.city}</span>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="state" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">State</label>
                      <input
                        type="text"
                        id="state"
                        required={orderType === 'Delivery'}
                        value={customerInfo.state}
                        onChange={(event) => handleInputChange('state', event.target.value)}
                        onBlur={(event) => handleInputBlur('state', event.target.value)}
                        className={`w-full bg-muted/10 border rounded-lg px-4 py-3 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/50 ${fieldErrors.state ? 'border-red-500/80 focus:ring-2 focus:ring-red-500/20 focus:border-red-500' : 'border-border focus:ring-2 focus:ring-primary/20 focus:border-primary'}`}
                        placeholder="Goa"
                      />
                      {fieldErrors.state && (
                        <span className="text-[10px] text-red-400 mt-1 block pl-1">{fieldErrors.state}</span>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="pincode" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pincode</label>
                      <input
                        type="text"
                        id="pincode"
                        required={orderType === 'Delivery'}
                        value={customerInfo.pincode}
                        onChange={(event) => handlePincodeChange(event.target.value)}
                        onBlur={(event) => handleInputBlur('pincode', event.target.value)}
                        className={`w-full bg-muted/10 border rounded-lg px-4 py-3 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/50 ${fieldErrors.pincode ? 'border-red-500/80 focus:ring-2 focus:ring-red-500/20 focus:border-red-500' : 'border-border focus:ring-2 focus:ring-primary/20 focus:border-primary'}`}
                        placeholder="6-digit PIN"
                      />
                      {fieldErrors.pincode && (
                        <span className="text-[10px] text-red-400 mt-1 block pl-1">{fieldErrors.pincode}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-medium">
                    <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                    All hardware orders are eligible for secure shipping.
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="notes" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Order Notes (Optional)</label>
                    <textarea
                      id="notes"
                      rows={2}
                      value={customerInfo.notes}
                      onChange={(event) => handleInputChange('notes', event.target.value)}
                      className="w-full bg-muted/10 border border-border rounded-lg px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-muted-foreground/50"
                      placeholder="Delivery instructions, landmarks, etc."
                    ></textarea>
                  </div>
                </div>
              </div>

              <div className="bento-card p-8 space-y-6">
                <div className="flex items-center gap-3 pb-2 border-b border-border">
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-bold text-foreground uppercase tracking-wider font-sans tech-heading">Payment Method</h2>
                </div>
                <div className="space-y-4">
                  {paymentLoading && (
                    <div className="space-y-4 min-h-[220px]">
                      {Array.from({ length: 3 }).map((_, index) => (
                        <div key={index} className="h-16 w-full animate-pulse rounded-xl border border-border bg-muted/20"></div>
                      ))}
                    </div>
                  )}
                  {!paymentLoading && getEnabledPaymentMethods().length === 0 && (
                    <div className="text-muted-foreground text-sm text-center py-6">No payment methods available. Please contact support.</div>
                  )}
                  {!paymentLoading && getEnabledPaymentMethods().map((method) => {
                    const getPaymentIcon = (methodId: string) => {
                      switch (methodId) {
                        case 'cod':
                          return <Banknote className="h-5 w-5" />;
                        case 'upi':
                          return <QrCode className="h-5 w-5" />;
                        case 'payu':
                          return <CreditCard className="h-5 w-5" />;
                        default:
                          return <Wallet className="h-5 w-5" />;
                      }
                    };

                     return (
                      <label key={method.id} className="cursor-pointer block relative group">
                        <input
                          type="radio"
                          name="payment"
                          value={method.id}
                          checked={selectedPaymentMethod === method.id}
                          onChange={() => setSelectedPaymentMethod(method.id)}
                          className="hidden"
                        />
                        <div className={`border rounded-xl p-5 flex items-center gap-4 transition-all ${
                          selectedPaymentMethod === method.id
                            ? 'border-primary bg-primary/10 shadow-sm shadow-primary/5'
                            : 'border-border bg-muted/10 hover:bg-muted/30 hover:border-border/70'
                        }`}>
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                            selectedPaymentMethod === method.id
                              ? 'border-primary bg-primary'
                              : 'border-muted-foreground/60 bg-transparent group-hover:border-foreground'
                          }`}>
                            {selectedPaymentMethod === method.id && (
                              <div className="w-1.5 h-1.5 rounded-full bg-white" />
                            )}
                          </div>
                          <div className="flex-1">
                            <span className="block text-sm font-semibold text-foreground">{method.name}</span>
                            <span className="text-xs text-muted-foreground mt-1 block">
                              {method.type === 'online'
                                ? 'Pay online securely'
                                : method.id === 'cod'
                                  ? 'Pay when your order is delivered'
                                  : method.id === 'upi'
                                    ? 'Pay using UPI apps'
                                    : 'Offline payment'}
                            </span>
                          </div>
                          <div className={`transition-colors ${selectedPaymentMethod === method.id ? 'text-primary' : 'text-muted-foreground'}`}>
                            {getPaymentIcon(method.id)}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>

                {/* Trust Badges & Compliance */}
                <div className="mt-10 pt-8 border-t border-border grid grid-cols-2 sm:grid-cols-4 gap-6">
                  <div className="flex flex-col items-center text-center gap-2.5">
                    <Shield className="h-5 w-5 text-muted-foreground" />
                    <span className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider leading-snug">BIS Certified Hardware</span>
                  </div>
                  <div className="flex flex-col items-center text-center gap-2.5">
                    <CheckCircle className="h-5 w-5 text-muted-foreground" />
                    <span className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider leading-snug">Regional Tech Compliance</span>
                  </div>
                  <div className="flex flex-col items-center text-center gap-2.5">
                    <CreditCard className="h-5 w-5 text-muted-foreground" />
                    <span className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider leading-snug">Secure UPI / Cards</span>
                  </div>
                  <div className="flex flex-col items-center text-center gap-2.5">
                    <User className="h-5 w-5 text-muted-foreground" />
                    <span className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider leading-snug">Verified Installer Network</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-1">
              <div className="sticky top-28 space-y-6">
                <div className="bento-card p-8 space-y-6">
                  <h3 className="text-sm font-bold text-foreground uppercase tracking-wider font-sans pb-2 border-b border-border tech-heading">Summary</h3>

                  <div className="space-y-4 my-2 max-h-60 overflow-y-auto pr-2 divide-y divide-border">
                    {displayItems.map((item: any) => (
                      <div key={item.id} className="flex justify-between text-xs py-3 first:pt-0">
                        <span className="text-muted-foreground font-medium">{item.name} × {item.quantity}</span>
                        <span className="text-foreground font-semibold tabular-nums ml-4">₹{(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-border pt-5 space-y-3">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="text-foreground font-medium tabular-nums">₹{displaySubtotal.toFixed(2)}</span>
                    </div>
                    {totalDiscount > 0 && (
                      <div className="flex justify-between text-xs text-emerald-600 dark:text-emerald-400">
                        <span>Discount</span>
                        <span className="tabular-nums">-₹{totalDiscount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">GST (Estimated)</span>
                      <span className="text-foreground font-medium tabular-nums">₹{displayGstAmount.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="border-t border-border pt-5">
                    <div className="flex justify-between items-baseline mb-6">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total</span>
                      <span className="text-2xl font-bold text-foreground tabular-nums tech-heading">₹{displayTotal.toFixed(2)}</span>
                    </div>

                    {/* Custom Part Payment Options */}
                    {!!quote && (
                      <div className="mt-4 p-4 bg-muted/10 border border-border rounded-xl space-y-3.5">
                        <label className="flex items-center gap-2.5 text-xs text-foreground cursor-pointer font-medium">
                          <input
                            type="checkbox"
                            checked={isPartPayment}
                            onChange={(e) => {
                              setIsPartPayment(e.target.checked);
                              if (e.target.checked) {
                                setPartPaymentAmount(String(Math.round(displayTotal * 0.5))); // default to 50%
                              } else {
                                setPartPaymentAmount('');
                              }
                            }}
                            className="h-3.5 w-3.5 rounded border-border bg-background text-foreground focus:ring-primary/20"
                          />
                          Pay Custom Part Amount
                        </label>
                        {isPartPayment && (
                          <div className="space-y-1.5 animate-fade-in">
                            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Amount (₹)</label>
                            <input
                              type="number"
                              min={1}
                              max={displayTotal}
                              required
                              placeholder="Enter amount"
                              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/50"
                              value={partPaymentAmount}
                              onChange={(e) => setPartPaymentAmount(e.target.value)}
                            />
                            <p className="text-[10px] text-muted-foreground leading-normal">
                              Remaining balance of ₹{Math.round(displayTotal - (Number(partPaymentAmount) || 0)).toLocaleString()} will be due later.
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {!!quote && showAdvance && !isPartPayment && (
                      <div className="mt-3 bg-muted/10 border border-border rounded-xl p-3 text-[10px] font-semibold text-muted-foreground text-center tracking-wide uppercase">
                        Advance Payable (50%): <span className="text-foreground font-bold ml-1">₹{advanceAmount.toFixed(2)}</span>
                      </div>
                    )}
                  </div>

                  {autoOffer && autoOfferDiscount > 0 && autoOffer.description && (
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-xs text-emerald-650 dark:text-emerald-300 leading-relaxed mb-4">
                      <div className="flex items-center justify-between font-semibold">
                        <span className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-emerald-500" /> {autoOffer.title}
                        </span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                          -₹{autoOfferDiscount.toFixed(2)}
                        </span>
                      </div>
                      <p className="mt-1.5 text-emerald-600/80 dark:text-emerald-400/70 text-[11px]">{autoOffer.description}</p>
                    </div>
                  )}

                  {appliedCoupon && couponDiscount > 0 && (
                    <div className="rounded-xl border border-border bg-muted/10 p-4 text-xs text-foreground mb-4 flex items-center justify-between">
                      <span className="flex items-center gap-2 font-medium">
                        <Tag className="h-3.5 w-3.5 text-primary" /> {appliedCoupon.code}
                      </span>
                      <button type="button" className="text-xs text-primary hover:text-primary/80 underline animate-fade-in" onClick={removeCoupon}>Remove</button>
                    </div>
                  )}

                  {orderError && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-4">
                      <p className="text-red-650 dark:text-red-400 text-xs font-semibold leading-normal">{orderError}</p>
                    </div>
                  )}

                  <div className="mb-6 flex items-start gap-3 rounded-xl border border-border bg-muted/10 p-4">
                    <input
                      id="checkout-privacy-consent"
                      type="checkbox"
                      checked={privacyAccepted}
                      onChange={(event) => setPrivacyAccepted(event.target.checked)}
                      className="mt-0.5 h-3.5 w-3.5 rounded border-border bg-background text-foreground focus:ring-primary/20"
                    />
                    <label htmlFor="checkout-privacy-consent" className="text-[11px] text-muted-foreground leading-normal">
                      I have read and agree to the{' '}
                      <Link href="/info/policies/privacy" className="text-primary hover:underline">Privacy Policy</Link>
                      {' '}and{' '}
                      <Link href="/info/policies/terms" className="text-primary hover:underline">Terms of Service</Link>.
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={isProcessingOrder || !selectedPaymentMethod || paymentLoading || !privacyAccepted}
                    className="w-full py-4 bg-primary hover:bg-primary/95 text-white font-bold text-sm tracking-wider uppercase rounded-xl transition-all shadow-md flex items-center justify-center gap-2 disabled:bg-muted/40 disabled:text-muted-foreground/50 disabled:opacity-40 disabled:cursor-not-allowed font-medium"
                  >
                    {isProcessingOrder ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 rounded-full border-2 border-white border-b-transparent animate-spin"></span>
                        Processing...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        Confirm Purchase <CheckCircle className="h-4 w-4" />
                      </span>
                    )}
                  </button>

                  <p className="mt-4 text-[10px] text-muted-foreground text-center leading-normal">
                    By placing this order, you agree to our Terms & Conditions.
                  </p>
                </div>
              </div>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
