import { useEffect, useState } from 'react';

import { media } from '@/services/media';

/** Resolves a private listing photo to a short-lived signed URL through the media function. */
export function usePhotoUrl(photoId: string | undefined) {
  const [result, setResult] = useState<{ id: string; url: string | null; failed: boolean } | null>(null);

  useEffect(() => {
    if (!photoId) return;
    let active = true;
    media.url(photoId)
      .then(({ url }) => { if (active) setResult({ id: photoId, url, failed: false }); })
      .catch(() => { if (active) setResult({ id: photoId, url: null, failed: true }); });
    return () => { active = false; };
  }, [photoId]);

  // Ignore a result that belongs to a previous photo ID.
  const current = result?.id === photoId ? result : null;
  return { url: current?.url ?? null, failed: current?.failed ?? false };
}
