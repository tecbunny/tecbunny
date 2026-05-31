'use client';

import * as React from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';

import { 
  Plus,
  Edit2, 
  RefreshCw, 
  FileText,
  Shield,
  Truck,
  RotateCcw,
  Undo2,
  Eye,
  ExternalLink
} from 'lucide-react';

import Link from 'next/link';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '../../hooks/use-toast';
import { logger } from '@/lib/logger';


interface PolicyContent {
  id: string;
  page_key: string;
  title: string;
  content: Record<string, any> | string | null;
  meta_description?: string;
  meta_keywords?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

function normalizePolicyContent(raw: unknown): Record<string, any> {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
      return { description: raw };
    } catch (error) {
      logger.warn('PoliciesManagement.normalizePolicyContent.parse_failed', {
        error,
        rawSnippet: String(raw).slice(0, 120)
      });
      return { description: raw };
    }
  }
  return (raw && typeof raw === 'object') ? (raw as Record<string, any>) : {};
}

function extractDescriptionFromContent(content: unknown): string {
  const normalized = normalizePolicyContent(content);
  if (!normalized) return '';
  if (typeof normalized.description === 'string') return normalized.description;
  if (typeof normalized.descriptionHtml === 'string') return normalized.descriptionHtml;

  const parts: string[] = [];

  if (typeof normalized.introduction === 'string') {
    parts.push(normalized.introduction);
  } else if (Array.isArray(normalized.introduction)) {
    parts.push(...normalized.introduction);
  }

  if (Array.isArray(normalized.sections)) {
    for (const section of normalized.sections) {
      if (section?.title) {
        parts.push(section.title);
      }
      if (Array.isArray(section?.content)) {
        parts.push(...section.content.filter(Boolean));
      }
      if (Array.isArray(section?.list)) {
        parts.push(...section.list.filter(Boolean));
      }
    }
  }

  return parts.join('\n\n');
}

export default function PoliciesManagement() {
  const [policies, setPolicies] = useState<PolicyContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPolicy, setSelectedPolicy] = useState<PolicyContent | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    meta_description: '',
    meta_keywords: '',
    status: 'published'
  });

  const policyTypes = useMemo(() => [
    {
      key: 'privacy_policy',
      title: 'Privacy Policy',
      description: 'How we collect, use, and protect personal information',
      icon: Shield,
      defaultTitle: 'Privacy Policy'
    },
    {
      key: 'terms_of_service',
      title: 'Terms of Service',
      description: 'Terms and conditions of using our platform',
      icon: FileText,
      defaultTitle: 'Terms of Service'
    },
    {
      key: 'shipping_policy',
      title: 'Shipping Policy',
      description: 'Shipping methods, costs, and delivery information',
      icon: Truck,
      defaultTitle: 'Shipping Policy'
    },
    {
      key: 'return_policy',
      title: 'Return Policy',
      description: 'Guidelines for returns, exchanges, and refunds',
      icon: RotateCcw,
      defaultTitle: 'Return & Exchange Policy'
    },
    {
      key: 'refund_cancellation_policy',
      title: 'Refund & Cancellation Policy',
      description: 'How cancellations are handled and when refunds are issued',
      icon: Undo2,
      defaultTitle: 'Refund & Cancellation Policy'
    }
  ], []);

  const fetchPolicies = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/page-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list_all' })
      });

      const result = await response.json();
      if (response.ok) {
        // Filter only policy-related content
        const policyKeys = policyTypes.map(p => p.key);
        const policyContents = result.data
          .filter((content: PolicyContent) => policyKeys.includes(content.page_key))
          .map((content: PolicyContent) => ({
            ...content,
            content: normalizePolicyContent(content.content)
          }));
        setPolicies(policyContents);
      } else {
        throw new Error(result.error || 'Failed to fetch policies');
      }
    } catch (error) {
      logger.error('Error fetching policies in PoliciesManagement', { error });
      toast({
        title: 'Error',
        description: 'Failed to fetch policies',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [toast, policyTypes]);

  useEffect(() => {
    fetchPolicies();
  }, [fetchPolicies]);

  const handleEditPolicy = (policy: PolicyContent | null, policyKey?: string) => {
    if (policy) {
      const normalizedContent = normalizePolicyContent(policy.content);
      setSelectedPolicy({
        ...policy,
        content: normalizedContent
      });
      setFormData({
        title: (typeof normalizedContent.title === 'string' && normalizedContent.title.trim().length > 0)
          ? normalizedContent.title
          : policy.title,
        description: extractDescriptionFromContent(normalizedContent),
        meta_description: policy.meta_description || '',
        meta_keywords: policy.meta_keywords || '',
        status: policy.status || 'published'
      });
    } else if (policyKey) {
      // Creating new policy
      const policyType = policyTypes.find(p => p.key === policyKey);
      setSelectedPolicy({
        id: '',
        page_key: policyKey,
        title: policyType?.defaultTitle || 'New Policy',
        content: {},
        status: 'draft',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } as PolicyContent);
      setFormData({
        title: policyType?.defaultTitle || 'New Policy',
        description: '',
        meta_description: policyType?.description || '',
        meta_keywords: '',
        status: 'draft'
      });
    }
    setShowEditDialog(true);
  };

  const handleSavePolicy = async () => {
    if (!selectedPolicy) return;

    try {
      setSaving(true);
      const pageKey = selectedPolicy.page_key;
      const isUpdate = Boolean(selectedPolicy.id);
      
      // Prepare simplified content structure
      const content = {
        title: formData.title,
        lastUpdated: new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
        description: formData.description
      };

      const response = await fetch('/api/page-content', {
        method: isUpdate ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageKey,
          title: formData.title,
          content,
          metaDescription: formData.meta_description,
          metaKeywords: formData.meta_keywords,
          status: formData.status
        })
      });

      const result = await response.json();
      
      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Policy updated successfully'
        });
        await fetchPolicies();
        setShowEditDialog(false);
        setSelectedPolicy(null);
      } else {
        throw new Error(result.error || 'Failed to save policy');
      }
    } catch (error) {
      logger.error('Error saving policy in PoliciesManagement', { error, formData });
      toast({
        title: 'Error',
        description: (error as Error).message,
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const getPolicyInfo = (pageKey: string) => {
    return policyTypes.find(p => p.key === pageKey);
  };

  const getExistingPolicy = (pageKey: string) => {
    return policies.find(p => p.page_key === pageKey);
  };

  return (
    <div className="min-h-screen bg-transparent p-6 text-slate-200">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-white">Policy Management</h1>
            <p className="text-slate-400">Manage legal documents and policies for your store</p>
          </div>
          <Button asChild variant="outline">
            <Link href="/info/policies" target="_blank" rel="noopener noreferrer">
              <Eye className="h-4 w-4 mr-2" />
              View Public Policies
              <ExternalLink className="h-4 w-4 ml-2" />
            </Link>
          </Button>
        </div>

        {/* Policy Types Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {policyTypes.map((policyType) => {
            const IconComponent = policyType.icon;
            const existingPolicy = getExistingPolicy(policyType.key);
            
            return (
              <Card key={policyType.key} className="cursor-pointer hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <IconComponent className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{policyType.title}</CardTitle>
                        {existingPolicy && (
                          <Badge variant={existingPolicy.status === 'published' ? 'default' : 'secondary'}>
                            {existingPolicy.status}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <CardDescription>{policyType.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  {existingPolicy ? (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Last updated: {new Date(existingPolicy.updated_at).toLocaleDateString()}
                      </p>
                      <div className="flex space-x-2">
                        <Button 
                          size="sm" 
                          onClick={() => handleEditPolicy(existingPolicy)}
                          className="flex-1"
                        >
                          <Edit2 className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          asChild
                        >
                          <Link href={`/info/policies/${policyType.key.replace('_policy', '').replace('_service', '')}`} target="_blank" rel="noopener noreferrer">
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleEditPolicy(null, policyType.key)}
                      className="w-full"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create Policy
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-8">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p>Loading policies...</p>
          </div>
        )}

        {/* Edit Policy Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedPolicy?.id ? 'Edit Policy' : 'Create New Policy'}
              </DialogTitle>
              <DialogDescription>
                {selectedPolicy && getPolicyInfo(selectedPolicy.page_key)?.description}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="title">Policy Title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Enter policy title"
                  />
                </div>
                <div>
                  <Label htmlFor="status">Status</Label>
                  <select
                    id="status"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 border border-input bg-background rounded-md"
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                  </select>
                </div>
              </div>

              {/* Meta Information */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="meta_description">Meta Description</Label>
                  <Input
                    id="meta_description"
                    value={formData.meta_description}
                    onChange={(e) => setFormData({ ...formData, meta_description: e.target.value })}
                    placeholder="SEO description for this policy"
                  />
                </div>
                <div>
                  <Label htmlFor="meta_keywords">Meta Keywords</Label>
                  <Input
                    id="meta_keywords"
                    value={formData.meta_keywords}
                    onChange={(e) => setFormData({ ...formData, meta_keywords: e.target.value })}
                    placeholder="Keywords separated by commas"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <Label htmlFor="description">Policy Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Enter the full policy content. Supports plain text or HTML markup."
                  rows={10}
                  className="font-mono"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Paste formatted HTML or plain text. Use HTML tags for advanced formatting if needed.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSavePolicy} disabled={saving}>
                {saving ? 'Saving...' : 'Save Policy'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}