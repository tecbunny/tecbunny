'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '../../../../hooks/use-toast';

export default function AdminQuotesPage() {
  const [quotes, setQuotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetch('/api/admin/quotes')
      .then(res => res.json())
      .then(data => {
        setQuotes(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const downloadPdf = async (quote: any) => {
    try {
      toast({
        title: "Downloading...",
        description: "Generating PDF file.",
      });

      const response = await fetch(`/api/admin/quotes/${quote.id}/download`);
      
      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `quote-${quote.section_id || quote.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Success",
        description: "Quote downloaded successfully.",
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to download PDF.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Quotes</h1>
        <p className="text-sm text-slate-400">Track and manage customer quote requests.</p>
      </div>
      <Separator className="bg-white/10" />
      
      <Card className="border-white/10 bg-white/5 text-slate-200">
        <CardHeader>
          <CardTitle>Generated Quotes</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
             <div className="flex justify-center p-8"><Loader2 className="animate-spin text-cyan-400" /></div>
          ) : quotes.length === 0 ? (
             <p className="text-center p-8 text-slate-400">No quotes found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-white/5">
                  <TableHead className="text-slate-400">Date</TableHead>
                  <TableHead className="text-slate-400">Customer</TableHead>
                  <TableHead className="text-slate-400">Email</TableHead>
                  <TableHead className="text-slate-400">Summary</TableHead>
                   <TableHead className="text-slate-400">Status</TableHead>
                  <TableHead className="text-right text-slate-400">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotes.map((quote) => (
                  <TableRow key={quote.id} className="border-white/10 hover:bg-white/5">
                    <TableCell>{format(new Date(quote.created_at), 'PPP')}</TableCell>
                    <TableCell>{quote.customer_name}</TableCell>
                    <TableCell>{quote.customer_email}</TableCell>
                    <TableCell className="max-w-[200px] truncate" title={quote.summary}>{quote.summary}</TableCell>
                    <TableCell><Badge variant="outline">{quote.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => downloadPdf(quote)}>
                        <Download className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
