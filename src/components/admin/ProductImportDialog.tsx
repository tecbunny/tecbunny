'use client';

import * as React from 'react';

import { Upload, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '../../hooks/use-toast';
import { logger } from '@/lib/logger';

interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

interface ImportResult {
  imported: number;
  errors: Array<{
    row: number;
    field: string;
    message: string;
  }>;
}

export function ProductImportDialog({ isOpen, onClose, onImportComplete }: ImportDialogProps) {
  const [isImporting, setIsImporting] = React.useState(false);
  const [importResult, setImportResult] = React.useState<ImportResult | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch('/api/products/template');
      if (!response.ok) throw new Error('Template download failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'product-import-template.csv';
      document.body.appendChild(a);
      a.click();
      // Safe cleanup
      try {
        if (typeof (a as any).remove === 'function') {
          (a as any).remove();
        } else if (a && a.parentNode) {
          a.parentNode.removeChild(a);
        }
      } finally {
        try { window.URL.revokeObjectURL(url); } catch {}
      }
      
      toast({
        title: "Template Downloaded",
        description: "Import template has been downloaded successfully.",
      });
    } catch (error) {
      logger.error('Template download error in ProductImportDialog', { error });
      toast({
        title: "Download Failed",
        description: "Failed to download template. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/products/csv', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Import failed');
      }

      setImportResult(result);

      if (result.imported > 0) {
        toast({
          title: "Import Completed",
          description: `${result.imported} products imported successfully.`,
        });
        onImportComplete();
      }

      if (result.errors && result.errors.length > 0) {
        toast({
          title: "Import Warnings",
          description: `${result.errors.length} rows had errors and were skipped.`,
          variant: "destructive",
        });
      }
    } catch (error) {
      logger.error('Import error in ProductImportDialog', { error });
      toast({
        title: "Import Failed",
        description: error instanceof Error ? error.message : "Failed to import products. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleClose = () => {
    setImportResult(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Products</DialogTitle>
          <DialogDescription>
            Upload a CSV file to import products into your catalog. Follow the template format for best results.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Step 1: Download Template */}
          <div className="border rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-sm">
                  1
                </div>
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-sm mb-2">Download Import Template</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Start by downloading our CSV template with the correct format and sample data.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadTemplate}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Download Template
                </Button>
              </div>
            </div>
          </div>

          {/* Step 2: Prepare Your Data */}
          <div className="border rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-sm">
                  2
                </div>
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-sm mb-2">Prepare Your Data</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Fill in the template with your product data. Required fields: name, price, category.
                </p>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>• Keep the header row unchanged</div>
                  <div>• Use "true" or "false" for boolean fields</div>
                  <div>• Use decimal format for prices (e.g., 1999.00)</div>
                  <div>• Leave optional fields empty if not applicable</div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 3: Upload File */}
          <div className="border rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-sm">
                  3
                </div>
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-sm mb-2">Upload Your CSV File</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Select your completed CSV file to import products.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileImport}
                  style={{ display: 'none' }}
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isImporting}
                  size="sm"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {isImporting ? 'Importing...' : 'Choose CSV File'}
                </Button>
              </div>
            </div>
          </div>

          {/* Import Results */}
          {importResult && (
            <div className="border rounded-lg p-4">
              <h3 className="font-medium text-sm mb-3">Import Results</h3>
              
              {importResult.imported > 0 && (
                <div className="flex items-center space-x-2 text-green-600 mb-2">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-sm">{importResult.imported} products imported successfully</span>
                </div>
              )}

              {importResult.errors && importResult.errors.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center space-x-2 text-orange-600">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm">{importResult.errors.length} rows had errors and were skipped</span>
                  </div>
                  
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {importResult.errors.slice(0, 5).map((error, index) => (
                      <div key={index} className="text-xs text-muted-foreground bg-orange-50 p-2 rounded">
                        Row {error.row}, {error.field}: {error.message}
                      </div>
                    ))}
                    {importResult.errors.length > 5 && (
                      <div className="text-xs text-muted-foreground">
                        ... and {importResult.errors.length - 5} more errors
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={handleClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}