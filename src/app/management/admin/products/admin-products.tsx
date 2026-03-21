'use client';

import * as React from 'react';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

import { 
  Plus, 
  Edit2, 
  Save, 
  RefreshCw, 
  Upload,
  Download,
  Trash2,
  Package,
  ShoppingCart,
  Tag,
  Image,
  Eye,
  X,
  Search,
  Sparkles
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Textarea } from '../../../../components/ui/textarea';
import { Badge } from '../../../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../components/ui/table';
import { useToast } from '../../../../hooks/use-toast';
import CSVImportDialog from '../../../../components/admin/csv-import-dialog';
import { useDebounce } from '../../../../hooks/use-debounce';

interface Product {
  id: string;
  handle: string;
  title: string;
  description?: string;
  vendor?: string;
  product_type?: string;
  tags?: string[];
  status: 'active' | 'archived' | 'draft';
  images?: any[];
  hsnCode?: string;
  stock_quantity?: number;
  min_stock_level?: number;
  max_stock_level?: number;
  stock_status?: 'in_stock' | 'low_stock' | 'out_of_stock' | 'backorder';
  created_at: string;
  updated_at: string;
  prioritized?: boolean;
  prioritized_at?: string;
  variants?: ProductVariant[];
  options?: ProductOption[];
}

interface ProductVariant {
  id: string;
  title?: string;
  sku?: string;
  price: number;
  option1?: string;
  option2?: string;
  option3?: string;
  status: string;
}

interface ProductOption {
  id: string;
  name: string;
  values: string[];
  position: number;
}

interface ProductFormData {
  handle: string;
  title: string;
  description: string;
  vendor: string;
  product_type: string;
  tags: string;
  status: 'active' | 'archived' | 'draft';
  mrp: number;
  price: number;
  hsnCode: string;
  stock_quantity: number;
  min_stock_level: number;
  max_stock_level: number;
  stock_status: 'in_stock' | 'low_stock' | 'out_of_stock' | 'backorder';
  images?: { url: string; alt?: string }[];
  options: { name: string; values: string[] }[];
  variants: {
    title: string;
    sku: string;
    price: number;
    inventory_quantity: number;
    option1: string;
    option2: string;
    option3: string;
  }[];
}

import { logger } from '../../../../lib/logger';

const deriveStockStatus = (
  quantity: number,
  minStock: number
): ProductFormData['stock_status'] => {
  if (quantity <= 0) {
    return 'out_of_stock';
  }
  if (quantity <= Math.max(0, minStock)) {
    return 'low_stock';
  }
  return 'in_stock';
};

export default function AdminProductCatalogPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  // Pagination state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 400);
  const [formData, setFormData] = useState<ProductFormData>({
    handle: '',
    title: '',
    description: '',
    vendor: '',
    product_type: '',
    tags: '',
    status: 'active',
    mrp: 0,
    price: 0,
    hsnCode: '',
    stock_quantity: 0,
    min_stock_level: 0,
    max_stock_level: 0,
    stock_status: 'in_stock',
    images: [],
    options: [{ name: 'Color', values: [] }],
    variants: []
  });
  const [isCleaningImages, setIsCleaningImages] = useState(false);
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);

  const { toast } = useToast();

  const handleGenerateDescription = async () => {
    if (!selectedProduct?.id) {
      toast({ title: 'Select a product', description: 'Open a product to generate its description.', variant: 'destructive' });
      return;
    }

    setIsGeneratingDescription(true);
    try {
      const response = await fetch('/api/admin/ai/product-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: selectedProduct.id }),
      });

      const result = await response.json();
      if (!response.ok || result.error) {
        throw new Error(result.error || 'Failed to generate description');
      }

      setFormData((prev) => ({ ...prev, description: result.description || prev.description }));
      toast({ title: 'Description updated', description: 'AI description has been saved to the database.' });
    } catch (error: any) {
      toast({ title: 'AI generation failed', description: error?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setIsGeneratingDescription(false);
    }
  };

  const fetchProducts = useCallback(async () => {
    // Ensure only the most recent query updates the grid
    fetchControllerRef.current?.abort();
    const controller = new AbortController();
    fetchControllerRef.current = controller;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        include_variants: 'true',
        include_options: 'true',
        page: String(page),
        limit: String(limit),
        sort: 'created_at',
        order: 'desc',
      });

      if (debouncedSearch) {
        params.set('search', debouncedSearch);
      }

      // Fetch products sorted by creation date (first added = first in order)
      const response = await fetch(`/api/products?${params.toString()}`, {
        signal: controller.signal,
      });
      const result = await response.json();
      
      if (controller.signal.aborted) {
        return;
      }

      logger.debug('Fetch products response:', { result, search: debouncedSearch });
      
      if (result.success) {
        setProducts(result.data || []);
        if (result.pagination) {
          setTotalPages(result.pagination.pages || 1);
          setTotalItems(result.pagination.total || result.data?.length || 0);
        }
      } else {
        logger.error('API returned error:', { error: result.error });
        toast({
          title: "Error",
          description: result.error || "Failed to fetch products",
          variant: "destructive"
        });
        setProducts([]); // Clear products on error
      }
    } catch (error) {
      if ((error as DOMException)?.name === 'AbortError') {
        return;
      }
      logger.error('Error fetching products:', { error });
      toast({
        title: "Error",
        description: "Failed to fetch products",
        variant: "destructive"
      });
      setProducts([]); // Clear products on error
    } finally {
      if (fetchControllerRef.current === controller) {
        fetchControllerRef.current = null;
        setLoading(false);
      }
    }
  }, [page, limit, toast, debouncedSearch]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    return () => {
      fetchControllerRef.current?.abort();
    };
  }, []);

  const handleSaveProduct = async () => {
    try {
      setIsSaving(true);
      // Normalize images to array of plain URL strings – backend expects text[] or json[] of URLs
      const normalizedImages = (formData.images || []).map(img => typeof (img as any) === 'string' ? img : img.url).filter(Boolean);
      
      logger.debug('admin_products_save_image_payload', {
        imageSourcesProvided: formData.images?.length || 0,
        normalizedCount: normalizedImages.length,
        sampleImage: normalizedImages[0] || null
      });
      
      const autoStockStatus = deriveStockStatus(formData.stock_quantity, formData.min_stock_level);

      const normalizedOptions = formData.options
        .map(opt => ({
          name: opt.name.trim(),
          values: sanitizeOptionValues(opt.values || []),
        }))
        .filter(opt => opt.name && opt.values.length > 0);

      const productData = {
        handle: formData.handle,
        title: formData.title,
        description: formData.description,
        vendor: formData.vendor,
        product_type: formData.product_type,
        tags: formData.tags.split(',').map(tag => tag.trim()).filter(Boolean),
        status: formData.status,
        mrp: formData.mrp,
        price: formData.price,
        hsnCode: formData.hsnCode.trim() || null,
        images: normalizedImages,
        options: normalizedOptions,
        variants: formData.variants.filter(variant => variant.title && variant.price > 0),
        stock_quantity: formData.stock_quantity,
        min_stock_level: formData.min_stock_level,
        max_stock_level: formData.max_stock_level,
        stock_status: autoStockStatus,
      } as const;

      const isEdit = editMode && selectedProduct?.id;
      const url = '/api/products?debug=1';
      const method = isEdit ? 'PUT' : 'POST';
      const body = isEdit ? JSON.stringify({ id: selectedProduct!.id, ...productData }) : JSON.stringify(productData);

      const correlationId = (crypto?.randomUUID && crypto.randomUUID()) || Math.random().toString(36).slice(2);
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'x-correlation-id': correlationId },
        body
      });

      if (response.ok) {
        const json = await response.json();
        toast({
          title: "Success",
          description: (isEdit ? "Product updated" : "Product saved") + (json.warnings?.length ? ` (with warnings: ${json.warnings.join('; ')})` : '!'),
        });
        await fetchProducts();
        setShowAddForm(false);
        setEditMode(false);
        setSelectedProduct(null);
        resetForm();
      } else {
        let errorJson: any = {};
        try { errorJson = await response.json(); } catch { /* ignore */ }
        logger.error('Product save failed', { status: response.status, errorJson });
        const detailParts = [errorJson.error || 'Unknown error'];
        if (errorJson.error_code) detailParts.push(`code:${errorJson.error_code}`);
        if (errorJson.hint) detailParts.push(`hint:${errorJson.hint}`);
        if (errorJson.correlationId) detailParts.push(`cid:${errorJson.correlationId}`);
        toast({
          title: 'Error',
          description: detailParts.join(' | '),
          variant: 'destructive'
        });
      }
    } catch (error) {
      logger.error('Error saving product:', { error });
      toast({
        title: "Error",
        description: "Error saving product",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      handle: '',
      title: '',
      description: '',
      vendor: '',
      product_type: '',
      tags: '',
      status: 'active',
      mrp: 0,
      price: 0,
      hsnCode: '',
      stock_quantity: 0,
      min_stock_level: 0,
      max_stock_level: 0,
      stock_status: 'in_stock',
      images: [],
      options: [{ name: 'Color', values: [] }],
      variants: []
    });
  };

  const startAddNew = () => {
    setEditMode(false);
    setSelectedProduct(null);
    resetForm();
    setShowAddForm(true);
  };

  const handleEdit = async (product: Product) => {
    try {
      setEditMode(true);
      setSelectedProduct(product);
      setShowAddForm(true);
      // Fetch full product details with options and variants
      const resp = await fetch(`/api/products?handle=${encodeURIComponent(product.handle)}&include_variants=true&include_options=true`);
      const result = await resp.json();
      const p = result?.data || product;
      setFormData({
        handle: p.handle || '',
        title: p.title || '',
        description: p.description || '',
        vendor: p.vendor || '',
        product_type: p.product_type || '',
        tags: Array.isArray(p.tags) ? p.tags.join(', ') : (typeof p.tags === 'string' ? p.tags : ''),
        status: (p.status as any) || 'active',
        mrp: typeof p.mrp === 'number' ? p.mrp : 0,
        price: typeof p.price === 'number' ? p.price : 0,
        hsnCode: (p as any).hsnCode || (p as any).hsn_code || '',
        stock_quantity: Number.isFinite(Number((p as any).stock_quantity))
          ? Math.max(0, Number((p as any).stock_quantity))
          : 0,
        min_stock_level: Number.isFinite(Number((p as any).min_stock_level))
          ? Math.max(0, Number((p as any).min_stock_level))
          : 0,
        max_stock_level: Number.isFinite(Number((p as any).max_stock_level))
          ? Math.max(0, Number((p as any).max_stock_level))
          : 0,
        stock_status: deriveStockStatus(
          Number.isFinite(Number((p as any).stock_quantity)) ? Math.max(0, Number((p as any).stock_quantity)) : 0,
          Number.isFinite(Number((p as any).min_stock_level)) ? Math.max(0, Number((p as any).min_stock_level)) : 0
        ),
        // Handle both text[] (from DB) and object[] (from state) formats
        images: (p.images || []).map((img: any) => {
          if (typeof img === 'string') {
            return { url: img, alt: '' };
          }
          return { url: img.url || img, alt: img.alt || '' };
        }),
        options: (p.options || []).map((o: any) => ({ name: o.name, values: o.values || [] })),
        variants: (p.variants || []).map((v: any) => ({
          title: v.title || '',
          sku: v.sku || '',
          price: typeof v.price === 'number' ? v.price : 0,
          inventory_quantity: typeof v.inventory_quantity === 'number' ? v.inventory_quantity : 0,
          option1: v.option1 || '',
          option2: v.option2 || '',
          option3: v.option3 || '',
        }))
      });
    } catch {
      toast({ title: 'Error', description: 'Failed to load product for editing', variant: 'destructive' });
    }
  };

  // Image upload handlers
  const uploadInputRef = React.useRef<HTMLInputElement>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const computedStockStatus = useMemo(
    () => deriveStockStatus(formData.stock_quantity, formData.min_stock_level),
    [formData.stock_quantity, formData.min_stock_level]
  );
  const fetchControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setFormData(prev => {
      const newStatus = deriveStockStatus(prev.stock_quantity, prev.min_stock_level);
      if (prev.stock_status === newStatus) {
        return prev;
      }
      return { ...prev, stock_status: newStatus };
    });
  }, [formData.stock_quantity, formData.min_stock_level]);
  const handleImagePick = () => uploadInputRef.current?.click();
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingImage(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('type', 'product');
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.url) {
        const message = data?.error || data?.message || `Upload failed (status ${res.status})`;
        throw new Error(message);
      }
      setFormData(prev => ({ ...prev, images: [...(prev.images || []), { url: data.url }] }));
      toast({ title: 'Image uploaded', description: 'Product image added.' });
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err?.message || 'Could not upload image', variant: 'destructive' });
    } finally {
      setIsUploadingImage(false);
      if (e.target) e.target.value = '';
    }
  };
  const removeImage = (url: string) => {
    setFormData(prev => ({ ...prev, images: (prev.images || []).filter(img => img.url !== url) }));
  };

  // Prioritize product toggle
  const toggleProductPriority = async (productId: string, currentPrioritized: boolean) => {
    try {
      const newPrioritized = !currentPrioritized;
      const updateData: any = {
        prioritized: newPrioritized,
        prioritized_at: newPrioritized ? new Date().toISOString() : null
      };
      const response = await fetch(`/api/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        throw new Error('Failed to update product priority');
      }

      // Update local state
      setProducts(prev => 
        prev.map(product => 
          product.id === productId 
            ? { ...product, prioritized: newPrioritized, prioritized_at: updateData.prioritized_at }
            : product
        )
      );

      toast({
        title: newPrioritized ? 'Product prioritized' : 'Product unprioritized',
        description: newPrioritized 
          ? 'This product will now appear at the top of the list.' 
          : 'This product will now follow normal ordering.',
      });

      // Reload products to see updated ordering
      await fetchProducts();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to update product priority',
        variant: 'destructive',
      });
    }
  };

  const handleCleanupImages = async () => {
    if (!window.confirm('This will remove all blank/invalid images from all products. This action cannot be undone. Continue?')) {
      return;
    }

    setIsCleaningImages(true);
    try {
      const response = await fetch('/api/products/cleanup-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to cleanup images');
      }

      toast({
        title: 'Image Cleanup Complete',
        description: `Processed ${result.totalProducts} products, updated ${result.updatedProducts} products, and removed ${result.cleanedImages} invalid images.`,
      });

      // Reload products to see the updated data
      await fetchProducts();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to cleanup images',
        variant: 'destructive',
      });
    } finally {
      setIsCleaningImages(false);
    }
  };

  // Basic reorder helpers
  const moveImage = (idx: number, dir: -1 | 1) => {
    setFormData(prev => {
      const imgs = [...(prev.images || [])];
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= imgs.length) return prev;
      const [item] = imgs.splice(idx, 1);
      imgs.splice(newIdx, 0, item);
      return { ...prev, images: imgs };
    });
  };
  // Enhanced drag-and-drop area for both files and URLs
  const onDropImages = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files || []).filter(f => f.type.startsWith('image/'));
    const textData = e.dataTransfer.getData('text/plain');
    const htmlData = e.dataTransfer.getData('text/html');
    
    const imageUrls: string[] = [];
    
    // Extract URLs from dropped text/HTML
    if (textData) {
      // Check if it's a direct URL - more flexible pattern matching
      const urlRegex = /https?:\/\/[^\s]+\.(jpg|jpeg|png|webp|gif)(\?[^\s]*)?/gi;
      const urls = textData.match(urlRegex);
      if (urls) {
        imageUrls.push(...urls);
      } else if (textData.startsWith('http') && textData.includes('/')) {
        // Fallback: if it looks like a URL but doesn't have explicit extension
        imageUrls.push(textData);
      }
    }
    
    // Extract image URLs from HTML (when dragging from websites)
    if (htmlData && !imageUrls.length) {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlData, 'text/html');
        const images = doc.querySelectorAll('img');
        images.forEach(img => {
          const src = img.getAttribute('src');
          if (src) {
            // Convert relative URLs to absolute if possible
            if (src.startsWith('http') || src.startsWith('data:')) {
              imageUrls.push(src);
            } else if (src.startsWith('//')) {
              imageUrls.push(`https:${src}`);
            }
          }
        });
        
        // Also try to find URLs in the raw HTML using regex as fallback
        if (!imageUrls.length) {
          const imgTagRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
          let match;
          while ((match = imgTagRegex.exec(htmlData)) !== null) {
            const src = match[1];
            if (src && (src.startsWith('http') || src.startsWith('data:') || src.startsWith('//'))) {
              imageUrls.push(src.startsWith('//') ? `https:${src}` : src);
            }
          }
        }
      } catch (error) {
        console.warn('Error parsing HTML data:', error);
      }
    }
    
    if (!files.length && !imageUrls.length) {
      // Provide helpful feedback about what can be dropped
      const hasText = textData || htmlData;
      if (hasText) {
        toast({ 
          title: 'No images detected', 
          description: 'The dropped content doesn\'t appear to contain image files or image URLs. Try dragging image files or images directly from websites.', 
          variant: 'destructive' 
        });
      } else {
        toast({ 
          title: 'Invalid drop', 
          description: 'Please drop image files from your computer or drag images directly from websites.', 
          variant: 'destructive' 
        });
      }
      return;
    }
    
    setIsUploadingImage(true);
    
    try {
      let successCount = 0;
      
      // Handle file uploads
      for (const file of files) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('type', 'product');
        const res = await fetch('/api/upload', { method: 'POST', body: fd });
        const data = await res.json().catch(() => null);
        if (res.ok && data?.url) {
          successCount++;
          setFormData(prev => ({ ...prev, images: [...(prev.images || []), { url: data.url }] }));
        } else if (!res.ok) {
          const message = data?.error || data?.message || `Upload failed (status ${res.status})`;
          throw new Error(message);
        }
      }
      
      // Handle URL uploads (download and re-upload)
      for (const imageUrl of imageUrls) {
        try {
          // Fetch the image from URL
          const response = await fetch(`/api/upload-from-url`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: imageUrl, type: 'product' })
          });
          
          const data = await response.json();
          
          if (response.ok && data?.url) {
            successCount++;
            setFormData(prev => ({ ...prev, images: [...(prev.images || []), { url: data.url }] }));
          } else {
            console.warn('Failed to upload from URL:', imageUrl, data);
            // Fallback: use the original URL directly (less reliable but still functional)
            setFormData(prev => ({ ...prev, images: [...(prev.images || []), { url: imageUrl }] }));
            successCount++;
          }
        } catch (urlError) {
          console.warn('Error processing URL:', imageUrl, urlError);
          // Fallback: use the original URL directly
          setFormData(prev => ({ ...prev, images: [...(prev.images || []), { url: imageUrl }] }));
          successCount++;
        }
      }
      
      const fileCount = files.length;
      const urlCount = imageUrls.length;
      let message = '';
      if (fileCount > 0 && urlCount > 0) {
        message = `${successCount} image(s) added from files and URLs.`;
      } else if (fileCount > 0) {
        message = `${successCount} image(s) uploaded from files.`;
      } else if (urlCount > 0) {
        message = `${successCount} image(s) added from URLs.`;
      } else {
        message = `${successCount} image(s) added.`;
      }
      toast({ title: 'Images uploaded', description: message });
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err?.message || 'Could not upload images', variant: 'destructive' });
    } finally {
      setIsUploadingImage(false);
    }
  };
  
  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  };
  
  const onDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };
  
  const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    // Only set to false if we're leaving the drop zone entirely
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  // Handle URL input for adding images from web
  const handleAddImageFromUrl = async () => {
    if (!imageUrlInput.trim()) {
      toast({ title: 'Invalid URL', description: 'Please enter a valid image URL.', variant: 'destructive' });
      return;
    }
    
    setIsUploadingImage(true);
    
    try {
      const response = await fetch(`/api/upload-from-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: imageUrlInput.trim(), type: 'product' })
      });
      
      const data = await response.json();
      
      if (response.ok && data?.url) {
        setFormData(prev => ({ ...prev, images: [...(prev.images || []), { url: data.url }] }));
        setImageUrlInput('');
        toast({ title: 'Image added', description: 'Image successfully added from URL.' });
      } else {
        throw new Error(data?.error || 'Failed to add image from URL');
      }
    } catch (error: any) {
      console.warn('Error adding image from URL:', error);
      toast({ title: 'Upload failed', description: error?.message || 'Could not add image from URL', variant: 'destructive' });
    } finally {
      setIsUploadingImage(false);
    }
  };

  const sanitizeOptionValues = (values: string[]) => values.map(v => v.trim()).filter(Boolean);

  const addOption = () => {
    setFormData({
      ...formData,
      options: [...formData.options, { name: '', values: [] }]
    });
  };

  const updateOption = (index: number, field: 'name' | 'values', value: string | string[]) => {
    const newOptions = [...formData.options];
    if (field === 'values' && typeof value === 'string') {
      newOptions[index].values = value.split(',').map(v => v.trimStart());
    } else {
      newOptions[index][field] = value as any;
    }
    setFormData({ ...formData, options: newOptions });
  };

  const removeOption = (index: number) => {
    setFormData({
      ...formData,
      options: formData.options.filter((_, i) => i !== index)
    });
  };

  const generateVariants = () => {
  const option1Values = sanitizeOptionValues(formData.options[0]?.values || []);
  const option2Values = sanitizeOptionValues(formData.options[1]?.values || []);
  const option3Values = sanitizeOptionValues(formData.options[2]?.values || []);

    const variants: any[] = [];

    if (option1Values.length > 0) {
      option1Values.forEach(value1 => {
        if (option2Values.length > 0) {
          option2Values.forEach(value2 => {
            if (option3Values.length > 0) {
              option3Values.forEach(value3 => {
                variants.push({
                  title: `${formData.title} - ${value1} / ${value2} / ${value3}`,
                  sku: `${formData.handle.toUpperCase()}-${value1.substring(0, 3).toUpperCase()}-${value2.substring(0, 3).toUpperCase()}-${value3.substring(0, 3).toUpperCase()}`,
                  price: 0,
                  inventory_quantity: 0,
                  option1: value1,
                  option2: value2,
                  option3: value3
                });
              });
            } else {
              variants.push({
                title: `${formData.title} - ${value1} / ${value2}`,
                sku: `${formData.handle.toUpperCase()}-${value1.substring(0, 3).toUpperCase()}-${value2.substring(0, 3).toUpperCase()}`,
                price: 0,
                inventory_quantity: 0,
                option1: value1,
                option2: value2,
                option3: ''
              });
            }
          });
        } else {
          variants.push({
            title: `${formData.title} - ${value1}`,
            sku: `${formData.handle.toUpperCase()}-${value1.substring(0, 3).toUpperCase()}`,
            price: 0,
            inventory_quantity: 0,
            option1: value1,
            option2: '',
            option3: ''
          });
        }
      });
    }

    setFormData({ ...formData, variants });
  };

  const updateVariant = (index: number, field: string, value: any) => {
    const newVariants = [...formData.variants];
    newVariants[index] = { ...newVariants[index], [field]: value };
    setFormData({ ...formData, variants: newVariants });
  };

  const handleExport = async (templateOnly = false) => {
    try {
      const url = templateOnly ? '/api/products/bulk-edit?template=true' : '/api/products/bulk-edit';
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }
      
      const blob = await response.blob();
      
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = templateOnly ? 'product_template.csv' : `products_bulk_edit_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      // Safe cleanup
      try { (a as any)?.remove?.(); } catch {}
      try { window.URL.revokeObjectURL(downloadUrl); } catch {}
      
      toast({
        title: "Success",
        description: templateOnly ? "Template downloaded successfully" : "Products exported successfully",
      });
    } catch (error) {
      logger.error('Export error:', { error });
      toast({
        title: "Error",
        description: "Export failed",
        variant: "destructive"
      });
    }
  };

  // Delete product logic
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const handleDelete = async (product: Product) => {
    if (!product?.id) return;
    const proceed = window.confirm(`Delete product "${product.title}"? This cannot be undone.`);
    if (!proceed) return;
    setDeletingIds(prev => new Set(prev).add(product.id));
    try {
      const correlationId = (crypto?.randomUUID && crypto.randomUUID()) || Math.random().toString(36).slice(2);
      const res = await fetch(`/api/products?id=${encodeURIComponent(product.id)}`, { method: 'DELETE', headers: { 'x-correlation-id': correlationId } });
      if (res.ok) {
        toast({ title: 'Deleted', description: 'Product removed.' });
        // If we were editing this product, reset form state
        if (selectedProduct?.id === product.id) {
          setEditMode(false);
          setSelectedProduct(null);
          setShowAddForm(false);
        }
        fetchProducts();
      } else {
        let j: any = {}; try { j = await res.json(); } catch {}
        toast({ title: 'Delete failed', description: j.error || 'Unknown error', variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Failed to delete product', variant: 'destructive' });
    } finally {
      setDeletingIds(prev => { const n = new Set(prev); n.delete(product.id); return n; });
    }
  };

  const downloadTemplate = async () => {
    await handleExport(true);
  };

  const handleExportClick = async () => {
    await handleExport(false);
  };

  // Product order is auto-generated based on creation date (first come, first served)
  // No manual ordering needed - products display in the order they were added

  return (
    <div className="min-h-screen bg-transparent p-6 text-slate-200">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-white">Product Management</h1>
            <p className="text-slate-400">Manage your product catalog with variants</p>
          </div>
          <div className="flex space-x-3">
            <Button 
              variant="outline" 
              onClick={downloadTemplate}
              className="flex items-center space-x-2"
            >
              <Download className="h-4 w-4" />
              <span>Download Template</span>
            </Button>
            <Button 
              variant="outline" 
              onClick={handleExportClick}
              className="flex items-center space-x-2"
            >
              <Download className="h-4 w-4" />
              <span>Export</span>
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setShowImportDialog(true)}
              className="flex items-center space-x-2"
            >
              <Upload className="h-4 w-4" />
              <span>Import CSV</span>
            </Button>
            <Button 
              variant="outline" 
              onClick={handleCleanupImages}
              disabled={isCleaningImages}
              className="flex items-center space-x-2"
            >
              {isCleaningImages ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              <span>{isCleaningImages ? 'Cleaning...' : 'Cleanup Images'}</span>
            </Button>
            <Button 
              onClick={startAddNew}
              className="flex items-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>Add Product</span>
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Package className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-slate-400">Total Products</p>
                  <p className="text-2xl font-bold text-white">{products.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <ShoppingCart className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-slate-400">Active Products</p>
                  <p className="text-2xl font-bold text-white">
                    {products.filter(p => p.status === 'active').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Tag className="h-8 w-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-slate-400">Total Variants</p>
                  <p className="text-2xl font-bold text-white">
                    {products.reduce((acc, p) => acc + (p.variants?.length || 0), 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Image className="h-8 w-8 text-orange-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-slate-400">Draft Products</p>
                  <p className="text-2xl font-bold text-white">
                    {products.filter(p => p.status === 'draft').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        {showAddForm ? (
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>{editMode ? 'Edit Product' : 'Add New Product'}</CardTitle>
                  <CardDescription>{editMode ? 'Update product details and variants' : 'Create a new product with variants and options'}</CardDescription>
                </div>
                <Button variant="outline" onClick={() => { setShowAddForm(false); setEditMode(false); setSelectedProduct(null); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="basic" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="basic">Basic Info</TabsTrigger>
                  <TabsTrigger value="options">Options</TabsTrigger>
                  <TabsTrigger value="variants">Variants</TabsTrigger>
                  <TabsTrigger value="images">Images</TabsTrigger>
                </TabsList>
                
                <TabsContent value="basic" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="handle">Handle *</Label>
                      <Input
                        id="handle"
                        value={formData.handle}
                        onChange={(e) => setFormData({...formData, handle: e.target.value})}
                        placeholder="e.g., del123"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="title">Title *</Label>
                      <Input
                        id="title"
                        value={formData.title}
                        onChange={(e) => setFormData({...formData, title: e.target.value})}
                        placeholder="e.g., Mouse M16"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="vendor">Vendor</Label>
                      <Input
                        id="vendor"
                        value={formData.vendor}
                        onChange={(e) => setFormData({...formData, vendor: e.target.value})}
                        placeholder="e.g., TechBrand"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="product_type">Product Type</Label>
                      <Input
                        id="product_type"
                        value={formData.product_type}
                        onChange={(e) => setFormData({...formData, product_type: e.target.value})}
                        placeholder="e.g., Electronics"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tags">Tags (comma separated)</Label>
                      <Input
                        id="tags"
                        value={formData.tags}
                        onChange={(e) => setFormData({...formData, tags: e.target.value})}
                        placeholder="e.g., mouse, gaming, wireless"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="status">Status</Label>
                      <select
                        id="status"
                        value={formData.status}
                        onChange={(e) => setFormData({...formData, status: e.target.value as any})}
                        className="w-full p-2 border rounded-md"
                      >
                        <option value="active">Active</option>
                        <option value="draft">Draft</option>
                        <option value="archived">Archived</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="mrp">MRP (Maximum Retail Price)</Label>
                      <Input
                        id="mrp"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.mrp}
                        onChange={(e) => setFormData({...formData, mrp: parseFloat(e.target.value) || 0})}
                        placeholder="e.g., 1999.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="price">Sale Price</Label>
                      <Input
                        id="price"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.price}
                        onChange={(e) => setFormData({...formData, price: parseFloat(e.target.value) || 0})}
                        placeholder="e.g., 1599.00"
                      />
                      <p className="text-xs text-muted-foreground">
                        Sale price should be less than or equal to MRP
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="hsnCode">HSN / SAC Code</Label>
                      <Input
                        id="hsnCode"
                        value={formData.hsnCode}
                        onChange={(e) => setFormData({ ...formData, hsnCode: e.target.value })}
                        placeholder="e.g., 85183000"
                      />
                      <p className="text-xs text-muted-foreground">
                        Enter the product-specific HSN/SAC identifier for invoicing.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="stock_quantity">Stock Quantity</Label>
                      <Input
                        id="stock_quantity"
                        type="number"
                        min="0"
                        value={formData.stock_quantity}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            stock_quantity: Math.max(0, parseInt(e.target.value, 10) || 0),
                          })
                        }
                        placeholder="e.g., 25"
                      />
                      <p className="text-xs text-muted-foreground">
                        Used across storefront, cart, and inventory modules.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="min_stock_level">Minimum Stock Threshold</Label>
                      <Input
                        id="min_stock_level"
                        type="number"
                        min="0"
                        value={formData.min_stock_level}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            min_stock_level: Math.max(0, parseInt(e.target.value, 10) || 0),
                          })
                        }
                        placeholder="e.g., 5"
                      />
                      <p className="text-xs text-muted-foreground">
                        Trigger low-stock alerts when quantity falls below this level.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="max_stock_level">Maximum Stock Target</Label>
                      <Input
                        id="max_stock_level"
                        type="number"
                        min="0"
                        value={formData.max_stock_level}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            max_stock_level: Math.max(0, parseInt(e.target.value, 10) || 0),
                          })
                        }
                        placeholder="e.g., 100"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Stock Status</Label>
                      <div className="border border-white/10 rounded-md p-3 bg-slate-900/60">
                        <Badge
                          variant={
                            computedStockStatus === 'in_stock'
                              ? 'default'
                              : computedStockStatus === 'low_stock'
                                ? 'secondary'
                                : computedStockStatus === 'out_of_stock'
                                  ? 'destructive'
                                  : 'outline'
                          }
                        >
                          {computedStockStatus.replace(/_/g, ' ')}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-2">
                          Automatically calculated based on stock quantity and minimum threshold.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor="description">Description</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleGenerateDescription}
                        disabled={isGeneratingDescription || !selectedProduct}
                      >
                        {isGeneratingDescription ? (
                          <>
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                            Generating
                          </>
                        ) : (
                          <>
                            <Sparkles className="mr-2 h-4 w-4" />
                            Generate with AI
                          </>
                        )}
                      </Button>
                    </div>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      placeholder="Product description..."
                      rows={4}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="options" className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Product Options</h3>
                    <Button onClick={addOption} variant="outline">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Option
                    </Button>
                  </div>
                  
                  {formData.options.map((option, index) => (
                    <Card key={index}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start space-x-4">
                          <div className="flex-1 space-y-2">
                            <Label>Option Name</Label>
                            <Input
                              value={option.name}
                              onChange={(e) => updateOption(index, 'name', e.target.value)}
                              placeholder="e.g., Color, Size"
                            />
                          </div>
                          <div className="flex-1 space-y-2">
                            <Label>Values (comma separated)</Label>
                            <Input
                              value={option.values.join(', ')}
                              onChange={(e) => updateOption(index, 'values', e.target.value)}
                              placeholder="e.g., Black, White, Blue"
                            />
                          </div>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => removeOption(index)}
                            className="mt-6"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  
                  {formData.options.length > 0 && (
                    <Button onClick={generateVariants} className="w-full">
                      Generate Variants from Options
                    </Button>
                  )}
                </TabsContent>

                <TabsContent value="variants" className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Product Variants</h3>
                    <Badge variant="secondary">{formData.variants.length} variants</Badge>
                  </div>
                  
                  {formData.variants.length > 0 ? (
                    <div className="space-y-3">
                      {formData.variants.map((variant, index) => (
                        <Card key={index}>
                          <CardContent className="p-4">
                            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                              <div className="space-y-2">
                                <Label>Title</Label>
                                <Input
                                  value={variant.title}
                                  onChange={(e) => updateVariant(index, 'title', e.target.value)}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>SKU</Label>
                                <Input
                                  value={variant.sku}
                                  onChange={(e) => updateVariant(index, 'sku', e.target.value)}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Price</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={variant.price}
                                  onChange={(e) => updateVariant(index, 'price', parseFloat(e.target.value) || 0)}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Inventory</Label>
                                <Input
                                  type="number"
                                  value={variant.inventory_quantity}
                                  onChange={(e) => updateVariant(index, 'inventory_quantity', parseInt(e.target.value) || 0)}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Options</Label>
                                <div className="text-sm text-slate-400">
                                  {[variant.option1, variant.option2, variant.option3].filter(Boolean).join(' / ')}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-500">
                      No variants created yet. Add options first, then generate variants.
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="images" className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Product Images</h3>
                    <div className="flex items-center gap-3">
                      <input ref={uploadInputRef} onChange={handleImageChange} type="file" accept="image/*" className="hidden" />
                      <Button onClick={handleImagePick} disabled={isUploadingImage}>
                        <Upload className="h-4 w-4 mr-2" />
                        {isUploadingImage ? 'Uploading...' : 'Add Image'}
                      </Button>
                    </div>
                  </div>
                  <div 
                    onDrop={onDropImages} 
                    onDragOver={onDragOver} 
                    onDragEnter={onDragEnter}
                    onDragLeave={onDragLeave}
                    className={`border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 ${
                      isDragOver 
                        ? 'border-cyan-400 bg-cyan-500/10 scale-105' 
                        : 'border-slate-600 hover:border-cyan-400 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex flex-col items-center space-y-2">
                      {isUploadingImage ? (
                        <>
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-300"></div>
                          <div className="text-sm font-medium text-cyan-200">
                            Uploading images...
                          </div>
                        </>
                      ) : (
                        <>
                          <Upload className={`h-8 w-8 ${isDragOver ? 'text-cyan-200' : 'text-cyan-300'}`} />
                          <div className="text-sm font-medium text-slate-200">
                            {isDragOver ? 'Drop images here!' : 'Drag & drop images here to upload'}
                          </div>
                          <div className="text-xs text-slate-400 space-y-1">
                            <div>• Drop image files from your computer</div>
                            <div>• Or drag images directly from websites</div>
                            <div>• Supports JPG, PNG, WebP, and GIF formats</div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  
                  {/* URL Input Alternative */}
                  <div className="border border-white/10 rounded-lg p-4 bg-slate-900/60">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm font-medium">Add from URL</Label>
                      <span className="text-xs text-slate-500">Alternative method</span>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        placeholder="https://example.com/image.jpg"
                        value={imageUrlInput}
                        onChange={(e) => setImageUrlInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddImageFromUrl();
                          }
                        }}
                        onPaste={(e) => {
                          // Auto-detect pasted URLs and add them
                          setTimeout(() => {
                            const pastedText = e.currentTarget.value;
                            if (pastedText.startsWith('http') && /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(pastedText)) {
                              handleAddImageFromUrl();
                            }
                          }, 100);
                        }}
                        disabled={isUploadingImage}
                        className="flex-1"
                      />
                      <Button 
                        onClick={handleAddImageFromUrl} 
                        disabled={isUploadingImage || !imageUrlInput.trim()}
                        size="sm"
                      >
                        Add Image
                      </Button>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Enter the direct URL of an image to add it to your product
                    </p>
                  </div>
                  
                  {formData.images && formData.images.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                      {formData.images.map((img, idx) => (
                        <div key={idx} className="relative border rounded overflow-hidden group">
                          { }
                          <img src={img.url} alt={img.alt || `Image ${idx + 1}`} className="w-full h-32 object-cover" />
                          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100">
                            <button type="button" onClick={() => moveImage(idx, -1)} className="bg-black/60 text-white text-xs px-2 py-1 rounded">Up</button>
                            <button type="button" onClick={() => moveImage(idx, 1)} className="bg-black/60 text-white text-xs px-2 py-1 rounded">Down</button>
                            <button type="button" onClick={() => removeImage(img.url)} className="bg-red-600/80 text-white text-xs px-2 py-1 rounded">Remove</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-slate-500">No images yet. Upload product images to showcase the item.</div>
                  )}
                </TabsContent>
              </Tabs>
              
              <div className="flex justify-end space-x-3 mt-6 pt-6 border-t">
                <Button variant="outline" onClick={() => { setShowAddForm(false); setEditMode(false); setSelectedProduct(null); }}>
                  Cancel
                </Button>
                <Button onClick={handleSaveProduct} disabled={isSaving}>
                  <Save className="h-4 w-4 mr-2" />
                  {editMode ? 'Update Product' : 'Save Product'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Product Catalog</CardTitle>
              <CardDescription>Manage all your products and variants</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex w-full max-w-xl items-center gap-2">
                  <div className="relative w-full">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <Input
                      placeholder="Search products by name, handle, or description"
                      value={searchQuery}
                      onChange={(event) => {
                        setPage(1);
                        setSearchQuery(event.target.value);
                      }}
                      className="pl-9"
                    />
                  </div>
                  {searchQuery && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Clear search"
                      onClick={() => {
                        setPage(1);
                        setSearchQuery('');
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={fetchProducts}
                  disabled={loading}
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
              {loading ? (
                <div className="flex justify-center py-8">
                  <RefreshCw className="h-8 w-8 animate-spin text-slate-500" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">Order</TableHead>
                      <TableHead className="w-20">Priority</TableHead>
                      <TableHead>Handle</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Variants</TableHead>
                      <TableHead>Options</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((product, index) => (
                      <TableRow key={product.id}>
                        <TableCell>
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-lg font-semibold text-cyan-300">
                              {totalItems - ((page - 1) * limit) - index}
                            </span>
                            <span className="text-xs text-slate-500">
                              Auto Order
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col items-center gap-1">
                            <Button
                              variant={product.prioritized ? "default" : "outline"}
                              size="sm"
                              onClick={() => toggleProductPriority(product.id, product.prioritized || false)}
                              className={`text-xs px-2 py-1 h-7 ${
                                product.prioritized 
                                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-900' 
                                  : 'border-amber-500/40 text-amber-300 hover:bg-amber-500/10'
                              }`}
                            >
                              {product.prioritized ? '⭐ Priority' : '☆ Prioritize'}
                            </Button>
                            {product.prioritized && product.prioritized_at && (
                              <span className="text-xs text-slate-500">
                                {new Date(product.prioritized_at).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{product.handle}</TableCell>
                        <TableCell className="font-medium">{product.title}</TableCell>
                        <TableCell>{product.vendor}</TableCell>
                        <TableCell>{product.product_type}</TableCell>
                        <TableCell>
                          <Badge variant={
                            product.status === 'active' ? 'default' :
                            product.status === 'draft' ? 'secondary' : 'outline'
                          }>
                            {product.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {product.variants?.length || 0} variants
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {product.options?.map((option: ProductOption, i: number) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                {option.name}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button size="sm" variant="outline">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleEdit(product)}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="destructive" disabled={deletingIds.has(product.id)} onClick={() => handleDelete(product)}>
                              {deletingIds.has(product.id) ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {/* Pagination controls */}
              {!showAddForm && (
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mt-6">
                  <div className="text-sm text-slate-400">
                    Page {page} of {totalPages} • {totalItems} items
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-slate-400 hidden md:block">Rows:</label>
                    <select
                      className="border rounded px-2 py-1 text-sm"
                      value={limit}
                      onChange={(e) => { setPage(1); setLimit(parseInt(e.target.value) || 20); }}
                    >
                      {[10,20,50,100].map(sz => (<option key={sz} value={sz}>{sz}</option>))}
                    </select>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page <= 1 || loading}
                    >
                      Prev
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages || loading}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
      
      {/* CSV Import Dialog */}
      <CSVImportDialog 
        isOpen={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        onSuccess={() => {
          fetchProducts();
          setShowImportDialog(false);
        }}
      />
    </div>
  );
}
