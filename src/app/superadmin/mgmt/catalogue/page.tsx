'use client';

import * as React from 'react';
import { 
  FileDown, 
  Loader2, 
  Sparkles, 
  CheckSquare, 
  Square, 
  Settings, 
  Layers, 
  DollarSign, 
  Info,
  Check
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { logger } from '@/lib/logger';

interface CatalogueItem {
  id: string;
  name: string;
  title?: string;
  description?: string;
  price: number;
  mrp?: number;
  category: string;
  brand?: string;
  isProduct: boolean;
}

export default function CatalogueManagementPage() {
  const [products, setProducts] = React.useState<CatalogueItem[]>([]);
  const [services, setServices] = React.useState<CatalogueItem[]>([]);
  const [loadingData, setLoadingData] = React.useState(true);
  const [generating, setGenerating] = React.useState(false);

  // Filter and selection states
  const [selectedProductIds, setSelectedProductIds] = React.useState<Set<string>>(new Set());
  const [selectedServiceIds, setSelectedServiceIds] = React.useState<Set<string>>(new Set());
  const [includePricing, setIncludePricing] = React.useState(true);

  const { toast } = useToast();

  // Load data
  React.useEffect(() => {
    async function loadData() {
      try {
        setLoadingData(true);
        const [prodRes, servRes] = await Promise.all([
          fetch('/api/admin/products?limit=250', { cache: 'no-store' }),
          fetch('/api/admin/services', { cache: 'no-store' })
        ]);

        if (!prodRes.ok || !servRes.ok) {
          throw new Error('Failed to fetch product/service inventory');
        }

        const prodData = await prodRes.json();
        const servData = await servRes.json();

        const loadedProds: CatalogueItem[] = (prodData.products || [])
          .filter((p: any) => p.status === 'active')
          .map((p: any) => ({
            id: p.id,
            name: p.name || p.title || 'Unnamed Product',
            title: p.title || p.name || 'Unnamed Product',
            description: p.description || '',
            price: p.price || 0,
            mrp: p.mrp || 0,
            category: p.category || 'Hardware',
            brand: p.brand || '',
            isProduct: true
          }));

        const loadedServs: CatalogueItem[] = (servData.services || [])
          .filter((s: any) => s.is_active !== false)
          .map((s: any) => ({
            id: s.id,
            name: s.name || s.title || 'Unnamed Service',
            title: s.title || s.name || 'Unnamed Service',
            description: s.description || '',
            price: s.price || 0,
            mrp: s.mrp || 0,
            category: s.category || 'Services',
            brand: '',
            isProduct: false
          }));

        setProducts(loadedProds);
        setServices(loadedServs);

        // Pre-select all by default for convenience
        setSelectedProductIds(new Set(loadedProds.map(p => p.id)));
        setSelectedServiceIds(new Set(loadedServs.map(s => s.id)));

      } catch (err: any) {
        logger.error('Catalogue inventory loading error:', { err });
        toast({
          title: 'Inventory Alert',
          description: err?.message || 'Could not fetch catalog inventory.',
          variant: 'destructive',
        });
      } finally {
        setLoadingData(false);
      }
    }

    loadData();
  }, [toast]);

  // Derived states
  const allItems = [...products, ...services];
  const categories = Array.from(new Set(allItems.map(item => item.category)));

  // Toggle helpers
  const handleProductToggle = (id: string) => {
    setSelectedProductIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleServiceToggle = (id: string) => {
    setSelectedServiceIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAllInCategory = (category: string) => {
    const categoryProds = products.filter(p => p.category === category);
    const categoryServs = services.filter(s => s.category === category);

    setSelectedProductIds(prev => {
      const next = new Set(prev);
      categoryProds.forEach(p => next.add(p.id));
      return next;
    });

    setSelectedServiceIds(prev => {
      const next = new Set(prev);
      categoryServs.forEach(s => next.add(s.id));
      return next;
    });
  };

  const deselectAllInCategory = (category: string) => {
    const categoryProds = products.filter(p => p.category === category);
    const categoryServs = services.filter(s => s.category === category);

    setSelectedProductIds(prev => {
      const next = new Set(prev);
      categoryProds.forEach(p => next.delete(p.id));
      return next;
    });

    setSelectedServiceIds(prev => {
      const next = new Set(prev);
      categoryServs.forEach(s => next.delete(s.id));
      return next;
    });
  };

  const selectAllGlobal = () => {
    setSelectedProductIds(new Set(products.map(p => p.id)));
    setSelectedServiceIds(new Set(services.map(s => s.id)));
  };

  const deselectAllGlobal = () => {
    setSelectedProductIds(new Set());
    setSelectedServiceIds(new Set());
  };

  // Trigger generator endpoint
  const handleDownload = async () => {
    if (selectedProductIds.size === 0 && selectedServiceIds.size === 0) {
      toast({
        title: 'Empty Catalog',
        description: 'Choose at least one product or service to generate PDF.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setGenerating(true);

      const activeCategories = categories.filter(cat => {
        const catProds = products.filter(p => p.category === cat);
        const catServs = services.filter(s => s.category === cat);
        return catProds.some(p => selectedProductIds.has(p.id)) || 
               catServs.some(s => selectedServiceIds.has(s.id));
      });

      const response = await fetch('/api/superadmin/catalogue/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          categories: activeCategories,
          productIds: Array.from(selectedProductIds),
          serviceIds: Array.from(selectedServiceIds),
          includePricing
        })
      });

      if (!response.ok) {
        throw new Error(`PDF Generation failed with status: ${response.status}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `catalogue-${new Date().toISOString().split('T')[0]}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Catalogue Ready',
        description: 'Your beautiful PDF catalogue has been downloaded.',
      });

    } catch (err: any) {
      logger.error('Catalogue download exception:', { err });
      toast({
        title: 'Export Failed',
        description: err?.message || 'Failed to generate catalogue.',
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  };

  if (loadingData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <p className="text-zinc-400 font-mono text-xs animate-pulse">LOADING CATALOG DATA...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <div className="flex items-center gap-2 text-primary text-xs font-mono mb-1.5 uppercase tracking-wider">
            <Sparkles className="h-3.5 w-3.5" />
            Superadmin Studio
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white">Catalogue Builder</h2>
          <p className="text-zinc-400 text-sm mt-1">
            Generate and export custom product and service guides styled dynamically as tech brochures.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={selectAllGlobal}
            className="text-xs font-semibold border-zinc-800 hover:bg-zinc-800"
          >
            Select All
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={deselectAllGlobal}
            className="text-xs font-semibold border-zinc-800 hover:bg-zinc-800"
          >
            Deselect All
          </Button>
          <Button
            onClick={handleDownload}
            disabled={generating}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs shadow-lg shadow-primary/20 px-4"
          >
            {generating ? (
              <>
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FileDown className="mr-2 h-3.5 w-3.5" />
                Build PDF
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Bento Grid Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Settings Bento Card */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="bg-zinc-950 border-zinc-800/80 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl" />
            <CardHeader className="border-b border-zinc-800/60 pb-4">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-white">
                <Settings className="h-4 w-4 text-primary" />
                Configurations
              </CardTitle>
              <CardDescription className="text-xs text-zinc-400">
                Adjust export content and parameters
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-5 space-y-5">
              
              {/* Pricing Switch */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/60">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                    <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                    Include Pricing
                  </div>
                  <p className="text-[10px] text-zinc-500">Show sale price & MRP in PDF cards</p>
                </div>
                <Switch 
                  checked={includePricing} 
                  onCheckedChange={setIncludePricing}
                  className="data-[state=checked]:bg-primary"
                />
              </div>

              {/* Scope & Counter Info */}
              <div className="p-4 rounded-lg bg-zinc-900/40 border border-zinc-800/40 space-y-3">
                <div className="text-xs font-bold text-zinc-400 flex items-center gap-1.5 font-mono">
                  <Layers className="h-3.5 w-3.5 text-blue-500" />
                  SELECTION DETAILS
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-zinc-900 p-2.5 rounded border border-zinc-800">
                    <div className="text-zinc-500 text-[10px] uppercase font-semibold">Products</div>
                    <div className="text-lg font-extrabold text-white font-mono mt-0.5">
                      {selectedProductIds.size} <span className="text-zinc-600 text-xs">/ {products.length}</span>
                    </div>
                  </div>
                  <div className="bg-zinc-900 p-2.5 rounded border border-zinc-800">
                    <div className="text-zinc-500 text-[10px] uppercase font-semibold">Services</div>
                    <div className="text-lg font-extrabold text-white font-mono mt-0.5">
                      {selectedServiceIds.size} <span className="text-zinc-600 text-xs">/ {services.length}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-zinc-500 flex items-start gap-2 leading-relaxed bg-zinc-950 p-3 rounded-md border border-zinc-900">
                <Info className="h-4 w-4 text-zinc-400 shrink-0 mt-0.5" />
                <span>
                  The generator automatically clusters selected items by category, renders a high-tech corporate blue branding layout, and dynamically formats currency as Rs.
                </span>
              </div>

            </CardContent>
          </Card>
        </div>

        {/* Categories & Selection Bento Card */}
        <div className="lg:col-span-2 space-y-6">
          {categories.length === 0 ? (
            <Card className="bg-zinc-950 border-zinc-800 text-center py-12">
              <CardContent>
                <p className="text-zinc-500 text-sm">No active catalog listings discovered in database.</p>
              </CardContent>
            </Card>
          ) : (
            categories.map((category) => {
              const catProds = products.filter(p => p.category === category);
              const catServs = services.filter(s => s.category === category);
              const totalInCat = catProds.length + catServs.length;
              
              const selectedInCat = 
                catProds.filter(p => selectedProductIds.has(p.id)).length + 
                catServs.filter(s => selectedServiceIds.has(s.id)).length;

              const isAllChecked = selectedInCat === totalInCat;
              const isSomeChecked = selectedInCat > 0 && selectedInCat < totalInCat;

              return (
                <Card 
                  key={category} 
                  className="bg-zinc-950 border-zinc-800/80 shadow-md transition-all hover:border-zinc-700/80 overflow-hidden"
                >
                  <CardHeader className="flex flex-row items-center justify-between border-b border-zinc-900/60 pb-3 pt-4 px-5">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center">
                        <Checkbox
                          checked={isAllChecked ? true : isSomeChecked ? 'indeterminate' : false}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              selectAllInCategory(category);
                            } else {
                              deselectAllInCategory(category);
                            }
                          }}
                        />
                      </div>
                      <div>
                        <CardTitle className="text-sm font-bold text-white uppercase tracking-wider">
                          {category}
                        </CardTitle>
                        <CardDescription className="text-[10px] text-zinc-500 mt-0.5">
                          {selectedInCat} of {totalInCat} items active
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-[10px] font-mono font-semibold px-2 py-0.5 bg-zinc-900 text-zinc-400 border-zinc-800">
                      {catProds.length > 0 && `${catProds.length} Prods`}
                      {catProds.length > 0 && catServs.length > 0 && ' | '}
                      {catServs.length > 0 && `${catServs.length} Servs`}
                    </Badge>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y divide-zinc-900/60 max-h-[260px] overflow-y-auto">
                      
                      {/* Products */}
                      {catProds.map((product) => {
                        const isChecked = selectedProductIds.has(product.id);
                        return (
                          <div 
                            key={product.id}
                            onClick={() => handleProductToggle(product.id)}
                            className="flex items-center justify-between py-2.5 px-5 hover:bg-zinc-900/30 cursor-pointer transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <Checkbox 
                                checked={isChecked} 
                                onCheckedChange={() => handleProductToggle(product.id)}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <div className="space-y-0.5">
                                <span className="text-xs font-semibold text-zinc-200 block">
                                  {product.brand ? `[${product.brand}] ` : ''}{product.title || product.name}
                                </span>
                                {product.description && (
                                  <span className="text-[10px] text-zinc-500 block line-clamp-1 max-w-[400px]">
                                    {product.description}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              {includePricing && product.price > 0 && (
                                <span className="text-xs font-bold text-zinc-400 font-mono">
                                  Rs. {product.price.toLocaleString('en-IN')}
                                </span>
                              )}
                              <Badge variant="outline" className="ml-2.5 text-[9px] font-mono py-0 text-blue-400 border-blue-900/50 bg-blue-950/20">
                                PROD
                              </Badge>
                            </div>
                          </div>
                        );
                      })}

                      {/* Services */}
                      {catServs.map((service) => {
                        const isChecked = selectedServiceIds.has(service.id);
                        return (
                          <div 
                            key={service.id}
                            onClick={() => handleServiceToggle(service.id)}
                            className="flex items-center justify-between py-2.5 px-5 hover:bg-zinc-900/30 cursor-pointer transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <Checkbox 
                                checked={isChecked} 
                                onCheckedChange={() => handleServiceToggle(service.id)}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <div className="space-y-0.5">
                                <span className="text-xs font-semibold text-zinc-200 block">
                                  {service.title || service.name}
                                </span>
                                {service.description && (
                                  <span className="text-[10px] text-zinc-500 block line-clamp-1 max-w-[400px]">
                                    {service.description}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              {includePricing && service.price > 0 && (
                                <span className="text-xs font-bold text-zinc-400 font-mono">
                                  Rs. {service.price.toLocaleString('en-IN')}
                                </span>
                              )}
                              <Badge variant="outline" className="ml-2.5 text-[9px] font-mono py-0 text-purple-400 border-purple-900/50 bg-purple-950/20">
                                SERV
                              </Badge>
                            </div>
                          </div>
                        );
                      })}

                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
}
