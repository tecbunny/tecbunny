'use client';

import * as React from 'react';

import { CheckCircle, XCircle, Clock } from 'lucide-react';

import { format } from 'date-fns';

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
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { useToast } from '../../hooks/use-toast';
import { logger } from '@/lib/logger';

// Define the structure of an application, including the joined user details
type Application = {
  id: string;
  user_id: string;
  referral_code: string;
  points_balance: number;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
  user_details: {
    email: string;
    raw_user_meta_data?: {
      name?: string;
      mobile?: string;
    };
  } | null;
};

interface SalesAgentsManagementProps {
  initialApplications: Application[];
}

export default function SalesAgentsManagement({ initialApplications }: SalesAgentsManagementProps) {
  const [applications, setApplications] = React.useState<Application[]>(initialApplications);
  const [loading, setLoading] = React.useState<Record<string, boolean>>({});
  const [dataLoading, setDataLoading] = React.useState(false);
  const { toast } = useToast();

  // Fetch applications on mount
  React.useEffect(() => {
    async function fetchApplications() {
      if (initialApplications.length > 0) return; // Already have data
      
      setDataLoading(true);
      try {
        const response = await fetch('/api/admin/sales-agents');
        if (response.ok) {
          const data = await response.json();
          setApplications(data);
        } else {
          logger.error('Failed to fetch applications in SalesAgentsManagement', { statusText: response.statusText });
        }
      } catch (error) {
        logger.error('Error fetching applications in SalesAgentsManagement', { error });
      } finally {
        setDataLoading(false);
      }
    }

    fetchApplications();
  }, [initialApplications.length]);

  // Check if the feature is set up (migration has been run)
  const isFeatureSetup = initialApplications !== null;

  const handleUpdateStatus = async (id: string, status: 'approved' | 'rejected') => {
    setLoading(prev => ({ ...prev, [id]: true }));
    try {
      const response = await fetch(`/api/admin/sales-agents/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error || 'Failed to update application status.');
      }

      // Update the local state to reflect the change
      setApplications(prev =>
        prev.map(app => (app.id === id ? { ...app, status, updated_at: new Date().toISOString() } : app))
      );

      toast({
        title: 'Success',
        description: `Application has been ${status}.`,
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    } finally {
      setLoading(prev => ({ ...prev, [id]: false }));
    }
  };

  const StatusBadge = ({ status }: { status: Application['status'] }) => {
    const statusConfig: Record<Application['status'], {
      icon: React.ReactNode;
      variant: BadgeProps['variant'];
      label: string;
    }> = {
      pending: {
        icon: <Clock className="h-4 w-4 mr-1" />,
        variant: 'secondary',
        label: 'Pending',
      },
      approved: {
        icon: <CheckCircle className="h-4 w-4 mr-1" />,
        variant: 'default',
        label: 'Approved',
      },
      rejected: {
        icon: <XCircle className="h-4 w-4 mr-1" />,
        variant: 'destructive',
        label: 'Rejected',
      },
    };
    const config = statusConfig[status];
    return (
      <Badge variant={config.variant} className="flex items-center w-fit">
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  // If feature is not set up, show setup message
  if (!isFeatureSetup) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sales Agent Feature</CardTitle>
          <CardDescription>
            The sales agent feature needs to be set up before it can be used.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <h3 className="text-lg font-medium text-yellow-800 mb-2">
                Database Migration Required
              </h3>
              <p className="text-yellow-700 mb-4">
                The sales agent feature requires a database migration to be run. Please run the migration SQL in your Supabase dashboard.
              </p>
              <div className="bg-white border rounded p-4 text-left">
                <p className="text-sm text-gray-600 mb-2">
                  <strong>Steps to complete setup:</strong>
                </p>
                <ol className="text-sm text-gray-700 list-decimal list-inside space-y-1">
                  <li>Go to your Supabase project dashboard</li>
                  <li>Navigate to SQL Editor</li>
                  <li>Copy and paste the migration SQL from the migration file</li>
                  <li>Execute the SQL</li>
                  <li>Refresh this page</li>
                </ol>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sales Agent Applications</CardTitle>
        <CardDescription>
          Review and manage applications from users wanting to become sales agents.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Applicant</TableHead>
              <TableHead>Referral Code</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Applied On</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dataLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  Loading applications...
                </TableCell>
              </TableRow>
            ) : applications.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  No applications found.
                </TableCell>
              </TableRow>
            ) : (
              applications.map(app => (
                <TableRow key={app.id}>
                  <TableCell>
                    <div className="font-medium">{app.user_details?.raw_user_meta_data?.name || 'N/A'}</div>
                    <div className="text-sm text-muted-foreground">{app.user_details?.email}</div>
                  </TableCell>
                  <TableCell>{app.referral_code}</TableCell>
                  <TableCell>
                    <StatusBadge status={app.status} />
                  </TableCell>
                  <TableCell>{format(new Date(app.created_at), 'PPP')}</TableCell>
                  <TableCell className="text-right">
                    {app.status === 'pending' && (
                      <div className="flex gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUpdateStatus(app.id, 'approved')}
                          disabled={loading[app.id]}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleUpdateStatus(app.id, 'rejected')}
                          disabled={loading[app.id]}
                        >
                          Reject
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}