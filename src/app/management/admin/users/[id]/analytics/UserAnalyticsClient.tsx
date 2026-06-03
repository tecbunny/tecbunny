'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { 
  Activity, 
  ShoppingCart, 
  MessageSquare, 
  FileText, 
  Eye, 
  Facebook, 
  Instagram, 
  Twitter, 
  Linkedin, 
  Youtube, 
  Globe,
  Phone
} from 'lucide-react';

export default function UserAnalyticsPage() {
  const params = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    if (params.id) {
      const loadHistory = async () => {
        try {
          setLoading(true);
          const response = await fetch(`/api/admin/users/${params.id}/history`, {
            credentials: 'include',
            headers: { Accept: 'application/json' },
          });

          const raw = await response.text();
          let payload: any = null;

          try {
            payload = raw ? JSON.parse(raw) : null;
          } catch {
            payload = { error: raw || `Unexpected response from server (${response.status})` };
          }

          if (!response.ok) {
            throw new Error(payload?.error || `Failed to load user history (${response.status})`);
          }

          if (!cancelled) {
            setData(payload);
          }
        } catch (error) {
          console.error(error);
          if (!cancelled) {
            setData({ error: error instanceof Error ? error.message : 'Failed to load user history' });
          }
        } finally {
          if (!cancelled) {
            setLoading(false);
          }
        }
      };

      void loadHistory();
    }

    return () => {
      cancelled = true;
    };
  }, [params.id]);

  if (loading) return <div className="p-8">Loading user history...</div>;
  if (!data || data.error) return <div className="p-8 text-red-500">Error loading user history: {data?.error}</div>;

  const { profile, timeline } = data;

  const getIcon = (item: any) => {
    if (item.type === 'order') return <ShoppingCart className="h-4 w-4 text-green-500" />;
    if (item.type === 'message') return <MessageSquare className="h-4 w-4 text-blue-500" />;
    if (item.type === 'lead') return <FileText className="h-4 w-4 text-orange-500" />;
    
    // Events
    if (item.event_type === 'page_view') return <Eye className="h-4 w-4 text-gray-500" />;
    if (item.event_type === 'add_to_cart') return <ShoppingCart className="h-4 w-4 text-purple-500" />;
    if (item.event_type === 'social_click') {
      const platform = item.metadata?.platform?.toLowerCase();
      if (platform?.includes('facebook')) return <Facebook className="h-4 w-4 text-blue-600" />;
      if (platform?.includes('instagram')) return <Instagram className="h-4 w-4 text-pink-600" />;
      if (platform?.includes('twitter')) return <Twitter className="h-4 w-4 text-blue-400" />;
      if (platform?.includes('linkedin')) return <Linkedin className="h-4 w-4 text-blue-700" />;
      if (platform?.includes('youtube')) return <Youtube className="h-4 w-4 text-red-600" />;
      if (platform?.includes('whatsapp')) return <Phone className="h-4 w-4 text-green-500" />;
      return <Globe className="h-4 w-4 text-blue-500" />;
    }
    
    return <Activity className="h-4 w-4 text-gray-400" />;
  };

  const formatEventDescription = (item: any) => {
    if (item.type === 'order') return `Placed Order #${item.id.slice(0, 8)} - $${item.total}`;
    if (item.type === 'message') return `Sent message: ${item.subject || 'No Subject'}`;
    if (item.type === 'lead') return `Submitted ${item.type} inquiry`;
    
    if (item.event_type === 'page_view') return `Viewed page: ${item.page_url}`;
    if (item.event_type === 'add_to_cart') return `Added "${item.metadata?.productName}" to cart`;
    if (item.event_type === 'remove_from_cart') return `Removed "${item.metadata?.productName}" from cart`;
    if (item.event_type === 'social_click') return `Clicked on ${item.metadata?.platform}`;
    
    return `Event: ${item.event_type}`;
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16">
          <AvatarImage src={profile.avatar_url} />
          <AvatarFallback>{profile.full_name?.slice(0, 2).toUpperCase() || 'U'}</AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-2xl font-bold">{profile.full_name || 'Unknown User'}</h1>
          <p className="text-muted-foreground">{profile.email}</p>
          <Badge variant={profile.role === 'admin' ? 'destructive' : 'secondary'} className="mt-1">
            {profile.role || 'Customer'}
          </Badge>
        </div>
      </div>

      <Separator />

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Activity Timeline</CardTitle>
            <CardDescription>Complete history of user interactions</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px] pr-4">
              <div className="space-y-8">
                {timeline.map((item: any, index: number) => (
                  <div key={index} className="flex gap-4">
                    <div className="mt-1 bg-muted rounded-full p-2 h-8 w-8 flex items-center justify-center">
                      {getIcon(item)}
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {formatEventDescription(item)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(item.timestamp).toLocaleString()}
                      </p>
                      {item.metadata && (
                        <pre className="text-xs bg-muted p-2 rounded mt-2 overflow-x-auto max-w-[400px]">
                          {JSON.stringify(item.metadata, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                ))}
                {timeline.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    No activity recorded for this user.
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>User Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Total Orders</span>
                <span className="font-bold">{timeline.filter((i: any) => i.type === 'order').length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Total Spent</span>
                <span className="font-bold">
                  ${timeline
                    .filter((i: any) => i.type === 'order')
                    .reduce((acc: number, curr: any) => acc + (curr.total || 0), 0)
                    .toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Page Views</span>
                <span className="font-bold">{timeline.filter((i: any) => i.event_type === 'page_view').length}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
