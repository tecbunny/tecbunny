'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { CustomSetupBlueprintComponentSummary, CustomSetupBlueprintSummary } from '@/lib/custom-setup-service';
import { useAuth, useCart } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { ROICostEfficiencyBanner } from './ROICostEfficiencyBanner';
import { useLeadCaptureTrigger } from '@/hooks/use-lead-capture-trigger';
import { FreeInstallationOfferBanner } from '@/components/ui/FreeInstallationOfferBanner';
import { Share2, Sparkles } from 'lucide-react';

export interface CustomSetupFlowProps {
  blueprint: CustomSetupBlueprintSummary | null;
  variant?: 'default' | 'tech';
}

import {
  type SetupSystem,
  type PriceEntry,
  type CapacityPriceEntry,
  type CameraPriceMatrix,
  type CablePriceEntry,
  type AnalogPricing,
  type IpPricing,
  type Totals,
  type AnalogSelections,
  type IpSelections,
  FALLBACK_ANALOG_PRICING,
  FALLBACK_IP_PRICING,
  FALLBACK_HDD_OPTIONS,
  FALLBACK_MONITOR_OPTION,
  FALLBACK_MONITOR_OPTIONS,
  FALLBACK_WALL_MOUNT_ADDON,
  FALLBACK_SPIKE_GUARD_OPTION,
  FALLBACK_RACK_OPTIONS,
  FALLBACK_CONDUIT_PIPE_OPTIONS,
  FALLBACK_INSTALLATION_OPTION,
  buildPricingCatalog,
  calculateTotals,
  pickCapacityOption,
  calculateQuantity,
  calculateCableQuantity,
  recommendedAnalogDvrCapacity,
  recommendedAnalogSmpsCapacity,
  recommendedIpCapacity,
  formatCurrency,
  buildAnalogSystemSummary,
  buildIpSystemSummary,
  resolveAccessoryPrice,
} from '@/lib/custom-setup-pricing';

export function CustomSetupFlow({ blueprint, variant = 'default' }: CustomSetupFlowProps) {
  const isTech = variant === 'tech';
  const pricingCatalog = useMemo(() => buildPricingCatalog(blueprint), [blueprint]);
  const analogPricing = pricingCatalog.analog;
  const ipPricing = pricingCatalog.ip;
  const hddOptions = pricingCatalog.hddOptions;
  const monitorOption = pricingCatalog.monitorOption;
  const installationOption = pricingCatalog.installationOption;
  const selectableHddOptions = hddOptions.length ? hddOptions : FALLBACK_HDD_OPTIONS;

  // Debug: Log pricing source - disabled for production

  //   hasBlueprintData: !!blueprint,
  //   blueprintSystems: blueprint?.systems?.length || 0,
  //   usingFallback: !blueprint,
  //   timestamp: new Date().toISOString(),
  //   sampleDvrPricing: analogPricing.dvr[0] || null
  // });

  const [system, setSystem] = useState<SetupSystem>('analog');
  const [premiseType, setPremiseType] = useState<'Residential' | 'Commercial' | 'Industrial'>('Residential');
  const [itSystemCount, setItSystemCount] = useState<number>(1);
  const [automationEnabled, setAutomationEnabled] = useState<boolean>(true);
  const [alarmEnabled, setAlarmEnabled] = useState<boolean>(false);
  const [cameraCount, setCameraCount] = useState<number>(4);
  const [cameraCountInput, setCameraCountInput] = useState<string>('4');
  const [analogSelections, setAnalogSelections] = useState<AnalogSelections>({
    dvrId: analogPricing.dvr[0]?.id ?? FALLBACK_ANALOG_PRICING.dvr[0].id,
    smpsId: analogPricing.smps[0]?.id ?? FALLBACK_ANALOG_PRICING.smps[0].id,
    cableId: analogPricing.cable[0]?.id ?? FALLBACK_ANALOG_PRICING.cable[0].id,
    resolution: '2.4mp',
    dualLight: false,
  });
  const [ipSelections, setIpSelections] = useState<IpSelections>({
    nvrId: ipPricing.nvr[0]?.id ?? FALLBACK_IP_PRICING.nvr[0].id,
    poeId: ipPricing.poe[0]?.id ?? FALLBACK_IP_PRICING.poe[0].id,
    cableId: ipPricing.cable[0]?.id ?? FALLBACK_IP_PRICING.cable[0].id,
    resolution: '2mp',
    dualLight: false,
  });
  const [hddId, setHddId] = useState<string>(
    selectableHddOptions[1]?.id ?? selectableHddOptions[0]?.id ?? FALLBACK_HDD_OPTIONS[0].id
  );
  const [monitorIncluded, setMonitorIncluded] = useState<boolean>(false);
  const [monitorId, setMonitorId] = useState<string>(FALLBACK_MONITOR_OPTIONS[0]?.id ?? 'monitor-19');
  const [wallMountIncluded, setWallMountIncluded] = useState<boolean>(false);
  const [spikeGuardIncluded, setSpikeGuardIncluded] = useState<boolean>(false);
  const [accessoryPricing, setAccessoryPricing] = useState<Record<string, { mrp: number; sale: number }> | null>(null);
  const [rackId, setRackId] = useState<string | null>(null);
  const [conduitPipeId, setConduitPipeId] = useState<string | null>(null);
  const [conduitMeters, setConduitMeters] = useState<number>(0);
  const [installationIncluded, setInstallationIncluded] = useState<boolean>(true);
  const [quoteDownloading, setQuoteDownloading] = useState<boolean>(false);
  const [isBidding, setIsBidding] = useState(false);
  const [bidForm, setBidForm] = useState({ name: '', email: '', phone: '', address: '', price: '' });
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [anonForm, setAnonForm] = useState({ name: '', phone: '', address: '', email: '' });
  const router = useRouter();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const { addToCart } = useCart();

  // CRO: Dynamic lead capture trigger
  useLeadCaptureTrigger(45000);

  useEffect(() => {
    const normalized = Number.isFinite(cameraCount) ? Math.min(32, Math.max(1, Math.round(cameraCount))) : 4;
    if (normalized !== cameraCount) {
      setCameraCount(normalized);
      setCameraCountInput(normalized.toString());
    }
  }, [cameraCount]);

  useEffect(() => {
    if (user) {
      setBidForm(prev => ({ ...prev, name: user.name || '', email: user.email || '', phone: user.mobile || '' }));
    }
  }, [user]);

  const handleCameraRangeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const normalized = Math.min(32, Math.max(1, Number.parseInt(event.target.value, 10)));
    setCameraCount(normalized);
    setCameraCountInput(normalized.toString());
  };

  const handleItRangeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const normalized = Math.min(20, Math.max(0, Number.parseInt(event.target.value, 10)));
    setItSystemCount(normalized);
  };

  const cameraCountLabel = cameraCount <= 0 ? 'None' : `${cameraCount} Camera${cameraCount > 1 ? 's' : ''}`;
  const itSystemLabel = itSystemCount <= 0 ? 'None' : `${itSystemCount} System${itSystemCount > 1 ? 's' : ''}`;
  const recommendationLines = useMemo(() => {
    if (cameraCount <= 0) {
      return ['> No Surveillance Selected'];
    }
    if (cameraCount <= 4) {
      return ['> 4CH CP PLUS DVR', '> 1TB Surveillance HDD', `> ${cameraCount}x 2.4MP Cameras`];
    }
    if (cameraCount <= 8) {
      return ['> 8CH CP PLUS DVR', '> 2TB Surveillance HDD', `> ${cameraCount}x 2.4MP Cameras`];
    }
    if (cameraCount <= 16) {
      return ['> 16CH CP PLUS DVR', '> 4TB Surveillance HDD', `> ${cameraCount}x 5MP Cameras`];
    }
    return ['> 32CH NVR (Enterprise)', '> 2x 6TB HDD', `> ${cameraCount}x IP Cameras`];
  }, [cameraCount]);

  const cardClassName = isTech ? 'border-border bg-card/60 text-card-foreground' : undefined;
  const cardHeaderClassName = isTech ? 'text-foreground font-semibold' : undefined;
  const cardDescriptionClassName = isTech ? 'text-muted-foreground' : undefined;
  const inputClassName = isTech ? 'bg-muted/10 border-border text-foreground placeholder:text-muted-foreground' : undefined;
  const selectTriggerClassName = isTech ? 'bg-muted/10 border-border text-foreground' : undefined;
  const selectContentClassName = isTech ? 'bg-popover text-popover-foreground border-border' : undefined;
  const selectItemClassName = isTech ? 'text-foreground focus:bg-primary/10 focus:text-primary' : undefined;
  const selectMutedClassName = isTech ? 'text-slate-400' : 'text-muted-foreground';

  // Handle camera count input changes
  const handleCameraCountChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setCameraCountInput(value);
    
    // Only update the actual count if it's a valid number
    const numValue = Number.parseInt(value, 10);
    if (!isNaN(numValue) && value !== '') {
      const normalized = Math.min(32, Math.max(1, numValue));
      setCameraCount(normalized);
    }
  };

  // Handle when user finishes editing (blur event)
  const handleCameraCountBlur = () => {
    const numValue = Number.parseInt(cameraCountInput, 10);
    if (isNaN(numValue) || cameraCountInput === '') {
      // Reset to current valid value if input is invalid or empty
      setCameraCountInput(cameraCount.toString());
    } else {
      // Normalize the value
      const normalized = Math.min(32, Math.max(1, numValue));
      setCameraCount(normalized);
      setCameraCountInput(normalized.toString());
    }
  };

  useEffect(() => {
    setAnalogSelections((previous) => {
      const resolvedDvrId = analogPricing.dvr.some((entry) => entry.id === previous.dvrId)
        ? previous.dvrId
        : analogPricing.dvr[0]?.id ?? FALLBACK_ANALOG_PRICING.dvr[0].id;
      const resolvedSmpsId = analogPricing.smps.some((entry) => entry.id === previous.smpsId)
        ? previous.smpsId
        : analogPricing.smps[0]?.id ?? FALLBACK_ANALOG_PRICING.smps[0].id;
      const resolvedCableId = analogPricing.cable.some((entry) => entry.id === previous.cableId)
        ? previous.cableId
        : analogPricing.cable[0]?.id ?? FALLBACK_ANALOG_PRICING.cable[0].id;

      if (resolvedDvrId === previous.dvrId && resolvedSmpsId === previous.smpsId && resolvedCableId === previous.cableId) {
        return previous;
      }

      return { ...previous, dvrId: resolvedDvrId, smpsId: resolvedSmpsId, cableId: resolvedCableId } satisfies AnalogSelections;
    });
  }, [analogPricing]);

  useEffect(() => {
    setIpSelections((previous) => {
      const resolvedNvrId = ipPricing.nvr.some((entry) => entry.id === previous.nvrId)
        ? previous.nvrId
        : ipPricing.nvr[0]?.id ?? FALLBACK_IP_PRICING.nvr[0].id;
      const resolvedPoeId = ipPricing.poe.some((entry) => entry.id === previous.poeId)
        ? previous.poeId
        : ipPricing.poe[0]?.id ?? FALLBACK_IP_PRICING.poe[0].id;
      const resolvedCableId = ipPricing.cable.some((entry) => entry.id === previous.cableId)
        ? previous.cableId
        : ipPricing.cable[0]?.id ?? FALLBACK_IP_PRICING.cable[0].id;

      if (resolvedNvrId === previous.nvrId && resolvedPoeId === previous.poeId && resolvedCableId === previous.cableId) {
        return previous;
      }

      return { ...previous, nvrId: resolvedNvrId, poeId: resolvedPoeId, cableId: resolvedCableId } satisfies IpSelections;
    });
  }, [ipPricing]);

  useEffect(() => {
    setHddId((previous) => {
      if (selectableHddOptions.some((entry) => entry.id === previous)) {
        return previous;
      }
      return selectableHddOptions[0]?.id ?? FALLBACK_HDD_OPTIONS[0].id;
    });
  }, [selectableHddOptions]);

  useEffect(() => {
    fetch('/api/settings?key=custom_setup_accessory_pricing')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.value) {
          setAccessoryPricing(data.value);
        }
      })
      .catch((err) => console.error('Failed to load accessory pricing overrides:', err));
  }, []);

  useEffect(() => {
    const recommendedDvrCapacity = recommendedAnalogDvrCapacity(cameraCount);
    const recommendedDvr = pickCapacityOption(analogPricing.dvr, recommendedDvrCapacity);
    const currentDvr = analogPricing.dvr.find((entry) => entry.id === analogSelections.dvrId);
    if (!currentDvr || currentDvr.capacity < recommendedDvrCapacity) {
      setAnalogSelections((previous) => ({ ...previous, dvrId: recommendedDvr.id }));
    }

    const recommendedSmpsCapacity = recommendedAnalogSmpsCapacity(cameraCount);
    const recommendedSmps = pickCapacityOption(analogPricing.smps, recommendedSmpsCapacity);
    const currentSmps = analogPricing.smps.find((entry) => entry.id === analogSelections.smpsId);
    if (!currentSmps || currentSmps.capacity < recommendedSmpsCapacity) {
      setAnalogSelections((previous) => ({ ...previous, smpsId: recommendedSmps.id }));
    }
  }, [analogPricing, analogSelections.dvrId, analogSelections.smpsId, cameraCount]);

  useEffect(() => {
    const recommendedNvrCapacity = recommendedIpCapacity(cameraCount);
    const recommendedNvr = pickCapacityOption(ipPricing.nvr, recommendedNvrCapacity);
    const currentNvr = ipPricing.nvr.find((entry) => entry.id === ipSelections.nvrId);
    if (!currentNvr || currentNvr.capacity < recommendedNvrCapacity) {
      setIpSelections((previous) => ({ ...previous, nvrId: recommendedNvr.id }));
    }

    const recommendedPoeCapacity = recommendedIpCapacity(cameraCount);
    const recommendedPoe = pickCapacityOption(ipPricing.poe, recommendedPoeCapacity);
    const currentPoe = ipPricing.poe.find((entry) => entry.id === ipSelections.poeId);
    if (!currentPoe || currentPoe.capacity < recommendedPoeCapacity) {
      setIpSelections((previous) => ({ ...previous, poeId: recommendedPoe.id }));
    }
  }, [cameraCount, ipPricing, ipSelections.nvrId, ipSelections.poeId]);

  const totals: Totals = useMemo(() => calculateTotals({
    system,
    cameraCount,
    analogSelections,
    ipSelections,
    hddId,
    monitorIncluded,
    monitorId,
    wallMountIncluded,
    spikeGuardIncluded,
    rackId,
    conduitPipeId,
    conduitMeters,
    installationIncluded,
    automationEnabled,
    pricingCatalog,
    accessoryPricingOverrides: accessoryPricing,
  }), [analogPricing, analogSelections, automationEnabled, cameraCount, calculateTotals, hddId, installationIncluded, installationOption, monitorIncluded, monitorOption, ipPricing, ipSelections, pricingCatalog, selectableHddOptions, system, monitorId, wallMountIncluded, spikeGuardIncluded, rackId, conduitPipeId, conduitMeters, accessoryPricing]);

  const inlineQuoteSummary = useMemo(() => {
    const systemLabel = system === 'analog' ? 'Analog DVR' : 'IP NVR';
    const hddLabel = selectableHddOptions.find((entry) => entry.id === hddId)?.label ?? 'Surveillance HDD';
    const itSystemsLabel = itSystemCount > 0 ? `${itSystemCount} IT system${itSystemCount > 1 ? 's' : ''}` : 'No IT systems';
    const extras: string[] = [];
    if (monitorIncluded) extras.push('monitor');
    if (installationIncluded) extras.push('installation');
    const extrasLabel = extras.length ? ` | Add-ons: ${extras.join(', ')}` : '';
    return `${systemLabel} | ${cameraCount} cameras | ${itSystemsLabel} | HDD: ${hddLabel}${extrasLabel} | Sale total ${formatCurrency(totals.overall.sale)}`;
  }, [cameraCount, hddId, installationIncluded, itSystemCount, monitorIncluded, selectableHddOptions, system, totals.overall.sale]);

  const handleInlineQuoteDownload = async () => {
    if (!user) {
      setIsDownloadModalOpen(true);
      return;
    }

    setQuoteDownloading(true);
    try {
      const systemLabel = system === 'analog' ? 'Analog DVR' : 'IP NVR';
      const hddLabel = selectableHddOptions.find((entry) => entry.id === hddId)?.label ?? 'Surveillance HDD';
      const items = [
        {
          description: `${systemLabel} system (${cameraCount} cameras)`,
          mrp: totals.system.mrp,
          sale: totals.system.sale,
        },
        {
          description: hddLabel,
          mrp: totals.hdd.mrp,
          sale: totals.hdd.sale,
        },
      ];

      if (totals.monitor.included) {
        items.push({
          description: `Monitor (${totals.monitor.label})`,
          mrp: totals.monitor.mrp,
          sale: totals.monitor.sale,
        });
      }

      if (totals.wallMount.included) {
        items.push({
          description: 'Wall Mount Installation Kit',
          mrp: totals.wallMount.mrp,
          sale: totals.wallMount.sale,
        });
      }

      if (totals.spikeGuard.included) {
        items.push({
          description: 'Spike Guard / Power Surge Protector',
          mrp: totals.spikeGuard.mrp,
          sale: totals.spikeGuard.sale,
        });
      }

      if (totals.rack.selected) {
        items.push({
          description: totals.rack.label,
          mrp: totals.rack.mrp,
          sale: totals.rack.sale,
        });
      }

      if (totals.conduit.selected) {
        items.push({
          description: `${totals.conduit.label} × ${totals.conduit.meters}m`,
          mrp: totals.conduit.mrp,
          sale: totals.conduit.sale,
        });
      }

      if (totals.installation.included) {
        items.push({
          description: `Installation (${installationOption.label})`,
          mrp: totals.installation.mrp,
          sale: totals.installation.sale,
        });
      }

      if (totals.installationLabor.sale > 0) {
        items.push({
          description: `Installation Labor (₹${totals.installationLabor.sale})`,
          mrp: totals.installationLabor.sale,
          sale: totals.installationLabor.sale,
        });
      }

      if (itSystemCount > 0) {
        items.push({
          description: `IT Systems (${itSystemCount} ${itSystemCount > 1 ? 'Systems' : 'System'})`,
          mrp: 0,
          sale: 0,
        });
      }

      const customSetupConfig = {
        system,
        cameraCount,
        itSystemCount,
        analogSelections,
        ipSelections,
        hddId,
        monitorIncluded,
        monitorId,
        wallMountIncluded,
        spikeGuardIncluded,
        rackId,
        conduitPipeId,
        conduitMeters,
        installationIncluded,
        automationEnabled,
      };

      const finalSelections = {
        type: 'customised_setup',
        systemType: systemLabel,
        cameraCount,
        items,
        totals: totals.overall,
        breakdown: totals.system.breakdown,
      };

      const response = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: inlineQuoteSummary,
          gstIncluded: true,
          selections: finalSelections,
          customSetupConfig
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => null);
        const message = err?.details || err?.error || 'Failed to generate quote';
        throw new Error(message);
      }

      const quoteNumberHeader = response.headers.get('X-Quote-Number') || 'pdf';

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `quote-${quoteNumberHeader}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast({ title: 'Quote ready', description: `Downloaded quote PDF successfully. Quote Number: ${quoteNumberHeader}` });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Quote failed', description: error?.message || 'Unable to generate quote.' });
    } finally {
      setQuoteDownloading(false);
    }
  };

  const handleInlineQuoteDownloadAnon = async () => {
    if (!anonForm.name || !anonForm.phone || !anonForm.address) {
      toast({ variant: 'destructive', title: 'Missing fields', description: 'Name, mobile number, and address are required.' });
      return;
    }

    setQuoteDownloading(true);
    try {
      const systemLabel = system === 'analog' ? 'Analog DVR' : 'IP NVR';
      const hddLabel = selectableHddOptions.find((entry) => entry.id === hddId)?.label ?? 'Surveillance HDD';
      const items = [
        {
          description: `${systemLabel} system (${cameraCount} cameras)`,
          mrp: totals.system.mrp,
          sale: totals.system.sale,
        },
        {
          description: hddLabel,
          mrp: totals.hdd.mrp,
          sale: totals.hdd.sale,
        },
      ];

      if (totals.monitor.included) {
        items.push({
          description: `Monitor (${totals.monitor.label})`,
          mrp: totals.monitor.mrp,
          sale: totals.monitor.sale,
        });
      }

      if (totals.wallMount.included) {
        items.push({
          description: 'Wall Mount Installation Kit',
          mrp: totals.wallMount.mrp,
          sale: totals.wallMount.sale,
        });
      }

      if (totals.spikeGuard.included) {
        items.push({
          description: 'Spike Guard / Power Surge Protector',
          mrp: totals.spikeGuard.mrp,
          sale: totals.spikeGuard.sale,
        });
      }

      if (totals.rack.selected) {
        items.push({
          description: totals.rack.label,
          mrp: totals.rack.mrp,
          sale: totals.rack.sale,
        });
      }

      if (totals.conduit.selected) {
        items.push({
          description: `${totals.conduit.label} × ${totals.conduit.meters}m`,
          mrp: totals.conduit.mrp,
          sale: totals.conduit.sale,
        });
      }

      if (totals.installation.included) {
        items.push({
          description: `Installation (${installationOption.label})`,
          mrp: totals.installation.mrp,
          sale: totals.installation.sale,
        });
      }

      if (totals.installationLabor.sale > 0) {
        items.push({
          description: `Installation Labor (₹${totals.installationLabor.sale})`,
          mrp: totals.installationLabor.sale,
          sale: totals.installationLabor.sale,
        });
      }

      if (itSystemCount > 0) {
        items.push({
          description: `IT Systems (${itSystemCount} ${itSystemCount > 1 ? 'Systems' : 'System'})`,
          mrp: 0,
          sale: 0,
        });
      }

      const customSetupConfig = {
        system,
        cameraCount,
        itSystemCount,
        analogSelections,
        ipSelections,
        hddId,
        monitorIncluded,
        monitorId,
        wallMountIncluded,
        spikeGuardIncluded,
        rackId,
        conduitPipeId,
        conduitMeters,
        installationIncluded,
        automationEnabled,
      };

      const finalSelections = {
        type: 'customised_setup',
        systemType: systemLabel,
        cameraCount,
        items,
        totals: totals.overall,
        breakdown: totals.system.breakdown,
      };

      const quoteNumber = `${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(Math.floor(10000 + Math.random() * 90000))}`;

      const response = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: inlineQuoteSummary,
          gstIncluded: true,
          selections: finalSelections,
          customSetupConfig,
          customerName: anonForm.name,
          customerPhone: anonForm.phone,
          customerAddress: anonForm.address,
          customerEmail: anonForm.email || 'anonymous@tecbunny.com',
          quote_number: quoteNumber
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => null);
        const message = err?.details || err?.error || 'Failed to generate quote';
        throw new Error(message);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `quote-${quoteNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast({ title: 'Quote ready', description: `Downloaded quote PDF successfully. Quote Number: ${quoteNumber}` });
      setIsDownloadModalOpen(false);
      setAnonForm({ name: '', phone: '', address: '', email: '' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Quote failed', description: error?.message || 'Unable to generate quote.' });
    } finally {
      setQuoteDownloading(false);
    }
  };

  const handleDownloadBidQuote = async () => {
    if (!bidForm.name || !bidForm.phone || !bidForm.price || !bidForm.address) {
      toast({ variant: 'destructive', title: 'Missing fields', description: 'Name, phone, address, and bid price are required.' });
      return;
    }

    const originalPrice = totals?.overall?.sale || 0;
    const bidPrice = Number(bidForm.price);
    const minPrice = originalPrice * 0.7;

    if (bidPrice < minPrice) {
      toast({ 
        variant: 'destructive', 
        title: 'Bid too low', 
        description: `Minimum bid price is ₹${Math.round(minPrice).toLocaleString()} (70% of quoted price). Your bid: ₹${Math.round(bidPrice).toLocaleString()}` 
      });
      return;
    }

    setQuoteDownloading(true);
    try {
      const systemLabel = system === 'analog' ? 'Analog DVR' : 'IP NVR';
      const hddLabel = selectableHddOptions.find((entry) => entry.id === hddId)?.label ?? 'Surveillance HDD';
      
      const biddedTotals = {
        ...totals.overall,
        sale: bidPrice,
        discountAmount: Math.max(0, totals.overall.mrp - bidPrice),
        discountPercent: totals.overall.mrp > 0 ? (Math.max(0, totals.overall.mrp - bidPrice) / totals.overall.mrp) * 100 : 0
      };

      const items = [
        {
          description: `${systemLabel} system (${cameraCount} cameras)`,
          mrp: totals.system.mrp,
          sale: totals.system.sale,
        },
        {
          description: hddLabel,
          mrp: totals.hdd.mrp,
          sale: totals.hdd.sale,
        },
      ];

      if (totals.monitor.included) {
        items.push({
          description: `Monitor (${totals.monitor.label})`,
          mrp: totals.monitor.mrp,
          sale: totals.monitor.sale,
        });
      }

      if (totals.wallMount.included) {
        items.push({
          description: 'Wall Mount Installation Kit',
          mrp: totals.wallMount.mrp,
          sale: totals.wallMount.sale,
        });
      }

      if (totals.spikeGuard.included) {
        items.push({
          description: 'Spike Guard / Power Surge Protector',
          mrp: totals.spikeGuard.mrp,
          sale: totals.spikeGuard.sale,
        });
      }

      if (totals.rack.selected) {
        items.push({
          description: totals.rack.label,
          mrp: totals.rack.mrp,
          sale: totals.rack.sale,
        });
      }

      if (totals.conduit.selected) {
        items.push({
          description: `${totals.conduit.label} × ${totals.conduit.meters}m`,
          mrp: totals.conduit.mrp,
          sale: totals.conduit.sale,
        });
      }

      if (totals.installation.included) {
        items.push({
          description: `Installation (${installationOption.label})`,
          mrp: totals.installation.mrp,
          sale: totals.installation.sale,
        });
      }

      if (totals.installationLabor.sale > 0) {
        items.push({
          description: `Installation Labor (₹${totals.installationLabor.sale})`,
          mrp: totals.installationLabor.sale,
          sale: totals.installationLabor.sale,
        });
      }

      if (itSystemCount > 0) {
        items.push({
          description: `IT Systems (${itSystemCount} ${itSystemCount > 1 ? 'Systems' : 'System'})`,
          mrp: 0,
          sale: 0,
        });
      }

      const customSetupConfig = {
        system,
        cameraCount,
        itSystemCount,
        analogSelections,
        ipSelections,
        hddId,
        monitorIncluded,
        monitorId,
        wallMountIncluded,
        spikeGuardIncluded,
        rackId,
        conduitPipeId,
        conduitMeters,
        installationIncluded,
        automationEnabled,
      };

      const finalSelections = {
        type: 'customised_setup',
        systemType: systemLabel,
        cameraCount,
        items,
        totals: biddedTotals,
        breakdown: totals.system.breakdown,
      };

      const quoteNumber = `${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(Math.floor(10000 + Math.random() * 90000))}`;

      const response = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: inlineQuoteSummary,
          gstIncluded: true,
          selections: finalSelections,
          customSetupConfig,
          customerName: bidForm.name,
          customerPhone: bidForm.phone,
          customerAddress: bidForm.address,
          customerEmail: bidForm.email || 'anonymous@tecbunny.com',
          quote_number: quoteNumber,
          biddedPrice: bidPrice,
          status: 'bidded'
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw new Error(err?.error || 'Failed to submit bid and generate quote');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `quote-bid-${quoteNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast({ title: 'Bid Quote ready', description: `Generated and downloaded your negotiated quote PDF. Quote Number: ${quoteNumber}` });
      setIsBidding(false);
      setBidForm({ name: '', email: '', phone: '', address: '', price: '' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Download failed', description: error?.message || 'Unable to download bid quote.' });
    } finally {
      setQuoteDownloading(false);
    }
  };

  const handleBookNow = () => {
    if (quoteDownloading) return;
    const systemLabel = system === 'analog' ? 'Analog DVR' : 'IP NVR';
    
    addToCart({
      id: `service-cctv-${Math.random().toString(36).substring(2,9)}`,
      name: `Custom CCTV Setup - ${cameraCount} Cameras (${systemLabel})`,
      price: totals.overall.sale,
      mrp: totals.overall.mrp,
      image: 'https://fbcsagupcxheyiusjfak.supabase.co/storage/v1/object/public/TecBunny%20Solution/cctv-bundle.jpg',
      product_type: 'service',
      description: inlineQuoteSummary
    }, 1);
    
    router.push('/checkout');
  };

  const handleSubmitBid = async (): Promise<void> => {
    if (!bidForm.name || !bidForm.phone || !bidForm.price) {
      toast({ variant: 'destructive', title: 'Missing fields', description: 'Name, phone, and bid price are required.' });
      return;
    }

    const originalPrice = totals?.overall?.sale || 0;
    const bidPrice = Number(bidForm.price);
    const minPrice = originalPrice * 0.7; // 70% of original price

    if (bidPrice < minPrice) {
      toast({ 
        variant: 'destructive', 
        title: 'Bid too low', 
        description: `Minimum bid price is ₹${Math.round(minPrice).toLocaleString()} (70% of quoted price). Your bid: ₹${Math.round(bidPrice).toLocaleString()}` 
      });
      return;
    }

    try {
      const customSetupConfig = {
        system,
        cameraCount,
        itSystemCount,
        analogSelections,
        ipSelections,
        hddId,
        monitorIncluded,
        installationIncluded,
        automationEnabled,
        totals,
      };

      const res = await fetch('/api/quotes/bid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...bidForm,
          biddedPrice: bidPrice,
          summary: inlineQuoteSummary,
          customSetupConfig
        })
      });

      if (!res.ok) throw new Error('Submission failed');
      
      const data = await res.json();
      const quoteId = data.quoteId;
      
      toast({ 
        title: 'Bid Submitted Successfully!', 
        description: 'Check your quote status to see our counter-offer.' 
      });
      
      setIsBidding(false);
      setBidForm({ name: '', email: '', phone: '', address: '', price: '' });
      
      // Redirect to quote view page
      setTimeout(() => {
        router.push(`/quotes/${quoteId}`);
      }, 1500);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to submit bid.' });
    }
  };

  const activeAnalog = system === 'analog';

  const renderAnalogControls = () => {
    const recommendedDvrCapacity = recommendedAnalogDvrCapacity(cameraCount);
    const recommendedSmpsCapacity = recommendedAnalogSmpsCapacity(cameraCount);

    return (
    <div className="space-y-6">
      <Card className={cardClassName}>
        <CardHeader className={cardHeaderClassName}>
          <CardTitle className={isTech ? 'text-white' : undefined}>DVR & Power</CardTitle>
          <CardDescription className={cardDescriptionClassName}>Auto-matched to the current camera count. You can upgrade to higher capacity if desired.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="analog-dvr">DVR Recorder</Label>
            <Select
              value={analogSelections.dvrId}
              onValueChange={(value) => setAnalogSelections((previous) => ({ ...previous, dvrId: value }))}
            >
              <SelectTrigger id="analog-dvr" className={selectTriggerClassName}>
                <SelectValue placeholder="Select DVR" />
              </SelectTrigger>
              <SelectContent className={selectContentClassName}>
                {analogPricing.dvr.map((option) => {
                  const isRecommended = option.capacity === recommendedDvrCapacity;
                  const isDisabled = option.capacity < recommendedDvrCapacity;
                  return (
                    <SelectItem key={option.id} value={option.id} disabled={isDisabled} className={selectItemClassName}>
                      <div className="flex flex-col">
                        <span>{option.label}</span>
                        <span className={cn('text-xs', selectMutedClassName)}>
                          Supports up to {option.capacity} cameras · {formatCurrency(option.sale)} sale
                          {isRecommended ? ' · Recommended' : ''}
                          {isDisabled ? ' · Min capacity not met' : ''}
                        </span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="analog-smps">SMPS Power Supply</Label>
            <Select
              value={analogSelections.smpsId}
              onValueChange={(value) => setAnalogSelections((previous) => ({ ...previous, smpsId: value }))}
            >
              <SelectTrigger id="analog-smps" className={selectTriggerClassName}>
                <SelectValue placeholder="Select SMPS" />
              </SelectTrigger>
              <SelectContent className={selectContentClassName}>
                {analogPricing.smps.map((option) => {
                  const quantity = calculateQuantity(cameraCount, option.capacity);
                  const totalSale = option.sale * quantity;
                  const isRecommended = option.capacity === recommendedSmpsCapacity;
                  const isDisabled = option.capacity < recommendedSmpsCapacity;
                  return (
                    <SelectItem key={option.id} value={option.id} disabled={isDisabled} className={selectItemClassName}>
                      <div className="flex flex-col">
                        <span>{option.label}</span>
                        <span className={cn('text-xs', selectMutedClassName)}>
                          {quantity} unit{quantity > 1 ? 's' : ''} for {cameraCount} cameras · {formatCurrency(totalSale)} sale
                          {isRecommended ? ' · Recommended' : ''}
                          {isDisabled ? ' · Min capacity not met' : ''}
                        </span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className={cardClassName}>
        <CardHeader className={cardHeaderClassName}>
          <CardTitle className={isTech ? 'text-white' : undefined}>Cameras & Cabling</CardTitle>
          <CardDescription className={cardDescriptionClassName}>Choose the megapixel rating and whether you need dual-light capability.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Camera Resolution</Label>
              <RadioGroup
                value={analogSelections.resolution}
                onValueChange={(value: '2.4mp' | '5mp') => setAnalogSelections((previous) => ({ ...previous, resolution: value }))}
                className="grid gap-2"
              >
                <Label className={cn('flex cursor-pointer items-center justify-between rounded-md border p-3', isTech && 'border-border bg-muted/40 text-foreground', analogSelections.resolution === '2.4mp' && (isTech ? 'border-primary bg-primary/10' : 'border-primary'))}
                  htmlFor="analog-res-24">
                  <div>
                    <span className="block font-medium">2.4 MP</span>
                    <span className={cn('text-xs', isTech ? 'text-muted-foreground' : 'text-muted-foreground')}>Balanced clarity with lower bandwidth</span>
                  </div>
                  <RadioGroupItem value="2.4mp" id="analog-res-24" aria-label="Select 2.4 MP analog camera resolution" />
                </Label>
                <Label className={cn('flex cursor-pointer items-center justify-between rounded-md border p-3', isTech && 'border-border bg-muted/40 text-foreground', analogSelections.resolution === '5mp' && (isTech ? 'border-primary bg-primary/10' : 'border-primary'))}
                  htmlFor="analog-res-5">
                  <div>
                    <span className="block font-medium">5 MP</span>
                    <span className={cn('text-xs', isTech ? 'text-muted-foreground' : 'text-muted-foreground')}>Higher detail for wider coverage</span>
                  </div>
                  <RadioGroupItem value="5mp" id="analog-res-5" aria-label="Select 5 MP analog camera resolution" />
                </Label>
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <Label>Dual-light Capability</Label>
              <RadioGroup
                value={analogSelections.dualLight ? 'yes' : 'no'}
                onValueChange={(value) => setAnalogSelections((previous) => ({ ...previous, dualLight: value === 'yes' }))}
                className="grid gap-2"
              >
                <Label className={cn('flex cursor-pointer items-center justify-between rounded-md border p-3', isTech && 'border-border bg-muted/40 text-foreground', !analogSelections.dualLight && (isTech ? 'border-primary bg-primary/10' : 'border-primary'))}
                  htmlFor="analog-dual-no">
                  <div>
                    <span className="block font-medium">Standard IR</span>
                    <span className={cn('text-xs', isTech ? 'text-muted-foreground' : 'text-muted-foreground')}>Best for typical day/night surveillance</span>
                  </div>
                  <RadioGroupItem value="no" id="analog-dual-no" aria-label="Use standard infrared analog cameras" />
                </Label>
                <Label className={cn('flex cursor-pointer items-center justify-between rounded-md border p-3', isTech && 'border-border bg-muted/40 text-foreground', analogSelections.dualLight && (isTech ? 'border-primary bg-primary/10' : 'border-primary'))}
                  htmlFor="analog-dual-yes">
                  <div>
                    <span className="block font-medium">Dual-light</span>
                    <span className={cn('text-xs', isTech ? 'text-muted-foreground' : 'text-muted-foreground')}>Switches between IR & warm light for colour video</span>
                  </div>
                  <RadioGroupItem value="yes" id="analog-dual-yes" aria-label="Use dual-light analog cameras" />
                </Label>
              </RadioGroup>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="analog-cable">Cable Preference</Label>
            <Select
              value={analogSelections.cableId}
              onValueChange={(value) => setAnalogSelections((previous) => ({ ...previous, cableId: value }))}
            >
              <SelectTrigger id="analog-cable" className={selectTriggerClassName}>
                <SelectValue placeholder="Select cable" />
              </SelectTrigger>
                 <SelectContent className={selectContentClassName}>
                {analogPricing.cable.map((option) => {
                  const quantity = calculateCableQuantity(cameraCount, option);
                  const totalSale = option.salePerUnit * quantity;
                  return (
                    <SelectItem key={option.id} value={option.id} className={selectItemClassName}>
                      <div className="flex flex-col">
                        <span>{option.label}</span>
                        <span className={cn('text-xs', selectMutedClassName)}>
                          100 m coverage per unit · Est. {quantity} unit{quantity > 1 ? 's' : ''} · {formatCurrency(totalSale)} sale
                        </span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  );
  };

  const renderIpControls = () => {
    const recommendedCapacity = recommendedIpCapacity(cameraCount);

    return (
    <div className="space-y-6">
      <Card className={cardClassName}>
        <CardHeader className={cardHeaderClassName}>
          <CardTitle className={isTech ? 'text-white' : undefined}>NVR & PoE Switching</CardTitle>
          <CardDescription className={cardDescriptionClassName}>Auto-optimised for the camera count. Upgrade to higher tiers for expansion headroom.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ip-nvr">NVR Recorder</Label>
            <Select value={ipSelections.nvrId} onValueChange={(value) => setIpSelections((previous) => ({ ...previous, nvrId: value }))}>
              <SelectTrigger id="ip-nvr" className={selectTriggerClassName}>
                <SelectValue placeholder="Select NVR" />
              </SelectTrigger>
              <SelectContent className={selectContentClassName}>
                {ipPricing.nvr.map((option) => {
                  const isRecommended = option.capacity === recommendedCapacity;
                  const isDisabled = option.capacity < recommendedCapacity;
                  return (
                    <SelectItem key={option.id} value={option.id} disabled={isDisabled} className={selectItemClassName}>
                      <div className="flex flex-col">
                        <span>{option.label}</span>
                        <span className={cn('text-xs', selectMutedClassName)}>
                          Supports {option.capacity} cameras · {formatCurrency(option.sale)} sale
                          {isRecommended ? ' · Recommended' : ''}
                          {isDisabled ? ' · Min capacity not met' : ''}
                        </span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ip-poe">PoE Switch</Label>
            <Select value={ipSelections.poeId} onValueChange={(value) => setIpSelections((previous) => ({ ...previous, poeId: value }))}>
              <SelectTrigger id="ip-poe" className={selectTriggerClassName}>
                <SelectValue placeholder="Select PoE switch" />
              </SelectTrigger>
              <SelectContent className={selectContentClassName}>
                {ipPricing.poe.map((option) => {
                  const quantity = calculateQuantity(cameraCount, option.capacity);
                  const totalSale = option.sale * quantity;
                  const isRecommended = option.capacity === recommendedCapacity;
                  const isDisabled = option.capacity < recommendedCapacity;
                  return (
                    <SelectItem key={option.id} value={option.id} disabled={isDisabled} className={selectItemClassName}>
                      <div className="flex flex-col">
                        <span>{option.label}</span>
                        <span className={cn('text-xs', selectMutedClassName)}>
                          {quantity} unit{quantity > 1 ? 's' : ''} · {formatCurrency(totalSale)} sale
                          {isRecommended ? ' · Recommended' : ''}
                          {isDisabled ? ' · Min capacity not met' : ''}
                        </span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className={cardClassName}>
        <CardHeader className={cardHeaderClassName}>
          <CardTitle className={isTech ? 'text-white' : undefined}>Cameras & Cabling</CardTitle>
          <CardDescription className={cardDescriptionClassName}>Pick your preferred megapixel profile and colour-at-night capability.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Camera Resolution</Label>
              <RadioGroup
                value={ipSelections.resolution}
                onValueChange={(value: '2mp' | '4mp') => setIpSelections((previous) => ({ ...previous, resolution: value }))}
                className="grid gap-2"
              >
                <Label className={cn('flex cursor-pointer items-center justify-between rounded-md border p-3', isTech && 'border-border bg-muted/40 text-foreground', ipSelections.resolution === '2mp' && (isTech ? 'border-primary bg-primary/10' : 'border-primary'))}
                  htmlFor="ip-res-2">
                  <div>
                    <span className="block font-medium">2 MP</span>
                    <span className={cn('text-xs', isTech ? 'text-muted-foreground' : 'text-muted-foreground')}>Ideal for compact deployments</span>
                  </div>
                  <RadioGroupItem value="2mp" id="ip-res-2" aria-label="Select 2 MP IP camera resolution" />
                </Label>
                <Label className={cn('flex cursor-pointer items-center justify-between rounded-md border p-3', isTech && 'border-border bg-muted/40 text-foreground', ipSelections.resolution === '4mp' && (isTech ? 'border-primary bg-primary/10' : 'border-primary'))}
                  htmlFor="ip-res-4">
                  <div>
                    <span className="block font-medium">4 MP</span>
                    <span className={cn('text-xs', isTech ? 'text-muted-foreground' : 'text-muted-foreground')}>Sharper detail for analytics</span>
                  </div>
                  <RadioGroupItem value="4mp" id="ip-res-4" aria-label="Select 4 MP IP camera resolution" />
                </Label>
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <Label>Dual-light Capability</Label>
              <RadioGroup
                value={ipSelections.dualLight ? 'yes' : 'no'}
                onValueChange={(value) => setIpSelections((previous) => ({ ...previous, dualLight: value === 'yes' }))}
                className="grid gap-2"
              >
                <Label className={cn('flex cursor-pointer items-center justify-between rounded-md border p-3', isTech && 'border-border bg-muted/40 text-foreground', !ipSelections.dualLight && (isTech ? 'border-primary bg-primary/10' : 'border-primary'))}
                  htmlFor="ip-dual-no">
                  <div>
                    <span className="block font-medium">Standard IR</span>
                    <span className={cn('text-xs', isTech ? 'text-muted-foreground' : 'text-muted-foreground')}>Monochrome at night</span>
                  </div>
                  <RadioGroupItem value="no" id="ip-dual-no" aria-label="Use standard infrared IP cameras" />
                </Label>
                <Label className={cn('flex cursor-pointer items-center justify-between rounded-md border p-3', isTech && 'border-border bg-muted/40 text-foreground', ipSelections.dualLight && (isTech ? 'border-primary bg-primary/10' : 'border-primary'))}
                  htmlFor="ip-dual-yes">
                  <div>
                    <span className="block font-medium">Dual-light</span>
                    <span className={cn('text-xs', isTech ? 'text-muted-foreground' : 'text-muted-foreground')}>Colour capture at night</span>
                  </div>
                  <RadioGroupItem value="yes" id="ip-dual-yes" aria-label="Use dual-light IP cameras" />
                </Label>
              </RadioGroup>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ip-cable">Cabling</Label>
            <Select value={ipSelections.cableId} onValueChange={(value) => setIpSelections((previous) => ({ ...previous, cableId: value }))}>
              <SelectTrigger id="ip-cable" className={selectTriggerClassName}>
                <SelectValue placeholder="Select cable" />
              </SelectTrigger>
              <SelectContent className={selectContentClassName}>
                {ipPricing.cable.map((option) => {
                  const quantity = calculateCableQuantity(cameraCount, option);
                  const totalSale = option.salePerUnit * quantity;
                  return (
                    <SelectItem key={option.id} value={option.id} className={selectItemClassName}>
                      <div className="flex flex-col">
                        <span>{option.label}</span>
                        <span className={cn('text-xs', selectMutedClassName)}>
                          100 m coverage per unit · Est. {quantity} unit{quantity > 1 ? 's' : ''} · {formatCurrency(totalSale)} sale
                        </span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  );
  };

  const defaultLayout = (
    <section className="space-y-8">
      <Card className={cardClassName}>
        <CardHeader className={cardHeaderClassName}>
          <CardTitle className={isTech ? 'text-white' : undefined}>Configure your surveillance stack</CardTitle>
          <CardDescription className={cardDescriptionClassName}>Adjust the camera count and component preferences to instantly preview bundled MRP and sale totals.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Choose recorder path</Label>
            <RadioGroup value={system} onValueChange={(value: SetupSystem) => setSystem(value)} className="grid gap-3 sm:grid-cols-2">
              <Label className={cn('flex cursor-pointer items-center justify-between rounded-lg border p-4', isTech && 'border-border bg-muted/40 text-foreground', system === 'analog' && (isTech ? 'border-primary bg-primary/10' : 'border-primary'))}
                htmlFor="system-analog">
                <div>
                  <span className="block text-lg font-semibold">Analog (DVR)</span>
                  <span className={cn('text-xs', isTech ? 'text-muted-foreground' : 'text-muted-foreground')}>Best for coaxial retrofits and budget installations</span>
                </div>
                <RadioGroupItem value="analog" id="system-analog" aria-label="Choose analog DVR system" />
              </Label>
              <Label className={cn('flex cursor-pointer items-center justify-between rounded-lg border p-4', isTech && 'border-border bg-muted/40 text-foreground', system === 'ip' && (isTech ? 'border-primary bg-primary/10' : 'border-primary'))}
                htmlFor="system-ip">
                <div>
                  <span className="block text-lg font-semibold">IP (NVR)</span>
                  <span className={cn('text-xs', isTech ? 'text-muted-foreground' : 'text-muted-foreground')}>PoE-based deployments with smart analytics</span>
                </div>
                <RadioGroupItem value="ip" id="system-ip" aria-label="Choose IP NVR system" />
              </Label>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="camera-count">Number of cameras</Label>
            <Input
              id="camera-count"
              type="number"
              min={1}
              max={32}
              value={cameraCountInput}
              onChange={handleCameraCountChange}
              onBlur={handleCameraCountBlur}
              placeholder="Enter number of cameras"
              className={inputClassName}
            />
            <p className={cn('text-xs', isTech ? 'text-slate-400' : 'text-muted-foreground')}>Supported range: 1 to 32 cameras.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="it-system-count">Number of IT systems</Label>
            <Input
              id="it-system-count"
              type="number"
              min={0}
              max={20}
              value={itSystemCount}
              onChange={handleItRangeChange}
              className={inputClassName}
            />
            <p className={cn('text-xs', isTech ? 'text-slate-400' : 'text-muted-foreground')}>IT systems are tracked separately from CCTV camera count.</p>
          </div>
        </CardContent>
      </Card>

      {activeAnalog ? renderAnalogControls() : renderIpControls()}

      <Card className={cardClassName}>
        <CardHeader className={cardHeaderClassName}>
          <CardTitle className={isTech ? 'text-white' : undefined}>Storage & Add-ons</CardTitle>
          <CardDescription className={cardDescriptionClassName}>Select the storage capacity and optional add-ons to complete your build.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="hdd-option">Surveillance HDD</Label>
            <Select value={hddId} onValueChange={(value) => setHddId(value)}>
              <SelectTrigger id="hdd-option" className={selectTriggerClassName}>
                <SelectValue placeholder="Select drive capacity" />
              </SelectTrigger>
              <SelectContent className={selectContentClassName}>
                {selectableHddOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id} className={selectItemClassName}>
                    <div className="flex flex-col">
                      <span>{option.label}</span>
                      <span className={cn('text-xs', selectMutedClassName)}>
                        {option.mrp ? `${formatCurrency(option.mrp)} MRP · ` : ''}{formatCurrency(option.sale)} sale
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Card className={cardClassName}>
            <CardHeader>
              <CardTitle className={cardHeaderClassName}>Optional Accessories</CardTitle>
              <CardDescription className={cardDescriptionClassName}>Add-on options for your setup</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Monitor Included Checkbox */}
              <div className={cn('flex items-start gap-3 rounded-md border p-3', isTech && 'border-white/10 bg-white/5')}>
                <Checkbox id="monitor-included" checked={monitorIncluded} onCheckedChange={(checked) => setMonitorIncluded(Boolean(checked))} />
                <div>
                  <Label htmlFor="monitor-included" className="text-sm font-semibold">Include Surveillance Monitor</Label>
                  <p className={cn('text-xs', isTech ? 'text-slate-400' : 'text-muted-foreground')}>
                    Add a surveillance monitor to view your camera feeds on-site
                  </p>
                </div>
              </div>

              {/* Monitor Selection */}
              {monitorIncluded && (
                <div className="space-y-2">
                  <Label htmlFor="monitor-select">Monitor Size</Label>
                  <Select value={monitorId} onValueChange={setMonitorId}>
                    <SelectTrigger id="monitor-select" className={selectTriggerClassName}>
                      <SelectValue placeholder="Select monitor size" />
                    </SelectTrigger>
                    <SelectContent className={selectContentClassName}>
                      {FALLBACK_MONITOR_OPTIONS.map((option) => {
                        const resolved = resolveAccessoryPrice(option.id, option.mrp ?? 0, option.sale, accessoryPricing);
                        return (
                          <SelectItem key={option.id} value={option.id} className={selectItemClassName}>
                            <div className="flex flex-col">
                              <span>{option.label}</span>
                              <span className={cn('text-xs', selectMutedClassName)}>
                                {resolved.mrp ? `${formatCurrency(resolved.mrp)} MRP · ` : ''}{formatCurrency(resolved.sale)} sale
                              </span>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Wall Mount Add-on */}
              {monitorIncluded && (
                <div className={cn('flex items-start gap-3 rounded-md border p-3', isTech && 'border-white/10 bg-white/5')}>
                  <Checkbox id="wall-mount" checked={wallMountIncluded} onCheckedChange={(checked) => setWallMountIncluded(Boolean(checked))} />
                  <div>
                    <Label htmlFor="wall-mount" className="text-sm font-semibold">Wall Mount Installation</Label>
                    <p className={cn('text-xs', isTech ? 'text-slate-400' : 'text-muted-foreground')}>
                      +{formatCurrency(resolveAccessoryPrice('wall-mount-addon', FALLBACK_WALL_MOUNT_ADDON.mrp ?? 0, FALLBACK_WALL_MOUNT_ADDON.sale, accessoryPricing).sale)}
                    </p>
                  </div>
                </div>
              )}

              {/* Spike Guard */}
              <div className={cn('flex items-start gap-3 rounded-md border p-3', isTech && 'border-white/10 bg-white/5')}>
                <Checkbox id="spike-guard" checked={spikeGuardIncluded} onCheckedChange={(checked) => setSpikeGuardIncluded(Boolean(checked))} />
                <div>
                  <Label htmlFor="spike-guard" className="text-sm font-semibold">{FALLBACK_SPIKE_GUARD_OPTION.label}</Label>
                  <p className={cn('text-xs', isTech ? 'text-slate-400' : 'text-muted-foreground')}>
                    +{formatCurrency(resolveAccessoryPrice('spike-guard', FALLBACK_SPIKE_GUARD_OPTION.mrp ?? 0, FALLBACK_SPIKE_GUARD_OPTION.sale, accessoryPricing).sale)}
                  </p>
                </div>
              </div>

              {/* Rack Selection */}
              <div className="space-y-2">
                <Label htmlFor="rack-select">Rack Cabinet (Optional)</Label>
                <Select value={rackId ?? 'none'} onValueChange={(val) => setRackId(val === 'none' ? null : val)}>
                  <SelectTrigger id="rack-select" className={selectTriggerClassName}>
                    <SelectValue placeholder="Select or skip rack cabinet" />
                  </SelectTrigger>
                  <SelectContent className={selectContentClassName}>
                    <SelectItem value="none" className={selectItemClassName}>
                      <span>None (Skip Rack)</span>
                    </SelectItem>
                    {FALLBACK_RACK_OPTIONS.map((option) => {
                      const resolved = resolveAccessoryPrice(option.id, option.mrp ?? 0, option.sale, accessoryPricing);
                      return (
                        <SelectItem key={option.id} value={option.id} className={selectItemClassName}>
                          <div className="flex flex-col">
                            <span>{option.label}</span>
                            <span className={cn('text-xs', selectMutedClassName)}>
                              {resolved.mrp ? `${formatCurrency(resolved.mrp)} MRP · ` : ''}{formatCurrency(resolved.sale)} sale
                            </span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Conduit Pipe Selection and Metering */}
              <div className="space-y-2">
                <Label htmlFor="conduit-select">Conduit Pipe Type (Optional)</Label>
                <Select value={conduitPipeId ?? 'none'} onValueChange={(val) => setConduitPipeId(val === 'none' ? null : val)}>
                  <SelectTrigger id="conduit-select" className={selectTriggerClassName}>
                    <SelectValue placeholder="Select or skip conduit pipe" />
                  </SelectTrigger>
                  <SelectContent className={selectContentClassName}>
                    <SelectItem value="none" className={selectItemClassName}>
                      <span>None (Skip Conduit)</span>
                    </SelectItem>
                    {FALLBACK_CONDUIT_PIPE_OPTIONS.map((option) => {
                      const resolved = resolveAccessoryPrice(option.id, option.mrp ?? 0, option.sale, accessoryPricing);
                      return (
                        <SelectItem key={option.id} value={option.id} className={selectItemClassName}>
                          <span>{option.label.split(' (')[0]} (₹{resolved.sale}/mtr)</span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Conduit Meter Input */}
              {conduitPipeId && (
                <div className="space-y-2">
                  <Label htmlFor="conduit-meters">Length in Meters</Label>
                  <Input
                    id="conduit-meters"
                    type="number"
                    min={0}
                    max={500}
                    value={conduitMeters}
                    onChange={(e) => setConduitMeters(Math.max(0, Number.parseInt(e.target.value, 10) || 0))}
                    placeholder="Enter length in meters"
                    className={inputClassName}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </CardContent>
      </Card>

      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className={cardHeaderClassName}>
          <CardTitle className={isTech ? 'text-white' : undefined}>Total investment preview</CardTitle>
          <CardDescription className={cardDescriptionClassName}>Final proposal will reconfirm inventory and site dependencies before order.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className={cn('flex items-center justify-between text-sm font-medium', isTech && 'text-slate-200')}>
              <span>System (recorder, power, cameras, cabling)</span>
              <span>{formatCurrency(totals.system.sale)} sale{totals.system.mrp ? ` · ${formatCurrency(totals.system.mrp)} MRP` : ''}</span>
            </p>
            <ul className={cn('space-y-1 text-xs', isTech ? 'text-slate-400' : 'text-muted-foreground')}>
              {totals.system.breakdown.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>

          <div className={cn('grid gap-3 text-sm', isTech && 'text-slate-300')}>
            <div className="flex items-center justify-between">
              <span>{totals.hdd.label}</span>
              <span>
                {formatCurrency(totals.hdd.sale)} sale{totals.hdd.mrp ? ` · ${formatCurrency(totals.hdd.mrp)} MRP` : ''}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Monitor</span>
              {totals.monitor.included ? (
                <span>
                  {formatCurrency(totals.monitor.sale)} sale{totals.monitor.mrp ? ` · ${formatCurrency(totals.monitor.mrp)} MRP` : ''}
                </span>
              ) : (
                <Badge variant="outline" className={isTech ? 'border-white/20 text-slate-300' : undefined}>Not included</Badge>
              )}
            </div>
            {totals.wallMount.included && (
              <div className="flex items-center justify-between">
                <span>Wall Mount</span>
                <span>
                  {formatCurrency(totals.wallMount.sale)} sale{totals.wallMount.mrp ? ` · ${formatCurrency(totals.wallMount.mrp)} MRP` : ''}
                </span>
              </div>
            )}
            {totals.spikeGuard.included && (
              <div className="flex items-center justify-between">
                <span>Spike Guard</span>
                <span>
                  {formatCurrency(totals.spikeGuard.sale)} sale{totals.spikeGuard.mrp ? ` · ${formatCurrency(totals.spikeGuard.mrp)} MRP` : ''}
                </span>
              </div>
            )}
            {totals.rack.selected && (
              <div className="flex items-center justify-between">
                <span>{totals.rack.label}</span>
                <span>
                  {formatCurrency(totals.rack.sale)} sale{totals.rack.mrp ? ` · ${formatCurrency(totals.rack.mrp)} MRP` : ''}
                </span>
              </div>
            )}
            {totals.conduit.selected && (
              <div className="flex items-center justify-between">
                <span>{totals.conduit.label} ({totals.conduit.meters}m)</span>
                <span>
                  {formatCurrency(totals.conduit.sale)} sale{totals.conduit.mrp ? ` · ${formatCurrency(totals.conduit.mrp)} MRP` : ''}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span>Installation</span>
              {totals.installation.included ? (
                <span>
                  {formatCurrency(totals.installation.sale)} sale{totals.installation.mrp ? ` · ${formatCurrency(totals.installation.mrp)} MRP` : ' · No MRP'}
                </span>
              ) : (
                <Badge variant="outline" className={isTech ? 'border-white/20 text-slate-300' : undefined}>Not included</Badge>
              )}
            </div>
            {totals.installation.included && totals.installationLabor.breakdown && totals.installationLabor.breakdown.length > 0 && (
              <>
                <div className={cn('flex items-center justify-between text-xs mt-1', isTech ? 'text-slate-400' : 'text-slate-500')}>
                  <span>Installation Labor Breakdown:</span>
                </div>
                {totals.installationLabor.breakdown.map((line, idx) => (
                  <div key={idx} className={cn('flex items-center justify-between text-xs pl-4', isTech ? 'text-slate-500' : 'text-slate-600')}>
                    <span>{line}</span>
                  </div>
                ))}
              </>
            )}
          </div>

          {totals.installation.included && (
            <div className="pt-2">
              <FreeInstallationOfferBanner 
                installationPrice={totals.installation.sale} 
                isEligible={true}
                variant="card"
              />
            </div>
          )}

          <div className={cn('rounded-lg p-4 text-sm shadow-inner', isTech ? 'bg-white/5 text-slate-200' : 'bg-white/70')}>
            <p className={cn('flex items-center justify-between text-base font-semibold', isTech ? 'text-white' : 'text-slate-900')}>
              <span>Sale Total</span>
              <span>{formatCurrency(totals.overall.sale)}</span>
            </p>
            <p className={cn('flex items-center justify-between text-sm', isTech ? 'text-slate-400' : 'text-slate-600')}>
              <span>MRP Total</span>
              <span>{formatCurrency(totals.overall.mrp)}</span>
            </p>
            <p className={cn('flex items-center justify-between text-sm', isTech ? 'text-emerald-300' : 'text-emerald-600')}>
              <span>Savings</span>
              <span>
                {formatCurrency(totals.overall.discountAmount)} ({totals.overall.discountPercent >= 10 ? totals.overall.discountPercent.toFixed(0) : totals.overall.discountPercent.toFixed(1)}%)
              </span>
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className={cn('text-xs', isTech ? 'text-slate-300' : 'text-slate-600')}>Download this estimate or proceed to book your setup.</span>
              <div className="flex gap-2 flex-wrap justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  className={isTech ? "border-amber-500/50 text-amber-400 hover:bg-amber-500/10" : "text-amber-600 border-amber-200"}
                  onClick={() => setIsBidding(true)}
                >
                  Negotiate Price
                </Button>
                <Button
                  size="sm"
                  variant={isTech ? 'secondary' : 'outline'}
                  onClick={handleInlineQuoteDownload}
                  disabled={quoteDownloading}
                >
                  {quoteDownloading ? 'Preparing…' : 'Download Quote'}
                </Button>
                <Button
                  size="sm"
                  variant="default"
                  onClick={handleBookNow}
                  className={isTech ? 'bg-primary text-primary-foreground hover:bg-primary/90 font-bold' : ''}
                >
                  Book Installation
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. SHARE-FOR-DISCOUNT CONVERSION BOOSTER */}
      <Card className="mt-8 border-yellow-500/30 bg-yellow-500/5 backdrop-blur-md overflow-hidden relative group">
        <div className="absolute top-0 right-0 p-2 opacity-20 group-hover:rotate-12 transition-transform">
          <Share2 className="w-12 h-12 text-yellow-500" />
        </div>
        <CardContent className="p-6 relative z-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex-1">
              <h4 className="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-yellow-400" /> Share & Unlock 10% Off
              </h4>
              <p className="text-sm text-slate-400 mt-1 leading-relaxed">
                Publish your technical blueprint to our public explorer and share it with your network to receive an instant <span className="text-yellow-400 font-bold">10% discount</span> on this setup.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button 
                onClick={async () => {
                  try {
                    // 1. Mock publish call (In real scenario, would save to DB)
                    const blueprintId = `BP-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
                    
                    // 2. Execute secure webhook dispatch
                    const res = await fetch('/api/auto-offers', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ 
                        action: 'issue_share_discount', 
                        blueprintId, 
                        platform: 'X/LinkedIn' 
                      })
                    });
                    
                    const data = await res.json();
                    if (data.success) {
                      toast({ 
                        title: 'Viral Discount Applied!', 
                        description: 'Your 10% share-bonus has been added to the calculation.',
                        variant: 'default'
                      });
                      // Logic to trigger cart refresh would go here
                    }
                    
                    // 3. Open share dialog
                    const shareUrl = `https://tecbunny.com/blueprints/${blueprintId}`;
                    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(`Check out my custom security architecture on TecBunny! ${shareUrl}`)}`, '_blank');
                    
                  } catch (err) {
                    console.error('Viral trigger failed', err);
                  }
                }}
                className="bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-bold h-12 px-6 rounded-xl shadow-lg shadow-yellow-500/20"
              >
                Publish & Share <Share2 className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {isBidding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#030712] border border-amber-500/30 rounded-xl max-w-md w-full p-6 shadow-2xl relative">
            <h3 className="text-xl font-bold text-white mb-2">Request Revised Price</h3>
            <p className="text-sm text-slate-400 mb-6">Enter your details and bid a price for this custom setup. Our team will review and respond shortly.</p>
            
            <div className="space-y-4">
              <div>
                <Label className="text-slate-300">Name</Label>
                <Input value={bidForm.name} onChange={e => setBidForm({...bidForm, name: e.target.value})} className="bg-white/5 border-white/10" placeholder="John Doe" />
              </div>
              <div>
                <Label className="text-slate-300">Phone Number</Label>
                <Input value={bidForm.phone} onChange={e => setBidForm({...bidForm, phone: e.target.value})} className="bg-white/5 border-white/10" placeholder="+91 9876543210" />
              </div>
              <div>
                <Label className="text-slate-300">Email Address (Optional)</Label>
                <Input value={bidForm.email} onChange={e => setBidForm({...bidForm, email: e.target.value})} className="bg-white/5 border-white/10" placeholder="john@example.com" />
              </div>
              <div>
                <Label className="text-slate-300">Installation Address</Label>
                <Input value={bidForm.address} onChange={e => setBidForm({...bidForm, address: e.target.value})} className="bg-white/5 border-white/10" placeholder="City, Area" />
              </div>
              <div>
                <Label className="text-amber-400 font-bold">Your Bid Price (₹)</Label>
                <Input type="number" value={bidForm.price} onChange={e => setBidForm({...bidForm, price: e.target.value})} className="bg-amber-500/10 border-amber-500/30 text-amber-100 placeholder:text-amber-500/30" placeholder={`E.g. ${Math.round(totals.overall.sale * 0.9)}`} />
                <p className="text-xs text-slate-500 mt-1">Current total: {formatCurrency(totals.overall.sale)}</p>
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-8">
              <Button variant="ghost" onClick={() => setIsBidding(false)} className="text-slate-400 hover:text-white">Cancel</Button>
              <Button onClick={handleSubmitBid} className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold">Submit Bid</Button>
            </div>
          </div>
        </div>
      )}

      <ROICostEfficiencyBanner savingsPercentage={Math.round(totals.overall.discountPercent)} isTech={isTech} />
    </section>
  );

  const techLayout = (
    <section className="blueprint-bg bg-[#050b14] py-10">
      

      <div className="flex items-center justify-center mb-12">
        <div className="flex items-center">
          <div className="step-circle active w-8 h-8 rounded-full border-2 border-white/20 flex items-center justify-center font-bold text-sm bg-[#030712] transition-colors">1</div>
          <div className="step-line active w-16 h-1 bg-white/10 transition-colors"></div>
          <div className="step-circle w-8 h-8 rounded-full border-2 border-white/20 flex items-center justify-center font-bold text-sm text-slate-500 bg-[#030712] transition-colors">2</div>
          <div className="step-line w-16 h-1 bg-white/10 transition-colors"></div>
          <div className="step-circle w-8 h-8 rounded-full border-2 border-white/20 flex items-center justify-center font-bold text-sm text-slate-500 bg-[#030712] transition-colors">3</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Card className={cardClassName}>
            <CardHeader className={cardHeaderClassName}>
              <CardTitle className="text-white">Select Premises Type</CardTitle>
              <CardDescription className={cardDescriptionClassName}>Choose the environment that best matches your site.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {([
                  { value: 'Residential', label: 'Residential', description: 'Villas & Apartments', icon: 'home' },
                  { value: 'Commercial', label: 'Commercial', description: 'Shops & Offices', icon: 'building' },
                  { value: 'Industrial', label: 'Industrial', description: 'Warehouses & Factories', icon: 'factory' },
                ] as const).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setPremiseType(option.value)}
                    onMouseMove={(event) => {
                      const rect = event.currentTarget.getBoundingClientRect();
                      event.currentTarget.style.setProperty('--mouse-x', `${event.clientX - rect.left}px`);
                      event.currentTarget.style.setProperty('--mouse-y', `${event.clientY - rect.top}px`);
                    }}
                    className={cn(
                      'selection-card border border-border bg-card/60 p-6 rounded-2xl text-center flex flex-col items-center justify-center',
                      premiseType === option.value && 'selected'
                    )}
                  >
                    <div className="h-12 w-12 rounded-xl bg-muted/30 border border-border flex items-center justify-center mb-4 text-primary">
                      <span className="text-xl">
                        {option.icon === 'home' && '🏠'}
                        {option.icon === 'building' && '🏢'}
                        {option.icon === 'factory' && '🏭'}
                      </span>
                    </div>
                    <h3 className="font-semibold text-foreground">{option.label}</h3>
                    <p className="text-xs text-muted-foreground mt-2">{option.description}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Scope card removed per request */}

          {defaultLayout}
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-24">
            <div className="relative bg-card border border-primary/30 rounded-2xl p-6 shadow-2xl overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" style={{ animation: 'scanLine 2s linear infinite' }}></div>

              <h3 className="text-xl font-semibold text-foreground mb-4 border-b border-border pb-2">System Blueprint</h3>

              <div className="space-y-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Premise Type</span>
                  <span className="text-foreground font-semibold text-right">{premiseType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CCTV Setup</span>
                  <span className="text-primary font-semibold text-right">{cameraCountLabel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">IT Systems</span>
                  <span className="text-violet-500 font-semibold text-right">{itSystemLabel}</span>
                </div>
                {automationEnabled && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Automation</span>
                    <span className="text-foreground font-semibold text-right">Included</span>
                  </div>
                )}
                {alarmEnabled && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Defense</span>
                    <span className="text-amber-500 font-semibold text-right">Active</span>
                  </div>
                )}
              </div>

              <div className="mt-6 pt-6 border-t border-border">
                <p className="text-xs text-muted-foreground mb-2">Recommended Hardware Kit:</p>
                <div className="bg-muted/30 rounded-lg p-3 text-xs text-muted-foreground font-mono">
                  {recommendationLines.map((line) => (
                    <div key={line}>{line}</div>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex gap-2 items-center">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-xs text-emerald-500 font-bold">SYSTEM COMPATIBLE</span>
              </div>

              <div className="mt-6 pt-4 border-t border-border">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-muted-foreground text-sm">Estimated Total</span>
                  <span className="text-xl font-bold text-foreground">{formatCurrency(totals.overall.sale)}</span>
                </div>
                <div className="flex flex-col gap-2">
                  <Button 
                    onClick={handleBookNow} 
                    className="w-full bg-primary hover:bg-primary/90 text-white font-bold uppercase tracking-wider"
                  >
                    Book Installation
                  </Button>
                  <Button 
                    onClick={() => setIsBidding(true)} 
                    variant="outline"
                    className="w-full border-amber-500/30 text-amber-500 hover:bg-amber-500/10 font-bold uppercase tracking-wider"
                  >
                    Negotiate Price
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );

  return isTech ? techLayout : defaultLayout;
}

export default CustomSetupFlow;
