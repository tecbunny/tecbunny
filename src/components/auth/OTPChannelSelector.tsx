'use client';

import React, { useState, useEffect } from 'react';

import { Smartphone, Mail, Shield, CheckCircle, AlertCircle, MessageCircle, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { ErrorBoundary, CommunicationErrorFallback } from '@/components/shared/ErrorBoundary';

export type OTPChannel = 'sms' | 'email' | 'whatsapp';
export type OTPPurpose = 'signup' | 'recovery' | 'login_2fa' | 'agent_order';

interface OTPChannelSelectorProps {
  email?: string;
  phone?: string;
  purpose: OTPPurpose;
  onChannelSelect: (channel: OTPChannel, contact: string) => void;
  onSendOTP: (channel: OTPChannel, contact: string) => Promise<{ success: boolean; error?: string }>;
  disabled?: boolean;
  userPreferences?: {
    preferredChannel: OTPChannel;
    smsEnabled: boolean;
    emailEnabled: boolean;
    whatsappEnabled: boolean;
  };
}

interface DeliveryStatus {
  channel?: OTPChannel;
  success?: boolean;
  error?: string;
  deliveryId?: string;
  fallbackUsed?: boolean;
}

export default function OTPChannelSelector({
  email: initialEmail,
  phone: initialPhone,
  purpose,
  onChannelSelect,
  onSendOTP,
  disabled = false,
  userPreferences
}: OTPChannelSelectorProps) {
  const [selectedChannel, setSelectedChannel] = useState<OTPChannel>(
    userPreferences?.preferredChannel || 'email'
  );
  const [email, setEmail] = useState(initialEmail || '');
  const [phone, setPhone] = useState(initialPhone || '');
  const [isLoading, setIsLoading] = useState(false);
  const [deliveryStatus, setDeliveryStatus] = useState<DeliveryStatus>({});
  const [countdown, setCountdown] = useState(0);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [countdown]);

  // Purpose display mapping
  const purposeConfig = {
    signup: {
      title: 'Verify Your Account',
      description: 'Choose how you\'d like to receive your verification code',
      icon: Shield
    },
    recovery: {
      title: 'Reset Your Password',
      description: 'We\'ll send a verification code to reset your password',
      icon: Shield
    },
    login_2fa: {
      title: '2-Factor Authentication',
      description: 'Additional security verification required',
      icon: Shield
    },
    agent_order: {
      title: 'Order Verification',
      description: 'Verify your order placement with a security code',
      icon: CheckCircle
    }
  };

  const config = purposeConfig[purpose];
  const IconComponent = config.icon;

  // Validate contact information
  const isEmailValid = email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isPhoneValid = phone && /^[\+]?[\d\s\-\(\)]{10,}$/.test(phone);

  // Check if selected channel is available and valid
  const isChannelAvailable = (channel: OTPChannel) => {
    if (channel === 'email') {
      return isEmailValid && (userPreferences?.emailEnabled !== false);
    }
    if (channel === 'sms') {
      return isPhoneValid && (userPreferences?.smsEnabled !== false);
    }
    if (channel === 'whatsapp') {
      return isPhoneValid && (userPreferences?.whatsappEnabled !== false);
    }
    return false;
  };

  // Format phone number for display
  const formatPhoneDisplay = (phoneNum: string) => {
    const cleaned = phoneNum.replace(/\D/g, '');
    if (cleaned.length >= 10) {
      const last4 = cleaned.slice(-4);
      const masked = cleaned.slice(0, -4).replace(/\d/g, 'X');
      return `+${masked}${last4}`;
    }
    return phoneNum;
  };

  // Format email for display
  const formatEmailDisplay = (emailAddr: string) => {
    const [username, domain] = emailAddr.split('@');
    if (username && domain) {
      const maskedUsername = username.charAt(0) + 'X'.repeat(Math.max(0, username.length - 2)) + username.slice(-1);
      return `${maskedUsername}@${domain}`;
    }
    return emailAddr;
  };

  // Handle OTP send
  const handleSendOTP = async () => {
    if (!isChannelAvailable(selectedChannel)) return;

    setIsLoading(true);
    setDeliveryStatus({});

    try {
      const contact = selectedChannel === 'email' ? email : phone;
      onChannelSelect(selectedChannel, contact);
      
      const result = await onSendOTP(selectedChannel, contact);
      
      setDeliveryStatus({
        channel: selectedChannel,
        success: result.success,
        error: result.error
      });

      if (result.success) {
        setCountdown(60); // 60 second cooldown
      }

    } catch (error) {
      setDeliveryStatus({
        channel: selectedChannel,
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send OTP'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ErrorBoundary fallback={CommunicationErrorFallback}>
      <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          <div className="p-3 bg-blue-100 rounded-full">
            <IconComponent className="h-6 w-6 text-blue-600" />
          </div>
        </div>
        <CardTitle className="text-xl">{config.title}</CardTitle>
        <CardDescription>{config.description}</CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Contact Information Inputs */}
        <div className="space-y-4">
          <div>
            <Label htmlFor="email" className="text-sm font-medium">Email Address</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="mt-1"
              disabled={disabled || !!initialEmail}
            />
          </div>
          
          <div>
            <Label htmlFor="phone" className="text-sm font-medium">Mobile Number</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 XXXXX XXXXX"
              className="mt-1"
              disabled={disabled || !!initialPhone}
            />
          </div>
        </div>

        {/* Channel Selection */}
        <div>
          <Label className="text-sm font-medium mb-3 block">Choose delivery method:</Label>
          <RadioGroup
            value={selectedChannel}
            onValueChange={(value) => setSelectedChannel(value as OTPChannel)}
            disabled={disabled}
          >
            {/* SMS Option */}
            <div className={cn(
              "flex items-center space-x-3 p-4 border rounded-lg cursor-pointer transition-colors",
              isChannelAvailable('sms') 
                ? "hover:bg-white/5 border-white/10" 
                : "opacity-50 cursor-not-allowed border-white/5 bg-white/5",
              selectedChannel === 'sms' && isChannelAvailable('sms') && "border-cyan-400/60 bg-cyan-500/10"
            )}>
              <RadioGroupItem 
                value="sms" 
                id="sms"
                disabled={!isChannelAvailable('sms')}
              />
              <Smartphone className="h-5 w-5 text-green-600" />
              <div className="flex-1">
                <Label htmlFor="sms" className="cursor-pointer">
                  <div className="font-medium">SMS to Mobile</div>
                  <div className="text-sm text-slate-400">
                    {isPhoneValid ? formatPhoneDisplay(phone) : 'Enter mobile number above'}
                  </div>
                </Label>
              </div>
            </div>

            {/* Email Option */}
            <div className={cn(
              "flex items-center space-x-3 p-4 border rounded-lg cursor-pointer transition-colors",
              isChannelAvailable('email') 
                ? "hover:bg-white/5 border-white/10" 
                : "opacity-50 cursor-not-allowed border-white/5 bg-white/5",
              selectedChannel === 'email' && isChannelAvailable('email') && "border-cyan-400/60 bg-cyan-500/10"
            )}>
              <RadioGroupItem 
                value="email" 
                id="email-radio"
                disabled={!isChannelAvailable('email')}
              />
              <Mail className="h-5 w-5 text-blue-600" />
              <div className="flex-1">
                <Label htmlFor="email-radio" className="cursor-pointer">
                  <div className="font-medium">Email</div>
                  <div className="text-sm text-slate-400">
                    {isEmailValid ? formatEmailDisplay(email) : 'Enter email address above'}
                  </div>
                </Label>
              </div>
            </div>

            {/* WhatsApp Option */}
            <div className={cn(
              "flex items-center space-x-3 p-4 border rounded-lg cursor-pointer transition-colors",
              isChannelAvailable('whatsapp') 
                ? "hover:bg-white/5 border-white/10" 
                : "opacity-50 cursor-not-allowed border-white/5 bg-white/5",
              selectedChannel === 'whatsapp' && isChannelAvailable('whatsapp') && "border-cyan-400/60 bg-cyan-500/10"
            )}>
              <RadioGroupItem 
                value="whatsapp" 
                id="whatsapp"
                disabled={!isChannelAvailable('whatsapp')}
              />
              <MessageCircle className="h-5 w-5 text-green-500" />
              <div className="flex-1">
                <Label htmlFor="whatsapp" className="cursor-pointer">
                  <div className="font-medium">WhatsApp</div>
                  <div className="text-sm text-slate-400">
                    {isPhoneValid ? formatPhoneDisplay(phone) : 'Enter mobile number above'}
                  </div>
                </Label>
              </div>
            </div>
          </RadioGroup>
        </div>

        {/* Delivery Status */}
        {deliveryStatus.channel && (
          <div className={cn(
            "p-4 rounded-lg border",
            deliveryStatus.success 
              ? "bg-emerald-500/10 border-emerald-500/20" 
              : "bg-red-500/10 border-red-500/20"
          )}>
            <div className="flex items-center space-x-2">
              {deliveryStatus.success ? (
                <CheckCircle className="h-5 w-5 text-emerald-300" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-300" />
              )}
              <div className="text-sm">
                {deliveryStatus.success ? (
                  <span className="text-emerald-200">
                    OTP sent successfully via {deliveryStatus.channel === 'sms' ? 'SMS' : deliveryStatus.channel === 'whatsapp' ? 'WhatsApp' : 'Email'}
                    {deliveryStatus.fallbackUsed && ' (using fallback method)'}
                  </span>
                ) : (
                  <span className="text-red-200">
                    Failed to send OTP: {deliveryStatus.error}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Send Button */}
        <Button 
          onClick={handleSendOTP}
          disabled={!selectedChannel || isLoading || !isChannelAvailable(selectedChannel)}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            `Send OTP via ${selectedChannel === 'sms' ? 'SMS' : selectedChannel === 'whatsapp' ? 'WhatsApp' : 'Email'}`
          )}
        </Button>
        
        {/* Fallback Information */}
        {(isChannelAvailable('sms') || isChannelAvailable('email') || isChannelAvailable('whatsapp')) && (
          <div className="text-xs text-gray-500 text-center">
            <p>
              {selectedChannel === 'sms' 
                ? 'If SMS delivery fails, we\'ll automatically try Email, then WhatsApp'
                : selectedChannel === 'whatsapp'
                ? 'If WhatsApp delivery fails, we\'ll automatically try SMS, then Email'
                : 'If Email delivery fails, we\'ll automatically try SMS, then WhatsApp'
              }
            </p>
          </div>
        )}
      </CardContent>
    </Card>
    </ErrorBoundary>
  );
}