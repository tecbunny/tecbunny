'use client';

import * as React from 'react';
import { RefreshCw, MessageCircle, Eye, Loader2 } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import type { ContactMessage, ContactMessageStatus } from '@/lib/types';
import { logger } from '@/lib/logger';

const STATUS_BADGE_VARIANT: Record<ContactMessageStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  New: 'secondary',
  'In Progress': 'default',
  Resolved: 'outline',
};

const STATUS_FILTER_OPTIONS: Array<'All' | ContactMessageStatus> = ['All', 'New', 'In Progress', 'Resolved'];

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch (error) {
    logger.warn('contact_message_datetime_parse_failed', { value, error: error instanceof Error ? error.message : String(error) });
    return value;
  }
}

function getPreview(message: string) {
  if (message.length <= 72) return message;
  return `${message.slice(0, 69)}…`;
}

export default function AdminContactMessages() {
  const { toast } = useToast();
  const [messages, setMessages] = React.useState<ContactMessage[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [statusFilter, setStatusFilter] = React.useState<'All' | ContactMessageStatus>('All');
  const [selectedMessage, setSelectedMessage] = React.useState<ContactMessage | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [notesDraft, setNotesDraft] = React.useState('');
  const [updatingId, setUpdatingId] = React.useState<string | null>(null);
  const [savingNotes, setSavingNotes] = React.useState(false);

  const stats = React.useMemo(() => {
    const totals = {
      total: messages.length,
      new: messages.filter(message => message.status === 'New').length,
      inProgress: messages.filter(message => message.status === 'In Progress').length,
      resolved: messages.filter(message => message.status === 'Resolved').length,
    };
    return totals;
  }, [messages]);

  const fetchMessages = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'All') {
        params.set('status', statusFilter);
      }
      const query = params.toString();
      const response = await fetch(`/api/contact-messages${query ? `?${query}` : ''}`, {
        cache: 'no-store',
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        const errorMessage = typeof data?.error === 'string' ? data.error : 'Unable to load messages.';
        throw new Error(errorMessage);
      }
      const payload = (await response.json()) as { data?: ContactMessage[] };
      setMessages(Array.isArray(payload.data) ? payload.data : []);
    } catch (error) {
      logger.error('contact_message_fetch_failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      toast({
        variant: 'destructive',
        title: 'Failed to load messages',
        description: error instanceof Error ? error.message : 'Unexpected error occurred while loading messages.',
      });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, toast]);

  React.useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const updateMessage = React.useCallback(
    async (id: string, payload: Partial<Pick<ContactMessage, 'status' | 'admin_notes'>>) => {
      setUpdatingId(id);
      try {
        const response = await fetch(`/api/contact-messages/${id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => null);
          const errorMessage = typeof data?.error === 'string' ? data.error : 'Unable to update message.';
          throw new Error(errorMessage);
        }

        const result = (await response.json()) as { data: ContactMessage };
        const updated = result.data;
        setMessages(prev => prev.map(message => (message.id === updated.id ? updated : message)) );
        setSelectedMessage(prev => (prev && prev.id === updated.id ? updated : prev));
        return updated;
      } catch (error) {
        logger.error('contact_message_update_failed', {
          error: error instanceof Error ? error.message : String(error),
          id,
        });
        toast({
          variant: 'destructive',
          title: 'Update failed',
          description: error instanceof Error ? error.message : 'Unexpected error occurred while updating the message.',
        });
        throw error;
      } finally {
        setUpdatingId(current => (current === id ? null : current));
      }
    },
    [toast]
  );

  const handleOpenDetails = (message: ContactMessage) => {
    setSelectedMessage(message);
    setNotesDraft(message.admin_notes ?? '');
    setDialogOpen(true);
  };

  const handleStatusChange = async (message: ContactMessage, nextStatus: ContactMessageStatus) => {
    if (message.status === nextStatus) return;
    await updateMessage(message.id, { status: nextStatus });
  };

  const handleDialogStatusChange = async (value: string) => {
    if (!selectedMessage) return;
    const nextStatus = value as ContactMessageStatus;
    if (selectedMessage.status === nextStatus) return;
    await updateMessage(selectedMessage.id, { status: nextStatus });
  };

  const handleSaveNotes = async () => {
    if (!selectedMessage) return;
    setSavingNotes(true);
    try {
      await updateMessage(selectedMessage.id, { admin_notes: notesDraft });
      toast({
        title: 'Notes saved',
        description: 'Your update has been recorded.',
      });
    } finally {
      setSavingNotes(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Contact Messages</h1>
          <p className="text-muted-foreground">Review and respond to customer enquiries submitted via the contact page.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Select value={statusFilter} onValueChange={value => setStatusFilter(value as 'All' | ContactMessageStatus)} disabled={loading}>
            <SelectTrigger className="min-w-[160px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTER_OPTIONS.map(option => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" className="gap-2" disabled={loading} onClick={fetchMessages}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
        </div>
      </div>

      <Card className="border-l-4 border-l-primary/70 bg-primary/5">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-primary">
              <MessageCircle className="h-5 w-5" />
              Inbox Snapshot
            </CardTitle>
            <CardDescription>Track new enquiries and monitor follow-ups in one place.</CardDescription>
          </div>
          <div className="flex gap-4 text-sm">
            <div className="text-center">
              <p className="font-semibold">Total</p>
              <p className="text-muted-foreground">{stats.total}</p>
            </div>
            <div className="text-center">
              <p className="font-semibold">New</p>
              <p className="text-muted-foreground">{stats.new}</p>
            </div>
            <div className="text-center">
              <p className="font-semibold">In Progress</p>
              <p className="text-muted-foreground">{stats.inProgress}</p>
            </div>
            <div className="text-center">
              <p className="font-semibold">Resolved</p>
              <p className="text-muted-foreground">{stats.resolved}</p>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Messages</CardTitle>
          <CardDescription>Latest customer enquiries.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Received</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <TableRow key={`contact-message-skeleton-${index}`}>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                    </TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : messages.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                    No messages found for the selected filter.
                  </TableCell>
                </TableRow>
              ) : (
                messages.map(message => (
                  <TableRow key={message.id}>
                    <TableCell className="font-medium">{message.name}</TableCell>
                    <TableCell>
                      <div className="space-y-1 text-sm">
                        {message.email && (
                          <a href={`mailto:${message.email}`} className="text-primary hover:underline">
                            {message.email}
                          </a>
                        )}
                        {message.phone && (
                          <p className="text-muted-foreground text-xs">{message.phone}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{message.subject || '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{getPreview(message.message)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDateTime(message.created_at)}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_BADGE_VARIANT[message.status]}>{message.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {message.status !== 'Resolved' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleStatusChange(message, 'Resolved')}
                            disabled={updatingId === message.id}
                          >
                            {updatingId === message.id ? 'Resolving…' : 'Mark Resolved'}
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => handleOpenDetails(message)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Message from {selectedMessage?.name}</DialogTitle>
            <DialogDescription>
              Submitted on {selectedMessage ? formatDateTime(selectedMessage.created_at) : ''}
            </DialogDescription>
          </DialogHeader>
          {selectedMessage && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-semibold">Email</p>
                  <p className="text-muted-foreground" title={selectedMessage.email}>
                    {selectedMessage.email}
                  </p>
                </div>
                <div>
                  <p className="font-semibold">Phone</p>
                  <p className="text-muted-foreground">{selectedMessage.phone || '—'}</p>
                </div>
                <div>
                  <p className="font-semibold">Subject</p>
                  <p className="text-muted-foreground">{selectedMessage.subject || '—'}</p>
                </div>
                <div>
                  <p className="font-semibold">Status</p>
                  <Select
                    value={selectedMessage.status}
                    onValueChange={handleDialogStatusChange}
                    disabled={updatingId === selectedMessage.id}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_FILTER_OPTIONS.filter(option => option !== 'All').map(option => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <p className="font-semibold">Handled By</p>
                  <p className="text-muted-foreground">{selectedMessage.handled_by_name || '—'}</p>
                </div>
                <div>
                  <p className="font-semibold">Source IP</p>
                  <p className="text-muted-foreground">{selectedMessage.ip_address || '—'}</p>
                </div>
              </div>

              <div>
                <p className="font-semibold mb-2">Message</p>
                <p className="rounded-lg border bg-muted/30 p-4 text-sm leading-relaxed whitespace-pre-wrap">
                  {selectedMessage.message}
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">Admin Notes</p>
                  <span className="text-xs text-muted-foreground">Visible only to staff</span>
                </div>
                <Textarea
                  value={notesDraft}
                  onChange={event => setNotesDraft(event.target.value)}
                  placeholder="Add follow-up notes or next steps"
                  rows={4}
                />
              </div>
            </div>
          )}
          <DialogFooter className="flex justify-between gap-2 pt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Close
            </Button>
            <Button onClick={handleSaveNotes} disabled={savingNotes || !selectedMessage} className="gap-2">
              {savingNotes ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save Notes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
