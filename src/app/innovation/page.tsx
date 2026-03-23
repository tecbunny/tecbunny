import { Metadata } from 'next';

import InnovationPage from '../../components/innovation-page';
import { createPageMetadata } from '../../lib/metadata';
import { logger } from '../../lib/logger';
import { createClient, createServiceClient, isSupabaseServiceConfigured } from '../../lib/supabase/server';
import type { InnovationDevice, InnovationMode } from '../../lib/types';

export const metadata: Metadata = createPageMetadata({
  title: 'Home Automation & Smart Security in Goa & Maharashtra',
  description: 'Explore TecBunny home automation, smart security, and connected-space solutions for homes, offices, hotels, and managed properties in Goa and Maharashtra.',
  keywords: ['home automation Goa', 'smart security Goa', 'automation Maharashtra', 'smart home solutions Goa', 'TecBunny innovation'],
  path: '/innovation',
  image: '/brand.png',
});

// export const dynamic = 'force-dynamic';

export default async function Page() {
  let modes: InnovationMode[] = [];
  let devices: InnovationDevice[] = [];

  try {
    const supabase = isSupabaseServiceConfigured
      ? createServiceClient()
      : await createClient();

    const [{ data: modeData, error: modeError }, { data: deviceData, error: deviceError }] = await Promise.all([
      supabase.from('innovation_modes').select('*'),
      supabase.from('innovation_devices').select('*'),
    ]);

    if (modeError) {
      logger.error('Error fetching innovation modes', {
        message: modeError.message,
        details: modeError.details,
        hint: modeError.hint,
        code: modeError.code,
      });
    }

    if (deviceError) {
      logger.error('Error fetching innovation devices', {
        message: deviceError.message,
        details: deviceError.details,
        hint: deviceError.hint,
        code: deviceError.code,
      });
    }

    modes = (modeData || []).map((mode: any) => {
      const rawItems = mode.items ?? [];
      const items = Array.isArray(rawItems)
        ? rawItems
        : typeof rawItems === 'string'
          ? (() => {
              try {
                const parsed = JSON.parse(rawItems);
                return Array.isArray(parsed) ? parsed : [];
              } catch {
                return [];
              }
            })()
          : [];

      return {
        ...mode,
        items,
        is_active: typeof mode.is_active === 'boolean' ? mode.is_active : true,
        display_order: typeof mode.display_order === 'number' ? mode.display_order : 0,
      } as InnovationMode;
    });

    devices = (deviceData || []).map((device: any) => {
      const rawChips = device.chips ?? [];
      const chips = Array.isArray(rawChips)
        ? rawChips
        : typeof rawChips === 'string'
          ? (() => {
              try {
                const parsed = JSON.parse(rawChips);
                return Array.isArray(parsed) ? parsed : [];
              } catch {
                return [];
              }
            })()
          : [];

      return {
        ...device,
        chips,
        is_active: typeof device.is_active === 'boolean' ? device.is_active : true,
        display_order: typeof device.display_order === 'number' ? device.display_order : 0,
      } as InnovationDevice;
    });
  } catch (error) {
    logger.error('Error loading innovation page', { error });
  }

  return <InnovationPage modes={modes} devices={devices} />;
}
