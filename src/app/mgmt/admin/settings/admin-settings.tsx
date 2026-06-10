'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { Palette, Building, FileText, Globe, Settings, Trash, Plus, Upload } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '../../../../hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { createClient } from '@/lib/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { logger } from '@/lib/logger';

const settingsSchema = z.object({
  // Site Identity
  siteName: z.string().min(1, "Site name is required"),
  tagline: z.string().optional(),
  logoUrl: z.string().optional(),
  faviconUrl: z.string().optional(),
  partnerBrands: z.string().optional(),
  
  // Color Scheme
  primaryColor: z.string().regex(/^#[0-9A-F]{6}$/i, "Must be a valid hex color"),
  secondaryColor: z.string().regex(/^#[0-9A-F]{6}$/i, "Must be a valid hex color"),
  accentColor: z.string().regex(/^#[0-9A-F]{6}$/i, "Must be a valid hex color"),
  
  // Homepage Settings
  heroTitle: z.string().min(1, "Hero title is required"),
  heroSubtitle: z.string().optional(),
  heroButtonText: z.string().min(1, "Hero button text is required"),
  heroButtonLink: z.string().min(1, "Hero button link is required"),
  featuredProductId: z.string().optional(),
  
  // Banner Settings
  topBannerEnabled: z.boolean().default(false),
  topBannerText: z.string().optional(),
  topBannerLink: z.string().optional(),
  topBannerImage: z.string().optional(),
  sideBannerEnabled: z.boolean().default(false),
  sideBannerImage: z.string().optional(),
  sideBannerLink: z.string().optional(),
  
  // Business Details
  companyName: z.string().min(1, "Company name is required"),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  pincode: z.string().min(1, "Pincode is required"),
  country: z.string().min(1, "Country is required"),
  
  // Contact Information
  phone: z.string().min(1, "Phone is required"),
  email: z.string().email("Invalid email address"),
  website: z.string().url("Invalid website URL"),
  
  // Business Registration
  gstin: z.string().optional(),
  pan: z.string().optional(),
  cin: z.string().optional(),
  businessType: z.string().min(1, "Business type is required"),
  
  // Additional Settings
  currency: z.string().min(1, "Currency is required"),
  timezone: z.string().min(1, "Timezone is required"),
  enableGST: z.boolean().default(false),
  
  // Category-based GST Rates
  categoryGstRates: z.record(z.string(), z.coerce.number().min(0).max(100).optional()).optional(),
});

type SettingsFormInput = z.input<typeof settingsSchema>;
type SettingsFormValues = z.output<typeof settingsSchema>;

const DEFAULT_CATEGORY_GST_RATES: Record<string, number> = {
  Electronics: 18,
  Accessories: 18,
  Books: 5,
  Clothing: 12,
  Food: 5,
  Health: 12,
  Home: 18,
  Sports: 18,
};



const createDefaultSettings = (): SettingsFormValues => ({
  siteName: 'TecBunny',
  tagline: 'Your Tech Store',
  logoUrl: '',
  faviconUrl: '',
  partnerBrands: 'CP PLUS, HIKVISION, DAHUA, UBIQUITI, CISCO, TP-LINK',
  primaryColor: '#3b82f6',
  secondaryColor: '#64748b',
  accentColor: '#f59e0b',
  heroTitle: 'Future at Your Fingertips',
  heroSubtitle: 'Discover the latest in cutting-edge technology. From smart devices to essential gear, find everything you need to stay ahead.',
  heroButtonText: 'Shop All Products',
  heroButtonLink: '/products',
  featuredProductId: 'none',
  topBannerEnabled: false,
  topBannerText: '',
  topBannerLink: '',
  topBannerImage: '',
  sideBannerEnabled: false,
  sideBannerImage: '',
  sideBannerLink: '',
  companyName: 'TecBunny Solutions',
  address: '123 Tech Lane',
  city: 'Bangalore',
  state: 'Karnataka',
  pincode: '560100',
  country: 'India',
  phone: '(+91) 987 654 3210',
  email: 'support@tecbunny.com',
  website: 'https://tecbunny.com',
  gstin: '',
  pan: '',
  cin: '',
  businessType: 'Private Limited',
  currency: 'INR',
  timezone: 'Asia/Kolkata',
  enableGST: false,
  categoryGstRates: { ...DEFAULT_CATEGORY_GST_RATES },
});

async function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export default function SiteSettingsPage() {
  return (
    <React.Suspense fallback={
      <div className="container mx-auto p-6 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
      </div>
    }>
      <SiteSettingsPageContent />
    </React.Suspense>
  );
}

function SiteSettingsPageContent() {
  const { toast } = useToast();
  const supabase = React.useMemo(() => createClient(), []);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [logoPreview, setLogoPreview] = React.useState('');
  const [faviconPreview, setFaviconPreview] = React.useState('');
  const [products, setProducts] = React.useState<any[]>([]);

  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = React.useState('identity');

  React.useEffect(() => {
    if (tabParam && ['identity', 'homepage', 'appearance', 'business', 'advanced'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const form = useForm<SettingsFormInput, any, SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: createDefaultSettings(),
  });

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      logger.info('Loading settings and products...');

      const settingsController = new AbortController();
      const settingsTimeoutId = window.setTimeout(() => settingsController.abort(), 12000);
      const settingsResponse = await fetch('/api/settings', {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
        },
        signal: settingsController.signal,
      });
      window.clearTimeout(settingsTimeoutId);

      const settingsPayload = await settingsResponse.json().catch(() => null);

      if (!settingsResponse.ok || !Array.isArray(settingsPayload)) {
        const message = settingsPayload && typeof settingsPayload?.error === 'string'
          ? settingsPayload.error
          : `Failed to load settings (status ${settingsResponse.status})`;
        throw new Error(message);
      }

      const settingsArray = settingsPayload as Array<{ key: string; value: unknown }>;
      const settingsMap = new Map(settingsArray.map(setting => [setting.key, setting.value]));
      const defaults = createDefaultSettings();

      const getString = (key: string, fallback: string) => {
        const raw = settingsMap.get(key);
        if (raw === undefined || raw === null) return fallback;
        if (typeof raw === 'string') return raw;
        if (typeof raw === 'number') return raw.toString();
        if (typeof raw === 'boolean') return raw ? 'true' : 'false';
        return fallback;
      };

      const getBoolean = (key: string, fallback: boolean) => {
        const raw = settingsMap.get(key);
        if (typeof raw === 'boolean') return raw;
        if (typeof raw === 'string') {
          const normalized = raw.trim().toLowerCase();
          if (normalized === 'true') return true;
          if (normalized === 'false') return false;
        }
        return fallback;
      };

      const resolveCategoryRates = () => {
        const raw = settingsMap.get('categoryGstRates');
        if (!raw) return { ...defaults.categoryGstRates };
        if (typeof raw === 'object') {
          return { ...(raw as Record<string, number>) };
        }
        if (typeof raw === 'string' && raw.trim().length > 0) {
          try {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
              return { ...(parsed as Record<string, number>) };
            }
          } catch (error) {
            logger.warn('Failed to parse categoryGstRates value', { error });
          }
        }
        return { ...defaults.categoryGstRates };
      };

      const formData: SettingsFormValues = {
        ...defaults,
        siteName: getString('siteName', defaults.siteName),
        tagline: getString('tagline', defaults.tagline ?? ''),
        logoUrl: getString('logoUrl', defaults.logoUrl ?? ''),
        faviconUrl: getString('faviconUrl', defaults.faviconUrl ?? ''),
        partnerBrands: getString('partnerBrands', defaults.partnerBrands ?? ''),
        primaryColor: getString('primaryColor', defaults.primaryColor),
        secondaryColor: getString('secondaryColor', defaults.secondaryColor),
        accentColor: getString('accentColor', defaults.accentColor),
        heroTitle: getString('heroTitle', defaults.heroTitle),
        heroSubtitle: getString('heroSubtitle', defaults.heroSubtitle ?? ''),
        heroButtonText: getString('heroButtonText', defaults.heroButtonText),
        heroButtonLink: getString('heroButtonLink', defaults.heroButtonLink),
        featuredProductId: (() => {
          const value = getString('featuredProductId', '');
          return value && value.trim().length > 0 ? value : 'none';
        })(),
        topBannerEnabled: getBoolean('topBannerEnabled', defaults.topBannerEnabled ?? false),
        topBannerText: getString('topBannerText', defaults.topBannerText ?? ''),
        topBannerLink: getString('topBannerLink', defaults.topBannerLink ?? ''),
        topBannerImage: getString('topBannerImage', defaults.topBannerImage ?? ''),
        sideBannerEnabled: getBoolean('sideBannerEnabled', defaults.sideBannerEnabled ?? false),
        sideBannerImage: getString('sideBannerImage', defaults.sideBannerImage ?? ''),
        sideBannerLink: getString('sideBannerLink', defaults.sideBannerLink ?? ''),
        companyName: getString('companyName', defaults.companyName),
        address: getString('address', defaults.address),
        city: getString('city', defaults.city),
        state: getString('state', defaults.state),
        pincode: getString('pincode', defaults.pincode),
        country: getString('country', defaults.country),
        phone: getString('phone', defaults.phone),
        email: getString('email', defaults.email),
        website: getString('website', defaults.website),
        gstin: getString('gstin', defaults.gstin ?? ''),
        pan: getString('pan', defaults.pan ?? ''),
        cin: getString('cin', defaults.cin ?? ''),
        businessType: getString('businessType', defaults.businessType),
        currency: getString('currency', defaults.currency),
        timezone: getString('timezone', defaults.timezone),
        enableGST: getBoolean('enableGST', defaults.enableGST ?? false),
        categoryGstRates: resolveCategoryRates(),
      };

      form.reset(formData);
      setLogoPreview(formData.logoUrl || '');
      setFaviconPreview(formData.faviconUrl || '');

      const { data: productsData, error: productsError } = await withTimeout(
        supabase
          .from('products')
          .select('id, name, price, image'),
        12000,
        'Loading products timed out.'
      );

      if (productsError) {
        logger.error('Products error:', { error: productsError });
      } else {
        setProducts(productsData || []);
      }
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'Failed to load settings. Please try again.';
      logger.error('Error loading data:', { error: message });
      setLoadError(message);
      toast({
        variant: 'destructive',
        title: 'Error loading settings',
        description: message,
      });
    } finally {
      setLoading(false);
    }
  }, [form, supabase, toast]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const onSubmit = async (data: SettingsFormValues) => {
    try {
      logger.info('Submitting settings:', { data });
      
      const { categoryGstRates, ...otherData } = data;
      
      // Convert "none" back to empty string for featuredProductId
      const processedData = { ...otherData };
      if (processedData.featuredProductId === 'none') {
        processedData.featuredProductId = '';
      }
      
      const settingsToUpsert = Object.entries(processedData).map(([key, value]) => ({
        key,
        value: typeof value === 'boolean' ? value.toString() : (value || '').toString(),
      }));
      
      // Add categoryGstRates as a JSON string
      if (categoryGstRates) {
        settingsToUpsert.push({
          key: 'categoryGstRates',
          value: JSON.stringify(categoryGstRates),
        });
      }
      
      const { error } = await supabase
        .from('settings')
        .upsert(settingsToUpsert, {
          onConflict: 'key',
        });
      
      if (error) {
        logger.error('Upsert error:', { error });
        toast({
          variant: 'destructive',
          title: 'Failed to save settings',
          description: `Could not save settings: ${error.message}`,
        });
      } else {
        toast({
          title: 'Settings saved successfully',
          description: 'Your site settings have been updated.',
        });
      }
      
    } catch (error) {
      logger.error('Exception during settings save:', { error });
      toast({
        variant: 'destructive',
        title: 'Failed to save settings',
        description: 'An unexpected error occurred while saving settings.',
      });
    }
  };

  const handleFileUpload = async (file: File, type: 'logo' | 'favicon') => {
    try {
      logger.info('Starting file upload:', { fileName: file.name, fileType: file.type, fileSize: file.size, uploadType: type });
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        throw new Error('Please select a valid image file');
      }

      // Validate file size (max 4MB)
      if (file.size > 4 * 1024 * 1024) {
        throw new Error('File size must be less than 4MB');
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);
      
      logger.info('Sending upload request to /api/upload');
      
      // Use the server-side API route for upload
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      
      logger.info('Upload response status:', { status: response.status, statusText: response.statusText });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
        logger.error('Upload response error:', { error: errorData });
        const errMsg = typeof errorData.error === 'object' && errorData.error?.message
          ? errorData.error.message
          : (typeof errorData.error === 'string' ? errorData.error : `Upload failed: ${response.statusText}`);
        throw new Error(errMsg);
      }
      
      const data = await response.json();
      logger.info('Upload response data:', { data });
      
      if (!data.secure_url && !data.url) {
        logger.error('No URL in response:', { data });
        throw new Error('Invalid response from upload service');
      }
      
      const imageUrl = data.secure_url || data.url;
      logger.info('Using image URL:', { imageUrl });
      
      if (type === 'logo') {
        logger.info('Setting logo preview and form value');
        setLogoPreview(imageUrl);
        form.setValue('logoUrl', imageUrl);
      } else {
        logger.info('Setting favicon preview and form value');
        setFaviconPreview(imageUrl);
        form.setValue('faviconUrl', imageUrl);
      }
      
      toast({
        title: `${type.charAt(0).toUpperCase() + type.slice(1)} uploaded successfully`,
        description: `Your ${type} has been uploaded to cloud storage. Save settings to apply changes.`,
      });
      
    } catch (error) {
      logger.error('Error in handleFileUpload:', { error });
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast({
        variant: 'destructive',
        title: 'Upload failed',
        description: `Failed to upload ${type}. ${errorMessage}`,
      });
    }
  };

  const uploadBrandFile = async (file: File): Promise<string> => {
    try {
      if (!file.type.startsWith('image/')) {
        throw new Error('Please select a valid image file');
      }
      if (file.size > 4 * 1024 * 1024) {
        throw new Error('File size must be less than 4MB');
      }
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'brand');
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
        const errMsg = typeof errorData.error === 'object' && errorData.error?.message
          ? errorData.error.message
          : (typeof errorData.error === 'string' ? errorData.error : `Upload failed: ${response.statusText}`);
        throw new Error(errMsg);
      }
      
      const data = await response.json();
      const imageUrl = data.secure_url || data.url;
      if (!imageUrl) {
        throw new Error('Invalid response from upload service');
      }
      return imageUrl;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({
        variant: 'destructive',
        title: 'Upload failed',
        description: `Failed to upload brand image: ${errorMessage}`,
      });
      throw error;
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-lg font-medium">Loading settings...</p>
            <p className="text-sm text-muted-foreground mb-4">Please wait while we fetch your settings</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Site Settings</h1>
        <p className="text-muted-foreground">
          Manage your site configuration, branding, and business details.
        </p>
      </div>

      {loadError && (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>We couldn&apos;t refresh the latest settings</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <span>{loadError}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={() => loadData()}
              disabled={loading}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="identity" className="flex items-center gap-2">
            <Building className="h-4 w-4" />
            Identity
          </TabsTrigger>
          <TabsTrigger value="homepage" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Homepage
          </TabsTrigger>
          <TabsTrigger value="appearance" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Appearance
          </TabsTrigger>
          <TabsTrigger value="business" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Business
          </TabsTrigger>
          <TabsTrigger value="advanced" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Advanced
          </TabsTrigger>
        </TabsList>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            
            {/* Site Identity Tab */}
            <TabsContent value="identity" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Site Identity</CardTitle>
                  <CardDescription>
                    Configure your site name, tagline, and branding assets.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="siteName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Site Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Your Site Name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="tagline"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tagline</FormLabel>
                          <FormControl>
                            <Input placeholder="Your Site Tagline" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="logo">Logo</Label>
                      <div className="flex items-center gap-4">
                        <Input
                          id="logo"
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              handleFileUpload(file, 'logo');
                            }
                          }}
                        />
                        {logoPreview && (
                          <div className="w-16 h-16 rounded border">
                            <img 
                              src={logoPreview} 
                              alt="Logo preview" 
                              className="w-full h-full object-contain"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="favicon">Favicon</Label>
                      <div className="flex items-center gap-4">
                        <Input
                          id="favicon"
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              handleFileUpload(file, 'favicon');
                            }
                          }}
                        />
                        {faviconPreview && (
                          <div className="w-8 h-8 rounded border">
                            <img 
                              src={faviconPreview} 
                              alt="Favicon preview" 
                              className="w-full h-full object-contain"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>


            </TabsContent>

            {/* Homepage Tab */}
            <TabsContent value="homepage" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Homepage Settings</CardTitle>
                  <CardDescription>
                    Configure your homepage hero section and featured content.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 gap-6">
                    <FormField
                      control={form.control}
                      name="heroTitle"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Hero Title</FormLabel>
                          <FormControl>
                            <Input placeholder="Your main headline" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="heroSubtitle"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Hero Subtitle</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Your hero description" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="heroButtonText"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Button Text</FormLabel>
                            <FormControl>
                              <Input placeholder="Button text" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="heroButtonLink"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Button Link</FormLabel>
                            <FormControl>
                              <Input placeholder="/products" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="featuredProductId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Featured Product</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a product to feature" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">No featured product</SelectItem>
                              {products.map((product) => (
                                <SelectItem key={product.id} value={product.id}>
                                  {product.name} - ₹{product.price}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Banner Settings</CardTitle>
                  <CardDescription>
                    Configure promotional banners for your homepage.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="topBannerEnabled"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Top Banner</FormLabel>
                            <FormDescription>
                              Show a banner at the top of your homepage
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    {form.watch('topBannerEnabled') && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="topBannerText"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Banner Text</FormLabel>
                              <FormControl>
                                <Input placeholder="Banner text" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="topBannerLink"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Banner Link</FormLabel>
                              <FormControl>
                                <Input placeholder="/offers" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Appearance Tab */}
            <TabsContent value="appearance" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Color Scheme</CardTitle>
                  <CardDescription>
                    Customize your site's color palette.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <FormField
                      control={form.control}
                      name="primaryColor"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Primary Color</FormLabel>
                          <FormControl>
                            <Input type="color" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="secondaryColor"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Secondary Color</FormLabel>
                          <FormControl>
                            <Input type="color" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="accentColor"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Accent Color</FormLabel>
                          <FormControl>
                            <Input type="color" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Business Tab */}
            <TabsContent value="business" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Business Details</CardTitle>
                  <CardDescription>
                    Configure your business information and contact details.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="companyName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Your Company Name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="businessType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Business Type</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select business type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Sole Proprietorship">Sole Proprietorship</SelectItem>
                              <SelectItem value="Partnership">Partnership</SelectItem>
                              <SelectItem value="Private Limited">Private Limited</SelectItem>
                              <SelectItem value="Public Limited">Public Limited</SelectItem>
                              <SelectItem value="LLP">LLP</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl>
                            <Input placeholder="Phone number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="Email address" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="website"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Website</FormLabel>
                          <FormControl>
                            <Input placeholder="Website URL" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Advanced Tab */}
            <TabsContent value="advanced" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Advanced Settings</CardTitle>
                  <CardDescription>
                    Configure advanced site settings and integrations.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="currency"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Currency</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select currency" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="INR">Indian Rupee (₹)</SelectItem>
                              <SelectItem value="USD">US Dollar ($)</SelectItem>
                              <SelectItem value="EUR">Euro (€)</SelectItem>
                              <SelectItem value="GBP">British Pound (£)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="timezone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Timezone</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select timezone" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Asia/Kolkata">Asia/Kolkata</SelectItem>
                              <SelectItem value="America/New_York">America/New_York</SelectItem>
                              <SelectItem value="Europe/London">Europe/London</SelectItem>
                              <SelectItem value="Asia/Tokyo">Asia/Tokyo</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="enableGST"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Enable GST</FormLabel>
                          <FormDescription>
                            Enable GST calculation for products
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <div className="flex justify-end">
              <Button type="submit" size="lg">
                Save Settings
              </Button>
            </div>
          </form>
        </Form>
      </Tabs>
    </div>
  );
}
