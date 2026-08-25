import { useState } from 'react';
import { ImageOff } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * A drop-in replacement for the Base44 `Image` component.
 *
 * Renders a standard <img> element and gracefully falls back to a neutral
 * placeholder when `src` is missing or the image fails to load.
 *
 * `fittingType` mirrors the old Base44 API:
 *   - "fill" (default) → object-cover (fills the container, cropping if needed)
 *   - "fit"            → object-contain (shows the whole image, letterboxed)
 */
export function Image({ src, alt = '', className, fittingType = 'fill', ...props }) {
  const [failed, setFailed] = useState(false);

  const objectFit = fittingType === 'fit' ? 'object-contain' : 'object-cover';

  if (!src || failed) {
    return (
      <div
        className={cn('flex items-center justify-center bg-slate-100 text-slate-300', className)}
        role="img"
        aria-label={alt}
      >
        <ImageOff className="h-8 w-8" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn(objectFit, className)}
      {...props}
    />
  );
}

export default Image;
