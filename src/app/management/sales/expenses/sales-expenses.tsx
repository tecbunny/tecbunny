
'use client';

import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '../../../../hooks/use-toast';
import { useAuth } from '@/lib/hooks';
import { logger } from '@/lib/logger';
import type { Expense, ExpenseStatus } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/client';

const expenseSchema = z.object({
  date: z.string().refine((val) => !isNaN(Date.parse(val)), { message: "Invalid date" }),
  category: z.string().min(1, { message: "Category is required." }),
  amount: z.coerce.number().min(0.01, { message: "Amount must be greater than 0." }),
  description: z.string().min(5, { message: "Description must be at least 5 characters." }),
});

type ExpenseFormInput = z.input<typeof expenseSchema>;
type ExpenseFormValues = z.output<typeof expenseSchema>;

export default function ExpenseEntryPage() {
    const { toast } = useToast();
    const { user } = useAuth();
    const supabase = createClient();
    const [expenses, setExpenses] = React.useState<Expense[]>([]);
    const [isClient, setIsClient] = React.useState(false);

    const fetchExpenses = React.useCallback(async () => {
        if (!user) return;
        const { data, error } = await supabase
            .from('expenses')
            .select('*')
            .eq('submitted_by', user.id);
        
        if (error) {
            logger.error('Error fetching expenses in sales-expenses', { error });
        } else {
            setExpenses(data as Expense[]);
        }
    }, [user, supabase]);

    React.useEffect(() => {
        setIsClient(true);
        fetchExpenses();
    }, [fetchExpenses]);

    const form = useForm<ExpenseFormInput, any, ExpenseFormValues>({
        resolver: zodResolver(expenseSchema),
        defaultValues: {
            date: new Date().toISOString().split('T')[0],
            category: '',
            amount: 0,
            description: '',
        },
    });

    const onSubmit = async (data: ExpenseFormValues) => {
        if (!user) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'You must be logged in to submit an expense.',
            });
            return;
        }

        const expenseData = {
            submitted_by: user.id,
            status: 'pending',
            created_at: data.date,
            ...data,
        };
        
        const { error } = await supabase.from('expenses').insert(expenseData);

        if (error) {
            toast({ variant: 'destructive', title: 'Submission Failed', description: error.message });
            return;
        }
        
        await fetchExpenses();

        toast({
            title: "Expense Submitted",
            description: "Your expense has been submitted for approval.",
        });
        form.reset();
        form.setValue('date', new Date().toISOString().split('T')[0]);
    };

    const getBadgeVariant = (status: ExpenseStatus) => {
        switch (status) {
            case 'pending': return 'default';
            case 'approved': return 'secondary';
            case 'rejected': return 'destructive';
            default: return 'outline';
        }
    }
    
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold">Expense Management</h1>
                <p className="text-muted-foreground">Log your business-related expenses and view history.</p>
            </div>
            
            <Card className="max-w-2xl">
                 <CardHeader>
                    <CardTitle>New Expense</CardTitle>
                    <CardDescription>Fill in the details of the expense below.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                             <FormField
                                control={form.control}
                                name="date"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Date of Expense</FormLabel>
                                    <FormControl>
                                        <Input type="date" {...field} />
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
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select an expense category" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="Travel">Travel</SelectItem>
                                        <SelectItem value="Food">Food & Refreshments</SelectItem>
                                        <SelectItem value="Supplies">Office Supplies</SelectItem>
                                        <SelectItem value="Utility">Utility Bill</SelectItem>
                                        <SelectItem value="Other">Other</SelectItem>
                                    </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="amount"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Amount (₹)</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            placeholder="e.g., 500.00"
                                            value={typeof field.value === 'number' || typeof field.value === 'string' ? field.value : ''}
                                            onChange={(event) => field.onChange(event.target.value)}
                                            onBlur={field.onBlur}
                                            name={field.name}
                                            ref={field.ref}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="description"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Description</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="Describe the expense..." {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                            <Button type="submit" disabled={form.formState.isSubmitting}>
                                {form.formState.isSubmitting ? 'Submitting...' : 'Submit Expense'}
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Your Expense History</CardTitle>
                    <CardDescription>A list of all expenses you have submitted.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Category</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isClient && expenses.length > 0 ? expenses.map((expense) => (
                                <TableRow key={expense.id}>
                                    <TableCell>{new Date(expense.created_at).toLocaleDateString()}</TableCell>
                                    <TableCell>{expense.category}</TableCell>
                                    <TableCell>{expense.description}</TableCell>
                                    <TableCell>
                                        <Badge variant={getBadgeVariant(expense.status)} className="capitalize">{expense.status}</Badge>
                                    </TableCell>
                                    <TableCell className="text-right font-medium">₹{expense.amount.toFixed(2)}</TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">
                                        No expenses recorded yet.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
