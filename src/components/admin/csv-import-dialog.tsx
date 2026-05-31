'use client';

import { useState } from 'react';

import { 
  Upload, 
  Download, 
  FileText, 
  Package, 
  CheckCircle,
  Clock
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '../../hooks/use-toast';

import { logger } from '@/lib/logger';

interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CSVImportDialog({ isOpen, onClose, onSuccess }: ImportDialogProps) {
  const [importing, setImporting] = useState(false);
  const [importType, setImportType] = useState<'simple' | 'bulk'>('simple');
  const [importResult, setImportResult] = useState<any>(null);
  const { toast } = useToast();

  const handleFileImport = async (file: File, type: 'simple' | 'bulk') => {
    try {
      setImporting(true);
      setImportResult(null);
      
      const formData = new FormData();
      formData.append('file', file);
      
      const endpoint = type === 'simple' ? '/api/products/simple-import' : '/api/products/bulk-edit';
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Import failed');
      }
      
      setImportResult(result);
      
      toast({
        title: "Import Complete",
        description: result.message,
      });
      
      // Call success callback to refresh products
      onSuccess();
      
    } catch (error) {
      logger.error('CSV import error', { error, importType, context: 'CSVImportDialog.handleFileImport' });
      toast({
        title: "Import Error",
        description: (error as Error).message,
        variant: "destructive"
      });
    } finally {
      setImporting(false);
    }
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>, type: 'simple' | 'bulk') => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileImport(file, type);
    }
    // Reset the input
    event.target.value = '';
  };

  const downloadTemplate = (type: 'simple' | 'bulk') => {
    if (type === 'simple') {
      // Create simple CSV template
      const headers = [
        'Handle ID', 'Type', 'Title', 'Brand', 'Description', 
        'Product Detail', 'Image Link', 'Warranty Details', 
        'Stock Status', 'Status'
      ];
      
      const sampleData = [
        [
          'PROD001', 'Product', 'Sample Product Title', 'TecBunny', 
          'Short product description here', 
          '<h3>Product Features</h3><ul><li>Feature 1</li><li>Feature 2</li></ul>',
          'https://example.com/image.jpg', '1 Year Manufacturer Warranty', 
          'In Stock', 'Active'
        ],
        [
          'PROD001', 'Variant', 'Sample Product - Red', 'TecBunny', 
          'Red variant of the sample product', 
          '<p>Same features in <strong>Red color</strong></p>',
          'https://example.com/image-red.jpg', '1 Year Manufacturer Warranty', 
          'In Stock', 'Active'
        ]
      ];
      
      const csvContent = [headers, ...sampleData]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'simple-product-template.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      // For bulk edit, trigger existing template download
      // This would need to be implemented based on your existing bulk edit system
      toast({
        title: "Download Template",
        description: "Bulk edit template download - implement based on existing system",
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Products from CSV
          </CardTitle>
          <CardDescription>
            Choose your import method and upload a CSV file to add products to your catalog
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={importType} onValueChange={(value) => setImportType(value as 'simple' | 'bulk')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="simple" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Simple Import
              </TabsTrigger>
              <TabsTrigger value="bulk" className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                Bulk Edit Import
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="simple" className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">Simple Import Format</h4>
                <p className="text-sm text-blue-700">
                  Use this format for easy product imports with just 10 essential columns:
                </p>
                <ul className="text-sm text-blue-700 mt-2 list-disc list-inside">
                  <li>Handle ID, Type, Title, Brand, Description</li>
                  <li>Product Detail (HTML allowed), Image Link, Warranty</li>
                  <li>Stock Status, Status (Active/Inactive)</li>
                </ul>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => downloadTemplate('simple')}
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download Template
                </Button>
                
                <div className="flex-1">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => handleFileInputChange(e, 'simple')}
                    className="hidden"
                    id="simple-import-file"
                  />
                  <Button 
                    onClick={() => document.getElementById('simple-import-file')?.click()}
                    disabled={importing}
                    className="w-full flex items-center gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    {importing ? 'Importing...' : 'Upload CSV File'}
                  </Button>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="bulk" className="space-y-4">
              <div className="bg-orange-50 p-4 rounded-lg">
                <h4 className="font-medium text-orange-900 mb-2">Bulk Edit Import</h4>
                <p className="text-sm text-orange-700">
                  Use this for advanced product management with full Shopify-compatible format including variants, options, and detailed specifications.
                </p>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => downloadTemplate('bulk')}
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download Template
                </Button>
                
                <div className="flex-1">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => handleFileInputChange(e, 'bulk')}
                    className="hidden"
                    id="bulk-import-file"
                  />
                  <Button 
                    onClick={() => document.getElementById('bulk-import-file')?.click()}
                    disabled={importing}
                    className="w-full flex items-center gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    {importing ? 'Importing...' : 'Upload CSV File'}
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
          
          {importing && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg flex items-center gap-3">
              <Clock className="h-5 w-5 text-blue-600 animate-spin" />
              <div>
                <p className="font-medium text-blue-900">Processing CSV file...</p>
                <p className="text-sm text-blue-700">Please wait while we import your products</p>
              </div>
            </div>
          )}
          
          {importResult && (
            <div className="mt-4 p-4 bg-green-50 rounded-lg">
              <div className="flex items-center gap-3 mb-3">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <h4 className="font-medium text-green-900">Import Results</h4>
              </div>
              <div className="space-y-2">
                <div className="flex gap-4">
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    ✅ Success: {importResult.details?.successCount || 0}
                  </Badge>
                  {importResult.details?.errorCount > 0 && (
                    <Badge variant="destructive">
                      ❌ Errors: {importResult.details.errorCount}
                    </Badge>
                  )}
                </div>
                {importResult.details?.errors && importResult.details.errors.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm font-medium text-gray-700 mb-1">Errors:</p>
                    <ul className="text-sm text-red-600 list-disc list-inside">
                      {importResult.details.errors.map((error: string, index: number) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
          
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}