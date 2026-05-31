'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { 
  Facebook, 
  Twitter, 
  Instagram, 
  Linkedin, 
  Youtube, 
  Globe, 
  Plus, 
  X, 
  ExternalLink,
  Save,
  RotateCcw,
  Eye,
  EyeOff
} from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '../../hooks/use-toast';
import { createClient } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Define available social media platforms with their icons and colors
const SOCIAL_PLATFORMS = {
  facebook: {
    name: 'Facebook',
    icon: Facebook,
    color: '#1877F2',
    placeholder: 'https://facebook.com/yourpage',
    example: 'https://facebook.com/tecbunny'
  },
  twitter: {
    name: 'X (Twitter)',
    icon: Twitter,
    color: '#1DA1F2',
    placeholder: 'https://x.com/yourusername',
    example: 'https://x.com/tecbunny'
  },
  instagram: {
    name: 'Instagram',
    icon: Instagram,
    color: '#E4405F',
    placeholder: 'https://instagram.com/yourusername',
    example: 'https://instagram.com/tecbunny'
  },
  linkedin: {
    name: 'LinkedIn',
    icon: Linkedin,
    color: '#0077B5',
    placeholder: 'https://linkedin.com/company/yourcompany',
    example: 'https://linkedin.com/company/tecbunny'
  },
  youtube: {
    name: 'YouTube',
    icon: Youtube,
    color: '#FF0000',
    placeholder: 'https://youtube.com/c/yourchannel',
    example: 'https://youtube.com/c/tecbunny'
  },
  website: {
    name: 'Website',
    icon: Globe,
    color: '#6B7280',
    placeholder: 'https://yourwebsite.com',
    example: 'https://tecbunny.com'
  }
} as const;

type PlatformKey = keyof typeof SOCIAL_PLATFORMS;

// Schema for social media validation
const socialMediaSchema = z.object({
  facebookUrl: z.string().url('Invalid Facebook URL').optional().or(z.literal('')),
  twitterUrl: z.string().url('Invalid X/Twitter URL').optional().or(z.literal('')),
  instagramUrl: z.string().url('Invalid Instagram URL').optional().or(z.literal('')),
  linkedinUrl: z.string().url('Invalid LinkedIn URL').optional().or(z.literal('')),
  youtubeUrl: z.string().url('Invalid YouTube URL').optional().or(z.literal('')),
  websiteUrl: z.string().url('Invalid Website URL').optional().or(z.literal('')),
});

type SocialMediaFormValues = z.infer<typeof socialMediaSchema>;

interface SocialMediaLink {
  id: string;
  platform: PlatformKey;
  url: string;
  isActive: boolean;
  displayName?: string;
}

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

export default function SocialMediaManager() {
  const { toast } = useToast();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [socialLinks, setSocialLinks] = useState<SocialMediaLink[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const form = useForm<SocialMediaFormValues>({
    resolver: zodResolver(socialMediaSchema),
    defaultValues: {
      facebookUrl: '',
      twitterUrl: '',
      instagramUrl: '',
      linkedinUrl: '',
      youtubeUrl: '',
      websiteUrl: '',
    },
  });

  const loadSocialMediaSettings = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      
      const { data: settings, error } = await withTimeout(
        supabase
          .from('settings')
          .select('key, value')
          .in('key', [
            'facebookUrl', 
            'twitterUrl', 
            'instagramUrl', 
            'linkedinUrl', 
            'youtubeUrl', 
            'websiteUrl'
          ]),
        12000,
        'Loading social media settings timed out.'
      );

      if (error) {
        logger.error('Error loading settings in SocialMediaManager', { error });
        setLoadError('Failed to load social media settings.');
        toast({
          title: 'Error',
          description: 'Failed to load social media settings',
          variant: 'destructive',
        });
        return;
      }

      // Convert settings array to form values
      const formValues: Partial<SocialMediaFormValues> = {};
      const links: SocialMediaLink[] = [];

      settings?.forEach((setting) => {
        const key = setting.key as keyof SocialMediaFormValues;
        formValues[key] = setting.value || '';

        // Create social link objects
        if (setting.value) {
          const platformKey = setting.key.replace('Url', '') as PlatformKey;
          if (SOCIAL_PLATFORMS[platformKey]) {
            links.push({
              id: setting.key,
              platform: platformKey,
              url: setting.value,
              isActive: true,
            });
          }
        }
      });

      form.reset(formValues);
      setSocialLinks(links);
    } catch (error) {
      logger.error('Error loading social media settings in SocialMediaManager', { error });
      setLoadError(error instanceof Error ? error.message : 'Failed to load social media settings.');
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load social media settings',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [supabase, toast, form]);

  // Load existing social media settings
  useEffect(() => {
    loadSocialMediaSettings();
  }, [loadSocialMediaSettings]);

  const saveSocialMediaSettings = async (values: SocialMediaFormValues) => {
    try {
      setSaving(true);

      // Prepare settings for upsert
      const settingsToUpdate = Object.entries(values).map(([key, value]) => ({
        key,
        value: value || '',
      }));

      const { error } = await supabase
        .from('settings')
        .upsert(settingsToUpdate, { onConflict: 'key' });

      if (error) {
        logger.error('Error saving settings in SocialMediaManager', { error, settingsToUpdate });
        toast({
          title: 'Error',
          description: 'Failed to save social media settings',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Success',
        description: 'Social media settings saved successfully',
      });

      // Reload the settings to update the links display
      await loadSocialMediaSettings();
    } catch (error) {
      logger.error('Error saving social media settings in SocialMediaManager', { error });
      toast({
        title: 'Error',
        description: 'Failed to save social media settings',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const addSocialLink = (platform: PlatformKey, url: string) => {
    const formKey = `${platform}Url` as keyof SocialMediaFormValues;
    form.setValue(formKey, url);
    
    const newLink: SocialMediaLink = {
      id: `${platform}Url`,
      platform,
      url,
      isActive: true,
    };

    setSocialLinks(prev => {
      const filtered = prev.filter(link => link.platform !== platform);
      return [...filtered, newLink];
    });
  };

  const removeSocialLink = (platform: PlatformKey) => {
    const formKey = `${platform}Url` as keyof SocialMediaFormValues;
    form.setValue(formKey, '');
    setSocialLinks(prev => prev.filter(link => link.platform !== platform));
  };

  const testSocialLink = (url: string) => {
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const resetForm = () => {
    form.reset();
    setSocialLinks([]);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Social Media Management</CardTitle>
          <CardDescription>Loading social media settings...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Social Media Management
              </CardTitle>
              <CardDescription>
                Manage your business social media links and online presence
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPreview(!showPreview)}
              >
                {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {showPreview ? 'Hide Preview' : 'Show Preview'}
              </Button>
              <AddSocialLinkDialog 
                onAdd={addSocialLink}
                existingPlatforms={socialLinks.map(link => link.platform)}
                isOpen={isAddDialogOpen}
                setIsOpen={setIsAddDialogOpen}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadError && (
            <div className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
              {loadError}
            </div>
          )}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(saveSocialMediaSettings)} className="space-y-6">
              {/* Current Social Links */}
              {socialLinks.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Current Social Media Links</h3>
                  <div className="grid gap-4">
                    {socialLinks.map((link) => {
                      const platform = SOCIAL_PLATFORMS[link.platform];
                      const IconComponent = platform.icon;
                      const formKey = `${link.platform}Url` as keyof SocialMediaFormValues;
                      
                      return (
                        <div key={link.id} className="flex items-center gap-4 p-4 border rounded-lg">
                          <div 
                            className="p-2 rounded-md flex items-center justify-center"
                            style={{ backgroundColor: `${platform.color}20`, color: platform.color }}
                          >
                            <IconComponent className="h-5 w-5" />
                          </div>
                          
                          <div className="flex-1">
                            <FormField
                              control={form.control}
                              name={formKey}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{platform.name} URL</FormLabel>
                                  <FormControl>
                                    <Input
                                      placeholder={platform.placeholder}
                                      {...field}
                                      className="w-full"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => testSocialLink(form.getValues(formKey) || '')}
                              disabled={!form.getValues(formKey)}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => removeSocialLink(link.platform)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* No links message */}
              {socialLinks.length === 0 && (
                <div className="text-center py-8 border border-dashed rounded-lg">
                  <Globe className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Social Media Links</h3>
                  <p className="text-muted-foreground mb-4">
                    Add your social media links to help customers connect with your business
                  </p>
                  <Button
                    type="button"
                    onClick={() => setIsAddDialogOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Social Media Link
                  </Button>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-6 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetForm}
                  disabled={saving}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset
                </Button>
                
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={loadSocialMediaSettings}
                    disabled={saving}
                  >
                    Reload
                  </Button>
                  <Button type="submit" disabled={saving}>
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Preview Section */}
      {showPreview && (
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>
              How your social media links will appear on your website
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SocialMediaPreview socialLinks={socialLinks} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Add Social Link Dialog Component
function AddSocialLinkDialog({ 
  onAdd, 
  existingPlatforms, 
  isOpen, 
  setIsOpen 
}: {
  onAdd: (platform: PlatformKey, url: string) => void;
  existingPlatforms: PlatformKey[];
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}) {
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformKey | null>(null);
  const [url, setUrl] = useState('');

  const availablePlatforms = Object.keys(SOCIAL_PLATFORMS).filter(
    platform => !existingPlatforms.includes(platform as PlatformKey)
  ) as PlatformKey[];

  const handleAdd = () => {
    if (selectedPlatform && url) {
      onAdd(selectedPlatform, url);
      setSelectedPlatform(null);
      setUrl('');
      setIsOpen(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Social Link
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Social Media Link</DialogTitle>
          <DialogDescription>
            Choose a platform and enter the URL for your social media profile
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label>Platform</Label>
            <Select value={selectedPlatform || ''} onValueChange={(value) => setSelectedPlatform(value as PlatformKey)}>
              <SelectTrigger>
                <SelectValue placeholder="Select a platform" />
              </SelectTrigger>
              <SelectContent>
                {availablePlatforms.map((platform) => {
                  const platformData = SOCIAL_PLATFORMS[platform];
                  const IconComponent = platformData.icon;
                  return (
                    <SelectItem key={platform} value={platform}>
                      <div className="flex items-center gap-2">
                        <IconComponent className="h-4 w-4" style={{ color: platformData.color }} />
                        {platformData.name}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {selectedPlatform && (
            <div>
              <Label>URL</Label>
              <Input
                placeholder={SOCIAL_PLATFORMS[selectedPlatform].placeholder}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <p className="text-sm text-muted-foreground mt-1">
                Example: {SOCIAL_PLATFORMS[selectedPlatform].example}
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={!selectedPlatform || !url}>
              Add Link
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Social Media Preview Component
function SocialMediaPreview({ socialLinks }: { socialLinks: SocialMediaLink[] }) {
  if (socialLinks.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-4">
        No social media links to preview
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h4 className="font-medium">Contact Page Preview:</h4>
      <Card className="p-4">
        <div className="flex flex-col space-y-3">
          <h3 className="text-lg font-semibold">Follow Us</h3>
          <p className="text-sm text-muted-foreground">Stay connected on social media</p>
          <div className="flex gap-3">
            {socialLinks.map((link) => {
              if (!link.isActive || !link.url) return null;
              
              const platform = SOCIAL_PLATFORMS[link.platform];
              const IconComponent = platform.icon;
              
              return (
                <Button
                  key={link.id}
                  variant="outline"
                  size="icon"
                  onClick={() => window.open(link.url, '_blank')}
                  style={{ borderColor: platform.color }}
                  className="hover:bg-opacity-10"
                >
                  <IconComponent 
                    className="h-4 w-4" 
                    style={{ color: platform.color }}
                  />
                </Button>
              );
            })}
          </div>
        </div>
      </Card>
    </div>
  );
}