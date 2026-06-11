'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

export const SingleImageUploader = ({ 
  value, 
  onChange,
  type
}: { 
  value: string; 
  onChange: (newValue: string) => void;
  type: 'logo' | 'favicon' | 'general';
}) => {
  const [uploading, setUploading] = React.useState(false);
  const { toast } = useToast();

  const handleFileChange = async (file: File) => {
    setUploading(true);
    try {
      if (!file.type.startsWith('image/')) {
        throw new Error('Please select a valid image file');
      }
      if (file.size > 4 * 1024 * 1024) {
        throw new Error('File size must be less than 4MB');
      }
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);
      
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
      
      onChange(imageUrl);
      toast({
        title: 'Upload successful',
        description: 'Image uploaded to storage successfully. Click Save to persist the change.',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({
        variant: 'destructive',
        title: 'Upload failed',
        description: `Failed to upload image: ${errorMessage}`,
      });
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-4 mt-2">
      <div className="w-16 h-16 rounded border bg-slate-950 flex items-center justify-center overflow-hidden shrink-0">
        {value ? (
          <img src={value} alt="Preview" className="w-full h-full object-contain" />
        ) : (
          <span className="text-xs text-muted-foreground font-mono">None</span>
        )}
      </div>
      <div className="flex flex-col gap-1 w-full max-w-xs">
        <Input
          type="file"
          accept="image/*"
          className="text-xs h-8 py-1 px-2 border-white/10 bg-slate-950/80 text-slate-100"
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileChange(file);
          }}
        />
        {uploading && <span className="text-[10px] text-amber-400 animate-pulse">Uploading...</span>}
      </div>
    </div>
  );
};
