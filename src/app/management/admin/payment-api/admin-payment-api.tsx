
'use client';

import * as React from 'react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '../../../../hooks/use-toast';
import { usePaymentMethods } from '../../../../hooks/use-payment-methods';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { InfoIcon } from 'lucide-react';

export default function PaymentApiPage() {
  const { toast } = useToast();
  const { paymentMethods, loading, updatePaymentMethod } = usePaymentMethods();

  const [formData, setFormData] = React.useState({
    payu: {
      enabled: false,
      merchantKey: '',
      merchantSalt: '',
      merchantId: '',
      environment: 'test'
    },
    cod: {
      enabled: true,
      minOrderAmount: '',
      maxOrderAmount: '',
      instructions: ''
    },
    upi: {
      enabled: true,
      upiId: '',
      upiName: '',
      instructions: ''
    }
  });

  const [savingStates, setSavingStates] = React.useState({
    payu: false,
    cod: false,
    upi: false
  });

  // Update form data when payment methods are loaded
  React.useEffect(() => {
    if (!loading && paymentMethods) {
      setFormData({
        payu: {
          enabled: paymentMethods.payu?.enabled || false,
          merchantKey: paymentMethods.payu?.config?.merchantKey || '',
          merchantSalt: paymentMethods.payu?.config?.merchantSalt || '',
          merchantId: paymentMethods.payu?.config?.merchantId || '',
          environment: paymentMethods.payu?.config?.environment || 'test'
        },
        cod: {
          enabled: paymentMethods.cod?.enabled || true,
          minOrderAmount: paymentMethods.cod?.config?.minOrderAmount || '',
          maxOrderAmount: paymentMethods.cod?.config?.maxOrderAmount || '',
          instructions: paymentMethods.cod?.config?.instructions || ''
        },
        upi: {
          enabled: paymentMethods.upi?.enabled || true,
          upiId: paymentMethods.upi?.config?.upiId || '',
          upiName: paymentMethods.upi?.config?.upiName || '',
          instructions: paymentMethods.upi?.config?.instructions || ''
        }
      });
    }
  }, [loading, paymentMethods]);

  const handleSavePayu = async () => {
    setSavingStates(prev => ({ ...prev, payu: true }));
    try {
      const result = await updatePaymentMethod('payu', {
        enabled: formData.payu.enabled,
        config: {
          merchantKey: formData.payu.merchantKey,
          merchantSalt: formData.payu.merchantSalt,
          merchantId: formData.payu.merchantId,
          environment: formData.payu.environment
        }
      });

      if (result && result.success) {
        toast({
          title: 'Success',
          description: 'PayU settings saved successfully'
        });
      } else {
        toast({
          title: 'Notice',
          description: 'Settings are managed via code. UI updates are disabled.',
          variant: 'default'
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive'
      });
    } finally {
      setSavingStates(prev => ({ ...prev, payu: false }));
    }
  };

  const handleSaveCOD = async () => {
    setSavingStates(prev => ({ ...prev, cod: true }));
    try {
      const result = await updatePaymentMethod('cod', {
        enabled: formData.cod.enabled,
        config: {
          minOrderAmount: formData.cod.minOrderAmount,
          maxOrderAmount: formData.cod.maxOrderAmount,
          instructions: formData.cod.instructions
        }
      });

      if (result && result.success) {
        toast({
          title: 'Success',
          description: 'Cash on Delivery settings saved successfully'
        });
      } else {
        toast({
          title: 'Notice',
          description: 'Settings are managed via code. UI updates are disabled.',
          variant: 'default'
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive'
      });
    } finally {
      setSavingStates(prev => ({ ...prev, cod: false }));
    }
  };

  const handleSaveUPI = async () => {
    setSavingStates(prev => ({ ...prev, upi: true }));
    try {
      const result = await updatePaymentMethod('upi', {
        enabled: formData.upi.enabled,
        config: {
          upiId: formData.upi.upiId,
          upiName: formData.upi.upiName,
          instructions: formData.upi.instructions
        }
      });

      if (result && result.success) {
        toast({
          title: 'Success',
          description: 'UPI settings saved successfully'
        });
      } else {
        toast({
          title: 'Notice',
          description: 'Settings are managed via code. UI updates are disabled.',
          variant: 'default'
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive'
      });
    } finally {
      setSavingStates(prev => ({ ...prev, upi: false }));
    }
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Payment API Settings</h1>
          <p className="text-muted-foreground">Loading payment configuration...</p>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Payment API Settings</h1>
        <p className="text-muted-foreground">
          Connect and configure your payment gateways.
        </p>
      </div>

      <Alert>
        <InfoIcon className="h-4 w-4" />
        <AlertTitle>Configuration Mode</AlertTitle>
        <AlertDescription>
          Payment settings are currently managed via code/environment variables. Changes made here will not persist.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>PayU</CardTitle>
          <CardDescription>
            Configure PayU (India) merchant credentials.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label>Enable PayU</Label>
              <p className="text-xs text-muted-foreground">Allow customers to pay using PayU.</p>
            </div>
            <Switch
              checked={formData.payu.enabled}
              onCheckedChange={(checked) =>
                setFormData(prev => ({
                  ...prev,
                  payu: { ...prev.payu, enabled: checked }
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="payu-merchant-key">Merchant Key</Label>
            <Input
              id="payu-merchant-key"
              placeholder="e.g., gtKFFx"
              value={formData.payu.merchantKey}
              onChange={(e) =>
                setFormData(prev => ({
                  ...prev,
                  payu: { ...prev.payu, merchantKey: e.target.value }
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="payu-merchant-salt">Merchant Salt</Label>
            <Input
              id="payu-merchant-salt"
              type="password"
              placeholder="Enter your salt"
              value={formData.payu.merchantSalt}
              onChange={(e) =>
                setFormData(prev => ({
                  ...prev,
                  payu: { ...prev.payu, merchantSalt: e.target.value }
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="payu-merchant-id">Merchant ID (optional)</Label>
            <Input
              id="payu-merchant-id"
              placeholder="Enter Merchant ID if provided"
              value={formData.payu.merchantId}
              onChange={(e) =>
                setFormData(prev => ({
                  ...prev,
                  payu: { ...prev.payu, merchantId: e.target.value }
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="payu-environment">Environment</Label>
            <select
              id="payu-environment"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={formData.payu.environment}
              onChange={(e) =>
                setFormData(prev => ({
                  ...prev,
                  payu: { ...prev.payu, environment: e.target.value }
                }))
              }
            >
              <option value="test">Test (Sandbox)</option>
              <option value="production">Production (Live)</option>
            </select>
            <p className="text-xs text-muted-foreground">
              Use the Test environment until PayU activates your live credentials.
            </p>
          </div>
          <Button onClick={handleSavePayu} disabled={savingStates.payu}>
            {savingStates.payu ? 'Saving...' : 'Save PayU Settings'}
          </Button>
        </CardContent>
      </Card>

      {/* Cash on Delivery (COD) Section */}
      <Card>
        <CardHeader>
          <CardTitle>Cash on Delivery (COD)</CardTitle>
          <CardDescription>
            Configure cash on delivery payment option for your customers.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label>Enable Cash on Delivery</Label>
              <p className="text-xs text-muted-foreground">Allow customers to pay with cash upon delivery.</p>
            </div>
            <Switch 
              checked={formData.cod.enabled}
              onCheckedChange={(checked) => 
                setFormData(prev => ({
                  ...prev,
                  cod: { ...prev.cod, enabled: checked }
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cod-min-amount">Minimum Order Amount (₹)</Label>
            <Input 
              id="cod-min-amount" 
              type="number"
              placeholder="e.g., 0 (optional)"
              value={formData.cod.minOrderAmount}
              onChange={(e) => 
                setFormData(prev => ({
                  ...prev,
                  cod: { ...prev.cod, minOrderAmount: e.target.value }
                }))
              }
            />
            <p className="text-xs text-muted-foreground">
              Leave empty for no minimum order amount
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cod-max-amount">Maximum Order Amount (₹)</Label>
            <Input 
              id="cod-max-amount" 
              type="number"
              placeholder="e.g., 50000 (optional)"
              value={formData.cod.maxOrderAmount}
              onChange={(e) => 
                setFormData(prev => ({
                  ...prev,
                  cod: { ...prev.cod, maxOrderAmount: e.target.value }
                }))
              }
            />
            <p className="text-xs text-muted-foreground">
              Leave empty for no maximum order amount
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cod-instructions">Instructions for Customers</Label>
            <Textarea 
              id="cod-instructions" 
              placeholder="e.g., Please keep exact change ready. Our delivery partner will collect the payment."
              value={formData.cod.instructions}
              rows={3}
              onChange={(e) => 
                setFormData(prev => ({
                  ...prev,
                  cod: { ...prev.cod, instructions: e.target.value }
                }))
              }
            />
          </div>
          <Button onClick={handleSaveCOD} disabled={savingStates.cod}>
            {savingStates.cod ? 'Saving...' : 'Save COD Settings'}
          </Button>
        </CardContent>
      </Card>

      {/* UPI Section */}
      <Card>
        <CardHeader>
          <CardTitle>UPI / QR Code Payment</CardTitle>
          <CardDescription>
            Configure UPI payment option for manual QR code payments.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label>Enable UPI Payments</Label>
              <p className="text-xs text-muted-foreground">Allow customers to pay via UPI/QR code.</p>
            </div>
            <Switch 
              checked={formData.upi.enabled}
              onCheckedChange={(checked) => 
                setFormData(prev => ({
                  ...prev,
                  upi: { ...prev.upi, enabled: checked }
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="upi-id">UPI ID</Label>
            <Input 
              id="upi-id" 
              placeholder="e.g., yourstore@paytm or 9876543210@ybl"
              value={formData.upi.upiId}
              onChange={(e) => 
                setFormData(prev => ({
                  ...prev,
                  upi: { ...prev.upi, upiId: e.target.value }
                }))
              }
            />
            <p className="text-xs text-muted-foreground">
              Your UPI ID for receiving payments (e.g., merchantname@paytm)
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="upi-name">Account Holder Name</Label>
            <Input 
              id="upi-name" 
              placeholder="e.g., TecBunny Solutions"
              value={formData.upi.upiName}
              onChange={(e) => 
                setFormData(prev => ({
                  ...prev,
                  upi: { ...prev.upi, upiName: e.target.value }
                }))
              }
            />
            <p className="text-xs text-muted-foreground">
              Name that appears on the UPI account
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="upi-instructions">Payment Instructions</Label>
            <Textarea 
              id="upi-instructions" 
              placeholder="e.g., Scan the QR code and complete the payment. Share the transaction screenshot/ID with us."
              value={formData.upi.instructions}
              rows={3}
              onChange={(e) => 
                setFormData(prev => ({
                  ...prev,
                  upi: { ...prev.upi, instructions: e.target.value }
                }))
              }
            />
            <p className="text-xs text-muted-foreground">
              Instructions shown to customers during UPI payment
            </p>
          </div>
          <Button onClick={handleSaveUPI} disabled={savingStates.upi}>
            {savingStates.upi ? 'Saving...' : 'Save UPI Settings'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
