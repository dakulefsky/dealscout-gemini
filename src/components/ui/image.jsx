import { useEffect, useMemo, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { cn } from '@/lib/utils';

function cleanSources(src, fallbackSrcs) {
  const values = [src, ...(Array.isArray(fallbackSrcs) ? fallbackSrcs : [])]
    .filter((value) => typeof value === 'string' && /^https?:\/\//i.test(value.trim()))
    .map((value) => value.trim());
  return [...new Set(values)];
}

export function Image({ src, fallbackSrcs = [], alt = '', className, fittingType = 'fill', ...props }) {
  const sources = useMemo(() => cleanSources(src, fallbackSrcs), [src, fallbackSrcs]);
  const [sourceIndex, setSourceIndex] = useState(0);

  useEffect(() => { setSourceIndex(0); }, [src]);

  const objectFit = fittingType === 'fit' || fittingType === 'contain' ? 'object-contain' : 'object-cover';
  const currentSrc = sources[sourceIndex];

  if (!currentSrc) {
    return (
      <div className={cn('flex items-center justify-center bg-slate-100 text-slate-300', className)} role="img" aria-label={alt}>
        <ImageOff className="h-8 w-8" />
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setSourceIndex((index) => index + 1)}
      className={cn(objectFit, className)}
      {...props}
    />
  );
}

export default Image;
