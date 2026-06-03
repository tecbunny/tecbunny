'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

import { ShoppingCart, CreditCard, MapPin, User, Wallet, Banknote, QrCode, Tag, Sparkles, ArrowLeft, CheckCircle, Shield, ChevronDown } from 'lucide-react';

import { useCart, useAuth } from '@/lib/hooks';
import { useOrder } from '../../context/OrderProvider';
import { usePaymentMethods } from '../../hooks/use-payment-methods';
import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { LoginDialog } from '@/components/auth/LoginDialog';
import { Badge } from '../ui/badge';
import type { OrderStatus, OrderType } from '@/lib/types';

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
  const pickupStores = PICKUP_STORES;
  
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
    if (serviceOnlyCart && orderType !== 'Delivery') {
      setOrderType('Delivery');
    }
  }, [serviceOnlyCart, orderType]);

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
    canCombineDiscounts,
  } = pricing;

  const displaySubtotal = cartItems.length
    ? (pricingSubtotal || cartSubtotal || fallbackTotals.subtotal)
    : 0;

  const displayGstAmount = cartItems.length
    ? (typeof pricingGstAmount === 'number' && pricingGstAmount > 0
        ? pricingGstAmount
        : cartGst || fallbackTotals.gstAmount)
    : 0;

  const displayTotalBeforeDiscounts = displaySubtotal + displayGstAmount;
  const displayTotal = cartItems.length
    ? (
        typeof pricingFinalTotal === 'number' && pricingFinalTotal >= 0
          ? pricingFinalTotal
          : Math.max(0, displayTotalBeforeDiscounts - (totalDiscount || 0))
      )
    : 0;

  const handlePlaceOrder = async () => {
    try {
      setOrderError('');

      if (!user) {
        setOrderError('Please log in to place an order.');
        return;
      }
      
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

      if (serviceOnlyCart && orderType === 'Pickup') {
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

      // Convert cart items to order items format
      const orderItems = cartItems.map(item => ({
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
        type: serviceOnlyCart ? 'Delivery' : orderType,
        delivery_address: orderType === 'Delivery' ? 
          `${customerInfo.address}, ${customerInfo.city}, ${customerInfo.state} - ${customerInfo.pincode}` : 
          pickupAddress || undefined,
        pickup_store: orderType === 'Pickup' && !serviceOnlyCart ? pickupAddress : undefined,
        notes: appendedNotes,
        status: initialStatus,
        payment_method: paymentMethod,
        payment_status: initialPaymentStatus,
        subtotal: displaySubtotal,
        gst_amount: displayGstAmount,
        total: displayTotal,
        discount_amount: totalDiscount,
        coupon_code: appliedCoupon?.code || undefined,
        items: orderItems
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

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#030712] text-slate-300">
        <div className="text-slate-400">Checking your account...</div>
      </div>
    );
  }

  // Show empty cart message if no items
  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-[#030712] py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
            <ShoppingCart className="h-8 w-8 text-slate-500" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Your Cart is Empty</h2>
          <p className="text-slate-400 mb-6">Add some products to your cart before checkout.</p>
          <Button onClick={() => window.location.href = '/products'} className="bg-cyan-400 hover:bg-white text-slate-900 font-semibold">
            Continue Shopping
          </Button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#030712] py-16">
        <div className="mx-auto max-w-3xl px-4">
          <div className="glass-panel rounded-2xl p-8 text-slate-200">
            <h2 className="text-2xl font-bold text-white mb-3">Login Required</h2>
            <p className="text-slate-400">
              Please sign in to place your order. Items in your cart will be waiting for you after login.
            </p>
            {cartCount > 0 && (
              <p className="text-sm text-slate-500 mt-3">
                You currently have {cartCount} {cartCount === 1 ? 'item' : 'items'} in your cart.
              </p>
            )}
            <div className="flex flex-col gap-3 sm:flex-row mt-6">
              <LoginDialog>
                <Button size="lg" className="w-full sm:w-auto bg-cyan-400 hover:bg-white text-slate-900">
                  Login to Continue
                </Button>
              </LoginDialog>
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-auto border-white/10 text-slate-200"
                onClick={() => {
                  window.location.href = '/auth/signup';
                }}
              >
                Create Account
              </Button>
            </div>
            <Button
              variant="ghost"
              className="mt-4 text-slate-400 hover:text-white"
              onClick={() => {
                window.location.href = '/';
              }}
            >
              Continue Shopping
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030712] text-slate-200 checkout-dark">
      <style jsx global>{`
        .checkout-dark input,
        .checkout-dark select,
        .checkout-dark textarea {
          color-scheme: dark;
        }
        .checkout-dark input:-webkit-autofill,
        .checkout-dark textarea:-webkit-autofill,
        .checkout-dark select:-webkit-autofill {
          -webkit-text-fill-color: #e2e8f0;
          box-shadow: 0 0 0px 1000px #0f172a inset;
          caret-color: #e2e8f0;
        }
        .checkout-dark input::placeholder,
        .checkout-dark textarea::placeholder {
          color: #94a3b8;
        }
        .glass-panel {
          background: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.05);
        }
        .magnetic-btn { transition: transform 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94); }
        .input-group input:focus ~ label,
        .input-group input:not(:placeholder-shown) ~ label,
        .input-group select:focus ~ label,
        .input-group select:not(:placeholder-shown) ~ label,
        .input-group textarea:focus ~ label,
        .input-group textarea:not(:placeholder-shown) ~ label {
          top: -0.6rem;
          left: 0.75rem;
          font-size: 0.75rem;
          color: #06b6d4;
          background-color: #0f172a;
          padding: 0 0.25rem;
        }
        .radio-card input:checked + div {
          border-color: #06b6d4;
          background-color: rgba(6, 182, 212, 0.05);
        }
        .radio-card input:checked + div .radio-circle {
          border-color: #06b6d4;
          background-color: #06b6d4;
          box-shadow: 0 0 10px rgba(6, 182, 212, 0.5);
        }
      `}</style>

      <section className="pt-28 pb-16 relative">
        <div className="fixed inset-0 bg-[url('/noise.svg')] opacity-5 pointer-events-none"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-white font-tech">Finalize Transmission</h1>
              <p className="text-sm text-slate-400">Securely verify details and confirm your order.</p>
            </div>
            <button
              type="button"
              onClick={() => window.location.href = '/cart'}
              className="magnetic-btn hidden md:flex items-center gap-2 px-6 py-2.5 rounded-lg border border-white/10 hover:bg-white/5 transition-all text-sm font-bold text-slate-400 hover:text-white"
            >
              <ArrowLeft className="h-3 w-3" /> Back
            </button>
          </div>

          <div className="hidden md:flex justify-center mb-10">
            <div className="flex items-center gap-1 p-1.5 rounded-full bg-white/5 border border-white/5 backdrop-blur-md shadow-lg">
              <div className="flex items-center gap-2 px-4 py-2">
                <span className="w-6 h-6 rounded-full bg-cyan-400 text-slate-900 flex items-center justify-center text-xs font-bold">1</span>
                <span className="text-xs text-cyan-300 font-bold">Cart</span>
              </div>
              <div className="w-8 h-px bg-white/10"></div>
              <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full border border-cyan-400/30">
                <span className="w-6 h-6 rounded-full bg-cyan-400 text-slate-900 flex items-center justify-center text-xs font-bold">2</span>
                <span className="text-xs text-white font-bold">Details</span>
              </div>
              <div className="w-8 h-px bg-white/10"></div>
              <div className="flex items-center gap-2 px-4 py-2 opacity-50">
                <span className="w-6 h-6 rounded-full border border-white/20 flex items-center justify-center text-xs font-bold">3</span>
                <span className="text-xs text-slate-400">Done</span>
              </div>
            </div>
          </div>

          <form
            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
            onSubmit={(event) => {
              event.preventDefault();
              void handlePlaceOrder();
            }}
          >
            <div className="lg:col-span-2 space-y-8">
              <div className="glass-panel p-6 rounded-2xl">
                <h3 className="text-xl font-bold text-white font-tech mb-6 flex items-center gap-2">
                  <User className="h-5 w-5 text-purple-300" /> Identity & Billing
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="input-group relative">
                    <input
                      type="text"
                      id="name"
                      required
                      value={customerInfo.name}
                      onChange={(event) => handleInputChange('name', event.target.value)}
                      onBlur={(event) => handleInputBlur('name', event.target.value)}
                      className={`peer w-full bg-white/5 border rounded-lg px-4 py-3 text-white outline-none transition-colors placeholder-transparent ${fieldErrors.name ? 'border-red-500/80 focus:border-red-500' : 'border-white/10 focus:border-cyan-400'}`}
                      placeholder=" "
                    />
                    <label htmlFor="name" className="absolute left-4 top-3 text-slate-500 text-sm transition-all pointer-events-none">Full Name</label>
                    {fieldErrors.name && (
                      <span className="text-[10px] text-red-400 mt-1 block pl-1">{fieldErrors.name}</span>
                    )}
                  </div>
                  <div className="input-group relative">
                    <input
                      type="tel"
                      id="phone"
                      required
                      value={customerInfo.phone}
                      onChange={(event) => handleInputChange('phone', event.target.value)}
                      onBlur={(event) => handleInputBlur('phone', event.target.value)}
                      className={`peer w-full bg-white/5 border rounded-lg px-4 py-3 text-white outline-none transition-colors placeholder-transparent ${fieldErrors.phone ? 'border-red-500/80 focus:border-red-500' : 'border-white/10 focus:border-cyan-400'}`}
                      placeholder=" "
                    />
                    <label htmlFor="phone" className="absolute left-4 top-3 text-slate-500 text-sm transition-all pointer-events-none">Phone Number</label>
                    {fieldErrors.phone && (
                      <span className="text-[10px] text-red-400 mt-1 block pl-1">{fieldErrors.phone}</span>
                    )}
                  </div>
                  <div className="input-group relative">
                    <input
                      type="email"
                      id="email"
                      required
                      value={customerInfo.email}
                      onChange={(event) => handleInputChange('email', event.target.value)}
                      onBlur={(event) => handleInputBlur('email', event.target.value)}
                      className={`peer w-full bg-white/5 border rounded-lg px-4 py-3 text-white outline-none transition-colors placeholder-transparent ${fieldErrors.email ? 'border-red-500/80 focus:border-red-500' : 'border-white/10 focus:border-cyan-400'}`}
                      placeholder=" "
                    />
                    <label htmlFor="email" className="absolute left-4 top-3 text-slate-500 text-sm transition-all pointer-events-none">Email Address</label>
                    {fieldErrors.email && (
                      <span className="text-[10px] text-red-400 mt-1 block pl-1">{fieldErrors.email}</span>
                    )}
                  </div>
                  <div className="input-group relative">
                    <input
                      type="text"
                      id="gstin"
                      value={customerInfo.gstin}
                      onChange={(event) => handleInputChange('gstin', event.target.value)}
                      className="peer w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white outline-none focus:border-cyan-400 transition-colors placeholder-transparent"
                      placeholder=" "
                    />
                    <label htmlFor="gstin" className="absolute left-4 top-3 text-slate-500 text-sm transition-all pointer-events-none">GSTIN (Optional - B2B)</label>
                  </div>
                </div>
              </div>

              <div className="glass-panel p-6 rounded-2xl">
                <h3 className="text-xl font-bold text-white font-tech mb-6 flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-cyan-300" /> Site Logistics
                </h3>
                <div className="space-y-6">
                  <div className="input-group relative">
                    <textarea
                      id="address"
                      rows={3}
                      required={orderType === 'Delivery'}
                      value={customerInfo.address}
                      onChange={(event) => handleInputChange('address', event.target.value)}
                      onBlur={(event) => handleInputBlur('address', event.target.value)}
                      className={`peer w-full bg-white/5 border rounded-lg px-4 py-3 text-white outline-none transition-colors placeholder-transparent ${fieldErrors.address ? 'border-red-500/80 focus:border-red-500' : 'border-white/10 focus:border-cyan-400'}`}
                      placeholder=" "
                    ></textarea>
                    <label htmlFor="address" className="absolute left-4 top-3 text-slate-500 text-sm transition-all pointer-events-none">Installation Address (Goa)</label>
                    {fieldErrors.address && (
                      <span className="text-[10px] text-red-400 mt-1 block pl-1">{fieldErrors.address}</span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="input-group relative">
                      <input
                        type="date"
                        id="date"
                        value={customerInfo.installDate}
                        onChange={(event) => handleInputChange('installDate', event.target.value)}
                        className="peer w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white outline-none focus:border-cyan-400 transition-colors placeholder-transparent"
                        placeholder=" "
                      />
                      <label htmlFor="date" className="absolute left-4 top-3 text-slate-500 text-sm transition-all pointer-events-none">Preferred Install Date</label>
                    </div>
                    <div className="input-group relative">
                      <select
                        id="readiness"
                        value={customerInfo.siteStatus}
                        onChange={(event) => handleInputChange('siteStatus', event.target.value)}
                        className="peer w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white outline-none focus:border-cyan-400 transition-colors appearance-none"
                      >
                        <option value="" className="bg-[#0f172a]">Select Status</option>
                        <option value="ready" className="bg-[#0f172a]">Site Ready (Plaster/Paint Done)</option>
                        <option value="construction" className="bg-[#0f172a]">Under Construction (Cabling Phase)</option>
                        <option value="renovation" className="bg-[#0f172a]">Renovation (Retrofit)</option>
                      </select>
                      <label htmlFor="readiness" className="absolute left-4 top-3 text-slate-500 text-sm transition-all pointer-events-none">Site Status</label>
                      <ChevronDown className="absolute right-4 top-3.5 h-4 w-4 text-slate-500 pointer-events-none" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="input-group relative">
                      <input
                        type="text"
                        id="city"
                        required={orderType === 'Delivery'}
                        value={customerInfo.city}
                        onChange={(event) => handleInputChange('city', event.target.value)}
                        onBlur={(event) => handleInputBlur('city', event.target.value)}
                        className={`peer w-full bg-white/5 border rounded-lg px-4 py-3 text-white outline-none transition-colors placeholder-transparent ${fieldErrors.city ? 'border-red-500/80 focus:border-red-500' : 'border-white/10 focus:border-cyan-400'}`}
                        placeholder=" "
                      />
                      <label htmlFor="city" className="absolute left-4 top-3 text-slate-500 text-sm transition-all pointer-events-none">City</label>
                      {fieldErrors.city && (
                        <span className="text-[10px] text-red-400 mt-1 block pl-1">{fieldErrors.city}</span>
                      )}
                    </div>
                    <div className="input-group relative">
                      <input
                        type="text"
                        id="state"
                        required={orderType === 'Delivery'}
                        value={customerInfo.state}
                        onChange={(event) => handleInputChange('state', event.target.value)}
                        onBlur={(event) => handleInputBlur('state', event.target.value)}
                        className={`peer w-full bg-white/5 border rounded-lg px-4 py-3 text-white outline-none transition-colors placeholder-transparent ${fieldErrors.state ? 'border-red-500/80 focus:border-red-500' : 'border-white/10 focus:border-cyan-400'}`}
                        placeholder=" "
                      />
                      <label htmlFor="state" className="absolute left-4 top-3 text-slate-500 text-sm transition-all pointer-events-none">State</label>
                      {fieldErrors.state && (
                        <span className="text-[10px] text-red-400 mt-1 block pl-1">{fieldErrors.state}</span>
                      )}
                    </div>
                    <div className="input-group relative">
                      <input
                        type="text"
                        id="pincode"
                        required={orderType === 'Delivery'}
                        value={customerInfo.pincode}
                        onChange={(event) => handlePincodeChange(event.target.value)}
                        onBlur={(event) => handleInputBlur('pincode', event.target.value)}
                        className={`peer w-full bg-white/5 border rounded-lg px-4 py-3 text-white outline-none transition-colors placeholder-transparent ${fieldErrors.pincode ? 'border-red-500/80 focus:border-red-500' : 'border-white/10 focus:border-cyan-400'}`}
                        placeholder=" "
                      />
                      <label htmlFor="pincode" className="absolute left-4 top-3 text-slate-500 text-sm transition-all pointer-events-none">Pincode</label>
                      {fieldErrors.pincode && (
                        <span className="text-[10px] text-red-400 mt-1 block pl-1">{fieldErrors.pincode}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <Shield className="h-4 w-4 text-cyan-300" />
                    All hardware orders are eligible for secure shipping.
                  </div>

                  <div className="input-group relative">
                    <textarea
                      id="notes"
                      rows={2}
                      value={customerInfo.notes}
                      onChange={(event) => handleInputChange('notes', event.target.value)}
                      className="peer w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white outline-none focus:border-cyan-400 transition-colors placeholder-transparent"
                      placeholder=" "
                    ></textarea>
                    <label htmlFor="notes" className="absolute left-4 top-3 text-slate-500 text-sm transition-all pointer-events-none">Order Notes (Optional)</label>
                  </div>
                </div>
              </div>

              <div className="glass-panel p-6 rounded-2xl">
                <h3 className="text-xl font-bold text-white font-tech mb-6 flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-emerald-300" /> Payment Protocol
                </h3>
                <div className="space-y-4">
                  {paymentLoading && <div className="text-slate-400">Loading payment methods...</div>}
                  {!paymentLoading && getEnabledPaymentMethods().length === 0 && (
                    <div className="text-slate-400">No payment methods available. Please contact support.</div>
                  )}
                  {!paymentLoading && getEnabledPaymentMethods().map((method) => {
                    const getPaymentIcon = (methodId: string) => {
                      switch (methodId) {
                        case 'cod':
                          return <Banknote className="h-5 w-5 text-emerald-300" />;
                        case 'upi':
                          return <QrCode className="h-5 w-5 text-purple-300" />;
                        case 'payu':
                          return <CreditCard className="h-5 w-5 text-blue-300" />;
                        default:
                          return <Wallet className="h-5 w-5 text-slate-500" />;
                      }
                    };

                    return (
                      <label key={method.id} className="radio-card cursor-pointer block relative">
                        <input
                          type="radio"
                          name="payment"
                          value={method.id}
                          checked={selectedPaymentMethod === method.id}
                          onChange={() => setSelectedPaymentMethod(method.id)}
                          className="hidden"
                        />
                        <div className="border border-white/10 rounded-xl p-4 flex items-center gap-4 transition-all hover:bg-white/5">
                          <div className="radio-circle w-5 h-5 rounded-full border-2 border-slate-600 transition-colors"></div>
                          <div className="flex-1">
                            <span className="block text-white font-bold">{method.name}</span>
                            <span className="text-xs text-slate-400">
                              {method.type === 'online'
                                ? 'Pay online securely'
                                : method.id === 'cod'
                                  ? 'Pay when your order is delivered'
                                  : method.id === 'upi'
                                    ? 'Pay using UPI apps'
                                    : 'Offline payment'}
                            </span>
                          </div>
                          {getPaymentIcon(method.id)}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="lg:col-span-1">
              <div className="sticky top-24 glass-panel p-6 rounded-2xl border-t-4 border-cyan-400">
                <h3 className="text-xl font-bold text-white font-tech mb-6">Invoice Preview</h3>

                <div className="space-y-3 mb-6 max-h-60 overflow-y-auto pr-2">
                  {cartItems.map((item) => (
                    <div key={item.id} className={`flex justify-between text-sm ${item.id.startsWith('service-') ? 'text-purple-300' : ''}`}>
                      <span className="text-slate-400">{item.quantity}x {item.name}</span>
                      <span className="text-white">₹{(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-white/10 pt-4 mb-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Subtotal</span>
                    <span className="text-white">₹{displaySubtotal.toFixed(2)}</span>
                  </div>
                  {totalDiscount > 0 && (
                    <div className="flex justify-between text-sm text-emerald-300">
                      <span>Discount</span>
                      <span>-₹{totalDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">GST (Estimated)</span>
                    <span className="text-white">₹{displayGstAmount.toFixed(2)}</span>
                  </div>
                </div>

                <div className="border-t border-white/10 pt-4 mb-8">
                  <div className="flex justify-between items-end">
                    <div>
                      <span className="block text-xs text-slate-500 uppercase font-bold">Total Payable</span>
                      <span className="text-3xl font-bold text-cyan-300 font-tech">₹{displayTotal.toFixed(2)}</span>
                    </div>
                  </div>
                  {showAdvance && (
                    <div className="mt-2 bg-cyan-400/10 border border-cyan-400/20 rounded p-2 text-[10px] text-cyan-300 text-center">
                      Advance Payable (50%): ₹{advanceAmount.toFixed(2)}
                    </div>
                  )}
                </div>

                {autoOffer && autoOfferDiscount > 0 && autoOffer.description && (
                  <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-200 mb-4">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4" /> {autoOffer.title}
                      </span>
                      <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-200">
                        -₹{autoOfferDiscount.toFixed(2)}
                      </Badge>
                    </div>
                    <p className="mt-2 text-emerald-200/80">{autoOffer.description}</p>
                  </div>
                )}

                {appliedCoupon && couponDiscount > 0 && (
                  <div className="rounded-md border border-cyan-400/20 bg-cyan-400/10 p-3 text-xs text-cyan-200 mb-4">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Tag className="h-4 w-4" /> {appliedCoupon.code}
                      </span>
                      <button type="button" className="text-xs text-cyan-200 hover:text-white" onClick={removeCoupon}>Remove</button>
                    </div>
                    <p className="mt-2 text-cyan-200/80">Coupon savings: ₹{couponDiscount.toFixed(2)}</p>
                  </div>
                )}

                {orderError && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-md p-3 mb-4">
                    <p className="text-red-200 text-sm font-medium">{orderError}</p>
                  </div>
                )}

                <div className="mb-4 flex items-start gap-3 rounded-lg border border-white/10 bg-white/5 p-3">
                  <input
                    id="checkout-privacy-consent"
                    type="checkbox"
                    checked={privacyAccepted}
                    onChange={(event) => setPrivacyAccepted(event.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-slate-400 bg-slate-900 text-cyan-400 focus:ring-cyan-400"
                  />
                  <label htmlFor="checkout-privacy-consent" className="text-xs text-slate-300 leading-relaxed">
                    I have read and agree to the{' '}
                    <Link href="/info/policies/privacy" className="text-cyan-300 hover:text-white underline">Privacy Policy</Link>
                    {' '}and{' '}
                    <Link href="/info/policies/terms" className="text-cyan-300 hover:text-white underline">Terms of Service</Link>.
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isProcessingOrder || !selectedPaymentMethod || paymentLoading || !privacyAccepted}
                  className="magnetic-btn w-full py-4 bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-white hover:to-white hover:text-slate-900 text-white font-bold font-tech text-lg rounded-xl transition-all shadow-lg shadow-cyan-400/20 flex items-center justify-center gap-2 group disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isProcessingOrder ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 rounded-full border-2 border-white border-b-transparent animate-spin"></span>
                      Processing Order...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      Confirm Order <CheckCircle className="h-4 w-4 group-hover:scale-110 transition-transform" />
                    </span>
                  )}
                </button>

                <p className="mt-4 text-xs text-slate-500 text-center">
                  By placing this order, you agree to our Terms & Conditions.
                </p>
              </div>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}