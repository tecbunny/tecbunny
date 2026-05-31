'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';

import { 
  Edit2, 
  Save, 
  RefreshCw, 
  FileText,
  Eye,
  EyeOff,
  Plus,
  Trash2
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useAllPageContents } from '../../../../hooks/use-page-content';

interface PageContent {
  id: string;
  page_key: string;
  title: string;
  content: unknown;
  meta_description?: string;
  meta_keywords?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export default function PageContentAdmin() {
  const { contents, loading, error, refetch } = useAllPageContents();
  const [selectedPage, setSelectedPage] = useState<PageContent | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    meta_description: '',
    meta_keywords: '',
    status: 'published'
  });
  const [saving, setSaving] = useState(false);
  const [showJsonRaw, setShowJsonRaw] = useState(false);
  const [newPageForm, setNewPageForm] = useState(() => ({
    page_key: '',
    title: '',
    content: '{}',
    meta_description: '',
    meta_keywords: '',
    status: 'draft'
  }));
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const resetNewPageForm = () => {
    setNewPageForm({
      page_key: '',
      title: '',
      content: '{}',
      meta_description: '',
      meta_keywords: '',
      status: 'draft'
    });
  };

  useEffect(() => {
    if (selectedPage) {
      setFormData({
        title: selectedPage.title,
        content: typeof selectedPage.content === 'string' 
          ? selectedPage.content 
          : JSON.stringify(selectedPage.content, null, 2),
        meta_description: selectedPage.meta_description || '',
        meta_keywords: selectedPage.meta_keywords || '',
        status: selectedPage.status
      });
    }
  }, [selectedPage]);

  useEffect(() => {
    if (!contents.length) {
      setSelectedPage(null);
      return;
    }

    if (!selectedPage) {
      setSelectedPage(contents[0]);
      return;
    }

    const updated = contents.find(page => page.page_key === selectedPage.page_key);
    if (updated && (updated.id !== selectedPage.id || updated.updated_at !== selectedPage.updated_at)) {
      setSelectedPage(updated);
    }
  }, [contents, selectedPage]);

  const handleCreatePage = async () => {
    const rawKey = newPageForm.page_key.trim();
    const normalizedKey = rawKey
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '');

    if (!normalizedKey) {
      alert('Please provide a valid page key.');
      return;
    }

    if (contents.some(page => page.page_key === normalizedKey)) {
      alert('A page with this key already exists.');
      return;
    }

    const title = newPageForm.title.trim() || formatPageKey(normalizedKey);
    let contentData: unknown;
    try {
      contentData = JSON.parse(newPageForm.content);
    } catch (_error) {
      contentData = newPageForm.content;
    }

    setCreating(true);
    try {
      const response = await fetch('/api/page-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageKey: normalizedKey,
          title,
          content: contentData,
          metaDescription: newPageForm.meta_description || null,
          metaKeywords: newPageForm.meta_keywords || null,
          status: newPageForm.status || 'draft'
        })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to create page content');
      }

      await refetch();
      if (result.data) {
        setSelectedPage(result.data);
      }
      resetNewPageForm();
      alert('Page created successfully.');
    } catch (error) {
      console.error('Error creating page content:', error);
      alert(error instanceof Error ? error.message : 'Failed to create page');
    } finally {
      setCreating(false);
    }
  };

  const handleDeletePage = async () => {
    if (!selectedPage) return;
    if (selectedPage.page_key === 'homepage') {
      alert('The homepage cannot be deleted.');
      return;
    }

    const confirmed = window.confirm(`Delete the page "${formatPageKey(selectedPage.page_key)}"? This cannot be undone.`);
    if (!confirmed) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/page-content?key=${encodeURIComponent(selectedPage.page_key)}`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || 'Failed to delete page content');
      }

      await refetch();
      setSelectedPage(null);
      alert('Page deleted successfully.');
    } catch (error) {
      console.error('Error deleting page content:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete page');
    } finally {
      setDeleting(false);
    }
  };

  const handleSave = async () => {
    if (!selectedPage) return;

    setSaving(true);
    try {
      let contentData;
      try {
        contentData = JSON.parse(formData.content);
      } catch {
        contentData = formData.content;
      }

      const response = await fetch('/api/page-content', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pageKey: selectedPage.page_key,
          title: formData.title,
          content: contentData,
          metaDescription: formData.meta_description,
          metaKeywords: formData.meta_keywords,
          status: formData.status
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setEditMode(false);
        await refetch();
        if (result.data) {
          setSelectedPage(result.data);
        }
        alert('Page content updated successfully!');
      } else {
        const errorResponse = await response.json();
        alert(`Error: ${errorResponse.error}`);
      }
    } catch (error) {
      console.error('Error saving:', error);
      alert('Error saving page content');
    } finally {
      setSaving(false);
    }
  };

  const formatPageKey = (key: string) => {
    return key
      .replace(/[-_]+/g, ' ')
      .split(' ')
      .filter(Boolean)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p>Loading page contents...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-600">Error Loading Content</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={refetch} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const editableContents = [...contents].sort((a, b) => a.page_key.localeCompare(b.page_key));
  const canDeleteSelected = selectedPage ? selectedPage.page_key !== 'homepage' : false;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Page Content Management</h1>
        <p className="text-gray-600 mt-2">
          Manage marketing and informational pages that power TecBunny.com. Create new entries, update existing content, or retire pages that are no longer needed.
        </p>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
          <div className="flex items-start gap-3">
            <FileText className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-900">Tip</h4>
              <p className="text-sm text-blue-700 mt-1">
                Use structured JSON for complex layouts. Keep drafts unpublished until you are ready to surface them on the storefront navigation.
              </p>
            </div>
          </div>
        </div>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add New Page
          </CardTitle>
          <CardDescription>
            Provide a unique page key (letters, numbers, and hyphens) and optional metadata. Content accepts JSON or plain text.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="new_page_key">Page Key</Label>
              <Input
                id="new_page_key"
                value={newPageForm.page_key}
                onChange={(e) => setNewPageForm({ ...newPageForm, page_key: e.target.value })}
                placeholder="e.g., customised-setups"
              />
            </div>
            <div>
              <Label htmlFor="new_page_title">Title</Label>
              <Input
                id="new_page_title"
                value={newPageForm.title}
                onChange={(e) => setNewPageForm({ ...newPageForm, title: e.target.value })}
                placeholder="Displayed title"
              />
            </div>
            <div>
              <Label htmlFor="new_page_status">Status</Label>
              <select
                id="new_page_status"
                value={newPageForm.status}
                onChange={(e) => setNewPageForm({ ...newPageForm, status: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>
            <div>
              <Label htmlFor="new_page_keywords">Meta Keywords</Label>
              <Input
                id="new_page_keywords"
                value={newPageForm.meta_keywords}
                onChange={(e) => setNewPageForm({ ...newPageForm, meta_keywords: e.target.value })}
                placeholder="Comma separated keywords"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="new_page_description">Meta Description</Label>
            <Textarea
              id="new_page_description"
              value={newPageForm.meta_description}
              onChange={(e) => setNewPageForm({ ...newPageForm, meta_description: e.target.value })}
              rows={2}
              placeholder="Short summary for SEO"
            />
          </div>

          <div>
            <Label htmlFor="new_page_content">Initial Content</Label>
            <Textarea
              id="new_page_content"
              value={newPageForm.content}
              onChange={(e) => setNewPageForm({ ...newPageForm, content: e.target.value })}
              rows={6}
              className="font-mono text-sm"
              placeholder="JSON or plain text"
            />
          </div>

          <div className="flex items-center justify-end gap-3">
            <Button
              variant="outline"
              onClick={resetNewPageForm}
              disabled={creating}
            >
              Clear
            </Button>
            <Button onClick={handleCreatePage} disabled={creating}>
              {creating ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Create Page
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Page List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Editable Pages
            </CardTitle>
            <CardDescription>
              Select a page to view or edit its content
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {editableContents.length > 0 ? (
              editableContents.map((page) => (
                <div
                  key={page.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedPage?.id === page.id
                      ? 'bg-blue-50 border-blue-200'
                      : 'hover:bg-white/5 border-white/10'
                  }`}
                  onClick={() => {
                    setSelectedPage(page);
                    setEditMode(false);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">{formatPageKey(page.page_key)}</h4>
                      <p className="text-sm text-gray-500">{page.title}</p>
                    </div>
                    <Badge variant={page.status === 'published' ? 'default' : 'secondary'}>
                      {page.status}
                    </Badge>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 text-sm">
                  No homepage content found. You may need to create it first.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Content Editor */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Edit2 className="h-5 w-5" />
                  {selectedPage ? formatPageKey(selectedPage.page_key) : 'Select a Page'}
                </CardTitle>
                {selectedPage && (
                  <CardDescription>
                    Last updated: {new Date(selectedPage.updated_at).toLocaleString()}
                  </CardDescription>
                )}
              </div>
              {selectedPage && (
                <div className="flex flex-wrap items-center gap-2">
                  {editMode ? (
                    <>
                      <Button
                        onClick={() => setEditMode(false)}
                        variant="outline"
                        size="sm"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleSave}
                        disabled={saving}
                        size="sm"
                      >
                        {saving ? (
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4 mr-2" />
                        )}
                        Save
                      </Button>
                    </>
                  ) : (
                    <Button
                      onClick={() => setEditMode(true)}
                      size="sm"
                    >
                      <Edit2 className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  )}
                  <Button
                    onClick={handleDeletePage}
                    variant="destructive"
                    size="sm"
                    disabled={!canDeleteSelected || deleting}
                  >
                    {deleting ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 mr-2" />
                    )}
                    Delete
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {selectedPage ? (
              editMode ? (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label htmlFor="status">Status</Label>
                    <select
                      id="status"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label htmlFor="content">Content</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowJsonRaw(!showJsonRaw)}
                      >
                        {showJsonRaw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        {showJsonRaw ? 'Hide' : 'Show'} Raw JSON
                      </Button>
                    </div>
                    <Textarea
                      id="content"
                      value={formData.content}
                      onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                      rows={15}
                      className="font-mono text-sm"
                    />
                  </div>

                  <div>
                    <Label htmlFor="meta_description">Meta Description</Label>
                    <Textarea
                      id="meta_description"
                      value={formData.meta_description}
                      onChange={(e) => setFormData({ ...formData, meta_description: e.target.value })}
                      rows={2}
                    />
                  </div>

                  <div>
                    <Label htmlFor="meta_keywords">Meta Keywords</Label>
                    <Input
                      id="meta_keywords"
                      value={formData.meta_keywords}
                      onChange={(e) => setFormData({ ...formData, meta_keywords: e.target.value })}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-lg">{selectedPage.title}</h3>
                    <Badge variant={selectedPage.status === 'published' ? 'default' : 'secondary'}>
                      {selectedPage.status}
                    </Badge>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Content Preview:</h4>
                    <div className="bg-white/5 border border-white/10 p-4 rounded-lg">
                      <pre className="text-sm overflow-x-auto">
                        {typeof selectedPage.content === 'string' 
                          ? selectedPage.content 
                          : JSON.stringify(selectedPage.content, null, 2)}
                      </pre>
                    </div>
                  </div>

                  {selectedPage.meta_description && (
                    <div>
                      <h4 className="font-medium mb-2">Meta Description:</h4>
                      <p className="text-sm text-gray-600">{selectedPage.meta_description}</p>
                    </div>
                  )}

                  {selectedPage.meta_keywords && (
                    <div>
                      <h4 className="font-medium mb-2">Meta Keywords:</h4>
                      <p className="text-sm text-gray-600">{selectedPage.meta_keywords}</p>
                    </div>
                  )}
                </div>
              )
            ) : (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Select a page from the list to view and edit its content.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
