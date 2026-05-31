'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { X } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '../../hooks/use-toast';
import { logger } from '@/lib/logger';
import { Badge } from '@/components/ui/badge';
import type { Service } from '@/lib/types';

const serviceSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  icon: z.string().min(1, 'Icon is required'),
  badge: z.string().optional(),
  category: z.string().min(1, 'Category is required'),
  price: z.coerce.number().min(0, 'Price must be positive').optional(),
  duration_days: z.coerce.number().min(1, 'Duration must be at least 1 day').optional(),
  display_order: z.coerce.number().min(0, 'Display order must be positive').default(0),
  is_active: z.boolean().default(true),
  features: z.array(z.string()).min(1, 'At least one feature is required'),
});

type ServiceFormInput = z.input<typeof serviceSchema>;
type ServiceFormValues = z.output<typeof serviceSchema>;

interface EditServiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service: Service;
  onServiceUpdated: () => void;
}

const iconOptions = [
  { value: 'Wrench', label: 'Wrench (Technical)' },
  { value: 'Shield', label: 'Shield (Protection)' },
  { value: 'Truck', label: 'Truck (Delivery)' },
  { value: 'HeadphonesIcon', label: 'Headphones (Support)' },
  { value: 'RefreshCw', label: 'Refresh (Trade-in)' },
  { value: 'Award', label: 'Award (Premium)' },
  { value: 'Settings', label: 'Settings (Configuration)' },
  { value: 'Smartphone', label: 'Smartphone (Mobile)' },
  { value: 'Laptop', label: 'Laptop (Computer)' },
  { value: 'Zap', label: 'Zap (Fast)' },
];

const categoryOptions = [
  { value: 'Support', label: 'Support' },
  { value: 'Protection', label: 'Protection' },
  { value: 'Installation', label: 'Installation' },
  { value: 'Trade', label: 'Trade' },
  { value: 'Business', label: 'Business' },
];

export function EditServiceDialog({ open, onOpenChange, service, onServiceUpdated }: EditServiceDialogProps) {
  const [featureInput, setFeatureInput] = React.useState('');
  const supabase = createClient();
  const { toast } = useToast();

  const form = useForm<ServiceFormInput, any, ServiceFormValues>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      title: service.title || '',
      description: service.description || '',
      icon: service.icon || '',
      badge: service.badge || '',
      category: service.category || '',
      price: service.price || undefined,
      duration_days: service.duration_days || undefined,
      display_order: service.display_order || 0,
      is_active: service.is_active ?? true,
      features: service.features || [],
    },
  });

  const features = form.watch('features');

  // Update form when service changes
  React.useEffect(() => {
    if (service) {
      form.reset({
        title: service.title || '',
        description: service.description || '',
        icon: service.icon || '',
        badge: service.badge || '',
        category: service.category || '',
        price: service.price || undefined,
        duration_days: service.duration_days || undefined,
        display_order: service.display_order || 0,
        is_active: service.is_active ?? true,
        features: service.features || [],
      });
    }
  }, [service, form]);

  const addFeature = () => {
    if (featureInput.trim()) {
      const currentFeatures = form.getValues('features');
      form.setValue('features', [...currentFeatures, featureInput.trim()]);
      setFeatureInput('');
    }
  };

  const removeFeature = (index: number) => {
    const currentFeatures = form.getValues('features');
    form.setValue('features', currentFeatures.filter((_, i) => i !== index));
  };

  const onSubmit = async (data: ServiceFormValues) => {
    try {
      const { error } = await supabase
        .from('services')
        .update({
          ...data,
          badge: data.badge || null,
          price: data.price || null,
          duration_days: data.duration_days || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', service.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Service updated successfully',
      });

      onServiceUpdated();
    } catch (error) {
      logger.error('Error updating service in EditServiceDialog', { error, values: data, serviceId: service.id });
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update service',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Service</DialogTitle>
          <DialogDescription>
            Update service details
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Service Title</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Technical Support" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categoryOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe what this service offers..."
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="icon"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Icon</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select icon" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {iconOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="badge"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Badge (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Popular, New" {...field} />
                    </FormControl>
                    <FormDescription>
                      Add a badge like "Popular", "New", "Recommended"
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price (₹)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={typeof field.value === 'number' || typeof field.value === 'string' ? field.value : ''}
                        onChange={(event) => field.onChange(event.target.value)}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                      />
                    </FormControl>
                    <FormDescription>
                      Leave empty for free services
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="duration_days"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duration (Days)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="1"
                        value={typeof field.value === 'number' || typeof field.value === 'string' ? field.value : ''}
                        onChange={(event) => field.onChange(event.target.value)}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                      />
                    </FormControl>
                    <FormDescription>
                      How long the service lasts
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="display_order"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display Order</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="0"
                        value={typeof field.value === 'number' || typeof field.value === 'string' ? field.value : ''}
                        onChange={(event) => field.onChange(event.target.value)}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                      />
                    </FormControl>
                    <FormDescription>
                      Lower numbers show first
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="features"
              render={() => (
                <FormItem>
                  <FormLabel>Features</FormLabel>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Add a feature..."
                        value={featureInput}
                        onChange={(e) => setFeatureInput(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addFeature();
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={addFeature}
                        disabled={!featureInput.trim()}
                      >
                        Add
                      </Button>
                    </div>
                    {features.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {features.map((feature, index) => (
                          <Badge
                            key={index}
                            variant="secondary"
                            className="flex items-center gap-1"
                          >
                            {feature}
                            <button
                              type="button"
                              onClick={() => removeFeature(index)}
                              className="ml-1 hover:text-red-500"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel>Active Service</FormLabel>
                    <FormDescription>
                      Make this service available to customers
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Updating...' : 'Update Service'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}