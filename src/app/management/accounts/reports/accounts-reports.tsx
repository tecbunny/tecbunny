
'use client';

import * as React from 'react';

import { Download } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import type { Order, Product, Expense } from '../../../../lib/types';
import { useToast } from '../../../../hooks/use-toast';
import { createClient } from '../../../../lib/supabase/client';

export default function BillingReportsPage() {
    const { toast } = useToast();
    const supabase = createClient();
    const [orders, setOrders] = React.useState<Order[]>([]);
    const [products, setProducts] = React.useState<Product[]>([]);
    const [expenses, setExpenses] = React.useState<Expense[]>([]);

    React.useEffect(() => {
        const fetchData = async () => {
            const { data: orderData } = await supabase.from('orders').select('*');
            const { data: productData } = await supabase.from('products').select('*');
            const { data: expenseData } = await supabase.from('expenses').select('*');

            setOrders(orderData || []);
            setProducts(productData || []);
            setExpenses(expenseData || []);
        };
        fetchData();
    }, [supabase]);

    const handleDownload = (reportType: 'sales' | 'expenses' | 'invoices') => {
        let csvContent = '';
        const fileName = `${reportType}_report.csv`;

        try {
            switch(reportType) {
                case 'sales':
                    const salesHeaders = ["OrderID", "Date", "Customer", "Status", "Total", "Type", "ProcessedBy"];
                    csvContent = [
                        salesHeaders.join(','),
                        ...orders.map(o => [o.id, o.created_at, `"${o.customer_name}"`, o.status, o.total, o.type, o.processed_by || ''].join(','))
                    ].join('\n');
                    break;
                case 'expenses':
                    const expenseHeaders = ["ExpenseID", "Date", "Category", "Amount", "Description", "SubmittedBy"];
                    csvContent = [
                        expenseHeaders.join(','),
                        ...expenses.map(e => [e.id, e.created_at, e.category, e.amount, `"${e.description}"`, e.submitted_by].join(','))
                    ].join('\n');
                    break;
                case 'invoices':
                    const invoiceHeaders = ["InvoiceID", "Date", "Customer", "Total", "Product", "Quantity", "Price"];
                    const invoiceRows = orders.flatMap(order => 
                        (order.items || []).map(item => {
                            const product = products.find(p => p.id === item.productId);
                            return [order.id, order.created_at, `"${order.customer_name}"`, order.total, `"${product?.name || 'N/A'}"`, item.quantity, product?.price || 0].join(',');
                        })
                    );
                     csvContent = [
                        invoiceHeaders.join(','),
                        ...invoiceRows
                    ].join('\n');
                    break;
            }

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            // Safe cleanup without removeChild pitfalls
            try { (link as any)?.remove?.(); } catch {}
            try { URL.revokeObjectURL(link.href); } catch {}

             toast({
                title: 'Download Started',
                description: `${fileName} is being downloaded.`,
            });
        } catch {
             toast({
                variant: 'destructive',
                title: 'Download Failed',
                description: `Could not generate the ${reportType} report.`,
            });
        }
    }


  return (
    <div className="space-y-8">
        <div>
            <h1 className="text-3xl font-bold">Billing Reports</h1>
            <p className="text-muted-foreground">Generate and view financial reports.</p>
        </div>
        <Card>
            <CardHeader>
                <CardTitle>Download Center</CardTitle>
                <CardDescription>Select a report to download it as a CSV file.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
               <Button onClick={() => handleDownload('sales')}>
                    <Download className="mr-2 h-4 w-4" />
                    Download Sales Report
               </Button>
               <Button onClick={() => handleDownload('expenses')}>
                    <Download className="mr-2 h-4 w-4" />
                    Download Expenses Report
               </Button>
               <Button onClick={() => handleDownload('invoices')}>
                    <Download className="mr-2 h-4 w-4" />
                    Download Invoice Report
               </Button>
            </CardContent>
        </Card>
    </div>
  );
}
