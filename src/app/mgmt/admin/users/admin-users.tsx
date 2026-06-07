
'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { MoreHorizontal, Settings, Percent, Crown, Star, User as UserIcon, Shield, UserCog, Users, Briefcase, Headphones, RefreshCcw, ChevronLeft, ChevronRight, Activity } from 'lucide-react';

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { User, CustomerCategory } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { AddUserDialog } from '@/components/admin/AddUserDialog';
import { EditUserDialog } from '@/components/admin/EditUserDialog';
import { DiscountOffersDialog } from '@/components/admin/DiscountOffersDialog';
import { UniversalSearch, SearchFilter, SortOption } from '@/components/shared/UniversalSearch';
import { useToast } from '../../../../hooks/use-toast';
import { useDebounce } from '../../../../hooks/use-debounce';

const ROLE_SENTINEL_NONE = '__none__';

export default function UserManagementPage() {
  const pathname = usePathname();
  const [users, setUsers] = React.useState<User[]>([]);
  const [totalUsers, setTotalUsers] = React.useState(0);
  const [totalsBreakdown, setTotalsBreakdown] = React.useState({
    total: 0,
    staff: 0,
    customers: 0,
    sales: 0
  });
  const [selectedUser, setSelectedUser] = React.useState<User | null>(null);
  const [showEditDialog, setShowEditDialog] = React.useState(false);
  const [showDiscountDialog, setShowDiscountDialog] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<'all' | 'staff' | 'customer' | 'sales'>('all');
  
  // Search and filter states
  const [searchQuery, setSearchQuery] = React.useState('');
  const [filters, setFilters] = React.useState<Record<string, any>>({});
  const [sortField, setSortField] = React.useState('name');
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('asc');
  const [isLoading, setIsLoading] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null);
  const [apiError, setApiError] = React.useState<string | null>(null);
  const usersControllerRef = React.useRef<AbortController | null>(null);
  const debouncedSearch = useDebounce(searchQuery, 400);

  const { toast } = useToast();
  const totalPages = Math.max(1, Math.ceil(totalUsers / pageSize) || 1);
  const rangeStart = totalUsers === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = totalUsers === 0 ? 0 : Math.min(page * pageSize, totalUsers);
  const userAnalyticsBasePath = pathname?.startsWith('/superadmin')
    ? '/superadmin/mgmt/users'
    : '/mgmt/admin/users';
  
  const roleFiltersFromTab = React.useMemo(() => {
    switch (activeTab) {
      case 'staff':
        return ['admin', 'manager', 'accounts'];
      case 'customer':
        return ['customer'];
      case 'sales':
        return ['sales'];
      default:
        return [];
    }
  }, [activeTab]);

  const effectiveRoleFilter = React.useMemo(() => {
    const userSelectedRoles: string[] | undefined = filters.role;
    if (roleFiltersFromTab.length === 0) {
      return userSelectedRoles;
    }
    if (!userSelectedRoles || userSelectedRoles.length === 0) {
      return roleFiltersFromTab;
    }
    const intersection = userSelectedRoles.filter((role) => roleFiltersFromTab.includes(role));
    return intersection.length === 0 ? [] : intersection;
  }, [filters.role, roleFiltersFromTab]);

  const roleFilterParam = React.useMemo(() => {
    if (effectiveRoleFilter === undefined) return '';
    if (effectiveRoleFilter.length === 0) return ROLE_SENTINEL_NONE;
    return effectiveRoleFilter.join(',');
  }, [effectiveRoleFilter]);

  const customerCategoryParam = React.useMemo(
    () => (filters.customerCategory ? (filters.customerCategory as string[]).join(',') : ''),
    [filters.customerCategory]
  );
  const statusFilter = filters.status || '';
  const discountRange = filters.discountRange || {};
  const discountSignature = `${discountRange.min || ''}-${discountRange.max || ''}`;

  const fetchUsers = React.useCallback(async () => {
    usersControllerRef.current?.abort();
    const controller = new AbortController();
    usersControllerRef.current = controller;

    setIsLoading(true);
    setApiError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        sortField,
        sortDirection,
        includeCounts: 'true'
      });

      const trimmedSearch = debouncedSearch.trim();
      if (trimmedSearch) {
        params.set('search', trimmedSearch);
      }

      if (roleFilterParam) {
        params.set('role', roleFilterParam);
      }

      if (statusFilter) {
        params.set('status', statusFilter);
      }

      if (customerCategoryParam) {
        params.set('customerCategory', customerCategoryParam);
      }

      if (discountRange.min) {
        params.set('discountMin', discountRange.min);
      }

      if (discountRange.max) {
        params.set('discountMax', discountRange.max);
      }

      const response = await fetch(`/api/users?${params.toString()}`, {
        signal: controller.signal,
        credentials: 'include',
        headers: { Accept: 'application/json' }
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || `Failed to load users (status ${response.status})`);
      }

      if (controller.signal.aborted || usersControllerRef.current !== controller) {
        return;
      }

      const totalCount = payload?.total ?? 0;
      const maxPage = Math.max(1, Math.ceil(totalCount / pageSize) || 1);
      if (page > maxPage && totalCount > 0) {
        setTotalUsers(totalCount);
        setPage(maxPage);
        return;
      }

      const usersWithProfiles = Array.isArray(payload?.users) ? payload.users : [];
      const normalizedUsers: User[] = usersWithProfiles.map((entry: any) => {
        const profile = entry.profile || {};
        return {
          id: entry.id,
          name: profile.name || profile.full_name || entry.email?.split('@')[0] || 'Unnamed User',
          email: profile.email || entry.email || '',
          mobile: profile.mobile || profile.phone || '',
          role: (profile.role || 'customer') as User['role'],
          address: profile.address || null,
          gstin: profile.gstin || null,
          customerCategory: profile.customer_category || undefined,
          discountPercentage: typeof profile.discount_percentage === 'number' ? profile.discount_percentage : undefined,
          isActive: profile.is_active ?? true,
          created_at: profile.created_at || entry.created_at,
          updated_at: profile.updated_at || entry.updated_at,
          emailVerified: Boolean(entry.email_confirmed_at),
          email_confirmed_at: entry.email_confirmed_at,
          customer_type: profile.customer_type || undefined,
          gst_verified: profile.gst_verified ?? undefined,
          gst_verification_date: profile.gst_verification_date || undefined,
          business_name: profile.business_name || undefined,
          business_address: profile.business_address || undefined,
          credit_limit: profile.credit_limit ?? undefined,
          b2b_category: profile.b2b_category || undefined,
        };
      });

      if (payload?.totals) {
        setTotalsBreakdown({
          total: payload.totals.total ?? totalCount,
          staff: payload.totals.staff ?? 0,
          customers: payload.totals.customers ?? 0,
          sales: payload.totals.sales ?? 0,
        });
      } else {
        setTotalsBreakdown((prev) => ({ ...prev, total: totalCount }));
      }

      setUsers(normalizedUsers);
      setTotalUsers(totalCount);
      setLastUpdated(new Date());
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        return;
      }
      console.error('Failed to fetch users:', error);
      const message = error instanceof Error ? error.message : 'Unable to load users. Please try again later.';
      setApiError(message);
      toast({
        variant: 'destructive',
        title: 'Error loading users',
        description: message,
      });
      setUsers([]);
      setTotalUsers(0);
    } finally {
      if (usersControllerRef.current === controller) {
        usersControllerRef.current = null;
        setIsLoading(false);
      }
    }
  }, [
    debouncedSearch,
    roleFilterParam,
    statusFilter,
    customerCategoryParam,
    discountRange.min,
    discountRange.max,
    page,
    pageSize,
    sortField,
    sortDirection,
    toast
  ]);
  
  React.useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  React.useEffect(() => {
    setPage(1);
  }, [debouncedSearch, roleFilterParam, statusFilter, customerCategoryParam, discountSignature, sortField, sortDirection, activeTab]);

  React.useEffect(() => {
    setPage(1);
  }, [pageSize]);

  React.useEffect(() => () => {
    usersControllerRef.current?.abort();
  }, []);


  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setShowEditDialog(true);
  };

  const getRoleVariant = (role: string) => {
    switch (role) {
      case 'admin':
        return 'destructive';
      case 'manager':
        return 'default';
      case 'sales':
      case 'accounts':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Shield className="h-3 w-3" />;
      case 'manager':
        return <Settings className="h-3 w-3" />;
      case 'sales':
      case 'accounts':
        return <UserCog className="h-3 w-3" />;
      default:
        return <UserIcon className="h-3 w-3" />;
    }
  };

  const getCategoryIcon = (category: CustomerCategory | undefined) => {
    if (!category) return null;
    switch (category) {
      case 'Premium':
        return <Crown className="h-3 w-3 text-yellow-500" />;
      case 'Standard':
        return <Star className="h-3 w-3 text-blue-500" />;
      default:
        return <UserIcon className="h-3 w-3 text-gray-500" />;
    }
  };

  const getCategoryVariant = (category: CustomerCategory | undefined) => {
    if (!category) return 'outline';
    switch (category) {
      case 'Premium':
        return 'destructive';
      case 'Standard':
        return 'default';
      default:
        return 'secondary';
    }
  };

  // Filter options
  const searchFilters: SearchFilter[] = [
    {
      id: 'role',
      label: 'User Role',
      type: 'checkbox',
      options: [
        { value: 'customer', label: 'Customer' },
        { value: 'sales', label: 'Sales' },
        { value: 'accounts', label: 'Accounts' },
        { value: 'manager', label: 'Manager' },
        { value: 'admin', label: 'Admin' }
      ],
      value: filters.role || []
    },
    {
      id: 'customerCategory',
      label: 'Customer Category',
      type: 'checkbox',
      options: [
        { value: 'Normal', label: 'Normal' },
        { value: 'Standard', label: 'Standard' },
        { value: 'Premium', label: 'Premium' }
      ],
      value: filters.customerCategory || []
    },
    {
      id: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' }
      ],
      value: filters.status || ''
    },
    {
      id: 'discountRange',
      label: 'Discount Percentage',
      type: 'range',
      value: filters.discountRange || {}
    }
  ];

  const sortOptions: SortOption[] = [
    { value: 'name', label: 'Name' },
    { value: 'email', label: 'Email' },
    { value: 'role', label: 'Role' },
    { value: 'customerCategory', label: 'Category' },
    { value: 'discountPercentage', label: 'Discount' },
    { value: 'created_at', label: 'Join Date' }
  ];

  const handleFilterChange = (filterId: string, value: any) => {
    setFilters((prev) => {
      const next = { ...prev };
      const isEmptyArray = Array.isArray(value) && value.length === 0;
      const isEmptyObject = value && typeof value === 'object' && !Array.isArray(value) && Object.values(value).every((entry) => !entry);

      if (value === undefined || value === null || value === '' || isEmptyArray || isEmptyObject) {
        delete next[filterId];
      } else {
        next[filterId] = value;
      }

      return next;
    });

    if (filterId === 'role' && Array.isArray(value) && value.length > 0) {
      setActiveTab('all');
    }
  };

  const handleSortChange = (field: string, direction: 'asc' | 'desc') => {
    setSortField(field);
    setSortDirection(direction);
  };

  const clearFilters = () => {
    setFilters({});
    setSearchQuery('');
  };

  const activeFiltersCount = Object.values(filters).filter(value => {
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object' && value !== null) {
      return Object.values(value).some(v => v);
    }
    return Boolean(value);
  }).length;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground">
            View, manage, and assign roles to all users.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button 
            variant="outline" 
            onClick={() => setShowDiscountDialog(true)}
            className="flex items-center gap-2"
          >
            <Percent className="h-4 w-4" />
            Discounts & Offers
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            All Users
            <Badge variant="secondary" className="ml-2">
              {totalsBreakdown.total}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="staff" className="flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            Staff
            <Badge variant="secondary" className="ml-2">
              {totalsBreakdown.staff}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="customer" className="flex items-center gap-2">
            <UserIcon className="h-4 w-4" />
            Customers
            <Badge variant="secondary" className="ml-2">
              {totalsBreakdown.customers}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="sales" className="flex items-center gap-2">
            <Headphones className="h-4 w-4" />
            Sales Agents
            <Badge variant="secondary" className="ml-2">
              {totalsBreakdown.sales}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>
                  {activeTab === 'all' && 'All Users'}
                  {activeTab === 'staff' && 'Staff Members'}
                  {activeTab === 'customer' && 'Customers'}
                  {activeTab === 'sales' && 'Sales Agents'}
                </CardTitle>
                <CardDescription>
                  A list of registered users filtered by your current view.
                </CardDescription>
                {lastUpdated && (
                  <p className="text-xs text-muted-foreground">Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                )}
                {apiError && (
                  <p className="text-xs text-destructive">{apiError}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={fetchUsers}
                  disabled={isLoading}
                  className="flex items-center gap-2"
                >
                  <RefreshCcw className="h-4 w-4" />
                  Refresh
                </Button>
                <AddUserDialog onUserAdded={fetchUsers} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
          <UniversalSearch
            placeholder="Search users by name, email, mobile, role..."
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            filters={searchFilters}
            onFilterChange={handleFilterChange}
            sortOptions={sortOptions}
            sortValue={sortField}
            sortDirection={sortDirection}
            onSortChange={handleSortChange}
            activeFiltersCount={activeFiltersCount}
            onClearFilters={clearFilters}
          />

          <div className="text-sm text-muted-foreground">
            Showing {rangeStart}-{rangeEnd} of {totalUsers} users
            {isLoading && users.length > 0 && <span className="ml-2 text-xs">(Refreshing...)</span>}
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Mobile</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                    Loading users...
                  </TableCell>
                </TableRow>
              ) : users.length > 0 ? (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.name || 'No Name'}
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      {user.mobile || <span className="text-muted-foreground text-sm">Not provided</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getRoleVariant(user.role)} className="capitalize flex items-center gap-1">
                        {getRoleIcon(user.role)}
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.role === 'customer' && user.customerCategory ? (
                        <Badge variant={getCategoryVariant(user.customerCategory)} className="flex items-center gap-1 w-fit">
                          {getCategoryIcon(user.customerCategory)}
                          {user.customerCategory}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {user.role === 'customer' && typeof user.discountPercentage === 'number' ? (
                        <Badge variant="outline">{user.discountPercentage}%</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.isActive !== false ? 'default' : 'secondary'}>
                        {user.isActive !== false ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Link href={`${userAnalyticsBasePath}/${user.id}/analytics`}>
                          <Button variant="ghost" size="icon" title="View Analytics">
                            <Activity className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditUser(user)}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                    No users found for the selected filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {rangeStart}-{rangeEnd} of {totalUsers}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={String(pageSize)}
                onValueChange={(value) => {
                  setPageSize(Number(value));
                }}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Page size" />
                </SelectTrigger>
                <SelectContent>
                  {[10, 25, 50, 100].map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size} per page
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={page === 1 || isLoading}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={page >= totalPages || isLoading}
                >
                  Next
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
        </TabsContent>
      </Tabs>

      <EditUserDialog
        isOpen={showEditDialog}
        onClose={() => setShowEditDialog(false)}
        user={selectedUser}
        onUserUpdated={fetchUsers}
      />

      <DiscountOffersDialog
        isOpen={showDiscountDialog}
        onClose={() => setShowDiscountDialog(false)}
      />
    </div>
  );
}
