'use client';

import * as React from 'react';
import { Trash, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export const parsePartnerBrands = (raw: string | undefined): Array<{ name: string; logoUrl: string }> => {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map(item => ({
          name: typeof item === 'object' && item?.name ? String(item.name) : '',
          logoUrl: typeof item === 'object' && item?.logoUrl ? String(item.logoUrl) : '',
        }));
      }
    } catch (e) {
      console.error('Failed to parse partnerBrands JSON:', e);
    }
  }
  // Fallback to comma-separated list
  return trimmed
    .split(',')
    .map(b => b.trim())
    .filter(Boolean)
    .map(name => ({ name, logoUrl: '' }));
};

export const PartnerBrandsEditor = ({ 
  value, 
  onChange, 
}: { 
  value: string; 
  onChange: (newValue: string) => void;
}) => {
  const brands = React.useMemo(() => parsePartnerBrands(value), [value]);
  const [uploadingIndex, setUploadingIndex] = React.useState<number | null>(null);
  const { toast } = useToast();

  const handleNameChange = (index: number, name: string) => {
    const updated = [...brands];
    updated[index] = { ...updated[index], name };
    onChange(JSON.stringify(updated));
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

  const handleFileChange = async (index: number, file: File) => {
    setUploadingIndex(index);
    try {
      const url = await uploadBrandFile(file);
      const updated = [...brands];
      updated[index] = { ...updated[index], logoUrl: url };
      onChange(JSON.stringify(updated));
    } catch (err) {
      console.error(err);
    } finally {
      setUploadingIndex(null);
    }
  };

  const handleDelete = (index: number) => {
    const updated = brands.filter((_, i) => i !== index);
    onChange(JSON.stringify(updated));
  };

  const handleAdd = () => {
    const updated = [...brands, { name: '', logoUrl: '' }];
    onChange(JSON.stringify(updated));
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {brands.map((brand: any, index: number) => (
          <div key={index} className="flex flex-col md:flex-row items-start md:items-center gap-4 p-4 rounded-lg border bg-slate-900/50">
            {/* Logo Preview and Upload */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded border bg-slate-950 flex items-center justify-center overflow-hidden shrink-0">
                {brand.logoUrl ? (
                  <img src={brand.logoUrl} alt={brand.name || "Brand logo"} className="w-full h-full object-contain" />
                ) : (
                  <span className="text-xs text-muted-foreground font-mono">No Logo</span>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <Input
                  type="file"
                  accept="image/*"
                  className="max-w-[200px] text-xs h-8 py-1 px-2"
                  disabled={uploadingIndex !== null}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileChange(index, file);
                  }}
                />
                {uploadingIndex === index && <span className="text-[10px] text-amber-400 animate-pulse">Uploading...</span>}
              </div>
            </div>

            {/* Brand Name Input */}
            <div className="flex-1 w-full">
              <Input
                placeholder="Brand Name (e.g. CP PLUS)"
                value={brand.name}
                onChange={(e) => handleNameChange(index, e.target.value)}
              />
            </div>

            {/* Delete button */}
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={() => handleDelete(index)}
            >
              <Trash className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <Button type="button" variant="outline" onClick={handleAdd} className="w-full flex items-center justify-center gap-2">
        <Plus className="h-4 w-4" /> Add Product Brand
      </Button>
    </div>
  );
};
