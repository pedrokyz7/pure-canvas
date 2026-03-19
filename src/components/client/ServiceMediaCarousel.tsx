import { useState } from 'react';
import { ChevronLeft, ChevronRight, Play, Image, X, Maximize2 } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';

interface ServiceMediaCarouselProps {
  imageUrl: string | null;
  videoUrl: string | null;
  serviceName: string;
}

export function ServiceMediaCarousel({ imageUrl, videoUrl, serviceName }: ServiceMediaCarouselProps) {
  const media: { type: 'image' | 'video'; url: string }[] = [];
  if (imageUrl) media.push({ type: 'image', url: imageUrl });
  if (videoUrl) media.push({ type: 'video', url: videoUrl });

  const [activeIndex, setActiveIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  if (media.length === 0) return null;

  const goNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveIndex((prev) => (prev + 1) % media.length);
  };

  const goPrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveIndex((prev) => (prev - 1 + media.length) % media.length);
  };

  const openFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFullscreen(true);
  };

  const current = media[activeIndex];

  const renderMedia = (item: typeof current, isFull: boolean) =>
    item.type === 'video' ? (
      <video
        key={item.url + (isFull ? '-full' : '')}
        src={item.url}
        className={isFull ? 'w-full max-h-[80vh] object-contain' : 'w-full h-full object-cover'}
        controls
        preload="metadata"
        playsInline
        muted
        autoPlay={isFull}
      />
    ) : (
      <img
        key={item.url + (isFull ? '-full' : '')}
        src={item.url}
        alt={serviceName}
        className={isFull ? 'w-full max-h-[80vh] object-contain' : 'w-full h-full object-cover'}
      />
    );

  return (
    <>
      <div className="w-full aspect-[4/3] bg-muted/30 relative overflow-hidden group" onClick={openFullscreen}>
        {renderMedia(current, false)}

        {/* Expand icon */}
        <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-background/70 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <Maximize2 className="w-3.5 h-3.5" />
        </div>

        {/* Navigation arrows */}
        {media.length > 1 && (
          <>
            <button
              onClick={goPrev}
              className="absolute left-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={goNext}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}

        {/* Dots */}
        {media.length > 1 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-background/70 backdrop-blur-sm rounded-full px-2.5 py-1">
            {media.map((m, i) => (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); setActiveIndex(i); }}
                className={`flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full transition-all ${
                  i === activeIndex
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {m.type === 'image' ? <Image className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                {m.type === 'image' ? 'Foto' : 'Vídeo'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Fullscreen modal */}
      <Dialog open={fullscreen} onOpenChange={(v) => { if (!v) setFullscreen(false); }}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-none flex flex-col items-center justify-center gap-0 [&>button]:text-white [&>button]:hover:text-white">
          <p className="text-white/80 text-sm font-medium py-3">{serviceName}</p>
          <div className="relative w-full flex items-center justify-center flex-1 min-h-0">
            {renderMedia(current, true)}

            {media.length > 1 && (
              <>
                <button
                  onClick={goPrev}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-white" />
                </button>
                <button
                  onClick={goNext}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition-colors"
                >
                  <ChevronRight className="w-5 h-5 text-white" />
                </button>
              </>
            )}
          </div>

          {media.length > 1 && (
            <div className="flex items-center gap-3 py-3">
              {media.map((m, i) => (
                <button
                  key={i}
                  onClick={() => setActiveIndex(i)}
                  className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-all ${
                    i === activeIndex
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-white/10 text-white/70 hover:text-white'
                  }`}
                >
                  {m.type === 'image' ? <Image className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  {m.type === 'image' ? 'Foto' : 'Vídeo'}
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
