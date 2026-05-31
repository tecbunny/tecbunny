
'use client';

import * as React from 'react';

import type { Product } from '@/lib/types';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

import Modal from '../ui/modal';

interface ProductWithStock extends Product {
    stock_quantity: number;
    stock_label: string;
    warehouse_location?: string;
    minimum_stock?: number;
    available_serials?: number;
    last_updated?: string;
    serial_numbers?: string[];
}

interface ViewSerialsDialogProps {
  product: ProductWithStock;
  onClose: () => void;
}

export function ViewSerialsDialog({ product, onClose }: ViewSerialsDialogProps) {
  const serialNumbers = product.serial_numbers || [];
  
  return (
    <Modal isOpen={true} onClose={onClose}>
      <div className="sm:max-w-md w-full">
        <div className="mb-4">
          <h2 className="text-2xl font-semibold">Serial Numbers for {product.name}</h2>
          <p className="text-muted-foreground">There are currently {serialNumbers.length} units in stock with serial numbers.</p>
        </div>
        <div className="py-4">
          <ScrollArea className="h-72 w-full rounded-md border p-4">
            <div className="space-y-2">
              {serialNumbers.length > 0 ? (
                serialNumbers.map((serial) => (
                  <div key={serial} className="font-mono text-sm">
                    {serial}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center">
                  No serial numbers found in stock.
                </p>
              )}
            </div>
          </ScrollArea>
        </div>
        <div className="flex justify-end mt-6">
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  );
}