'use client';

import * as React from 'react';

import { Plus, Trash2, Pencil } from 'lucide-react';

import { createClient } from '../../../../lib/supabase/client';
import { useToast } from '../../../../hooks/use-toast';
import { logger } from '../../../../lib/logger';
import type { InnovationDevice, InnovationMode, InnovationModeItem } from '../../../../lib/types';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Textarea } from '../../../../components/ui/textarea';
import { Switch } from '../../../../components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../components/ui/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../../../../components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../components/ui/select';
import { Badge } from '../../../../components/ui/badge';

const ICON_OPTIONS = [
  'Shield',
  'Wifi',
  'Bell',
  'Camera',
  'Lightbulb',
  'Cpu',
  'Zap',
  'Leaf',
  'DoorClosed',
  'Speaker',
];

const defaultModeForm: Omit<InnovationMode, 'id' | 'created_at'> = {
  key: '',
  label: '',
  sub: '',
  title: '',
  description: '',
  icon: 'Shield',
  rec_id: '',
  items: [],
  is_active: true,
  display_order: 0,
  updated_at: new Date().toISOString(),
};

const defaultDeviceForm: Omit<InnovationDevice, 'id' | 'created_at'> = {
  title: '',
  description: '',
  accent: 'violet',
  icon: 'Shield',
  chips: [],
  is_active: true,
  display_order: 0,
  updated_at: new Date().toISOString(),
};

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export default function AdminInnovationPage() {
  const [modes, setModes] = React.useState<InnovationMode[]>([]);
  const [devices, setDevices] = React.useState<InnovationDevice[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [modeDialogOpen, setModeDialogOpen] = React.useState(false);
  const [deviceDialogOpen, setDeviceDialogOpen] = React.useState(false);
  const [editingMode, setEditingMode] = React.useState<InnovationMode | null>(null);
  const [editingDevice, setEditingDevice] = React.useState<InnovationDevice | null>(null);

  const [modeForm, setModeForm] = React.useState(defaultModeForm);
  const [deviceForm, setDeviceForm] = React.useState(defaultDeviceForm);

  const [newItemText, setNewItemText] = React.useState('');
  const [newItemIcon, setNewItemIcon] = React.useState('Shield');
  const [newItemAccent, setNewItemAccent] = React.useState('text-violet-300');

  const [newChip, setNewChip] = React.useState('');

  const supabase = createClient();
  const { toast } = useToast();

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [{ data: modeData, error: modeError }, { data: deviceData, error: deviceError }] = await withTimeout(
        Promise.all([
          supabase.from('innovation_modes').select('*').order('display_order', { ascending: true }),
          supabase.from('innovation_devices').select('*').order('display_order', { ascending: true }),
        ]),
        12000,
        'Loading innovation content timed out.'
      );

      if (modeError) throw modeError;
      if (deviceError) throw deviceError;

      setModes(modeData || []);
      setDevices(deviceData || []);
    } catch (error) {
      logger.error('Failed to fetch innovation data', { error });
      setLoadError(error instanceof Error ? error.message : 'Failed to load innovation content');
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load innovation content',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [supabase, toast]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCreateMode = () => {
    setEditingMode(null);
    setModeForm({ ...defaultModeForm, updated_at: new Date().toISOString() });
    setModeDialogOpen(true);
  };

  const openEditMode = (mode: InnovationMode) => {
    setEditingMode(mode);
    setModeForm({
      key: mode.key,
      label: mode.label,
      sub: mode.sub,
      title: mode.title,
      description: mode.description,
      icon: mode.icon,
      rec_id: mode.rec_id,
      items: mode.items || [],
      is_active: mode.is_active,
      display_order: mode.display_order ?? 0,
      updated_at: new Date().toISOString(),
    });
    setModeDialogOpen(true);
  };

  const openCreateDevice = () => {
    setEditingDevice(null);
    setDeviceForm({ ...defaultDeviceForm, updated_at: new Date().toISOString() });
    setDeviceDialogOpen(true);
  };

  const openEditDevice = (device: InnovationDevice) => {
    setEditingDevice(device);
    setDeviceForm({
      title: device.title,
      description: device.description,
      accent: device.accent,
      icon: device.icon,
      chips: device.chips || [],
      is_active: device.is_active,
      display_order: device.display_order ?? 0,
      updated_at: new Date().toISOString(),
    });
    setDeviceDialogOpen(true);
  };

  const handleModeSave = async () => {
    try {
      const payload = {
        ...modeForm,
        updated_at: new Date().toISOString(),
      };

      if (editingMode) {
        const { error } = await supabase
          .from('innovation_modes')
          .update(payload)
          .eq('id', editingMode.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('innovation_modes')
          .insert([{
            ...payload,
            created_at: new Date().toISOString(),
          }]);
        if (error) throw error;
      }

      toast({ title: 'Saved', description: 'Innovation mode saved.' });
      setModeDialogOpen(false);
      fetchData();
    } catch (error: any) {
      logger.error('Failed to save innovation mode', { error });
      toast({
        title: 'Error',
        description: error?.message || 'Failed to save innovation mode',
        variant: 'destructive',
      });
    }
  };

  const handleDeviceSave = async () => {
    try {
      const payload = {
        ...deviceForm,
        updated_at: new Date().toISOString(),
      };

      if (editingDevice) {
        const { error } = await supabase
          .from('innovation_devices')
          .update(payload)
          .eq('id', editingDevice.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('innovation_devices')
          .insert([{
            ...payload,
            created_at: new Date().toISOString(),
          }]);
        if (error) throw error;
      }

      toast({ title: 'Saved', description: 'Innovation device saved.' });
      setDeviceDialogOpen(false);
      fetchData();
    } catch (error: any) {
      logger.error('Failed to save innovation device', { error });
      toast({
        title: 'Error',
        description: error?.message || 'Failed to save innovation device',
        variant: 'destructive',
      });
    }
  };

  const handleModeDelete = async (mode: InnovationMode) => {
    if (!window.confirm(`Delete mode "${mode.title}"?`)) return;
    try {
      const { error } = await supabase.from('innovation_modes').delete().eq('id', mode.id);
      if (error) throw error;
      toast({ title: 'Deleted', description: 'Mode deleted.' });
      fetchData();
    } catch (error) {
      logger.error('Failed to delete innovation mode', { error });
      toast({ title: 'Error', description: 'Failed to delete mode', variant: 'destructive' });
    }
  };

  const handleDeviceDelete = async (device: InnovationDevice) => {
    if (!window.confirm(`Delete device "${device.title}"?`)) return;
    try {
      const { error } = await supabase.from('innovation_devices').delete().eq('id', device.id);
      if (error) throw error;
      toast({ title: 'Deleted', description: 'Device deleted.' });
      fetchData();
    } catch (error) {
      logger.error('Failed to delete innovation device', { error });
      toast({ title: 'Error', description: 'Failed to delete device', variant: 'destructive' });
    }
  };

  const addModeItem = () => {
    if (!newItemText.trim()) return;
    const newItem: InnovationModeItem = {
      icon: newItemIcon,
      text: newItemText.trim(),
      accent: newItemAccent.trim() || 'text-violet-300',
    };
    setModeForm((prev) => ({ ...prev, items: [...(prev.items || []), newItem] }));
    setNewItemText('');
  };

  const updateModeItem = (index: number, updates: Partial<InnovationModeItem>) => {
    setModeForm((prev) => {
      const items = [...(prev.items || [])];
      items[index] = { ...items[index], ...updates };
      return { ...prev, items };
    });
  };

  const removeModeItem = (index: number) => {
    setModeForm((prev) => {
      const items = [...(prev.items || [])];
      items.splice(index, 1);
      return { ...prev, items };
    });
  };

  const addChip = () => {
    const trimmed = newChip.trim();
    if (!trimmed) return;
    setDeviceForm((prev) => ({ ...prev, chips: [...(prev.chips || []), trimmed] }));
    setNewChip('');
  };

  const removeChip = (index: number) => {
    setDeviceForm((prev) => {
      const chips = [...(prev.chips || [])];
      chips.splice(index, 1);
      return { ...prev, chips };
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Innovation Content</h1>
        <p className="text-muted-foreground">Manage the Innovation page modes and new device showcases.</p>
      </div>

      {loadError && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {loadError}
        </div>
      )}

      <Tabs defaultValue="modes">
        <TabsList>
          <TabsTrigger value="modes">Modes</TabsTrigger>
          <TabsTrigger value="devices">Devices</TabsTrigger>
        </TabsList>

        <TabsContent value="modes" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={openCreateMode}>
              <Plus className="mr-2 h-4 w-4" />
              Add Mode
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Innovation Modes</CardTitle>
              <CardDescription>Customize the scenarios shown on the Innovation page.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Key</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : modes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No modes found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    modes.map((mode) => (
                      <TableRow key={mode.id}>
                        <TableCell className="font-medium">{mode.key}</TableCell>
                        <TableCell>{mode.title}</TableCell>
                        <TableCell>
                          <Badge variant={mode.is_active ? 'default' : 'secondary'}>
                            {mode.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>{mode.display_order ?? 0}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => openEditMode(mode)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </Button>
                          <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleModeDelete(mode)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="devices" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={openCreateDevice}>
              <Plus className="mr-2 h-4 w-4" />
              Add Device
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>New Arrivals</CardTitle>
              <CardDescription>Showcase featured innovation devices.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : devices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        No devices found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    devices.map((device) => (
                      <TableRow key={device.id}>
                        <TableCell className="font-medium">{device.title}</TableCell>
                        <TableCell>
                          <Badge variant={device.is_active ? 'default' : 'secondary'}>
                            {device.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>{device.display_order ?? 0}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => openEditDevice(device)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </Button>
                          <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDeviceDelete(device)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={modeDialogOpen} onOpenChange={setModeDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingMode ? 'Edit Mode' : 'Add Mode'}</DialogTitle>
            <DialogDescription>Configure the innovation mode content.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <Input
              placeholder="Key (e.g., security)"
              value={modeForm.key}
              onChange={(event) => setModeForm((prev) => ({ ...prev, key: event.target.value }))}
            />
            <Input
              placeholder="Tab Label"
              value={modeForm.label}
              onChange={(event) => setModeForm((prev) => ({ ...prev, label: event.target.value }))}
            />
            <Input
              placeholder="Tab Subtitle"
              value={modeForm.sub}
              onChange={(event) => setModeForm((prev) => ({ ...prev, sub: event.target.value }))}
            />
            <Input
              placeholder="Title"
              value={modeForm.title}
              onChange={(event) => setModeForm((prev) => ({ ...prev, title: event.target.value }))}
            />
            <Textarea
              placeholder="Description"
              value={modeForm.description}
              onChange={(event) => setModeForm((prev) => ({ ...prev, description: event.target.value }))}
            />

            <div className="grid grid-cols-2 gap-4">
              <Select value={modeForm.icon} onValueChange={(value) => setModeForm((prev) => ({ ...prev, icon: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Icon" />
                </SelectTrigger>
                <SelectContent>
                  {ICON_OPTIONS.map((icon) => (
                    <SelectItem key={icon} value={icon}>
                      {icon}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                placeholder="Rec ID"
                value={modeForm.rec_id}
                onChange={(event) => setModeForm((prev) => ({ ...prev, rec_id: event.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                type="number"
                placeholder="Display Order"
                value={modeForm.display_order}
                onChange={(event) => setModeForm((prev) => ({ ...prev, display_order: Number(event.target.value) }))}
              />
              <div className="flex items-center gap-2">
                <Switch
                  checked={modeForm.is_active}
                  onCheckedChange={(checked) => setModeForm((prev) => ({ ...prev, is_active: checked }))}
                />
                <span className="text-sm">Active</span>
              </div>
            </div>

            <div className="space-y-3 rounded-lg border border-white/10 p-4">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Item text"
                  value={newItemText}
                  onChange={(event) => setNewItemText(event.target.value)}
                />
                <Select value={newItemIcon} onValueChange={setNewItemIcon}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Icon" />
                  </SelectTrigger>
                  <SelectContent>
                    {ICON_OPTIONS.map((icon) => (
                      <SelectItem key={icon} value={icon}>
                        {icon}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Accent class"
                  value={newItemAccent}
                  onChange={(event) => setNewItemAccent(event.target.value)}
                />
                <Button type="button" onClick={addModeItem}>
                  Add Item
                </Button>
              </div>

              {modeForm.items.map((item, index) => (
                <div key={`${item.text}-${index}`} className="grid grid-cols-[1fr_160px_1fr_auto] gap-2">
                  <Input
                    value={item.text}
                    onChange={(event) => updateModeItem(index, { text: event.target.value })}
                  />
                  <Select
                    value={item.icon}
                    onValueChange={(value) => updateModeItem(index, { icon: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ICON_OPTIONS.map((icon) => (
                        <SelectItem key={icon} value={icon}>
                          {icon}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={item.accent}
                    onChange={(event) => updateModeItem(index, { accent: event.target.value })}
                  />
                  <Button variant="ghost" onClick={() => removeModeItem(index)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setModeDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleModeSave}>{editingMode ? 'Update' : 'Create'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deviceDialogOpen} onOpenChange={setDeviceDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingDevice ? 'Edit Device' : 'Add Device'}</DialogTitle>
            <DialogDescription>Configure new arrivals shown on the Innovation page.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <Input
              placeholder="Title"
              value={deviceForm.title}
              onChange={(event) => setDeviceForm((prev) => ({ ...prev, title: event.target.value }))}
            />
            <Input
              placeholder="Short description"
              value={deviceForm.description}
              onChange={(event) => setDeviceForm((prev) => ({ ...prev, description: event.target.value }))}
            />

            <div className="grid grid-cols-2 gap-4">
              <Select
                value={deviceForm.icon}
                onValueChange={(value) => setDeviceForm((prev) => ({ ...prev, icon: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Icon" />
                </SelectTrigger>
                <SelectContent>
                  {ICON_OPTIONS.map((icon) => (
                    <SelectItem key={icon} value={icon}>
                      {icon}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                placeholder="Accent (e.g. violet)"
                value={deviceForm.accent}
                onChange={(event) => setDeviceForm((prev) => ({ ...prev, accent: event.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                type="number"
                placeholder="Display Order"
                value={deviceForm.display_order}
                onChange={(event) => setDeviceForm((prev) => ({ ...prev, display_order: Number(event.target.value) }))}
              />
              <div className="flex items-center gap-2">
                <Switch
                  checked={deviceForm.is_active}
                  onCheckedChange={(checked) => setDeviceForm((prev) => ({ ...prev, is_active: checked }))}
                />
                <span className="text-sm">Active</span>
              </div>
            </div>

            <div className="space-y-3 rounded-lg border border-white/10 p-4">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Feature chip"
                  value={newChip}
                  onChange={(event) => setNewChip(event.target.value)}
                />
                <Button type="button" onClick={addChip}>
                  Add Chip
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {deviceForm.chips.map((chip, index) => (
                  <Badge key={`${chip}-${index}`} variant="outline" className="gap-1">
                    {chip}
                    <button type="button" onClick={() => removeChip(index)}>
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeviceDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleDeviceSave}>{editingDevice ? 'Update' : 'Create'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
