'use client';

import { useState, useEffect, useCallback } from 'react';

import { 
  Phone, 
  MessageCircle, 
  User, 
  Calendar, 
  Send
} from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface Customer {
  id: string;
  phone: string;
  name: string;
  email?: string;
  lead_source: string;
  status: string;
  first_contact_date: string;
  last_contact_date: string;
  call_count: number;
  whatsapp_opted_in: boolean;
  created_at: string;
}

interface Interaction {
  id: string;
  interaction_type: string;
  direction: string;
  interaction_data: any;
  created_at: string;
}

export default function CustomerManagementDashboard() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [whatsappMessage, setWhatsappMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  const supabase = createClient();

  const loadCustomers = useCallback(async () => {
    try {
      let query = supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });

      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`);
      }

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (sourceFilter !== 'all') {
        query = query.eq('lead_source', sourceFilter);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      logger.error('Error loading customers in customer-management', { error });
    } finally {
      setLoading(false);
    }
  }, [supabase, searchTerm, statusFilter, sourceFilter]);

  const loadCustomerInteractions = useCallback(async (customerId: string) => {
    try {
      const { data, error } = await supabase
        .from('customer_interactions')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInteractions(data || []);
    } catch (error) {
      logger.error('Error loading interactions in customer-management', { error, customerId });
    }
  }, [supabase]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  useEffect(() => {
    if (selectedCustomer) {
      loadCustomerInteractions(selectedCustomer.id);
    }
  }, [selectedCustomer, loadCustomerInteractions]);

  const sendWhatsAppMessage = async () => {
    if (!selectedCustomer || !whatsappMessage.trim()) return;

    setSendingMessage(true);
    try {
      const response = await fetch('/api/customer/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_whatsapp',
          customerData: {
            phone: selectedCustomer.phone,
            message: whatsappMessage
          }
        })
      });

      if (response.ok) {
        setWhatsappMessage('');
        await loadCustomerInteractions(selectedCustomer.id);
        alert('Message sent successfully!');
      } else {
        alert('Failed to send message');
      }
    } catch (error) {
      logger.error('Error sending message in customer-management', { error, customerId: selectedCustomer?.id, message: whatsappMessage });
      alert('Error sending message');
    } finally {
      setSendingMessage(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new_lead': return 'bg-blue-500';
      case 'qualified': return 'bg-yellow-500';
      case 'customer': return 'bg-green-500';
      case 'inactive': return 'bg-gray-500';
      default: return 'bg-gray-400';
    }
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'phone_call': return <Phone className="w-4 h-4" />;
      case 'whatsapp': return <MessageCircle className="w-4 h-4" />;
      default: return <User className="w-4 h-4" />;
    }
  };

  if (loading) {
    return <div className="p-6">Loading customers...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">
            Customer Management Dashboard
          </h1>
          <p className="text-slate-300">
            Manage customers from phone contacts and WhatsApp interactions
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <User className="w-8 h-8 text-blue-500 mb-2" />
                <div className="ml-4">
                  <p className="text-sm text-slate-300">Total Customers</p>
                  <p className="text-2xl font-bold">{customers.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Phone className="w-8 h-8 text-green-500 mb-2" />
                <div className="ml-4">
                  <p className="text-sm text-slate-300">Phone Leads</p>
                  <p className="text-2xl font-bold">
                    {customers.filter(c => c.lead_source === 'phone_call').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <MessageCircle className="w-8 h-8 text-purple-500 mb-2" />
                <div className="ml-4">
                  <p className="text-sm text-slate-300">WhatsApp Leads</p>
                  <p className="text-2xl font-bold">
                    {customers.filter(c => c.lead_source === 'whatsapp').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Calendar className="w-8 h-8 text-orange-500 mb-2" />
                <div className="ml-4">
                  <p className="text-sm text-slate-300">New Today</p>
                  <p className="text-2xl font-bold">
                    {customers.filter(c => 
                      new Date(c.created_at).toDateString() === new Date().toDateString()
                    ).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Customer List */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Customers</CardTitle>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <Input
                      placeholder="Search customers..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2 border rounded-md"
                  >
                    <option value="all">All Status</option>
                    <option value="new_lead">New Lead</option>
                    <option value="qualified">Qualified</option>
                    <option value="customer">Customer</option>
                    <option value="inactive">Inactive</option>
                  </select>
                  <select
                    value={sourceFilter}
                    onChange={(e) => setSourceFilter(e.target.value)}
                    className="px-3 py-2 border rounded-md"
                  >
                    <option value="all">All Sources</option>
                    <option value="phone_call">Phone Call</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="website">Website</option>
                  </select>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {customers.map((customer) => (
                    <div
                      key={customer.id}
                      className={`p-4 border border-white/10 rounded-lg cursor-pointer transition-colors hover:bg-white/5 ${
                        selectedCustomer?.id === customer.id ? 'bg-blue-50 border-blue-200' : ''
                      }`}
                      onClick={() => setSelectedCustomer(customer)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          {getSourceIcon(customer.lead_source)}
                          <div>
                            <h3 className="font-medium text-white">
                              {customer.name}
                            </h3>
                            <p className="text-sm text-slate-300">
                              {customer.phone}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge className={getStatusColor(customer.status)}>
                            {customer.status}
                          </Badge>
                          {customer.whatsapp_opted_in && (
                            <MessageCircle className="w-4 h-4 text-green-500" />
                          )}
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-slate-400">
                        First contact: {new Date(customer.first_contact_date).toLocaleDateString()}
                        {customer.call_count > 0 && (
                          <span className="ml-2">• {customer.call_count} calls</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Customer Details & WhatsApp */}
          <div className="space-y-6">
            {selectedCustomer && (
              <>
                {/* Customer Details */}
                <Card>
                  <CardHeader>
                    <CardTitle>Customer Details</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-slate-300">Name</label>
                        <p className="text-white">{selectedCustomer.name}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-slate-300">Phone</label>
                        <p className="text-white">{selectedCustomer.phone}</p>
                      </div>
                      {selectedCustomer.email && (
                        <div>
                          <label className="text-sm font-medium text-slate-300">Email</label>
                          <p className="text-white">{selectedCustomer.email}</p>
                        </div>
                      )}
                      <div>
                        <label className="text-sm font-medium text-slate-300">Source</label>
                        <p className="text-white">{selectedCustomer.lead_source}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-slate-300">Status</label>
                        <Badge className={getStatusColor(selectedCustomer.status)}>
                          {selectedCustomer.status}
                        </Badge>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-slate-300">Call Count</label>
                        <p className="text-white">{selectedCustomer.call_count}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Send WhatsApp Message */}
                {selectedCustomer.whatsapp_opted_in && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <MessageCircle className="w-5 h-5 mr-2" />
                        Send WhatsApp Message
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <Textarea
                          placeholder="Type your message..."
                          value={whatsappMessage}
                          onChange={(e) => setWhatsappMessage(e.target.value)}
                          rows={4}
                        />
                        <Button
                          onClick={sendWhatsAppMessage}
                          disabled={!whatsappMessage.trim() || sendingMessage}
                          className="w-full"
                        >
                          <Send className="w-4 h-4 mr-2" />
                          {sendingMessage ? 'Sending...' : 'Send Message'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Recent Interactions */}
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Interactions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {interactions.map((interaction) => (
                        <div key={interaction.id} className="p-3 border rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">
                              {interaction.interaction_type}
                            </span>
                            <span className="text-xs text-slate-400">
                              {new Date(interaction.created_at).toLocaleString()}
                            </span>
                          </div>
                          <div className="text-xs text-slate-300">
                            Direction: {interaction.direction}
                          </div>
                          {interaction.interaction_data && (
                            <div className="text-xs text-slate-400 mt-1">
                              {JSON.stringify(interaction.interaction_data, null, 2)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}