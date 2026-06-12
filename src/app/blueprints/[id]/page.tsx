import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import { BlueprintShowcase } from '@/components/customised-setups/BlueprintShowcase';

interface BlueprintPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Headless SEO Meta Propagation & Open Graph Dynamic Renderer
 */
export async function generateMetadata({ params }: BlueprintPageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = createServiceClient();
  
  const { data: blueprint } = await supabase
    .from('published_blueprints')
    .select('*, profiles:creator_id(name)')
    .eq('id', id)
    .single();

  if (!blueprint) return { title: 'Blueprint Not Found | TecBunny' };

  const config = blueprint.config_payload;
  const creator = blueprint.profiles?.name || 'Expert User';
  const title = `${config.cameraCount}x Node ${config.systemType} Security Blueprint by ${creator}`;
  const description = `Visualizing a high-fidelity ${config.premiseType} security setup with ${config.resolution} resolution and ${config.storage} storage. Compliance Grade: Tier-1 Verified.`;

  // Dynamic OG image targeting an edge function generator
  const ogImageUrl = `https://tecbunny.com/api/og/blueprint?id=${id}&nodes=${config.cameraCount}&type=${encodeURIComponent(config.systemType)}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: title }],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
    },
    other: {
      'application/ld+json': JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'TechArticle',
        'headline': title,
        'description': description,
        'image': ogImageUrl,
        'author': { '@type': 'Person', 'name': creator },
        'publisher': { '@type': 'Organization', 'name': 'TecBunny' }
      })
    }
  };
}

export default async function BlueprintPage({ params }: BlueprintPageProps) {
  const { id } = await params;
  const supabase = createServiceClient();

  const { data: blueprint } = await supabase
    .from('published_blueprints')
    .select('*, profiles:creator_id(name, avatar_url)')
    .eq('id', id)
    .single();

  if (!blueprint) notFound();

  return (
    <main className="min-h-screen bg-background pt-20">
      <BlueprintShowcase blueprint={blueprint} />
    </main>
  );
}
