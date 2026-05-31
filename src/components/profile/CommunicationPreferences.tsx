'use client';

import React, { useState, useEffect } from 'react';

import { 
  Smartphone, 
  Mail, 
  MessageCircle, 
  Shield, 
  ShoppingCart, 
  Wrench, 
  Bell,
  Save,
  CheckCircle
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { useToast } from '../../hooks/use-toast';
import { logger } from '@/lib/logger';

export type OTPChannel = 'sms' | 'email';

export interface CommunicationPreferences {
  id?: string;
  userId: string;
  preferredOTPChannel: OTPChannel;
  smsNotifications: boolean;
  emailNotifications: boolean;
  whatsappNotifications: boolean;
  orderUpdates: boolean;
  serviceUpdates: boolean;
  securityAlerts: boolean;
  phone?: string;
  email?: string;
}

interface CommunicationPreferencesProps {
  userId: string;
  initialPreferences?: Partial<CommunicationPreferences>;
  onSave?: (preferences: CommunicationPreferences) => Promise<void>;
}

export default function CommunicationPreferencesComponent({
  userId,
  initialPreferences,
  onSave
}: CommunicationPreferencesProps) {
  const { toast } = useToast();
  const [preferences, setPreferences] = useState<CommunicationPreferences>({
    userId,
    preferredOTPChannel: 'email',
    smsNotifications: true,
    emailNotifications: true,
    whatsappNotifications: true,
    orderUpdates: true,
    serviceUpdates: true,
    securityAlerts: true,
    phone: '',
    email: '',
    ...initialPreferences
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Track changes
  useEffect(() => {
    setHasChanges(JSON.stringify(preferences) !== JSON.stringify({
      userId,
      preferredOTPChannel: 'email',
      smsNotifications: true,
      emailNotifications: true,
      whatsappNotifications: true,
      orderUpdates: true,
      serviceUpdates: true,
      securityAlerts: true,
      phone: '',
      email: '',
      ...initialPreferences
    }));
  }, [preferences, initialPreferences, userId]);

  // Update preference helper
  const updatePreference = (key: keyof CommunicationPreferences, value: any) => {
    setPreferences(prev => ({
      ...prev,
      [key]: value
    }));
    setIsSaved(false);
  };

  // Save preferences
  const handleSave = async () => {
    setIsLoading(true);
    try {
      if (onSave) {
        await onSave(preferences);
      } else {
        // Default API call
        const response = await fetch('/api/user/communication-preferences', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(preferences)
        });

        if (!response.ok) {
          throw new Error('Failed to save preferences');
        }
      }

      setIsSaved(true);
      setHasChanges(false);
      toast({
        title: "Preferences Saved",
        description: "Your communication preferences have been updated successfully.",
        duration: 3000,
      });

      // Reset saved state after 3 seconds
      setTimeout(() => setIsSaved(false), 3000);

    } catch (error) {
      logger.error('Failed to save communication preferences', {
        error: error instanceof Error ? error.message : String(error)
      });
      toast({
        title: "Error",
        description: "Failed to save preferences. Please try again.",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900">Communication Preferences</h2>
        <p className="text-gray-600 mt-2">
          Manage how you'd like to receive notifications and security codes from TecBunny Solutions
        </p>
      </div>

      {/* Contact Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Mail className="h-5 w-5" />
            <span>Contact Information</span>
          </CardTitle>
          <CardDescription>
            Update your contact details for notifications and OTP delivery
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              value={preferences.email || ''}
              onChange={(e) => updatePreference('email', e.target.value)}
              placeholder="your.email@example.com"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="phone">Mobile Number</Label>
            <Input
              id="phone"
              type="tel"
              value={preferences.phone || ''}
              onChange={(e) => updatePreference('phone', e.target.value)}
              placeholder="+91 XXXXX XXXXX"
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* OTP Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5" />
            <span>OTP & Security</span>
          </CardTitle>
          <CardDescription>
            Choose your preferred method for receiving one-time passwords and security codes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label className="text-base font-medium">Preferred OTP Method</Label>
            <p className="text-sm text-gray-500 mb-3">
              We'll try your preferred method first, with automatic fallback if needed
            </p>
            <RadioGroup
              value={preferences.preferredOTPChannel}
              onValueChange={(value) => updatePreference('preferredOTPChannel', value as OTPChannel)}
            >
              <div className="flex items-center space-x-3 p-3 border rounded-lg">
                <RadioGroupItem value="email" id="email-otp" />
                <Mail className="h-4 w-4 text-blue-600" />
                <Label htmlFor="email-otp" className="flex-1 cursor-pointer">
                  <div className="font-medium">Email</div>
                  <div className="text-sm text-gray-500">Fast and reliable delivery</div>
                </Label>
              </div>
              <div className="flex items-center space-x-3 p-3 border rounded-lg">
                <RadioGroupItem value="sms" id="sms-otp" />
                <Smartphone className="h-4 w-4 text-green-600" />
                <Label htmlFor="sms-otp" className="flex-1 cursor-pointer">
                  <div className="font-medium">SMS</div>
                  <div className="text-sm text-gray-500">Instant mobile delivery</div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          <Separator />

          <div className="space-y-4">
            <Label className="text-base font-medium">Security Alerts</Label>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Shield className="h-4 w-4 text-orange-600" />
                  <div>
                    <div className="font-medium">Security Notifications</div>
                    <div className="text-sm text-gray-500">Login alerts, password changes, etc.</div>
                  </div>
                </div>
                <Switch
                  checked={preferences.securityAlerts}
                  onCheckedChange={(checked) => updatePreference('securityAlerts', checked)}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notification Channels */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Bell className="h-5 w-5" />
            <span>Notification Channels</span>
          </CardTitle>
          <CardDescription>
            Enable or disable specific communication channels for different types of notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* SMS Notifications */}
            <div className="p-4 border rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <Smartphone className="h-5 w-5 text-green-600" />
                  <span className="font-medium">SMS</span>
                </div>
                <Switch
                  checked={preferences.smsNotifications}
                  onCheckedChange={(checked) => updatePreference('smsNotifications', checked)}
                />
              </div>
              <p className="text-sm text-gray-500">
                Receive text messages for important updates
              </p>
            </div>

            {/* Email Notifications */}
            <div className="p-4 border rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <Mail className="h-5 w-5 text-blue-600" />
                  <span className="font-medium">Email</span>
                </div>
                <Switch
                  checked={preferences.emailNotifications}
                  onCheckedChange={(checked) => updatePreference('emailNotifications', checked)}
                />
              </div>
              <p className="text-sm text-gray-500">
                Receive detailed email notifications
              </p>
            </div>

            {/* WhatsApp Notifications */}
            <div className="p-4 border rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <MessageCircle className="h-5 w-5 text-green-500" />
                  <span className="font-medium">WhatsApp</span>
                </div>
                <Switch
                  checked={preferences.whatsappNotifications}
                  onCheckedChange={(checked) => updatePreference('whatsappNotifications', checked)}
                />
              </div>
              <p className="text-sm text-gray-500">
                Get instant WhatsApp notifications
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notification Types */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Bell className="h-5 w-5" />
            <span>Notification Types</span>
          </CardTitle>
          <CardDescription>
            Choose which types of notifications you want to receive
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center space-x-3">
              <ShoppingCart className="h-4 w-4 text-blue-600" />
              <div>
                <div className="font-medium">Order Updates</div>
                <div className="text-sm text-gray-500">Confirmations, shipping, delivery status</div>
              </div>
            </div>
            <Switch
              checked={preferences.orderUpdates}
              onCheckedChange={(checked) => updatePreference('orderUpdates', checked)}
            />
          </div>

          <div className="flex items-center justify-between py-2">
            <div className="flex items-center space-x-3">
              <Wrench className="h-4 w-4 text-orange-600" />
              <div>
                <div className="font-medium">Service Updates</div>
                <div className="text-sm text-gray-500">Technician assignments, service completion</div>
              </div>
            </div>
            <Switch
              checked={preferences.serviceUpdates}
              onCheckedChange={(checked) => updatePreference('serviceUpdates', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-center">
        <Button
          onClick={handleSave}
          disabled={!hasChanges || isLoading}
          className="min-w-32"
        >
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Saving...
            </>
          ) : isSaved ? (
            <>
              <CheckCircle className="h-4 w-4 mr-2" />
              Saved
            </>
          ) : hasChanges ? (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </>
          ) : (
            <>
              <CheckCircle className="h-4 w-4 mr-2" />
              Up to Date
            </>
          )}
        </Button>
      </div>

      {/* Help Text */}
      <div className="text-center text-sm text-gray-500">
        <p>
          Changes take effect immediately. You can update these preferences anytime.
        </p>
        <p className="mt-1">
          For urgent matters, we may still contact you regardless of these settings.
        </p>
      </div>
    </div>
  );
}