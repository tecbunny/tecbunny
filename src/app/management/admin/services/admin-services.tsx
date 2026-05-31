'use client';

import * as React from 'react';
import Link from 'next/link';

import { 
  PlusCircle, 
  MoreHorizontal, 
  Eye, 
  Edit, 
  Trash2, 
  ToggleLeft,
  ToggleRight,
  Users,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

import { 
  Wrench, 
  Shield, 
  Truck, 
  HeadphonesIcon, 
  RefreshCw, 
  Award 
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

import { createClient } from '@/lib/supabase/client';
import { useToast } from '../../../../hooks/use-toast';
import type { Service, ServiceRequest } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreateServiceDialog } from '@/components/admin/CreateServiceDialog';
import { EditServiceDialog } from '@/components/admin/EditServiceDialog';

import { logger } from '@/lib/logger';

export default function AdminServicesPage() {
  const [services, setServices] = React.useState<Service[]>([]);
  const [serviceRequests, setServiceRequests] = React.useState<ServiceRequest[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [requestsLoading, setRequestsLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState<'services' | 'requests'>('services');
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [selectedService, setSelectedService] = React.useState<Service | null>(null);
  
  const supabase = createClient();
  const { toast } = useToast();

  const iconMap = React.useMemo(() => ({
    Wrench,
    Shield,
    Truck,
    HeadphonesIcon,
    RefreshCw,
    Award,
  } as Record<string, React.ComponentType<LucideProps>>), []);
  const fetchServices = React.useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/services');
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to fetch services');
      }
      const data = Array.isArray(payload?.services) ? payload.services : [];
      const safe = data.map((s: any) => ({
        ...s,
        icon: iconMap[String(s.icon)] || Wrench,
        features: Array.isArray(s.features) ? s.features : [],
        is_active: typeof s.is_active === 'boolean' ? s.is_active : true,
        display_order: typeof s.display_order === 'number' ? s.display_order : 0,
      }));
      setServices(safe);
    } catch (error) {
      logger.error('Error fetching services:', { error });
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch services',
      });
    } finally {
      setLoading(false);
    }
  }, [iconMap, toast]);

  const fetchServiceRequests = React.useCallback(async () => {
    try {
      setRequestsLoading(true);
      const { data, error } = await supabase
        .from('service_requests')
        .select(`
          *,
          service:services(title, icon),
          customer:profiles!service_requests_customer_id_fkey(name),
          assigned:profiles!service_requests_assigned_to_fkey(name)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setServiceRequests(data || []);
    } catch (error) {
      logger.error('Error fetching service requests:', { error });
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch service requests',
      });
    } finally {
      setRequestsLoading(false);
    }
  }, [supabase, toast]);

  const toggleServiceStatus = async (serviceId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('services')
        .update({ is_active: !currentStatus })
        .eq('id', serviceId);

      if (error) throw error;

      setServices(services.map(service => 
        service.id === serviceId 
          ? { ...service, is_active: !currentStatus }
          : service
      ));

      toast({
        title: 'Success',
        description: `Service ${!currentStatus ? 'activated' : 'deactivated'} successfully`,
      });
    } catch (error) {
      logger.error('Error updating service:', { error });
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update service status',
      });
    }
  };

  const deleteService = async (serviceId: string) => {
    try {
      const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', serviceId);

      if (error) throw error;

      setServices(services.filter(service => service.id !== serviceId));
      toast({
        title: 'Success',
        description: 'Service deleted successfully',
      });
    } catch (error) {
      logger.error('Error deleting service:', { error });
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to delete service',
      });
    }
  };

  const updateRequestStatus = async (requestId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('service_requests')
        .update({ 
          status: newStatus,
          completed_date: newStatus === 'completed' ? new Date().toISOString() : null
        })
        .eq('id', requestId);

      if (error) throw error;

      setServiceRequests(serviceRequests.map(request => 
        request.id === requestId 
          ? { ...request, status: newStatus as any }
          : request
      ));

      toast({
        title: 'Success',
        description: 'Request status updated successfully',
      });
    } catch (error) {
      logger.error('Error updating request:', { error });
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update request status',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'in_progress':
        return <Badge variant="outline"><AlertCircle className="w-3 h-3 mr-1" />In Progress</Badge>;
      case 'completed':
        return <Badge variant="default"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return <Badge variant="destructive">Urgent</Badge>;
      case 'high':
        return <Badge variant="destructive">High</Badge>;
      case 'medium':
        return <Badge variant="outline">Medium</Badge>;
      case 'low':
        return <Badge variant="secondary">Low</Badge>;
      default:
        return <Badge variant="secondary">{priority}</Badge>;
    }
  };

  React.useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  React.useEffect(() => {
    if (activeTab !== 'requests') return;
    fetchServiceRequests();
  }, [activeTab, fetchServiceRequests]);

  const handleServiceCreated = () => {
    fetchServices();
    setCreateDialogOpen(false);
  };

  const handleServiceUpdated = () => {
    fetchServices();
    setEditDialogOpen(false);
  };

  const handleEditService = (service: Service) => {
    setSelectedService(service);
    setEditDialogOpen(true);
  };

  // Calculate statistics
  const totalServices = services.length;
  const activeServices = services.filter(s => s.is_active).length;
  const totalRequests = serviceRequests.length;
  const pendingRequests = serviceRequests.filter(r => r.status === 'pending').length;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Service Management</h1>
          <p className="text-muted-foreground">
            Manage services and service requests
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/services" target="_blank" rel="noopener noreferrer">
              <Eye className="mr-2 h-4 w-4" />
              View Services Page
            </Link>
          </Button>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Service
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Services</p>
                <p className="text-2xl font-bold">{totalServices}</p>
              </div>
              <div className="p-2 bg-blue-100 rounded-full">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Services</p>
                <p className="text-2xl font-bold">{activeServices}</p>
              </div>
              <div className="p-2 bg-green-100 rounded-full">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Requests</p>
                <p className="text-2xl font-bold">{totalRequests}</p>
              </div>
              <div className="p-2 bg-purple-100 rounded-full">
                <AlertCircle className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Requests</p>
                <p className="text-2xl font-bold">{pendingRequests}</p>
              </div>
              <div className="p-2 bg-orange-100 rounded-full">
                <Clock className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'services' | 'requests')} className="w-full">
        <TabsList>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="requests">Service Requests</TabsTrigger>
        </TabsList>

        <TabsContent value="services" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Services</CardTitle>
              <CardDescription>
                Manage your service offerings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Features</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      </TableRow>
                    ))
                  ) : services.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        No services found. Create your first service to get started.
                      </TableCell>
                    </TableRow>
                  ) : (
                    services.map((service) => (
                      <TableRow key={service.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="p-2 rounded-lg bg-primary/10">
                              {(() => {
                                const Icon = iconMap[String(service.icon)] || Wrench;
                                return <Icon className="h-5 w-5 text-primary" />;
                              })()}
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="font-medium">{service.title}</div>
                              {service.badge && (
                                <Badge variant="secondary" className="text-xs">
                                  {service.badge}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{service.category}</Badge>
                        </TableCell>
                        <TableCell>
                          {service.price ? `₹${service.price}` : 'Free'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleServiceStatus(service.id, service.is_active)}
                              className="p-1 hover:bg-gray-100 rounded"
                            >
                              {service.is_active ? (
                                <ToggleRight className="h-5 w-5 text-green-600" />
                              ) : (
                                <ToggleLeft className="h-5 w-5 text-gray-400" />
                              )}
                            </button>
                            <span className={`text-sm ${service.is_active ? 'text-green-600' : 'text-gray-400'}`}>
                              {service.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-muted-foreground">
                            {Array.isArray(service.features) ? service.features.length : 0} features
                          </div>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleEditService(service)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => toggleServiceStatus(service.id, service.is_active)}
                              >
                                {service.is_active ? (
                                  <>
                                    <ToggleLeft className="mr-2 h-4 w-4" />
                                    Deactivate
                                  </>
                                ) : (
                                  <>
                                    <ToggleRight className="mr-2 h-4 w-4" />
                                    Activate
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => deleteService(service.id)}
                                className="text-red-600"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requests" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Service Requests</CardTitle>
              <CardDescription>
                Manage customer service requests
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Request ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requestsLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      </TableRow>
                    ))
                  ) : serviceRequests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        No service requests found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    serviceRequests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell className="font-mono text-sm">
                          #{request.id.slice(-8)}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{request.customer_name}</div>
                            <div className="text-sm text-muted-foreground">
                              {request.customer_email}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-medium">
                              {(request.service as any)?.title || 'Unknown Service'}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(request.status)}
                        </TableCell>
                        <TableCell>
                          {getPriorityBadge(request.priority)}
                        </TableCell>
                        <TableCell>
                          {new Date(request.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem>
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => updateRequestStatus(request.id, 'in_progress')}
                              >
                                Mark In Progress
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => updateRequestStatus(request.id, 'completed')}
                              >
                                Mark Completed
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => updateRequestStatus(request.id, 'cancelled')}
                                className="text-red-600"
                              >
                                Cancel Request
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <CreateServiceDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onServiceCreated={handleServiceCreated}
      />

      {selectedService && (
        <EditServiceDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          service={selectedService}
          onServiceUpdated={handleServiceUpdated}
        />
      )}
    </div>
  );
}
