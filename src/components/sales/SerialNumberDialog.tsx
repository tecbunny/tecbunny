
'use client';

import * as React from 'react';

import type { Product, InventoryItem } from '@/lib/types';

import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '../../hooks/use-toast';

import { createClient } from '@/lib/supabase/client';

import { Input } from '../ui/input';
import Modal from '../ui/modal';

interface SerialNumberDialogProps {
  product: Product;
  onClose: () => void;
  onSave: (product: Product, serials: string[]) => void;
}

export function SerialNumberDialog({ product, onClose, onSave }: SerialNumberDialogProps) {
  const [selectedSerials, setSelectedSerials] = React.useState<string[]>([]);
  const [quantity, setQuantity] = React.useState(1);
  const [productInventory, setProductInventory] = React.useState<InventoryItem | null>(null);
  const { toast } = useToast();
  const supabase = createClient();

  React.useEffect(() => {
    const fetchInventory = async () => {
        const { data, error } = await supabase
            .from('inventory')
            .select('*')
            .eq('product_id', product.id)
            .single();
        
        if (error) {
            logger.error("Error fetching inventory for serials", { error, productId: product.id });
        } else {
            setProductInventory(data || null);
        }
    };
    fetchInventory();
  }, [product.id, supabase]);


  const availableSerials = productInventory?.serial_numbers || [];
  const stock = productInventory?.stock || 0;

  const handleCheckboxChange = (serial: string) => {
    setSelectedSerials((prev) => {
      const isSelected = prev.includes(serial);
      if (isSelected) {
        return prev.filter((s) => s !== serial);
      } else {
        if (prev.length >= quantity) {
          toast({
            variant: 'destructive',
            title: `You can only select ${quantity} serial number(s).`,
          });
          return prev;
        }
        return [...prev, serial];
      }
    });
  };
  
  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let newQuantity = parseInt(e.target.value, 10);
      if (isNaN(newQuantity) || newQuantity < 1) {
          newQuantity = 1;
      }
      if (newQuantity > stock) {
          newQuantity = stock;
          toast({ variant: 'destructive', title: 'Quantity exceeds available stock.'});
      }
      setQuantity(newQuantity);
      setSelectedSerials([]);
  }

  const handleSave = () => {
    if (selectedSerials.length !== quantity) {
      toast({
        variant: 'destructive',
        title: `Please select exactly ${quantity} serial number(s).`,
      });
      return;
    }
    onSave(product, selectedSerials);
  };

  return (
    <Modal isOpen={true} onClose={onClose}>
      <div className="sm:max-w-md w-full">
        <div className="mb-4">
          <h2 className="text-2xl font-semibold">Select Serial Numbers</h2>
          <p className="text-muted-foreground">{product.name} requires serial number tracking.</p>
        </div>
        <div className="space-y-4 py-4">
          <div className="flex items-center gap-4">
            <Label htmlFor="quantity">Quantity (Max: {stock})</Label>
            <Input
              id="quantity"
              type="number"
              value={quantity}
              onChange={handleQuantityChange}
              className="w-20"
              min="1"
              max={stock}
            />
          </div>
          <p className="text-sm text-muted-foreground">Please select {quantity} serial number(s) from the list below.</p>
          <ScrollArea className="h-48 w-full rounded-md border p-4">
            {availableSerials.length > 0 ? (
              <div className="space-y-2">
                {availableSerials.map((serial) => (
                  <div key={serial} className="flex items-center space-x-2">
                    <Checkbox
                      id={serial}
                      checked={selectedSerials.includes(serial)}
                      onCheckedChange={() => handleCheckboxChange(serial)}
                    />
                    <Label htmlFor={serial} className="font-mono text-sm">
                      {serial}
                    </Label>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center">
                No serial numbers in stock for this product.
              </p>
            )}
          </ScrollArea>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={availableSerials.length === 0}>Add to Cart</Button>
        </div>
      </div>
    </Modal>
  );
}