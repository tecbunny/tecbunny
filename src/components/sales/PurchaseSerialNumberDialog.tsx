
'use client';

import * as React from 'react';

import type { Product } from '@/lib/types';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '../../hooks/use-toast';

import Modal from '../ui/modal';
import { Label } from '../ui/label';

interface PurchaseItem extends Product {
    quantity: number;
    purchase_price: number;
    serialNumbers?: string[];
}

interface PurchaseSerialNumberDialogProps {
  item: PurchaseItem;
  onClose: () => void;
  onSave: (productId: string, serials: string[]) => void;
}

export function PurchaseSerialNumberDialog({ item, onClose, onSave }: PurchaseSerialNumberDialogProps) {
  const [serialsText, setSerialsText] = React.useState(item.serialNumbers?.join('\n') || '');
  const { toast } = useToast();

  const handleSave = () => {
    const serials = serialsText.split('\n').map(s => s.trim()).filter(s => s);
    if (serials.length !== item.quantity) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: `Please enter exactly ${item.quantity} serial number(s). You have entered ${serials.length}.`,
      });
      return;
    }
    onSave(item.id, serials);
  };

  return (
    <Modal isOpen={true} onClose={onClose}>
      <div className="sm:max-w-md w-full">
        <div className="mb-4">
          <h2 className="text-2xl font-semibold">Enter Serial Numbers</h2>
          <p className="text-muted-foreground">For {item.name}. Please enter one serial number per line.</p>
        </div>
        <div className="space-y-4 py-4">
          <div className='space-y-2'>
            <Label htmlFor="serials">Serial Numbers ({item.quantity} required)</Label>
            <Textarea
              id="serials"
              value={serialsText}
              onChange={(e) => setSerialsText(e.target.value)}
              rows={10}
              placeholder="Paste or type serial numbers here, each on a new line."
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save Serials</Button>
        </div>
      </div>
    </Modal>
  );
}