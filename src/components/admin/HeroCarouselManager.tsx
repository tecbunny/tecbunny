'use client';

import * as React from 'react';
import {
  ArrowDown,
  ArrowUp,
  ImagePlus,
  Pencil,
  Save,
  Trash,
  Upload,
} from 'lucide-react';

import { usePageContent } from '../../hooks/use-page-content';
import { useToast } from '../../hooks/use-toast';
import type { HeroCarouselContent, HeroCarouselItem, HeroCarouselPageKey } from '@/lib/types';

import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Textarea } from '../ui/textarea';

const PAGE_TABS: Array<{ key: HeroCarouselPageKey; label: string; description: string }> = [
  { key: 'homepage', label: 'Homepage', description: 'Large banners shown below the primary hero on the storefront.' },
  { key: 'services', label: 'Services', description: 'Highlight service packages or success stories on the services page.' },
  { key: 'offers', label: 'Offers', description: 'Promote current deals and campaigns on the offers page.' },
  { key: 'products', label: 'Store / Products', description: 'Upsell categories or spotlight collections on the product catalog.' },
  { key: 'innovations', label: 'Innovations', description: 'Showcase R&D projects and technological breakthroughs.' },
];

const EMPTY_CONTENT: HeroCarouselContent = {
  homepage: [],
  services: [],
  offers: [],
  products: [],
  innovations: [],
};

type SlideDraft = {
  title: string;
  subtitle: string;
  description: string;
  htmlContent: string;
  ctaText: string;
  ctaLink: string;
  imageUrl: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeSlides(pageKey: HeroCarouselPageKey, value: unknown): HeroCarouselItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is Record<string, unknown> => isRecord(item))
    .map((item, index) => {
      const fallbackId = `slide-${pageKey}-${index}-${Math.random().toString(36).slice(2, 8)}`;
      const id = typeof item.id === 'string' && item.id.length > 0 ? item.id : fallbackId;
      const imageUrl =
        typeof item.imageUrl === 'string' && item.imageUrl.length > 0
          ? item.imageUrl
          : typeof item.image === 'string' && item.image.length > 0
          ? item.image
          : '';
      return {
        id,
        title: typeof item.title === 'string' ? item.title : '',
        subtitle: typeof item.subtitle === 'string' ? item.subtitle : '',
        description: typeof item.description === 'string' ? item.description : '',
        htmlContent: typeof item.htmlContent === 'string' ? item.htmlContent : '',
        imageUrl,
        ctaText: typeof item.ctaText === 'string' ? item.ctaText : '',
        ctaLink: typeof item.ctaLink === 'string' ? item.ctaLink : '',
        isActive: item.isActive === false ? false : true,
        displayOrder: typeof item.displayOrder === 'number' ? item.displayOrder : index,
      } satisfies HeroCarouselItem;
    })
    .filter(slide => slide.imageUrl.length > 0)
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
    .map((slide, order) => ({ ...slide, displayOrder: order }));
}

function normalizeContent(raw: unknown): HeroCarouselContent {
  if (!isRecord(raw)) {
    return EMPTY_CONTENT;
  }

  const pages = isRecord(raw.pages) ? raw.pages : raw;
  return {
    homepage: normalizeSlides('homepage', pages.homepage),
    services: normalizeSlides('services', pages.services),
    offers: normalizeSlides('offers', pages.offers),
    products: normalizeSlides('products', pages.products),
    innovations: normalizeSlides('innovations', pages.innovations),
  };
}

const EMPTY_FORM: SlideDraft = {
  title: '',
  subtitle: '',
  description: '',
  htmlContent: '',
  ctaText: '',
  ctaLink: '',
  imageUrl: '',
};

export default function HeroCarouselManager() {
  const { content, loading, updateContent } = usePageContent('hero-carousels');
  const { toast } = useToast();

  const [activeTab, setActiveTab] = React.useState<HeroCarouselPageKey>('homepage');
  const [localContent, setLocalContent] = React.useState<HeroCarouselContent>(EMPTY_CONTENT);
  const [formState, setFormState] = React.useState<SlideDraft>(EMPTY_FORM);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingSlide, setEditingSlide] = React.useState<HeroCarouselItem | null>(null);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);

  React.useEffect(() => {
    if (!content?.content) {
      setLocalContent(EMPTY_CONTENT);
      setDirty(false);
      return;
    }
    const normalized = normalizeContent(content.content);
    setLocalContent(prev => {
      const prevJson = JSON.stringify(prev);
      const nextJson = JSON.stringify(normalized);
      if (prevJson === nextJson) {
        return prev;
      }
      return normalized;
    });
    setDirty(false);
  }, [content]);

  const openCreateDialog = () => {
    setEditingSlide(null);
    setFormState(EMPTY_FORM);
    setSelectedFile(null);
    setDialogOpen(true);
  };

  const openEditDialog = (slide: HeroCarouselItem) => {
    setEditingSlide(slide);
    setFormState({
      title: slide.title || '',
      subtitle: slide.subtitle || '',
      description: slide.description || '',
      htmlContent: slide.htmlContent || '',
      ctaText: slide.ctaText || '',
      ctaLink: slide.ctaLink || '',
      imageUrl: slide.imageUrl || '',
    });
    setSelectedFile(null);
    setDialogOpen(true);
  };

  const updateSlides = (pageKey: HeroCarouselPageKey, updater: (slides: HeroCarouselItem[]) => HeroCarouselItem[]) => {
    setLocalContent(prev => {
      const nextSlides = updater(prev[pageKey]);
      const reindexed = nextSlides.map((slide, index) => ({ ...slide, displayOrder: index }));
      const prevSlides = prev[pageKey];
      const changed =
        reindexed.length !== prevSlides.length ||
        reindexed.some((slide, index) => {
          const current = prevSlides[index];
          if (!current) {
            return true;
          }
          return (
            current.id !== slide.id ||
            current.title !== slide.title ||
            (current.subtitle || '') !== (slide.subtitle || '') ||
            (current.description || '') !== (slide.description || '') ||
            current.imageUrl !== slide.imageUrl ||
            (current.ctaText || '') !== (slide.ctaText || '') ||
            (current.ctaLink || '') !== (slide.ctaLink || '') ||
            (current.isActive ?? true) !== (slide.isActive ?? true) ||
            (current.displayOrder ?? 0) !== (slide.displayOrder ?? 0)
          );
        });

      if (changed) {
        setDirty(true);
        return { ...prev, [pageKey]: reindexed };
      }
      return prev;
    });
  };

  const uploadBannerImage = async (file: File) => {
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `hero-carousel/${activeTab}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
    // Use centralized upload endpoint to ensure S3/Supabase logic is consistent
    const fd = new FormData();
    fd.append('file', file);
    fd.append('type', 'hero');
    fd.append('path', path);
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const json = await res.json().catch(() => null);
    if (!res.ok || !(json?.secure_url || json?.url)) {
      const message = json?.error || json?.message || `Upload failed (status ${res.status})`;
      throw new Error(message);
    }
    return json?.secure_url || json?.url;
  };

  const handleDialogSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formState.title.trim()) {
      toast({ title: 'Title required', description: 'Please enter a banner title.', variant: 'destructive' });
      return;
    }

    try {
      setUploading(true);
      let imageUrl = formState.imageUrl.trim();
      if (selectedFile) {
        imageUrl = await uploadBannerImage(selectedFile);
      }
      if (!imageUrl) {
        throw new Error('Please upload a banner image.');
      }

      const slide: HeroCarouselItem = {
        id: editingSlide?.id || `slide-${activeTab}-${Date.now()}`,
        title: formState.title.trim(),
        subtitle: formState.subtitle.trim() || undefined,
        description: formState.description.trim() || undefined,
        htmlContent: formState.htmlContent.trim() || undefined,
        imageUrl,
        ctaText: formState.ctaText.trim() || undefined,
        ctaLink: formState.ctaLink.trim() || undefined,
        isActive: editingSlide?.isActive ?? true,
        displayOrder: editingSlide?.displayOrder,
      };

      updateSlides(activeTab, slides => {
        const filtered = slides.filter(existing => existing.id !== slide.id);
        filtered.push(slide);
        return filtered.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
      });

      toast({
        title: editingSlide ? 'Hero updated' : 'Hero added',
        description: 'Save changes to publish the new carousel order.',
      });

      setDialogOpen(false);
      setEditingSlide(null);
      setFormState(EMPTY_FORM);
      setSelectedFile(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save hero banner';
      toast({ title: 'Banner update failed', description: message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const toggleSlide = (pageKey: HeroCarouselPageKey, slideId: string, nextState: boolean) => {
    updateSlides(pageKey, slides =>
      slides.map(slide => (slide.id === slideId ? { ...slide, isActive: nextState } : slide))
    );
  };

  const removeSlide = (pageKey: HeroCarouselPageKey, slideId: string) => {
    updateSlides(pageKey, slides => slides.filter(slide => slide.id !== slideId));
    toast({ title: 'Hero removed', description: 'Save changes to confirm deletion.' });
  };

  const moveSlide = (pageKey: HeroCarouselPageKey, slideId: string, direction: 'up' | 'down') => {
    updateSlides(pageKey, slides => {
      const next = [...slides];
      const index = next.findIndex(slide => slide.id === slideId);
      if (index === -1) {
        return next;
      }
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= next.length) {
        return next;
      }
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return next;
    });
  };

  const persistChanges = async () => {
    try {
      setSaving(true);
      const payload: HeroCarouselContent = {
        homepage: localContent.homepage.map((slide, index) => ({ ...slide, displayOrder: index })),
        services: localContent.services.map((slide, index) => ({ ...slide, displayOrder: index })),
        offers: localContent.offers.map((slide, index) => ({ ...slide, displayOrder: index })),
        products: localContent.products.map((slide, index) => ({ ...slide, displayOrder: index })),
        innovations: localContent.innovations.map((slide, index) => ({ ...slide, displayOrder: index })),
      };

      const response = await updateContent({
        title: content?.title || 'Hero Carousels',
        content: {
          pages: payload,
          updatedAt: new Date().toISOString(),
        },
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to save hero banners');
      }

      toast({ title: 'Hero banners saved', description: 'The carousel will update on storefront pages within seconds.' });
      setDirty(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save hero banners';
      toast({ title: 'Save failed', description: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Hero Banner Management</h1>
          <p className="text-muted-foreground">
            Create and organize hero banners for each storefront page. Add multiple slides to build an auto-sliding carousel.
          </p>
        </div>
        <Button onClick={persistChanges} disabled={saving || loading || !dirty} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? 'Saving…' : dirty ? 'Save Changes' : 'Saved'}
        </Button>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Carousel Pages</CardTitle>
          <CardDescription>
            Switch between pages to configure targeted carousels. Slides inherit their display order unless you reorder them.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={value => setActiveTab(value as HeroCarouselPageKey)}>
            <TabsList className="flex flex-wrap gap-2">
              {PAGE_TABS.map(tab => (
                <TabsTrigger key={tab.key} value={tab.key} className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  {tab.label}
                  {localContent[tab.key].length > 0 ? (
                    <Badge variant="secondary" className="ml-2">
                      {localContent[tab.key].length}
                    </Badge>
                  ) : null}
                </TabsTrigger>
              ))}
            </TabsList>
            {PAGE_TABS.map(tab => (
              <TabsContent key={tab.key} value={tab.key} className="mt-6 space-y-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">{tab.label} Carousel</h2>
                    <p className="text-sm text-muted-foreground">{tab.description}</p>
                  </div>
                  <Button onClick={openCreateDialog} className="gap-2">
                    <ImagePlus className="h-4 w-4" />
                    Add Banner
                  </Button>
                </div>

                {localContent[tab.key].length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-muted-foreground/40 bg-muted/30 p-12 text-center">
                    <Upload className="mb-4 h-10 w-10 text-muted-foreground" />
                    <h3 className="text-lg font-semibold">No banners yet</h3>
                    <p className="mt-2 max-w-md text-sm text-muted-foreground">
                      Add your first banner to start the carousel. Upload images, set call-to-action links, and reorder slides anytime.
                    </p>
                    <Button onClick={openCreateDialog} className="mt-4 gap-2">
                      <ImagePlus className="h-4 w-4" />
                      Upload Banner
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                    {localContent[tab.key].map((slide, index) => (
                      <Card key={slide.id} className="overflow-hidden">
                        <div className="relative aspect-[16/9] overflow-hidden bg-muted">
                          <img
                            src={slide.imageUrl}
                            alt={slide.title || 'Carousel banner'}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        </div>
                        <CardHeader className="flex flex-row items-start justify-between gap-4">
                          <div>
                            <CardTitle className="text-lg leading-tight">{slide.title || 'Untitled Banner'}</CardTitle>
                            {slide.subtitle ? (
                              <CardDescription>{slide.subtitle}</CardDescription>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={slide.isActive !== false}
                              onCheckedChange={checked => toggleSlide(tab.key, slide.id, checked)}
                              aria-label={slide.isActive === false ? 'Activate banner' : 'Deactivate banner'}
                            />
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {slide.description ? (
                            <p className="text-sm text-muted-foreground line-clamp-3">{slide.description}</p>
                          ) : null}
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-2"
                              onClick={() => moveSlide(tab.key, slide.id, 'up')}
                              disabled={index === 0}
                            >
                              <ArrowUp className="h-4 w-4" />
                              Up
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-2"
                              onClick={() => moveSlide(tab.key, slide.id, 'down')}
                              disabled={index === localContent[tab.key].length - 1}
                            >
                              <ArrowDown className="h-4 w-4" />
                              Down
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-2"
                              onClick={() => openEditDialog(slide)}
                            >
                              <Pencil className="h-4 w-4" />
                              Edit
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              className="gap-2"
                              onClick={() => removeSlide(tab.key, slide.id)}
                            >
                              <Trash className="h-4 w-4" />
                              Delete
                            </Button>
                          </div>
                          {slide.ctaText && slide.ctaLink ? (
                            <div className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                              CTA: {slide.ctaText} → {slide.ctaLink}
                            </div>
                          ) : null}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingSlide ? 'Edit Banner' : 'Add Banner'}</DialogTitle>
            <DialogDescription>
              Upload a hero banner image and configure its metadata. Remember to save changes after adding or editing slides.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleDialogSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="hero-title">Title</Label>
              <Input
                id="hero-title"
                value={formState.title}
                onChange={event => setFormState(current => ({ ...current, title: event.target.value }))}
                placeholder="Summer Festive Sale"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hero-subtitle">Subtitle</Label>
              <Input
                id="hero-subtitle"
                value={formState.subtitle}
                onChange={event => setFormState(current => ({ ...current, subtitle: event.target.value }))}
                placeholder="Limited time offers across electronics"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hero-description">Description</Label>
              <Textarea
                id="hero-description"
                value={formState.description}
                onChange={event => setFormState(current => ({ ...current, description: event.target.value }))}
                placeholder="Highlight what makes this banner special."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hero-html">Custom HTML Overlay (Optional)</Label>
              <Textarea
                id="hero-html"
                value={formState.htmlContent}
                onChange={event => setFormState(current => ({ ...current, htmlContent: event.target.value }))}
                placeholder="<div className='text-center'>...</div>"
                rows={5}
                className="font-mono text-xs"
              />
              <p className="text-[10px] text-muted-foreground">Overrides Title/Subtitle/CTA overlay if provided. Use Tailwind classes.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="hero-cta-text">CTA Text</Label>
                <Input
                  id="hero-cta-text"
                  value={formState.ctaText}
                  onChange={event => setFormState(current => ({ ...current, ctaText: event.target.value }))}
                  placeholder="Shop Now"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hero-cta-link">CTA Link</Label>
                <Input
                  id="hero-cta-link"
                  value={formState.ctaLink}
                  onChange={event => setFormState(current => ({ ...current, ctaLink: event.target.value }))}
                  placeholder="/products"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Banner Image</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={event => {
                  const file = event.target.files?.[0] || null;
                  setSelectedFile(file);
                  if (file) {
                    setFormState(current => ({ ...current, imageUrl: '' }));
                  }
                }}
              />
              {formState.imageUrl && !selectedFile ? (
                <div className="overflow-hidden rounded-lg border">
                  <img src={formState.imageUrl} alt="Banner preview" className="h-40 w-full object-cover" />
                </div>
              ) : null}
              {selectedFile ? (
                <p className="text-xs text-muted-foreground">
                  Selected file: {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
                </p>
              ) : null}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={uploading}>
                Cancel
              </Button>
              <Button type="submit" disabled={uploading}>
                {uploading ? 'Saving…' : editingSlide ? 'Update Banner' : 'Add Banner'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
