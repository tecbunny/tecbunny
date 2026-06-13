
export interface Review {
  id: string;
  author: string;
  rating: number;
  comment: string;
  created_at: string;
}

export interface Product {
  id: string;
  title: string;  // Database field name (required)
  name: string;   // Computed field for backwards compatibility (required)
  handle?: string;
  vendor?: string;
  product_type?: string;
  tags?: string[];
  status?: 'active' | 'archived' | 'draft';
  images?: string[];
  seo_title?: string;
  seo_description?: string;
  brand?: string;
  description: string;
  mrp?: number;
  price: number;
  category: string;  // Make this required as many components expect it
  image: string;     // Make this required as many components expect it
  warranty?: string;
  hsnCode?: string;
  gstRate?: number;
  gst_rate?: number;
  installation_applicable?: boolean;
  installation_charge?: number;
  isSerialNumberCompulsory?: boolean;
  popularity: number;
  rating: number;
  reviewCount: number;
  created_at: string;
  updated_at?: string;
  // Prioritization fields
  prioritized?: boolean;
  prioritized_at?: string;
  // New pricing and stock fields
  stock_quantity?: number;
  min_stock_level?: number;
  max_stock_level?: number;
  stock_status?: 'in_stock' | 'low_stock' | 'out_of_stock' | 'backorder';
  offer_price?: number;
  discount_percentage?: number;
  applied_offer_title?: string;
  applied_offer_id?: string;
  // Enhanced product fields
  product_url?: string;           // Direct product URL/link
  additional_images?: string[];   // Multiple product images
  brand_logo?: string;           // Brand logo image
  specifications?: Record<string, string>; // Product specifications
  model_number?: string;         // Product model number
  barcode?: string;             // Product barcode/SKU
}

export type HeroCarouselPageKey = 'homepage' | 'services' | 'offers' | 'products' | 'innovations';

export interface HeroCarouselItem {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  imageUrl: string;
  htmlContent?: string;
  ctaText?: string;
  ctaLink?: string;
  isActive?: boolean;
  displayOrder?: number;
}

export type HeroCarouselContent = Record<HeroCarouselPageKey, HeroCarouselItem[]>;

export interface CartItem extends Product {
  quantity: number;
  serialNumbers?: string[];
}

export type UserRole = 'customer' | 'sales' | 'sales-staff' | 'sales-external' | 'manager' | 'accounts' | 'admin' | 'service_engineer' | 'superadmin';
export type CustomerCategory = 'Normal' | 'Standard' | 'Premium';
export type CustomerType = 'B2C' | 'B2B';
export type B2BCategory = 'Bronze' | 'Silver' | 'Gold';

export interface User {
    id: string; // This corresponds to the Supabase auth.users.id
    name: string;
    email: string;
    mobile: string;
    role: UserRole;
  // Whether the user's email has been verified/confirmed
  emailVerified?: boolean;
  // Raw timestamp from auth provider when email was confirmed (if available)
  email_confirmed_at?: string | null;
  // First-login WhatsApp onboarding handshake tracking
  first_login_whatsapp_sent?: boolean;
  first_login_notified_at?: string | null;
    address?: string;
    gstin?: string;
    customerCategory?: CustomerCategory;
    discountPercentage?: number;
    isActive?: boolean;
    created_at?: string;
    updated_at?: string;
    // Enhanced B2B features
    customer_type?: CustomerType;
    gst_verified?: boolean;
    gst_verification_date?: string;
    business_name?: string;
    business_address?: string;
    credit_limit?: number;
    b2b_category?: B2BCategory;
}

export interface CustomerDiscount {
    id: string;
    category: CustomerCategory;
    discountPercentage: number;
    description: string;
    isActive: boolean;
    created_at: string;
}

export interface CustomerOffer {
    id: string;
    title: string;
    description: string;
    discountPercentage: number;
    targetCategories: CustomerCategory[];
    validFrom: string;
    validTo: string;
    isActive: boolean;
    minimumOrderValue?: number;
    maxDiscountAmount?: number;
    created_at: string;
}

// Orders can be retail/fulfillment or service/repair; keep one union so downstream consumers stay compatible.
export type OrderStatus =
  | 'Pending'
  | 'Awaiting Payment'
  | 'Payment Confirmed'
  | 'Payment Failed'
  | 'Confirmed'
  | 'Processing'
  | 'Ready to Ship'
  | 'Shipped'
  | 'Ready for Pickup'
  | 'Ready for Delivery'
  | 'Delivered'
  | 'Delivered/Picked Up'
  | 'Completed'
  | 'Cancelled'
  | 'Rejected'
  | 'On Hold'
  | 'Visit Scheduled'
  | 'Visit Completed'
  | 'Diagnosis Done'
  | 'Quote Sent'
  | 'Awaiting Customer Approval'
  | 'Approved'
  | 'Parts Ordered'
  | 'Work In Progress'
  | 'Quality Check'
  | 'Warranty/Support Active';

export type OrderType = 'Pickup' | 'Delivery' | 'Walk-in' | 'Service' | 'Repair' | 'Installation' | 'Setup';

export interface OrderItem {
  productId: string;
  quantity: number;
  price: number;
  gstRate?: number;
  hsnCode?: string;
  name: string;
  serialNumbers?: string[];
}

export interface Order {
  id: string;
  customer_name: string;
  customer_id: string | null; // Allow null for guest orders
  customer_email?: string;
  customer_phone?: string;
  created_at: string;
  updated_at?: string;
  status: OrderStatus;
  subtotal: number;
  gst_amount: number;
  total: number;
  total_amount?: number; // For backward compatibility
  tax_amount?: number;
  discount_amount?: number;
  shipping_amount?: number;
  type: OrderType;
  delivery_address?: string;
  pickup_store?: string;
  customer_state?: string;
  customer_state_code?: string;
  place_of_supply?: string;
  place_of_supply_state_code?: string;
  seller_state_code?: string;
  notes?: string;
  payment_method?: string;
  payment_status?: string;
  payment_reference?: string;
  items: OrderItem[];
  processed_by?: string; // Sales or Manager ID
  payment_confirmed_at?: string;
  payment_confirmed_by?: string;
  confirmed_at?: string;
  confirmed_by?: string;
  shipped_at?: string;
  delivered_at?: string;
  cancelled_at?: string;
  cancelled_by?: string;
  cancellation_reason?: string;
  // Enhanced order fields
  agent_id?: string;
  commission_applicable?: boolean;
  pre_tax_total?: number;
  customer_type?: CustomerType;
  otp_verified?: boolean;
  otp_verified_at?: string;
  pickup_code?: string; // OTP for Pickup Verification
  part_payment_amount?: number | null;
  quote_id?: string | null;
  pending_amount_requested?: boolean;
  pending_payment_status?: 'unpaid' | 'paid';
  pending_payment_method?: 'cash' | 'online' | null;
  invoice_pdf_url?: string | null;
  // Related data
  sales_agent?: SalesAgent;
  status_history?: OrderStatusHistory[];
}

export type ContactMessageStatus = 'New' | 'In Progress' | 'Resolved';

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
  status: ContactMessageStatus;
  created_at: string;
  updated_at?: string;
  resolved_at?: string | null;
  handled_by?: string | null;
  handled_by_name?: string | null;
  admin_notes?: string | null;
  ip_address?: string | null;
}

export interface ActivityLog {
    id: number;
    user: string;
    action: string;
    timestamp: string;
    type: 'content_edit' | 'report_view' | 'signup' | 'login' | 'coupon_created';
}

export type ExpenseStatus = 'pending' | 'approved' | 'rejected';
export type ExpenseCategory = 'Travel' | 'Food' | 'Supplies' | 'Utility' | 'Other';

export interface Expense {
    id: string;
    created_at: string;
    category: ExpenseCategory;
    amount: number;
    description: string;
    submitted_by: string; // User ID
    status: ExpenseStatus;
}


export type CouponType = 'percentage' | 'fixed';
export type CouponStatus = 'active' | 'inactive';


export interface Coupon {
    id: string;
    code: string;
    type: CouponType;
    value: number;
    start_date: string;
    expiry_date: string;
    min_purchase?: number;
    usage_limit: number;
    usage_count: number;
    per_user_limit: number;
    status: CouponStatus;
    applicable_category?: string;
    applicable_product_id?: string;
}

// Auto-applied discount (no code needed)
export interface Discount {
    id: string;
    name: string;
    type: CouponType; // percentage | fixed
    value: number;
    status: CouponStatus;
    start_date: string;
    expiry_date: string;
    min_purchase?: number;
    applicable_category?: string;
    applicable_product_id?: string;
    priority: number;
    created_at?: string;
    updated_at?: string;
}

// Enhanced offer system for auto-application
// export type ServiceCategory = 'Support' | 'Protection' | 'Installation' | 'Trade' | 'Business';
export interface Service {
    id: string;
    icon: string;
    title: string;
    name?: string;
    description: string;
    features: string[];
    badge?: 'Popular' | 'Recommended' | 'New' | 'Featured' | null;
    is_active: boolean;
    price?: number;
    duration_days?: number;
    category: ServiceCategory;
    display_order: number;
    created_at: string;
    updated_at: string;
    terms_and_conditions?: string;
}

export interface InnovationModeItem {
  icon: string;
  text: string;
  accent: string;
}

export interface InnovationMode {
  id: string;
  key: string;
  label: string;
  sub: string;
  title: string;
  description: string;
  icon: string;
  rec_id: string;
  items: InnovationModeItem[];
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at?: string;
}

export interface InnovationDevice {
  id: string;
  title: string;
  description: string;
  accent: string;
  icon: string;
  chips: string[];
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at?: string;
}
export type OfferType = 'category_discount' | 'customer_tier' | 'minimum_order' | 'seasonal' | 'product_specific';

export interface AutoOffer {
    id: string;
    title: string;
    description: string;
    type: OfferType;
    discount_percentage?: number;
    discount_amount?: number;
    conditions: {
        customer_category?: CustomerCategory[];
        minimum_order_value?: number;
        applicable_categories?: string[];
        applicable_product_ids?: string[];
        valid_from: string;
        valid_to: string;
    };
    is_active: boolean;
    auto_apply: boolean;
    priority: number; // For determining best offer when multiple apply
    max_discount_amount?: number;
    created_at: string;
    updated_at?: string;
}

// Enhanced pricing structure with offers and discounts
export interface PricingWithOffers {
    originalPrice: number;
    basePrice: number;
    autoOfferDiscount: number;
    manualDiscountCode?: string;
    manualDiscountAmount: number;
    finalPrice: number;
    appliedOffers: AutoOffer[];
    availableOffers: AutoOffer[];
    appliedDiscount?: Coupon;
    totalSavings: number;
    canCombine: boolean; // Whether offer and discount can be combined
}

// Cart item with enhanced pricing
export interface EnhancedCartItem extends CartItem {
    pricing: PricingWithOffers;
}

export interface InventoryItem {
    id: string;
    product_id: string;
    stock: number;
    serial_numbers: string[];
}

export interface PurchaseItem extends Product {
    quantity: number;
    purchase_price: number;
    serialNumbers?: string[];
}

export interface Purchase {
    id: string;
    supplier_name: string;
    supplier_invoice: string;
    items: PurchaseItem[];
    created_at: string;
    total: number;
}

export type ServiceStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type ServicePriority = 'low' | 'medium' | 'high' | 'urgent';
export type ServiceCategory = 'Support' | 'Protection' | 'Installation' | 'Trade' | 'Business' | 'CCTV' | 'Computer' | 'Web Services';

// Sales Agent Types
export type SalesAgentStatus = 'pending' | 'approved' | 'rejected';
export type RedemptionStatus = 'pending' | 'approved' | 'rejected' | 'processed';

export interface SalesAgent {
  id: string;
  user_id: string;
  referral_code: string;
  points_balance: number;
  status: SalesAgentStatus;
  created_at: string;
  updated_at: string;
}

export interface AgentCommission {
  id: string;
  agent_id: string;
  order_id: string;
  order_total: number;
  commission_rate_snapshot: Record<string, any>;
  points_awarded: number;
  created_at: string;
}

export interface AgentRedemptionRequest {
  id: string;
  agent_id: string;
  points_to_redeem: number;
  status: RedemptionStatus;
  bank_details?: Record<string, any>;
  notes?: string;
  requested_at: string;
  processed_at?: string;
}

// Enhanced Product Pricing Types
export interface ProductPricing {
  id: string;
  product_id: string;
  customer_type: CustomerType;
  customer_category?: string;
  price: number;
  min_quantity?: number;
  max_quantity?: number;
  valid_from?: string;
  valid_to?: string;
  is_active: boolean;
}

// Agent Commission Rules
export interface AgentCommissionRule {
  id: string;
  agent_id: string;
  product_id?: string;
  product_category?: string;
  commission_rate: number;
  min_order_value?: number;
  valid_from?: string;
  valid_to?: string;
  is_active: boolean;
}

// OTP Verification Types
export type OtpType = 'agent_order' | 'customer_verification' | 'pickup';

export interface OrderOtpVerification {
  id: string;
  order_id: string;
  agent_id?: string;
  customer_phone: string;
  otp_code: string;
  otp_type: OtpType;
  attempts: number;
  max_attempts: number;
  verified: boolean;
  verified_at?: string;
  expires_at: string;
  created_at: string;
}

// Service Engineer Types
export type ServiceEngineerSkillLevel = 'junior' | 'senior' | 'expert';

export interface ServiceEngineer {
  id: string;
  user_id: string;
  employee_id?: string;
  specializations: string[];
  skill_level: ServiceEngineerSkillLevel;
  available_hours?: Record<string, any>;
  is_available: boolean;
  current_location?: { lat: number; lng: number };
  service_radius: number;
  rating: number;
  total_services: number;
  created_at: string;
  updated_at: string;
}

// Enhanced Service Ticket Types
export type ServiceTicketStatus =
  | 'created'
  | 'accepted'
  | 'rejected'
  | 'under_process'
  | 'hold_for_product_payment'
  | 'rejected_by_customer'
  | 'completed';
export type ServiceTicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface ServiceTicket {
  id: string;
  service_id?: string;
  customer_id?: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  customer_address?: string;
  issue_description: string;
  priority: ServiceTicketPriority;
  status: ServiceTicketStatus;
  assigned_engineer_id?: string;
  assigned_at?: string;
  scheduled_date?: string;
  started_at?: string;
  completed_at?: string;
  estimated_duration?: number;
  actual_duration?: number;
  service_charge?: number;
  parts_cost?: number;
  total_cost?: number;
  customer_rating?: number;
  customer_feedback?: string;
  engineer_notes?: string;
  photos?: string[];
  created_at: string;
  updated_at: string;
  // Related data
  assigned_engineer?: ServiceEngineer;
  service_parts?: ServicePart[];
}

export interface ServicePart {
  id: string;
  ticket_id: string;
  product_id?: string;
  part_name: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  warranty_days?: number;
  created_at: string;
}

// Agent Performance Types
export interface AgentPerformance {
  id: string;
  agent_id: string;
  month_year: string;
  total_orders: number;
  total_sales_value: number;
  total_commission_earned: number;
  customer_acquisition_count: number;
  average_order_value: number;
  performance_rating: number;
  created_at: string;
}

// Order Status History
export interface OrderStatusHistory {
  id: string;
  order_id: string;
  previous_status?: string;
  new_status: string;
  changed_by?: string;
  change_reason?: string;
  notes?: string;
  created_at: string;
}

// Analytics Types
export interface CustomerAnalytics {
  id: string;
  customer_id: string;
  total_orders: number;
  total_spent: number;
  average_order_value: number;
  last_order_date?: string;
  customer_lifetime_days: number;
  preferred_categories: string[];
  risk_score: number;
  loyalty_score: number;
  last_updated: string;
}

export interface ProductAnalytics {
  id: string;
  product_id: string;
  total_orders: number;
  total_quantity_sold: number;
  total_revenue: number;
  average_rating: number;
  return_rate: number;
  profit_margin: number;
  last_sold_date?: string;
  seasonal_trend?: Record<string, any>;
  last_updated: string;
}

// (Removed duplicate Service interface)

export interface ServiceRequest {
    id: string;
    service_id: string;
    customer_id: string;
    customer_name: string;
    customer_email: string;
    customer_phone?: string;
    message?: string;
    status: ServiceStatus;
    assigned_to?: string;
    priority: ServicePriority;
    scheduled_date?: string;
    completed_date?: string;
    notes?: string;
    created_at: string;
    updated_at: string;
    service?: Service;
}
