
'use client';

import * as React from 'react';

import type { Order, OrderStatus } from '@/lib/types';
import { Button } from '@/components/ui/button';

import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { InvoiceTemplate, type CompanySettings } from '@/components/invoices/InvoiceTemplate';

import Modal from '../ui/modal';

interface PickupOrderDialogProps {
  order: Order;
  isOpen: boolean;
  onClose: () => void;
  onUpdateStatus: (orderId: string, newStatus: OrderStatus) => void;
}

const companySettings: CompanySettings = {
    name: 'TecBunny',
    address: '123 Tech Lane, Circuit City, 560100',
    gstin: '30AAMCT1608G1ZO',
    logoUrl: '/logo.svg' 
};

export function PickupOrderDialog({ order, isOpen, onClose, onUpdateStatus }: PickupOrderDialogProps) {
  const [showInvoice, setShowInvoice] = React.useState(false);

  const handleStatusUpdate = (newStatus: OrderStatus) => {
    onUpdateStatus(order.id, newStatus);
    onClose();
  };
  
  const handleClose = () => {
    setShowInvoice(false);
    onClose();
  }
  
  const getBadgeVariant = (status: OrderStatus) => {
    switch (status) {
        case 'Pending': return 'destructive';
        case 'Ready for Pickup': return 'default';
        case 'Completed': return 'secondary';
        default: return 'outline';
    }
  }

  if (showInvoice) {
    return (
      <Modal isOpen={isOpen} onClose={handleClose}>
        <div className="max-w-4xl w-full">
          <Button onClick={() => setShowInvoice(false)} variant="outline" className="mb-4">Back to Details</Button>
          <InvoiceTemplate order={order} settings={companySettings} />
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <div className="sm:max-w-lg w-full">
        <div className="mb-4">
          <h2 className="text-2xl font-semibold">Order Details: {order.id}</h2>
          <p className="text-muted-foreground">Customer: {order.customer_name} | Date: {new Date(order.created_at).toLocaleDateString()}</p>
        </div>
        <div className="space-y-4 py-4">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Status</span>
            <Badge variant={getBadgeVariant(order.status)}>{order.status}</Badge>
          </div>
          <Separator />
          <h4 className="font-medium">Items</h4>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-center">Qty</TableHead>
                <TableHead className="text-right">Price</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items.map((item) => (
                <TableRow key={item.productId}>
                  <TableCell>{item.name}</TableCell>
                  <TableCell className="text-center">{item.quantity}</TableCell>
                  <TableCell className="text-right">₹{(item.price * item.quantity).toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Separator />
          <div className="flex justify-end font-bold text-lg">
            <span>Total: ₹{order.total.toFixed(2)}</span>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:justify-between gap-2 mt-6">
          <Button variant="outline" onClick={() => setShowInvoice(true)}>Print Invoice</Button>
          {order.status !== 'Completed' && (
            <div className="flex gap-2">
              {order.status === 'Pending' && (
                <Button onClick={() => handleStatusUpdate('Ready for Pickup')}>Mark as Ready for Pickup</Button>
              )}
              {order.status === 'Ready for Pickup' && (
                <Button onClick={() => handleStatusUpdate('Completed')}>Mark as Completed</Button>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}