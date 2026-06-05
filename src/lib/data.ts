/**
 * Data utilities and constants for the application
 * This file contains commonly used data structures and constants
 */

import type { CategoryGstRates } from './utils';
import type { UserRole, CustomerCategory } from './types';

// GST Rates by Category
export const GST_RATES: CategoryGstRates = {
  Electronics: 18,
  Accessories: 18,
  Books: 5,
  Clothing: 12,
  Food: 5,
  Health: 12,
  Home: 18,
  Sports: 18,
  Software: 18,
  Services: 18,
  Gaming: 18,
  Furniture: 18,
  Automotive: 28,
} as const;

// User Role Permissions
export const ROLE_PERMISSIONS = {
  customer: {
    canViewProducts: true,
    canPlaceOrders: true,
    canViewOwnOrders: true,
    canManageProfile: true,
  },
  sales: {
    canViewProducts: true,
    canManageOrders: true,
    canViewCustomers: true,
    canProcessPayments: true,
  },
  'sales-staff': {
    canViewProducts: true,
    canManageOrders: true,
    canViewCustomers: true,
    canProcessPayments: true,
  },
  'sales-external': {
    canViewProducts: true,
    canManageOrders: true,
    canViewCustomers: true,
    canProcessPayments: true,
  },
  manager: {
    canViewProducts: true,
    canManageOrders: true,
    canViewCustomers: true,
    canProcessPayments: true,
    canManageInventory: true,
    canViewReports: true,
  },
  accounts: {
    canViewOrders: true,
    canManageInvoices: true,
    canViewReports: true,
    canManageExpenses: true,
  },
  admin: {
    canManageEverything: true,
  },
  superadmin: {
    canManageEverything: true,
  },
  service_engineer: {
    canViewProducts: true,
    canManageOrders: true,
    canViewCustomers: true,
    canManageInventory: true,
    canViewReports: true,
  },
} as const;

// Customer Categories and Benefits
export const CUSTOMER_CATEGORIES: Record<CustomerCategory, { 
  name: string; 
  defaultDiscount: number; 
  benefits: string[];
}> = {
  Normal: {
    name: 'Normal Customer',
    defaultDiscount: 0,
    benefits: ['Standard pricing', 'Basic support'],
  },
  Standard: {
    name: 'Standard Customer', 
    defaultDiscount: 5,
    benefits: ['5% discount on all products', 'Priority support', 'Extended warranty'],
  },
  Premium: {
    name: 'Premium Customer',
    defaultDiscount: 10,
    benefits: ['10% discount on all products', 'VIP support', 'Free installation', 'Extended warranty'],
  },
} as const;

// Common validation patterns
export const VALIDATION_PATTERNS = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  mobile: /^[6-9]\d{9}$/,
  gstin: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
  pan: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
  pincode: /^[1-9][0-9]{5}$/,
} as const;

// Order status flow
export const ORDER_STATUS_FLOW = [
  'Pending',
  'Awaiting Payment',
  'Payment Failed',
  'Payment Confirmed', 
  'Confirmed',
  'Processing',
  'Ready to Ship',
  'Shipped',
  'Ready for Pickup',
  'Completed',
  'Delivered'
] as const;

// Service/repair setup lifecycle
export const SERVICE_ORDER_STATUS_FLOW = [
  'Pending',
  'Awaiting Payment',
  'Visit Scheduled',
  'Visit Completed',
  'Diagnosis Done',
  'Quote Sent',
  'Awaiting Customer Approval',
  'Approved',
  'Parts Ordered',
  'Work In Progress',
  'Quality Check',
  'Ready for Pickup',
  'Ready for Delivery',
  'Delivered/Picked Up',
  'Completed',
  'Warranty/Support Active'
] as const;

// Error messages
export const ERROR_MESSAGES = {
  INVALID_EMAIL: 'Please enter a valid email address',
  INVALID_MOBILE: 'Please enter a valid 10-digit mobile number',
  INVALID_GSTIN: 'Please enter a valid GSTIN',
  REQUIRED_FIELD: 'This field is required',
  NETWORK_ERROR: 'Network error. Please try again.',
  UNAUTHORIZED: 'You are not authorized to perform this action',
  SERVER_ERROR: 'Server error. Please try again later.',
} as const;

/**
 * Check if user has permission for a specific action
 */
export function hasPermission(role: UserRole, permission: string): boolean {
  const rolePerms = ROLE_PERMISSIONS[role];
  if ('canManageEverything' in rolePerms) return true;
  return permission in rolePerms && rolePerms[permission as keyof typeof rolePerms];
}

/**
 * Get customer category benefits
 */
export function getCustomerBenefits(category: CustomerCategory) {
  return CUSTOMER_CATEGORIES[category];
}
