'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  PlusCircle, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  ToggleLeft,
  ToggleRight,
  Clock,
  CheckCircle,
  AlertCircle,
  Wrench,
  Shield,
  Truck,
  HeadphonesIcon,
  RefreshCw,
  Award,
  Sparkles,
  Loader2,
  X
} from 'lucide-react';
import type { LucideProps } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import type { Service } from '@/lib/types';

const iconOptions = [
  { value: 'Wrench', label: 'Wrench (Technical)' },
  { value: 'Shield', label: 'Shield (Protection)' },
  { value: 'Truck', label: 'Truck (Delivery)' },
  { value: 'HeadphonesIcon', label: 'Headphones (Support)' },
  { value: 'RefreshCw', label: 'Refresh (Trade-in)' },
  { value: 'Award', label: 'Award (Premium)' },
];

const categoryOptions = [
  { value: 'Support', label: 'Support' },
  { value: 'Protection', label: 'Protection' },
  { value: 'Installation', label: 'Installation' },
  { value: 'Trade', label: 'Trade' },
  { value: 'Business', label: 'Business' },
  { value: 'CCTV', label: 'CCTV' },
  { value: 'Computer', label: 'Computer' },
  { value: 'Web Services', label: 'Web Services' },
];

const serviceSchema = z.object({
  name: z.string().min(3, 'Service name must be at least 3 characters'),
  category: z.string().min(1, 'Category is required'),
  price: z.number().min(0, 'Price must be positive').optional(),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  terms_and_conditions: z.string().min(10, 'Terms and conditions must be at least 10 characters'),
  icon: z.string().min(1, 'Icon is required'),
  badge: z.string().optional(),
  duration_days: z.number().min(1, 'Duration must be at least 1 day').optional(),
  display_order: z.number().min(0, 'Display order must be positive'),
  is_active: z.boolean(),
  features: z.array(z.string()).min(1, 'At least one feature is required'),
});

type ServiceFormValues = z.infer<typeof serviceSchema>;

export default function SuperadminServicesPage() {
  const [services, setServices] = React.useState<Service[]>([]);
  const [loading, setLoading] = React.useState(true);
  
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [selectedService, setSelectedService] = React.useState<Service | null>(null);

  const { toast } = useToast();

  const iconMap: Record<string, React.ComponentType<LucideProps>> = React.useMemo(() => ({
    Wrench,
    Shield,
    Truck,
    HeadphonesIcon,
    RefreshCw,
    Award,
  }), []);

  const fetchServices = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/superadmin/services');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch services');
      setServices(data.services || []);
    } catch (error) {
      logger.error('superadmin_fetch_services_failed', { error });
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to fetch services',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      const res = await fetch(`/api/superadmin/services/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update status');
      
      setServices(prev => prev.map(s => s.id === id ? { ...s, is_active: !currentActive } : s));
      toast({
        title: 'Status Updated',
        description: `Service is now ${!currentActive ? 'Active' : 'Inactive'}.`,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to update status',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const handleDeleteService = async (id: string) => {
    if (!confirm('Are you sure you want to delete this service?')) return;
    try {
      const res = await fetch(`/api/superadmin/services/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete service');

      setServices(prev => prev.filter(s => s.id !== id));
      toast({
        title: 'Success',
        description: 'Service deleted successfully',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Delete failed',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const handleEditClick = (service: Service) => {
    setSelectedService(service);
    setEditDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white font-sans">Services Core</h1>
          <p className="text-sm text-zinc-400">
            Configure platform services catalog directly in database
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} className="bg-primary hover:bg-primary/90 text-white font-medium text-xs">
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Service
        </Button>
      </div>

      <Card className="border-zinc-800 bg-zinc-950/60">
        <CardHeader>
          <CardTitle className="text-white">Active Services</CardTitle>
          <CardDescription className="text-zinc-400">
            Overview of tech-services offered in system.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader className="border-zinc-800">
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <TableHead className="text-zinc-400">Service</TableHead>
                <TableHead className="text-zinc-400">Category</TableHead>
                <TableHead className="text-zinc-400">Price</TableHead>
                <TableHead className="text-zinc-400">Status</TableHead>
                <TableHead className="text-zinc-400">Features</TableHead>
                <TableHead className="text-zinc-400 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-zinc-500">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                    Loading services...
                  </TableCell>
                </TableRow>
              ) : services.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-zinc-500">
                    No services found in database. Create your first service.
                  </TableCell>
                </TableRow>
              ) : (
                services.map((service) => {
                  const Icon = iconMap[service.icon] || Wrench;
                  return (
                    <TableRow key={service.id} className="border-zinc-850 hover:bg-zinc-900/20">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-primary">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-semibold text-white text-sm">{service.title || service.name}</div>
                            {service.badge && (
                              <Badge variant="secondary" className="text-[9px] uppercase tracking-wider bg-primary/10 text-primary border-transparent py-0 px-1.5 mt-0.5">
                                {service.badge}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-zinc-800 text-zinc-300 text-xs bg-zinc-900/40">
                          {service.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-zinc-300 font-medium font-mono text-xs">
                        {service.price ? `₹${Number(service.price).toLocaleString('en-IN')}` : 'Free'}
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => handleToggleActive(service.id, service.is_active)}
                          className="flex items-center gap-1.5 text-xs focus:outline-none text-zinc-400"
                        >
                          {service.is_active ? (
                            <>
                              <ToggleRight className="h-5 w-5 text-green-500" />
                              <span className="text-green-500 font-semibold">Active</span>
                            </>
                          ) : (
                            <>
                              <ToggleLeft className="h-5 w-5 text-zinc-600" />
                              <span className="text-zinc-500">Inactive</span>
                            </>
                          )}
                        </button>
                      </TableCell>
                      <TableCell className="text-zinc-400 text-xs">
                        {service.features?.length || 0} items
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-zinc-400 hover:text-white hover:bg-zinc-800">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-zinc-950 border-zinc-800 text-zinc-200">
                            <DropdownMenuLabel>Configure</DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-zinc-800" />
                            <DropdownMenuItem onClick={() => handleEditClick(service)} className="hover:bg-zinc-900 cursor-pointer">
                              <Edit className="mr-2 h-4.5 w-4.5" />
                              Edit Service
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDeleteService(service.id)} className="text-red-500 hover:bg-red-500/10 cursor-pointer">
                              <Trash2 className="mr-2 h-4.5 w-4.5" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ServiceFormDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={() => {
          setCreateDialogOpen(false);
          fetchServices();
        }}
      />

      {selectedService && (
        <ServiceFormDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          service={selectedService}
          onSuccess={() => {
            setEditDialogOpen(false);
            setSelectedService(null);
            fetchServices();
          }}
        />
      )}
    </div>
  );
}

interface ServiceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service?: Service | null;
  onSuccess: () => void;
}

function ServiceFormDialog({ open, onOpenChange, service, onSuccess }: ServiceFormDialogProps) {
  const [featureInput, setFeatureInput] = React.useState('');
  const [generatingDesc, setGeneratingDesc] = React.useState(false);
  const [generatingTc, setGeneratingTc] = React.useState(false);
  const { toast } = useToast();

  const form = useForm<ServiceFormValues>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: '',
      category: 'Support',
      price: undefined,
      description: '',
      terms_and_conditions: '',
      icon: 'Wrench',
      badge: '',
      duration_days: undefined,
      display_order: 0,
      is_active: true,
      features: [],
    },
  });

  React.useEffect(() => {
    if (service) {
      form.reset({
        name: service.name || service.title || '',
        category: service.category || 'Support',
        price: service.price ? Number(service.price) : undefined,
        description: service.description || '',
        terms_and_conditions: service.terms_and_conditions || '',
        icon: service.icon || 'Wrench',
        badge: service.badge || '',
        duration_days: service.duration_days ? Number(service.duration_days) : undefined,
        display_order: service.display_order || 0,
        is_active: service.is_active ?? true,
        features: service.features || [],
      });
    } else {
      form.reset({
        name: '',
        category: 'Support',
        price: undefined,
        description: '',
        terms_and_conditions: '',
        icon: 'Wrench',
        badge: '',
        duration_days: undefined,
        display_order: 0,
        is_active: true,
        features: [],
      });
    }
  }, [service, form, open]);

  const features = form.watch('features') || [];
  const nameValue = form.watch('name');

  const addFeature = () => {
    if (featureInput.trim()) {
      form.setValue('features', [...features, featureInput.trim()]);
      setFeatureInput('');
    }
  };

  const removeFeature = (idx: number) => {
    form.setValue('features', features.filter((_, i) => i !== idx));
  };

  const handleAiGenerate = async (field: 'description' | 'terms_and_conditions') => {
    if (!nameValue || nameValue.trim().length < 3) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Please specify a service name first (at least 3 characters).',
      });
      return;
    }

    if (field === 'description') setGeneratingDesc(true);
    else setGeneratingTc(true);

    try {
      const res = await fetch('/api/superadmin/services/ai-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nameValue, field }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate copy');

      form.setValue(field, data.text || '');
      toast({
        title: 'Copy Generated',
        description: `Successfully generated ${field === 'description' ? 'description' : 'T&C'} for "${nameValue}".`,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Generation Failed',
        description: error instanceof Error ? error.message : 'Unknown AI generation error',
      });
    } finally {
      if (field === 'description') setGeneratingDesc(false);
      else setGeneratingTc(false);
    }
  };

  const onSubmit = async (values: ServiceFormValues) => {
    try {
      const method = service ? 'PUT' : 'POST';
      const url = service ? `/api/superadmin/services/${service.id}` : '/api/superadmin/services';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save service');

      toast({
        title: 'Success',
        description: `Service ${service ? 'updated' : 'created'} successfully`,
      });
      onSuccess();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Save failed',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-zinc-950 border-zinc-800 text-zinc-100">
        <DialogHeader>
          <DialogTitle className="text-white">{service ? 'Configure Service' : 'Add New Service'}</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Define attributes and parameters for this dynamic platform offering.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-zinc-300">Service Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 4-Camera CCTV Installation" className="bg-zinc-900 border-zinc-800 text-white" {...field} />
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
                    <FormLabel className="text-zinc-300">Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-zinc-900 border-zinc-800 text-white">
                          <SelectValue placeholder="Select Category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-zinc-950 border-zinc-800 text-white">
                        {categoryOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} className="hover:bg-zinc-900 cursor-pointer">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-4">
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel className="text-zinc-300">Description</FormLabel>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={generatingDesc}
                        onClick={() => handleAiGenerate('description')}
                        className="text-[10px] h-7 px-2.5 border-primary/30 text-primary hover:bg-primary/10 flex items-center gap-1 bg-transparent hover:text-white"
                      >
                        {generatingDesc ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Sparkles className="h-3 w-3" />
                        )}
                        AI Generate
                      </Button>
                    </div>
                    <FormControl>
                      <Textarea
                        placeholder="Provide professional high-definition engineering copy..."
                        className="bg-zinc-900 border-zinc-800 text-white resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="terms_and_conditions"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel className="text-zinc-300">Terms & Conditions</FormLabel>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={generatingTc}
                        onClick={() => handleAiGenerate('terms_and_conditions')}
                        className="text-[10px] h-7 px-2.5 border-primary/30 text-primary hover:bg-primary/10 flex items-center gap-1 bg-transparent hover:text-white"
                      >
                        {generatingTc ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Sparkles className="h-3 w-3" />
                        )}
                        AI Generate
                      </Button>
                    </div>
                    <FormControl>
                      <Textarea
                        placeholder="Specify key exclusions, SLAs, or contract prerequisites..."
                        className="bg-zinc-900 border-zinc-800 text-white resize-none"
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="icon"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-zinc-300">Icon Marker</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-zinc-900 border-zinc-800 text-white">
                          <SelectValue placeholder="Select Icon" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-zinc-950 border-zinc-800 text-white">
                        {iconOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} className="hover:bg-zinc-900 cursor-pointer">
                            {opt.label}
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
                    <FormLabel className="text-zinc-300">Ribbon Badge (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Popular, Recommended, New" className="bg-zinc-900 border-zinc-800 text-white" {...field} />
                    </FormControl>
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
                    <FormLabel className="text-zinc-300">Price (₹)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="0.00"
                        className="bg-zinc-900 border-zinc-800 text-white font-mono"
                        value={field.value !== undefined ? field.value : ''}
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                      />
                    </FormControl>
                    <FormDescription className="text-[10px] text-zinc-550">Leave empty for quotation basis.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="duration_days"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-zinc-300">Duration (Days)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="e.g. 365"
                        className="bg-zinc-900 border-zinc-800 text-white font-mono"
                        value={field.value !== undefined ? field.value : ''}
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                      />
                    </FormControl>
                    <FormDescription className="text-[10px] text-zinc-550">SLA or validity duration.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="display_order"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-zinc-300">Display Weight</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="0"
                        className="bg-zinc-900 border-zinc-800 text-white font-mono"
                        value={field.value !== undefined ? field.value : 0}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription className="text-[10px] text-zinc-550">Lower numbers priority sorting.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="features"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-zinc-300">Features Checklist</FormLabel>
                  <div className="space-y-2.5">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Add key service item (e.g. Mobile access app configuration)"
                        className="bg-zinc-900 border-zinc-800 text-white text-xs"
                        value={featureInput}
                        onChange={(e) => setFeatureInput(e.target.value)}
                        onKeyDown={(e) => {
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
                        className="border-zinc-800 text-zinc-300 hover:bg-zinc-900 hover:text-white"
                      >
                        Add
                      </Button>
                    </div>
                    {features.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {features.map((feature, idx) => (
                          <Badge
                            key={idx}
                            variant="secondary"
                            className="bg-zinc-900 border border-zinc-800 text-zinc-300 flex items-center gap-1 py-0.5 px-2 text-xs"
                          >
                            {feature}
                            <button
                              type="button"
                              onClick={() => removeFeature(idx)}
                              className="ml-1 hover:text-red-500 text-zinc-500 focus:outline-none"
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
                <FormItem className="flex items-center justify-between rounded-lg border border-zinc-800 p-4 bg-zinc-900/20">
                  <div className="space-y-0.5">
                    <FormLabel className="text-zinc-300">Active Listing</FormLabel>
                    <FormDescription className="text-[10px] text-zinc-500">
                      Instantly expose this service offering to client checkout dashboards.
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

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="border-zinc-800 text-zinc-400 hover:bg-zinc-900 hover:text-white"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting} className="bg-primary hover:bg-primary/90 text-white font-medium">
                {form.formState.isSubmitting ? 'Saving...' : service ? 'Update Offer' : 'Publish Service'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
