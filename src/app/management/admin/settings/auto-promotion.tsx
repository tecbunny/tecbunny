'use client';

import * as React from 'react';

import {
  Settings,
  TrendingUp,
  Crown,
  Star,
  User,
  ShoppingCart,
  DollarSign,
  Calendar,
  RotateCcw,
  Save
} from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Switch } from '../../../../components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../components/ui/tabs';
import { useToast } from '../../../../hooks/use-toast';
import { createClient } from '../../../../lib/supabase/client';

interface PromotionRule {
  id: string;
  fromCategory: string;
  toCategory: string;
  minOrderAmount: number;
  minOrderCount: number;
  timeframeDays: number;
  isActive: boolean;
}

interface AutoPromotionSettings {
  isEnabled: boolean;
  rules: PromotionRule[];
  checkFrequencyHours: number;
  requireConsecutiveOrders: boolean;
  applyImmediately: boolean;
  notifyCustomers: boolean;
}

export default function AutoPromotionSettingsPage() {
  const [settings, setSettings] = React.useState<AutoPromotionSettings>({
    isEnabled: false,
    rules: [
      {
        id: '1',
        fromCategory: 'Normal',
        toCategory: 'Standard',
        minOrderAmount: 50000,
        minOrderCount: 5,
        timeframeDays: 30,
        isActive: true
      },
      {
        id: '2',
        fromCategory: 'Standard',
        toCategory: 'Premium',
        minOrderAmount: 100000,
        minOrderCount: 10,
        timeframeDays: 60,
        isActive: true
      }
    ],
    checkFrequencyHours: 24,
    requireConsecutiveOrders: false,
    applyImmediately: true,
    notifyCustomers: true
  });

  const [isLoading, setIsLoading] = React.useState(false);
  const [lastCheck, setLastCheck] = React.useState<string>('');
  const [promotionStats, setPromotionStats] = React.useState({
    totalPromotions: 0,
    thisMonth: 0,
    pending: 0
  });

  const { toast } = useToast();
  const supabase = createClient();

  const loadSettings = React.useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .eq('key', 'auto_promotion_settings')
        .single();

      if (!error && data) {
        setSettings(JSON.parse(data.value));
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }, [supabase]);

  const loadStats = React.useCallback(async () => {
    try {
      // Get promotion statistics
      const { data: promotions, error } = await supabase
        .from('customer_promotions')
        .select('*');

      if (!error && promotions) {
        const now = new Date();
        const thisMonth = promotions.filter(p => {
          const promotionDate = new Date(p.created_at);
          return promotionDate.getMonth() === now.getMonth() &&
                 promotionDate.getFullYear() === now.getFullYear();
        });

        setPromotionStats({
          totalPromotions: promotions.length,
          thisMonth: thisMonth.length,
          pending: promotions.filter(p => !p.applied).length
        });
      }

      // Get last check time
      const { data: lastCheckData } = await supabase
        .from('system_settings')
        .select('updated_at')
        .eq('key', 'last_promotion_check')
        .single();

      if (lastCheckData) {
        setLastCheck(lastCheckData.updated_at);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }, [supabase]);

  React.useEffect(() => {
    loadSettings();
    loadStats();
  }, [loadSettings, loadStats]);

  const saveSettings = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('system_settings')
        .upsert({
          key: 'auto_promotion_settings',
          value: JSON.stringify(settings),
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      toast({
        title: "Settings Saved",
        description: "Auto-promotion settings have been updated successfully.",
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: "Save Failed",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const runPromotionCheck = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/customer-promotions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check-all' })
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.message);

      const promotedCount = typeof result?.count === 'number'
        ? result.count
        : Array.isArray(result?.promotions)
          ? result.promotions.length
          : 0;

      toast({
        title: "Promotion Check Complete",
        description: `${promotedCount} customers matched promotion checks.`,
      });

      loadStats();
    } catch (error) {
      console.error('Error running promotion check:', error);
      toast({
        title: "Check Failed",
        description: "Failed to run promotion check. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateRule = (ruleId: string, field: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      rules: prev.rules.map(rule =>
        rule.id === ruleId ? { ...rule, [field]: value } : rule
      )
    }));
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Premium':
        return <Crown className="h-4 w-4 text-yellow-500" />;
      case 'Standard':
        return <Star className="h-4 w-4 text-blue-500" />;
      default:
        return <User className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Auto-Promotion Settings</h1>
          <p className="text-muted-foreground">
            Configure automatic customer category promotions based on purchase behavior.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={runPromotionCheck}
            disabled={isLoading}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Run Check Now
          </Button>
          <Button onClick={saveSettings} disabled={isLoading}>
            <Save className="mr-2 h-4 w-4" />
            {isLoading ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Promotions</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{promotionStats.totalPromotions}</div>
            <p className="text-xs text-muted-foreground">
              All-time customer promotions
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{promotionStats.thisMonth}</div>
            <p className="text-xs text-muted-foreground">
              Promotions this month
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{promotionStats.pending}</div>
            <p className="text-xs text-muted-foreground">
              Awaiting manual approval
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="rules" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="rules">Promotion Rules</TabsTrigger>
          <TabsTrigger value="settings">General Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Customer Promotion Rules</CardTitle>
              <CardDescription>
                Define rules for automatically promoting customers to higher tiers based on their purchase behavior.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {settings.rules.map((rule) => (
                <div key={rule.id} className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        {getCategoryIcon(rule.fromCategory)}
                        <span className="font-medium">{rule.fromCategory}</span>
                      </div>
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      <div className="flex items-center gap-2">
                        {getCategoryIcon(rule.toCategory)}
                        <span className="font-medium">{rule.toCategory}</span>
                      </div>
                    </div>
                    <Switch
                      checked={rule.isActive}
                      onCheckedChange={(checked) => updateRule(rule.id, 'isActive', checked)}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor={`amount-${rule.id}`}>
                        <DollarSign className="inline h-4 w-4 mr-1" />
                        Minimum Total Amount (₹)
                      </Label>
                      <Input
                        id={`amount-${rule.id}`}
                        type="number"
                        value={rule.minOrderAmount}
                        onChange={(e) => updateRule(rule.id, 'minOrderAmount', parseInt(e.target.value) || 0)}
                        placeholder="50000"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor={`count-${rule.id}`}>
                        <ShoppingCart className="inline h-4 w-4 mr-1" />
                        Minimum Order Count
                      </Label>
                      <Input
                        id={`count-${rule.id}`}
                        type="number"
                        value={rule.minOrderCount}
                        onChange={(e) => updateRule(rule.id, 'minOrderCount', parseInt(e.target.value) || 0)}
                        placeholder="5"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor={`timeframe-${rule.id}`}>
                        <Calendar className="inline h-4 w-4 mr-1" />
                        Timeframe (Days)
                      </Label>
                      <Input
                        id={`timeframe-${rule.id}`}
                        type="number"
                        value={rule.timeframeDays}
                        onChange={(e) => updateRule(rule.id, 'timeframeDays', parseInt(e.target.value) || 0)}
                        placeholder="30"
                      />
                    </div>
                  </div>

                  <div className="text-sm text-muted-foreground bg-white/5 border border-white/10 p-3 rounded">
                    <strong>Rule:</strong> Promote {rule.fromCategory} customers to {rule.toCategory} when they have 
                    placed at least <strong>{rule.minOrderCount} orders</strong> totaling 
                    <strong> ₹{rule.minOrderAmount.toLocaleString()}</strong> within 
                    <strong> {rule.timeframeDays} days</strong>.
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>
                Configure how the auto-promotion system operates.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-base">Enable Auto-Promotion</Label>
                  <p className="text-sm text-muted-foreground">
                    Turn on automatic customer category promotions based on purchase behavior.
                  </p>
                </div>
                <Switch
                  checked={settings.isEnabled}
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, isEnabled: checked }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="checkFrequency">Check Frequency (Hours)</Label>
                <Input
                  id="checkFrequency"
                  type="number"
                  value={settings.checkFrequencyHours}
                  onChange={(e) => setSettings(prev => ({ 
                    ...prev, 
                    checkFrequencyHours: parseInt(e.target.value) || 24 
                  }))}
                  placeholder="24"
                />
                <p className="text-xs text-muted-foreground">
                  How often to check for eligible customers (in hours).
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-base">Apply Immediately</Label>
                  <p className="text-sm text-muted-foreground">
                    Apply promotions immediately without manual approval.
                  </p>
                </div>
                <Switch
                  checked={settings.applyImmediately}
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, applyImmediately: checked }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-base">Notify Customers</Label>
                  <p className="text-sm text-muted-foreground">
                    Send email notifications to customers when they are promoted.
                  </p>
                </div>
                <Switch
                  checked={settings.notifyCustomers}
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, notifyCustomers: checked }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-base">Require Consecutive Orders</Label>
                  <p className="text-sm text-muted-foreground">
                    Orders must be placed consecutively without gaps to qualify.
                  </p>
                </div>
                <Switch
                  checked={settings.requireConsecutiveOrders}
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, requireConsecutiveOrders: checked }))}
                />
              </div>

              {lastCheck && (
                <div className="border border-white/10 rounded-lg p-4 bg-white/5">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Last Check:</span>
                    <span className="text-sm text-muted-foreground">
                      {new Date(lastCheck).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
