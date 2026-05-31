'use client';

import { useState, useEffect } from 'react';

import { 
  Shield, 
  Key, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Activity
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface SecuritySetting {
  value: string;
  description: string;
}

interface SecuritySettings {
  [key: string]: SecuritySetting;
}

interface AuditLog {
  id: string;
  event_type: string;
  user_id: string;
  severity: string;
  event_data: any;
  created_at: string;
  profiles?: {
    name: string;
    email: string;
    role: string;
  };
}

import { logger } from '@/lib/logger';

export default function SecurityDashboard() {
  const [settings, setSettings] = useState<SecuritySettings>({});
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState('');

  // Password validation state
  const [testPassword, setTestPassword] = useState('');
  const [passwordValidation, setPasswordValidation] = useState<any>(null);

  useEffect(() => {
    fetchSecuritySettings();
    fetchAuditLogs();
  }, []);

  const fetchSecuritySettings = async () => {
    try {
      const response = await fetch('/api/security/settings');
      const data = await response.json();
      
      if (data.success) {
        setSettings(data.settings);
        if (data.fallback) {
          setMessage('Security settings storage is not configured. Displaying default values.');
        } else {
          setMessage('');
        }
      } else {
        setMessage('Failed to fetch security settings');
      }
    } catch {
      setMessage('Error fetching security settings');
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const response = await fetch('/api/security/audit-logs?limit=20');
      const data = await response.json();
      
      if (data.success) {
        setAuditLogs(data.auditLogs);
      }
    } catch (error) {
      logger.error('Error fetching audit logs in security-dashboard', { error });
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key: string, value: string) => {
    setUpdating(true);
    try {
      const response = await fetch('/api/security/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          setting_key: key,
          setting_value: value,
          description: settings[key]?.description
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setMessage('Setting updated successfully');
        fetchSecuritySettings();
      } else if (data.fallback) {
        setMessage('Security settings database is not configured. Please run the latest migrations.');
      } else {
        setMessage(data.error || 'Failed to update setting');
      }
    } catch (error) {
      logger.error('Error updating security setting in dashboard', { error });
      setMessage('Error updating setting');
    } finally {
      setUpdating(false);
    }
  };

  const testPasswordStrength = async () => {
    if (!testPassword) return;

    try {
      const response = await fetch('/api/security/validate-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password: testPassword }),
      });

      const data = await response.json();
      
      if (data.success) {
        setPasswordValidation(data.validation);
      }
    } catch (error) {
      logger.error('Error validating password in security-dashboard', { error });
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getValidationIcon = (isValid: boolean) => {
    return isValid ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : (
      <XCircle className="h-4 w-4 text-red-500" />
    );
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center space-x-2">
        <Shield className="h-8 w-8 text-blue-600" />
        <h1 className="text-3xl font-bold">Security Dashboard</h1>
      </div>

      {message && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="password">Password Validation</TabsTrigger>
          <TabsTrigger value="audit">Audit Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Security Status</CardTitle>
                <Shield className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">Protected</div>
                <p className="text-xs text-muted-foreground">
                  All security features configured
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">MFA Options</CardTitle>
                <Key className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">3</div>
                <p className="text-xs text-muted-foreground">
                  TOTP, Phone, WebAuthn enabled
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Audit Events</CardTitle>
                <Activity className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{auditLogs.length}</div>
                <p className="text-xs text-muted-foreground">
                  Recent security events
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Security Configuration Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Leaked Password Protection</span>
                  <Badge className="bg-green-100 text-green-800">
                    {settings.password_hibp_check?.value === 'true' ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Multi-Factor Authentication</span>
                  <Badge className="bg-green-100 text-green-800">
                    {settings.mfa_totp_enabled?.value === 'true' ? 'Multiple Options' : 'Limited'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Strong Password Requirements</span>
                  <Badge className="bg-green-100 text-green-800">
                    {settings.password_min_length?.value ? 'Enforced' : 'Basic'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Session Security</span>
                  <Badge className="bg-green-100 text-green-800">
                    {settings.session_timeout_minutes?.value ? `${settings.session_timeout_minutes.value} min` : 'Default'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Password Security</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password_min_length">Minimum Length</Label>
                  <Input
                    id="password_min_length"
                    type="number"
                    value={settings.password_min_length?.value || '8'}
                    onChange={(e) => updateSetting('password_min_length', e.target.value)}
                    className="w-20"
                    disabled={updating}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="password_hibp_check">HaveIBeenPwned Check</Label>
                  <Switch
                    id="password_hibp_check"
                    checked={settings.password_hibp_check?.value === 'true'}
                    onCheckedChange={(checked) => updateSetting('password_hibp_check', checked.toString())}
                    disabled={updating}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="password_require_uppercase">Require Uppercase</Label>
                  <Switch
                    id="password_require_uppercase"
                    checked={settings.password_require_uppercase?.value === 'true'}
                    onCheckedChange={(checked) => updateSetting('password_require_uppercase', checked.toString())}
                    disabled={updating}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="password_require_symbols">Require Symbols</Label>
                  <Switch
                    id="password_require_symbols"
                    checked={settings.password_require_symbols?.value === 'true'}
                    onCheckedChange={(checked) => updateSetting('password_require_symbols', checked.toString())}
                    disabled={updating}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Multi-Factor Authentication</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="mfa_totp_enabled">TOTP Enabled</Label>
                  <Switch
                    id="mfa_totp_enabled"
                    checked={settings.mfa_totp_enabled?.value === 'true'}
                    onCheckedChange={(checked) => updateSetting('mfa_totp_enabled', checked.toString())}
                    disabled={updating}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="mfa_phone_enabled">Phone MFA Enabled</Label>
                  <Switch
                    id="mfa_phone_enabled"
                    checked={settings.mfa_phone_enabled?.value === 'true'}
                    onCheckedChange={(checked) => updateSetting('mfa_phone_enabled', checked.toString())}
                    disabled={updating}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="mfa_webauthn_enabled">WebAuthn Enabled</Label>
                  <Switch
                    id="mfa_webauthn_enabled"
                    checked={settings.mfa_webauthn_enabled?.value === 'true'}
                    onCheckedChange={(checked) => updateSetting('mfa_webauthn_enabled', checked.toString())}
                    disabled={updating}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="mfa_required_for_admins">Required for Admins</Label>
                  <Switch
                    id="mfa_required_for_admins"
                    checked={settings.mfa_required_for_admins?.value === 'true'}
                    onCheckedChange={(checked) => updateSetting('mfa_required_for_admins', checked.toString())}
                    disabled={updating}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Session & Rate Limiting</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="session_timeout_minutes">Session Timeout (minutes)</Label>
                  <Input
                    id="session_timeout_minutes"
                    type="number"
                    value={settings.session_timeout_minutes?.value || '480'}
                    onChange={(e) => updateSetting('session_timeout_minutes', e.target.value)}
                    className="w-20"
                    disabled={updating}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="max_login_attempts">Max Login Attempts</Label>
                  <Input
                    id="max_login_attempts"
                    type="number"
                    value={settings.max_login_attempts?.value || '5'}
                    onChange={(e) => updateSetting('max_login_attempts', e.target.value)}
                    className="w-20"
                    disabled={updating}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="account_lockout_minutes">Lockout Duration (minutes)</Label>
                  <Input
                    id="account_lockout_minutes"
                    type="number"
                    value={settings.account_lockout_minutes?.value || '15'}
                    onChange={(e) => updateSetting('account_lockout_minutes', e.target.value)}
                    className="w-20"
                    disabled={updating}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="password">
          <Card>
            <CardHeader>
              <CardTitle>Password Strength Validator</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex space-x-2">
                <Input
                  type="password"
                  placeholder="Enter password to test..."
                  value={testPassword}
                  onChange={(e) => setTestPassword(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={testPasswordStrength}>Test</Button>
              </div>

              {passwordValidation && (
                <div className="space-y-2 p-4 border rounded">
                  <h4 className="font-semibold">Validation Results:</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center space-x-2">
                      {getValidationIcon(passwordValidation.length_valid)}
                      <span>Length requirement</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getValidationIcon(passwordValidation.has_uppercase)}
                      <span>Uppercase letter</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getValidationIcon(passwordValidation.has_lowercase)}
                      <span>Lowercase letter</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getValidationIcon(passwordValidation.has_numbers)}
                      <span>Number</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getValidationIcon(passwordValidation.has_symbols)}
                      <span>Special character</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getValidationIcon(passwordValidation.is_valid)}
                      <span className="font-semibold">Overall valid</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle>Security Audit Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {auditLogs.map((log) => (
                  <div key={log.id} className="border rounded p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Badge className={getSeverityColor(log.severity)}>
                          {log.severity}
                        </Badge>
                        <span className="font-medium">{log.event_type}</span>
                      </div>
                      <span className="text-sm text-gray-500">
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </div>
                    {log.profiles && (
                      <div className="text-sm text-gray-600 mt-2">
                        User: {log.profiles.name} ({log.profiles.email})
                      </div>
                    )}
                    {log.event_data && (
                      <div className="text-xs text-gray-500 mt-2">
                        <pre>{JSON.stringify(log.event_data, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}