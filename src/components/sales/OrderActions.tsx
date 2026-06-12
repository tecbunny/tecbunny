'use client';

import * as React from 'react';

import { 
  MoreHorizontal, 
  CheckCircle, 
  XCircle, 
  Printer, 
  Package, 
  Truck, 
  Clock,
  Ban,
  CreditCard,
  Eye
} from 'lucide-react';

import { logger } from '@/lib/logger';
import { formatOrderNumber } from '@/lib/order-utils';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useToast } from '../../hooks/use-toast';
import { useAuth } from '@/lib/hooks';
import { isManagerClient, isSalesClient } from '@/lib/permissions-client';
import type { Order, OrderStatus } from '@/lib/types';

const SERVICE_TYPE_SET = new Set(['Service', 'Repair', 'Installation', 'Setup']);

const ADMIN_NOTIFICATION_EMAIL = (() => {
  const envValue = (process.env.NEXT_PUBLIC_ORDER_ADMIN_EMAIL || '').trim();
  return envValue || 'tecbunnysolution@gmail.com';
})();

interface OrderActionsProps {
  order: Order;
  onStatusUpdate: () => Promise<void> | void;
  variant?: 'dropdown' | 'buttons' | 'compact';
}

interface PaymentConfirmationDialog {
  isOpen: boolean;
  onConfirm: () => void;
  onReject: () => void;
  onClose: () => void;
}

interface OrderConfirmationDialog {
  isOpen: boolean;
  onAccept: () => void;
  onReject: () => void;
  onClose: () => void;
}

interface CancellationDialog {
  isOpen: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

export function OrderActions({ order, onStatusUpdate, variant = 'dropdown' }: OrderActionsProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [paymentDialog, setPaymentDialog] = React.useState<PaymentConfirmationDialog>({
    isOpen: false,
    onConfirm: () => {},
    onReject: () => {},
    onClose: () => {}
  });
  
  const [confirmDialog, setConfirmDialog] = React.useState<OrderConfirmationDialog>({
    isOpen: false,
    onAccept: () => {},
    onReject: () => {},
    onClose: () => {}
  });
  
  const [cancelDialog, setCancelDialog] = React.useState<CancellationDialog>({
    isOpen: false,
    onConfirm: () => {},
    onClose: () => {}
  });
  
  const [cancellationReason, setCancellationReason] = React.useState('');
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [paymentReference, setPaymentReference] = React.useState(order.payment_reference ?? '');

  const [isUploadInvoiceOpen, setIsUploadInvoiceOpen] = React.useState(false);
  const [invoiceFile, setInvoiceFile] = React.useState<File | null>(null);
  const [uploadingInvoice, setUploadingInvoice] = React.useState(false);

  const handlePendingAction = async (action: 'request_pending' | 'accept_cash') => {
    setIsProcessing(true);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/pending-actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });

      const result = await res.json().catch(() => null);
      if (!res.ok) throw new Error(result?.error || 'Action failed');

      toast({
        title: 'Success',
        description: action === 'request_pending' 
          ? 'Pending payment request sent to customer.' 
          : 'Cash payment confirmed successfully.'
      });
      await onStatusUpdate();
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err.message
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUploadInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceFile) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please select a PDF file.' });
      return;
    }

    setUploadingInvoice(true);
    try {
      const formData = new FormData();
      formData.append('action', 'upload_invoice');
      formData.append('file', invoiceFile);

      const res = await fetch(`/api/admin/orders/${order.id}/pending-actions`, {
        method: 'POST',
        body: formData
      });

      const result = await res.json().catch(() => null);
      if (!res.ok) throw new Error(result?.error || 'Upload failed');

      toast({
        title: 'Invoice Sent',
        description: 'Final invoice uploaded and sent to customer.'
      });
      setIsUploadInvoiceOpen(false);
      setInvoiceFile(null);
      await onStatusUpdate();
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err.message
      });
    } finally {
      setUploadingInvoice(false);
    }
  };

  const canManageOrders = isManagerClient(user);
  const canManagePickupOrders = isSalesClient(user); // Both sales and manager can manage pickup orders

  const hasPermission = order.type === 'Pickup' ? canManagePickupOrders : canManageOrders;

  const isPickupLikeOrder = order.type === 'Pickup' || order.type === 'Walk-in';
  const isServiceOrder = SERVICE_TYPE_SET.has(order.type);

  React.useEffect(() => {
    setPaymentReference(order.payment_reference ?? '');
  }, [order.payment_reference, order.id]);

  const notifyStatusChange = async (status: OrderStatus) => {
    const notifyPickupCustomer = async () => {
      // Changed to check phone for WhatsApp notification
      if (!order.customer_phone) {
        return;
      }

      try {
        const pickupCode = formatOrderNumber(order.id);
        const response = await fetch('/api/email/pickup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            // to: order.customer_email, // Deprecated in favor of phone
            phone: order.customer_phone,
            orderData: {
              id: order.id,
              customer_name: order.customer_name,
              total: order.total,
              type: order.type,
              delivery_address: order.pickup_store || order.delivery_address,
              pickup_store: order.pickup_store || order.delivery_address
            },
            pickupCode
          })
        });

        if (!response.ok) {
          throw new Error(`pickup notification failed with status ${response.status}`);
        }
      } catch (error) {
        logger.warn('pickup_notification_failed', {
          error: error instanceof Error ? error.message : String(error),
          orderId: order.id
        });
      }
    };

    const notifyPickupAdmin = async () => {
      if (!ADMIN_NOTIFICATION_EMAIL) {
        return;
      }

      try {
        const response = await fetch('/api/email/notify-sales-pickup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            to: ADMIN_NOTIFICATION_EMAIL,
            orderId: order.id,
            orderType: 'pickup'
          })
        });

        if (!response.ok) {
          throw new Error(`pickup admin email failed with status ${response.status}`);
        }
      } catch (error) {
        logger.warn('pickup_admin_notification_failed', {
          error: error instanceof Error ? error.message : String(error),
          orderId: order.id
        });
      }
    };

    const notifyOrderApproved = async () => {
      if (!ADMIN_NOTIFICATION_EMAIL) {
        return;
      }

      try {
        const response = await fetch('/api/email/order-approved', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            to: ADMIN_NOTIFICATION_EMAIL,
            orderId: order.id,
            orderTotal: order.total,
            orderType: order.type === 'Pickup' ? 'pickup' : order.type === 'Delivery' ? 'delivery' : undefined,
            customerName: order.customer_name
          })
        });

        if (!response.ok) {
          throw new Error(`order approved email failed with status ${response.status}`);
        }
      } catch (error) {
        logger.warn('order_approved_email_failed', {
          error: error instanceof Error ? error.message : String(error),
          orderId: order.id
        });
      }
    };

    if (status === 'Ready for Pickup' && order.type === 'Pickup') {
      await notifyPickupCustomer();
      await notifyPickupAdmin();
    }

    if (status === 'Confirmed') {
      await notifyOrderApproved();
    }
  };

  const updateOrderStatus = async (newStatus: OrderStatus, additionalData?: any) => {
    setIsProcessing(true);
    try {
      const response = await fetch('/api/orders/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          status: newStatus,
          additionalData
        })
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        const message = result?.error ?? 'Failed to update order status.';
        toast({
          variant: 'destructive',
          title: 'Update failed',
          description: message
        });
        return;
      }

      await notifyStatusChange(newStatus);

      await onStatusUpdate();
      toast({
        title: 'Order Updated',
        description: `Order ${formatOrderNumber(order.id)} is now ${newStatus}.`
      });
    } catch (error) {
      logger.error('Error updating order', { error, orderId: order.id, newStatus });
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update order status.'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePaymentConfirmation = (confirmed: boolean) => {
    if (confirmed) {
      const payload = paymentReference?.trim()
        ? { payment_reference: paymentReference.trim() }
        : undefined;
      updateOrderStatus('Payment Confirmed', payload);
    } else {
      updateOrderStatus('Cancelled', { 
        cancellation_reason: 'Payment not confirmed' 
      });
    }
    setPaymentDialog(prev => ({ ...prev, isOpen: false }));
  };

  const handleOrderConfirmation = (accepted: boolean) => {
    if (accepted) {
      updateOrderStatus('Confirmed');
    } else {
      updateOrderStatus('Rejected', { 
        cancellation_reason: 'Order rejected by management' 
      });
    }
    setConfirmDialog(prev => ({ ...prev, isOpen: false }));
  };

  const handleCancellation = (reason: string) => {
    updateOrderStatus('Cancelled', { 
      cancellation_reason: reason || 'No reason provided' 
    });
    setCancelDialog(prev => ({ ...prev, isOpen: false }));
    setCancellationReason('');
  };

  const handlePrintInvoice = () => {
    const invoiceUrl = `/orders/${order.id}/invoice?print=1`;
    window.open(invoiceUrl, '_blank', 'noopener,noreferrer');
  };

  const getAvailableActions = () => {
    const actions: Array<{
      label: string;
      icon: React.ReactNode;
      action: () => void;
      variant?: 'default' | 'destructive' | 'outline';
      disabled?: boolean;
    }> = [];

    // Always available actions
    actions.push({
      label: 'View Details',
      icon: <Eye className="h-4 w-4" />,
      action: () => window.open(`/orders/${order.id}`, '_blank'),
      variant: 'outline'
    });

    actions.push({
      label: 'Print Invoice',
      icon: <Printer className="h-4 w-4" />,
      action: handlePrintInvoice,
      variant: 'outline'
    });

    const hasPartPayment = typeof order.part_payment_amount === 'number' && order.part_payment_amount > 0;
    const isInitialPaid = order.payment_status === 'Payment Confirmed' || 
      ['Payment Confirmed', 'Confirmed', 'Processing', 'Ready to Ship', 'Shipped', 'Ready for Pickup', 'Completed', 'Delivered', 'Delivered/Picked Up'].includes(order.status);
    const isPendingUnpaid = hasPartPayment && isInitialPaid && order.pending_payment_status !== 'paid';

    if (isPendingUnpaid) {
      actions.push({
        label: 'Ask for Pending Payment',
        icon: <Clock className="h-4 w-4" />,
        action: () => handlePendingAction('request_pending'),
        variant: 'outline'
      });
      actions.push({
        label: 'Record Cash Balance Payment',
        icon: <CheckCircle className="h-4 w-4" />,
        action: () => handlePendingAction('accept_cash'),
        variant: 'outline'
      });
    }

    if (isInitialPaid) {
      actions.push({
        label: 'Upload Final Invoice PDF',
        icon: <Printer className="h-4 w-4" />,
        action: () => setIsUploadInvoiceOpen(true),
        variant: 'outline'
      });
    }

    if (!hasPermission) {
      return actions;
    }

    // Status-specific actions
    const readyAction = {
      label: isPickupLikeOrder ? 'Ready for Pickup' : 'Ready to Ship',
      icon: <Clock className="h-4 w-4" />,
      action: () => updateOrderStatus(isPickupLikeOrder ? 'Ready for Pickup' : 'Ready to Ship')
    };

    const pushPaymentConfirmation = () => {
      actions.push({
        label: 'Confirm Payment',
        icon: <CreditCard className="h-4 w-4" />,
        action: () => {
          setPaymentReference(order.payment_reference ?? '');
          setPaymentDialog(prev => ({
            ...prev,
            isOpen: true,
            onConfirm: () => handlePaymentConfirmation(true),
            onReject: () => handlePaymentConfirmation(false),
            onClose: () => setPaymentDialog(prev => ({ ...prev, isOpen: false }))
          }));
        }
      });
    };

    if (isServiceOrder) {
      switch (order.status) {
        case 'Awaiting Payment':
          pushPaymentConfirmation();
          break;
        case 'Pending':
        case 'Payment Confirmed':
          actions.push({ label: 'Schedule Visit', icon: <Clock className="h-4 w-4" />, action: () => updateOrderStatus('Visit Scheduled') });
          if (order.status === 'Pending') {
            actions.push({ label: 'Confirm Order', icon: <CheckCircle className="h-4 w-4" />, action: () => setConfirmDialog(prev => ({
              ...prev,
              isOpen: true,
              onAccept: () => handleOrderConfirmation(true),
              onReject: () => handleOrderConfirmation(false),
              onClose: () => setConfirmDialog(prev => ({ ...prev, isOpen: false }))
            })) });
          }
          break;
        case 'Visit Scheduled':
          actions.push({ label: 'Mark Visit Completed', icon: <CheckCircle className="h-4 w-4" />, action: () => updateOrderStatus('Visit Completed') });
          break;
        case 'Visit Completed':
          actions.push({ label: 'Mark Diagnosis Done', icon: <CheckCircle className="h-4 w-4" />, action: () => updateOrderStatus('Diagnosis Done') });
          break;
        case 'Diagnosis Done':
          actions.push({ label: 'Send Quote', icon: <CheckCircle className="h-4 w-4" />, action: () => updateOrderStatus('Quote Sent') });
          break;
        case 'Quote Sent':
          actions.push({ label: 'Await Customer Approval', icon: <Clock className="h-4 w-4" />, action: () => updateOrderStatus('Awaiting Customer Approval') });
          break;
        case 'Awaiting Customer Approval':
          actions.push({ label: 'Approve Quote', icon: <CheckCircle className="h-4 w-4" />, action: () => updateOrderStatus('Approved') });
          actions.push({ label: 'Reject Quote', icon: <XCircle className="h-4 w-4" />, action: () => updateOrderStatus('Rejected') });
          break;
        case 'Approved':
          actions.push({ label: 'Order Parts', icon: <Package className="h-4 w-4" />, action: () => updateOrderStatus('Parts Ordered') });
          actions.push({ label: 'Start Work', icon: <Package className="h-4 w-4" />, action: () => updateOrderStatus('Work In Progress') });
          actions.push({ label: 'Put On Hold', icon: <Clock className="h-4 w-4" />, action: () => updateOrderStatus('On Hold') });
          break;
        case 'Parts Ordered':
          actions.push({ label: 'Start Work', icon: <Package className="h-4 w-4" />, action: () => updateOrderStatus('Work In Progress') });
          actions.push({ label: 'Put On Hold', icon: <Clock className="h-4 w-4" />, action: () => updateOrderStatus('On Hold') });
          break;
        case 'On Hold':
          actions.push({ label: 'Resume Work', icon: <Package className="h-4 w-4" />, action: () => updateOrderStatus('Work In Progress') });
          break;
        case 'Work In Progress':
          actions.push({ label: 'Move to QC', icon: <CheckCircle className="h-4 w-4" />, action: () => updateOrderStatus('Quality Check') });
          break;
        case 'Quality Check':
          actions.push({ label: 'Ready for Pickup', icon: <Clock className="h-4 w-4" />, action: () => updateOrderStatus('Ready for Pickup') });
          actions.push({ label: 'Ready for Delivery', icon: <Truck className="h-4 w-4" />, action: () => updateOrderStatus('Ready for Delivery') });
          break;
        case 'Ready for Pickup':
        case 'Ready for Delivery':
          actions.push({ label: 'Mark Delivered/Picked Up', icon: <CheckCircle className="h-4 w-4" />, action: () => updateOrderStatus('Delivered/Picked Up') });
          break;
        case 'Delivered/Picked Up':
          actions.push({ label: 'Close as Completed', icon: <CheckCircle className="h-4 w-4" />, action: () => updateOrderStatus('Completed') });
          break;
        case 'Completed':
          actions.push({ label: 'Start Warranty/Support', icon: <CheckCircle className="h-4 w-4" />, action: () => updateOrderStatus('Warranty/Support Active') });
          break;
        default:
          break;
      }
    } else {
      switch (order.status) {
        case 'Awaiting Payment':
          pushPaymentConfirmation();
          break;

        case 'Pending':
          actions.push({
            label: 'Confirm Order',
            icon: <CheckCircle className="h-4 w-4" />,
            action: () => setConfirmDialog(prev => ({
              ...prev,
              isOpen: true,
              onAccept: () => handleOrderConfirmation(true),
              onReject: () => handleOrderConfirmation(false),
              onClose: () => setConfirmDialog(prev => ({ ...prev, isOpen: false }))
            }))
          });
          break;

        case 'Payment Confirmed':
          actions.push({
            label: 'Confirm Order',
            icon: <CheckCircle className="h-4 w-4" />,
            action: () => setConfirmDialog(prev => ({
              ...prev,
              isOpen: true,
              onAccept: () => handleOrderConfirmation(true),
              onReject: () => handleOrderConfirmation(false),
              onClose: () => setConfirmDialog(prev => ({ ...prev, isOpen: false }))
            }))
          });
          actions.push(readyAction);
          break;

        case 'Confirmed':
          actions.push(readyAction);
          actions.push({
            label: 'Start Processing',
            icon: <Package className="h-4 w-4" />,
            action: () => updateOrderStatus('Processing')
          });
          break;

        case 'Processing':
          if (isPickupLikeOrder) {
            actions.push({
              label: 'Ready for Pickup',
              icon: <Clock className="h-4 w-4" />,
              action: () => updateOrderStatus('Ready for Pickup')
            });
          } else {
            actions.push({
              label: 'Ready to Ship',
              icon: <Clock className="h-4 w-4" />,
              action: () => updateOrderStatus('Ready to Ship')
            });
          }
          break;

        case 'Ready to Ship':
          if (order.type !== 'Pickup') {
            actions.push({
              label: 'Mark as Shipped',
              icon: <Truck className="h-4 w-4" />,
              action: () => updateOrderStatus('Shipped')
            });
          }
          break;

        case 'Shipped':
          if (order.type !== 'Pickup') {
            actions.push({
              label: 'Mark as Delivered',
              icon: <CheckCircle className="h-4 w-4" />,
              action: () => updateOrderStatus('Delivered')
            });
          }
          break;

        case 'Ready for Pickup':
          actions.push({
            label: 'Mark as Completed',
            icon: <CheckCircle className="h-4 w-4" />,
            action: () => updateOrderStatus('Completed')
          });
          break;
      }
    }

    // Cancellation option (except for completed/cancelled orders)
    if (!['Delivered', 'Delivered/Picked Up', 'Warranty/Support Active', 'Cancelled', 'Rejected'].includes(order.status)) {
      actions.push({
        label: 'Cancel Order',
        icon: <Ban className="h-4 w-4" />,
        action: () => setCancelDialog(prev => ({
          ...prev,
          isOpen: true,
          onConfirm: handleCancellation,
          onClose: () => setCancelDialog(prev => ({ ...prev, isOpen: false }))
        })),
        variant: 'destructive'
      });
    }

    return actions;
  };

  const getBadgeVariant = (status: OrderStatus) => {
    switch (status) {
      case 'Awaiting Payment': return 'destructive';
      case 'Payment Confirmed': return 'default';
      case 'Confirmed': return 'default';
      case 'Processing': return 'default';
      case 'Ready for Pickup': return 'default';
      case 'Ready for Delivery': return 'default';
      case 'Ready to Ship': return 'default';
      case 'Shipped': return 'secondary';
      case 'Delivered': return 'outline';
      case 'Delivered/Picked Up': return 'outline';
      case 'Visit Scheduled': return 'default';
      case 'Visit Completed': return 'default';
      case 'Diagnosis Done': return 'default';
      case 'Quote Sent': return 'default';
      case 'Awaiting Customer Approval': return 'default';
      case 'Approved': return 'default';
      case 'Parts Ordered': return 'default';
      case 'Work In Progress': return 'default';
      case 'Quality Check': return 'default';
      case 'On Hold': return 'outline';
      case 'Warranty/Support Active': return 'outline';
      case 'Cancelled': case 'Rejected': return 'destructive';
      default: return 'outline';
    }
  };

  const actions = getAvailableActions();
  const manageActions = actions.filter(action => action.label !== 'View Details' && action.label !== 'Print Invoice');

  if (variant === 'buttons') {
    return (
      <>
        <div className="flex items-center gap-2 flex-wrap">
          {actions.slice(0, 3).map((action, index) => (
            <Button
              key={index}
              variant={action.variant || 'outline'}
              size="sm"
              onClick={action.action}
              disabled={action.disabled || isProcessing}
              className="gap-2"
            >
              {action.icon}
              {action.label}
            </Button>
          ))}
          {actions.length > 3 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {actions.slice(3).map((action, index) => (
                  <DropdownMenuItem
                    key={index + 3}
                    onClick={action.action}
                    disabled={action.disabled || isProcessing}
                    className="gap-2"
                  >
                    {action.icon}
                    {action.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        {renderDialogs()}
      </>
    );
  }

  if (variant === 'compact') {
    return (
      <>
        <div className="flex items-center gap-2">
          <Badge variant={getBadgeVariant(order.status)}>
            {order.status}
          </Badge>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Order Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {actions.map((action, index) => (
                <DropdownMenuItem
                  key={index}
                  onClick={action.action}
                  disabled={action.disabled || isProcessing}
                  className="gap-2"
                >
                  {action.icon}
                  {action.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {renderDialogs()}
      </>
    );
  }

  // Default dropdown variant
  return (
    <>
      <div className="flex items-center gap-2">
        {hasPermission && manageActions.length > 0 ? (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`/orders/${order.id}`, '_blank')}
            >
              <Eye className="h-4 w-4 mr-2" />
              View Details
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>
                  {order.type === 'Pickup' ? 'Sales Actions' : 'Manager Actions'}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handlePrintInvoice}
                  className="gap-2"
                >
                  <Printer className="h-4 w-4" />
                  Print Invoice
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {manageActions.map((action, index) => (
                  <DropdownMenuItem
                    key={index}
                    onClick={action.action}
                    disabled={action.disabled || isProcessing}
                    className="gap-2"
                  >
                    {action.icon}
                    {action.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`/orders/${order.id}`, '_blank')}
            >
              <Eye className="h-4 w-4 mr-2" />
              View Details
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrintInvoice}
            >
              <Printer className="h-4 w-4 mr-2" />
              Print Invoice
            </Button>
            {!hasPermission && (
              <div className="text-xs text-muted-foreground">
                {order.type === 'Pickup' ? 'Sales Required' : 'Manager Required'}
              </div>
            )}
          </div>
        )}
      </div>
      {renderDialogs()}
    </>
  );

  function renderDialogs() {
    return (
      <>
        {/* Payment Confirmation Dialog */}
        <Dialog open={paymentDialog.isOpen} onOpenChange={(open) => {
          if (!open) {
            setPaymentDialog(prev => ({ ...prev, isOpen: false }));
            setPaymentReference(order.payment_reference ?? '');
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Payment Confirmation</DialogTitle>
              <DialogDescription>
                Has the payment for order {formatOrderNumber(order.id)} been confirmed?
                <br />
                <strong>Amount: ₹{order.total.toFixed(2)}</strong>
                <br />
                <strong>Payment Method: {order.payment_method || 'Not specified'}</strong>
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="payment-reference">Payment Reference (optional)</Label>
                <Input
                  id="payment-reference"
                  placeholder="Transaction or UTR number"
                  value={paymentReference}
                  onChange={(event) => setPaymentReference(event.target.value)}
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button 
                variant="outline" 
                onClick={() => handlePaymentConfirmation(false)}
                disabled={isProcessing}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Payment Not Received
              </Button>
              <Button 
                onClick={() => handlePaymentConfirmation(true)}
                disabled={isProcessing}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Payment Confirmed
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Order Confirmation Dialog */}
        <Dialog open={confirmDialog.isOpen} onOpenChange={(open) => 
          !open && setConfirmDialog(prev => ({ ...prev, isOpen: false }))
        }>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Order Confirmation</DialogTitle>
              <DialogDescription>
                Do you want to accept or reject order {formatOrderNumber(order.id)}?
                <br />
                <strong>Customer: {order.customer_name}</strong>
                <br />
                <strong>Total: ₹{order.total.toFixed(2)}</strong>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button 
                variant="destructive" 
                onClick={() => handleOrderConfirmation(false)}
                disabled={isProcessing}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject Order
              </Button>
              <Button 
                onClick={() => handleOrderConfirmation(true)}
                disabled={isProcessing}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Accept Order
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Cancellation Dialog */}
        <Dialog open={cancelDialog.isOpen} onOpenChange={(open) => {
          if (!open) {
            setCancelDialog(prev => ({ ...prev, isOpen: false }));
            setCancellationReason('');
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cancel Order</DialogTitle>
              <DialogDescription>
                Are you sure you want to cancel order {formatOrderNumber(order.id)}?
                Please provide a reason for cancellation.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="reason">Cancellation Reason</Label>
                <Textarea
                  id="reason"
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  placeholder="Enter reason for cancellation..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setCancelDialog(prev => ({ ...prev, isOpen: false }));
                  setCancellationReason('');
                }}
              >
                Keep Order
              </Button>
              <Button 
                variant="destructive"
                onClick={() => handleCancellation(cancellationReason)}
                disabled={isProcessing}
              >
                <Ban className="h-4 w-4 mr-2" />
                Cancel Order
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Upload Invoice Dialog */}
        <Dialog open={isUploadInvoiceOpen} onOpenChange={(open) => {
          if (!open) {
            setIsUploadInvoiceOpen(false);
            setInvoiceFile(null);
          }
        }}>
          <DialogContent className="border-zinc-800 bg-zinc-900/95 text-zinc-100 backdrop-blur-md">
            <DialogHeader>
              <DialogTitle>Upload Final Invoice PDF</DialogTitle>
              <DialogDescription className="text-zinc-400">
                Upload the final invoice PDF for order {formatOrderNumber(order.id)}. An email with the invoice download link will be automatically sent to the customer.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUploadInvoice} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="invoice-file" className="text-sm font-medium text-zinc-300">Select Invoice PDF</Label>
                <Input
                  id="invoice-file"
                  type="file"
                  accept=".pdf"
                  required
                  className="bg-zinc-950 border border-zinc-800 text-zinc-100 cursor-pointer"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setInvoiceFile(file);
                  }}
                />
              </div>
              <DialogFooter className="pt-4 gap-2">
                <Button 
                  type="button"
                  variant="outline" 
                  onClick={() => {
                    setIsUploadInvoiceOpen(false);
                    setInvoiceFile(null);
                  }}
                  disabled={uploadingInvoice}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={uploadingInvoice || !invoiceFile}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
                >
                  {uploadingInvoice ? 'Uploading...' : 'Upload & Send Email'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </>
    );
  }
}