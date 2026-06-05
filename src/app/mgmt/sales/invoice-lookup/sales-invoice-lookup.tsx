
'use client';

import * as React from 'react';

import { Search } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Order } from '@/lib/types';
import { InvoiceTemplate, type CompanySettings } from '@/components/invoices/InvoiceTemplate';
import { useToast } from '../../../../hooks/use-toast';
import { createClient } from '@/lib/supabase/client';


// In a real app, this would be fetched from a database
const companySettings: CompanySettings = {
    name: 'TecBunny',
    address: '123 Tech Lane, Circuit City, 560100',
    gstin: '30AAMCT1608G1ZO',
    logoUrl: '/logo.png' // Assuming you have a logo in public/
};

export default function InvoiceLookupPage() {
  const [invoiceId, setInvoiceId] = React.useState('');
  const [searchResult, setSearchResult] = React.useState<{ order: Order | null; notFound: boolean }>({
    order: null,
    notFound: false,
  });
  const { toast } = useToast();
  const supabase = createClient();

  const handleSearch = async () => {
    if (!invoiceId) return;

    const { data: order, error } = await supabase
        .from('orders')
        .select('*')
        .ilike('id', `%${invoiceId}%`)
        .single();
    
    if (error || !order) {
        setSearchResult({ order: null, notFound: true });
        toast({ variant: 'destructive', title: 'Search Error', description: 'Invoice not found' });
    } else {
        setSearchResult({ order: order as Order, notFound: false });
    }
  };
  
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Invoice Lookup</h1>
        <p className="text-muted-foreground">Find and view a specific invoice by its number.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Search Invoice</CardTitle>
          <CardDescription>Enter the invoice number below to find and reprint it.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter invoice number..."
              value={invoiceId}
              onChange={(e) => setInvoiceId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button onClick={handleSearch}>
              <Search className="mr-2 h-4 w-4" /> Search
            </Button>
          </div>
           {searchResult.notFound && <p className="text-destructive text-sm">Invoice not found.</p>}
        </CardContent>
      </Card>

      {searchResult.order && (
         <InvoiceTemplate order={searchResult.order} settings={companySettings} />
      )}
    </div>
  );
}
