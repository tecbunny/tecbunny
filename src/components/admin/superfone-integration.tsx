'use client';

import React, { useState, useEffect, useCallback } from 'react';

import { 
  Loader2, 
  Phone, 
  MessageSquare, 
  Users, 
  BarChart3, 
  Settings,
  Send,
  Play,
  Check
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface CallLog {
  id: string;
  call_id: string;
  from_number: string;
  to_number: string;
  status: string;
  duration?: number;
  start_time: string;
  recording_url?: string;
}

interface MessageLog {
  id: string;
  message_id: string;
  type: string;
  recipient: string;
  content: string;
  status: string;
  sent_at: string;
}

interface SuperfoneContact {
  id: string;
  phone_number: string;
  name?: string;
  email?: string;
  company?: string;
  tags?: string[];
}

interface Analytics {
  total_calls: number;
  total_messages: number;
  total_contacts: number;
  call_success_rate: number;
  message_delivery_rate: number;
}

export default function SuperfoneIntegrationPage() {
  const [activeTab, setActiveTab] = useState('calls');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  // Call management state
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [callForm, setCallForm] = useState({
    from_number: '',
    to_number: '',
    caller_id: '',
    recording_enabled: true
  });

  // Message management state
  const [messageLogs, setMessageLogs] = useState<MessageLog[]>([]);
  const [messageForm, setMessageForm] = useState({
    type: 'whatsapp_text',
    recipient: '',
    message: '',
    template_name: ''
  });

  // Contact management state
  const [contacts] = useState<SuperfoneContact[]>([]);
  const [contactForm, setContactForm] = useState({
    phone_number: '',
    name: '',
    email: '',
    company: '',
    tags: ''
  });

  // Analytics state
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [analyticsDateRange, setAnalyticsDateRange] = useState({
    start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0]
  });

  // Load initial data
  useEffect(() => {
    if (activeTab === 'calls') {
      loadCallLogs();
    } else if (activeTab === 'messages') {
      loadMessageLogs();
    } else if (activeTab === 'contacts') {
      loadContacts();
    } else if (activeTab === 'analytics') {
      loadAnalytics();
    }
  });

  // =============================================================================
  // CALL MANAGEMENT
  // =============================================================================

  const loadCallLogs = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/superfone/analytics?start_date=${analyticsDateRange.start_date}&end_date=${analyticsDateRange.end_date}&type=calls`);
      const data = await response.json();
      
      if (response.ok) {
        setCallLogs(data.call_logs || []);
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to load call logs' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error loading call logs' });
    } finally {
      setLoading(false);
    }
  }, [analyticsDateRange]);

  const initiateCall = async () => {
    try {
      setLoading(true);
      setMessage({ type: '', text: '' });

      const response = await fetch('/api/superfone/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(callForm)
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: `Call initiated successfully. Call ID: ${data.call_id}` });
        setCallForm({ from_number: '', to_number: '', caller_id: '', recording_enabled: true });
        loadCallLogs(); // Refresh the list
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to initiate call' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error initiating call' });
    } finally {
      setLoading(false);
    }
  };

  // =============================================================================
  // MESSAGE MANAGEMENT
  // =============================================================================

  const loadMessageLogs = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/superfone/analytics?start_date=${analyticsDateRange.start_date}&end_date=${analyticsDateRange.end_date}&type=messages`);
      const data = await response.json();
      
      if (response.ok) {
        setMessageLogs(data.message_logs || []);
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to load message logs' });
      }
    } catch (_error) {
      setMessage({ type: 'error', text: 'Network error loading message logs' });
    } finally {
      setLoading(false);
    }
  }, [analyticsDateRange]);

  const sendMessage = async () => {
    try {
      setLoading(true);
      setMessage({ type: '', text: '' });

      let endpoint = '/api/superfone/whatsapp/text';
      let payload: any = {
        to: messageForm.recipient,
        message: messageForm.message
      };

      if (messageForm.type === 'whatsapp_template') {
        endpoint = '/api/superfone/whatsapp/template';
        payload = {
          template_name: messageForm.template_name,
          recipient: messageForm.recipient,
          language_code: 'en'
        };
      } else if (messageForm.type === 'sms') {
        endpoint = '/api/superfone/sms';
        payload = {
          to_number: messageForm.recipient,
          message: messageForm.message
        };
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: `Message sent successfully. Message ID: ${data.message_id}` });
        setMessageForm({ type: 'whatsapp_text', recipient: '', message: '', template_name: '' });
        loadMessageLogs(); // Refresh the list
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to send message' });
      }
    } catch (_error) {
      setMessage({ type: 'error', text: 'Network error sending message' });
    } finally {
      setLoading(false);
    }
  };

  // =============================================================================
  // CONTACT MANAGEMENT
  // =============================================================================

  const loadContacts = useCallback(async () => {
    try {
      setLoading(true);
      // Implementation would fetch from your contacts API
      setLoading(false);
    } catch (_error) {
      setMessage({ type: 'error', text: 'Network error loading contacts' });
      setLoading(false);
    }
  }, []);

  const createContact = async () => {
    try {
      setLoading(true);
      setMessage({ type: '', text: '' });

      const payload = {
        ...contactForm,
        tags: contactForm.tags.split(',').map(tag => tag.trim()).filter(Boolean)
      };

      const response = await fetch('/api/superfone/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: `Contact created successfully. Contact ID: ${data.contact_id}` });
        setContactForm({ phone_number: '', name: '', email: '', company: '', tags: '' });
        loadContacts(); // Refresh the list
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to create contact' });
      }
    } catch (_error) {
      setMessage({ type: 'error', text: 'Network error creating contact' });
    } finally {
      setLoading(false);
    }
  };

  // =============================================================================
  // ANALYTICS
  // =============================================================================

  const loadAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/superfone/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_date: analyticsDateRange.start_date,
          end_date: analyticsDateRange.end_date,
          metrics: ['calls', 'messages', 'contacts']
        })
      });

      const data = await response.json();

      if (response.ok) {
        setAnalytics(data.analytics);
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to load analytics' });
      }
    } catch (_error) {
      setMessage({ type: 'error', text: 'Network error loading analytics' });
    } finally {
      setLoading(false);
    }
  }, [analyticsDateRange]);

  useEffect(() => {
    if (activeTab === 'calls') {
      loadCallLogs();
    } else if (activeTab === 'messages') {
      loadMessageLogs();
    } else if (activeTab === 'contacts') {
      loadContacts();
    } else if (activeTab === 'analytics') {
      loadAnalytics();
    }
  }, [activeTab, loadCallLogs, loadMessageLogs, loadContacts, loadAnalytics]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      completed: 'bg-green-500',
      answered: 'bg-blue-500',
      initiated: 'bg-yellow-500',
      missed: 'bg-red-500',
      failed: 'bg-red-500',
      sent: 'bg-green-500',
      delivered: 'bg-blue-500',
      read: 'bg-purple-500'
    };

    return (
      <Badge className={`${statusColors[status] || 'bg-gray-500'} text-white`}>
        {status}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Superfone Enterprise Integration</h1>
        <p className="text-muted-foreground">
          Manage calls, messages, contacts, and campaigns through Superfone
        </p>
      </div>

      {message.text && (
        <Alert className={`mb-4 ${message.type === 'error' ? 'border-red-500' : 'border-green-500'}`}>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="calls" className="flex items-center gap-2">
            <Phone className="w-4 h-4" />
            Calls
          </TabsTrigger>
          <TabsTrigger value="messages" className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Messages
          </TabsTrigger>
          <TabsTrigger value="contacts" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Contacts
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        {/* CALLS TAB */}
        <TabsContent value="calls" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Initiate Call</CardTitle>
                <CardDescription>Make an outbound call through Superfone</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="from_number">From Number</Label>
                    <Input
                      id="from_number"
                      value={callForm.from_number}
                      onChange={(e) => setCallForm(prev => ({ ...prev, from_number: e.target.value }))}
                      placeholder="+919604136010"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="to_number">To Number</Label>
                    <Input
                      id="to_number"
                      value={callForm.to_number}
                      onChange={(e) => setCallForm(prev => ({ ...prev, to_number: e.target.value }))}
                      placeholder="+919876543210"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="caller_id">Caller ID (Optional)</Label>
                  <Input
                    id="caller_id"
                    value={callForm.caller_id}
                    onChange={(e) => setCallForm(prev => ({ ...prev, caller_id: e.target.value }))}
                    placeholder="TecBunny Store"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="recording_enabled"
                    checked={callForm.recording_enabled}
                    onChange={(e) => setCallForm(prev => ({ ...prev, recording_enabled: e.target.checked }))}
                  />
                  <Label htmlFor="recording_enabled">Enable Call Recording</Label>
                </div>
                <Button 
                  onClick={initiateCall}
                  disabled={loading || !callForm.to_number}
                  className="w-full"
                >
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Phone className="w-4 h-4 mr-2" />}
                  Initiate Call
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Calls</CardTitle>
                <CardDescription>Call history and status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {callLogs.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">No calls found</p>
                  ) : (
                    callLogs.map((call) => (
                      <div key={call.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{call.from_number} → {call.to_number}</span>
                            {getStatusBadge(call.status)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {new Date(call.start_time).toLocaleString()}
                            {call.duration && ` • Duration: ${formatDuration(call.duration)}`}
                          </div>
                        </div>
                        {call.recording_url && (
                          <Button variant="outline" size="sm" asChild>
                            <a href={call.recording_url} target="_blank" rel="noopener noreferrer">
                              <Play className="w-4 h-4" />
                            </a>
                          </Button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* MESSAGES TAB */}
        <TabsContent value="messages" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Send Message</CardTitle>
                <CardDescription>Send WhatsApp or SMS messages</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Message Type</Label>
                  <Select
                    value={messageForm.type}
                    onValueChange={(value) => setMessageForm(prev => ({ ...prev, type: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="whatsapp_text">WhatsApp Text</SelectItem>
                      <SelectItem value="whatsapp_template">WhatsApp Template</SelectItem>
                      <SelectItem value="sms">SMS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recipient">Recipient Number</Label>
                  <Input
                    id="recipient"
                    value={messageForm.recipient}
                    onChange={(e) => setMessageForm(prev => ({ ...prev, recipient: e.target.value }))}
                    placeholder="+919876543210"
                    required
                  />
                </div>
                {messageForm.type === 'whatsapp_template' ? (
                  <div className="space-y-2">
                    <Label htmlFor="template_name">Template Name</Label>
                    <Input
                      id="template_name"
                      value={messageForm.template_name}
                      onChange={(e) => setMessageForm(prev => ({ ...prev, template_name: e.target.value }))}
                      placeholder="welcome_message"
                      required
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="message">Message</Label>
                    <Textarea
                      id="message"
                      value={messageForm.message}
                      onChange={(e) => setMessageForm(prev => ({ ...prev, message: e.target.value }))}
                      placeholder="Type your message here..."
                      rows={4}
                      required
                    />
                  </div>
                )}
                <Button 
                  onClick={sendMessage}
                  disabled={loading || !messageForm.recipient || (!messageForm.message && !messageForm.template_name)}
                  className="w-full"
                >
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                  Send Message
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Messages</CardTitle>
                <CardDescription>Message history and delivery status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {messageLogs.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">No messages found</p>
                  ) : (
                    messageLogs.map((message) => (
                      <div key={message.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{message.recipient}</span>
                            {getStatusBadge(message.status)}
                            <Badge variant="outline">{message.type}</Badge>
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {message.content?.substring(0, 50)}...
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(message.sent_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* CONTACTS TAB */}
        <TabsContent value="contacts" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Add Contact</CardTitle>
                <CardDescription>Create a new contact in Superfone</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone_number">Phone Number</Label>
                    <Input
                      id="phone_number"
                      value={contactForm.phone_number}
                      onChange={(e) => setContactForm(prev => ({ ...prev, phone_number: e.target.value }))}
                      placeholder="+919876543210"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={contactForm.name}
                      onChange={(e) => setContactForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="John Doe"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={contactForm.email}
                      onChange={(e) => setContactForm(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="john@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company">Company</Label>
                    <Input
                      id="company"
                      value={contactForm.company}
                      onChange={(e) => setContactForm(prev => ({ ...prev, company: e.target.value }))}
                      placeholder="Acme Corp"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tags">Tags (comma-separated)</Label>
                  <Input
                    id="tags"
                    value={contactForm.tags}
                    onChange={(e) => setContactForm(prev => ({ ...prev, tags: e.target.value }))}
                    placeholder="customer, vip, premium"
                  />
                </div>
                <Button 
                  onClick={createContact}
                  disabled={loading || !contactForm.phone_number}
                  className="w-full"
                >
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Users className="w-4 h-4 mr-2" />}
                  Add Contact
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Contact List</CardTitle>
                <CardDescription>Manage your Superfone contacts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {contacts.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">No contacts found</p>
                  ) : (
                    contacts.map((contact) => (
                      <div key={contact.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <div className="font-medium">{contact.name || 'Unknown'}</div>
                          <div className="text-sm text-muted-foreground">{contact.phone_number}</div>
                          {contact.email && (
                            <div className="text-sm text-muted-foreground">{contact.email}</div>
                          )}
                          {contact.tags && contact.tags.length > 0 && (
                            <div className="flex gap-1 mt-1">
                              {contact.tags.map((tag, index) => (
                                <Badge key={index} variant="outline" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ANALYTICS TAB */}
        <TabsContent value="analytics" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Analytics Dashboard</CardTitle>
              <CardDescription>Superfone communication statistics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="space-y-2">
                  <Label htmlFor="start_date">Start Date</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={analyticsDateRange.start_date}
                    onChange={(e) => setAnalyticsDateRange(prev => ({ ...prev, start_date: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_date">End Date</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={analyticsDateRange.end_date}
                    onChange={(e) => setAnalyticsDateRange(prev => ({ ...prev, end_date: e.target.value }))}
                  />
                </div>
              </div>
              <Button onClick={loadAnalytics} disabled={loading} className="mb-6">
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BarChart3 className="w-4 h-4 mr-2" />}
                Load Analytics
              </Button>

              {analytics && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-blue-600">{analytics.total_calls}</div>
                      <div className="text-sm text-muted-foreground">Total Calls</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-green-600">{analytics.total_messages}</div>
                      <div className="text-sm text-muted-foreground">Total Messages</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-purple-600">{analytics.total_contacts}</div>
                      <div className="text-sm text-muted-foreground">Total Contacts</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-orange-600">{analytics.call_success_rate}%</div>
                      <div className="text-sm text-muted-foreground">Call Success Rate</div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* SETTINGS TAB */}
        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configuration</CardTitle>
              <CardDescription>Superfone integration settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertDescription>
                  Superfone Enterprise Integration is configured with the following settings:
                </AlertDescription>
              </Alert>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>API Key Status</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Check className="w-4 h-4 text-green-500" />
                    <span className="text-sm">Configured</span>
                  </div>
                </div>
                <div>
                  <Label>Webhook URL</Label>
                  <div className="text-sm text-muted-foreground mt-1">
                    {process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/superfone/enterprise
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}