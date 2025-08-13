import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ExternalLink } from 'lucide-react';

interface LinkPreviewData {
  title?: string;
  description?: string;
  image?: string;
  url: string;
  domain: string;
}

interface LinkPreviewProps {
  url: string;
  className?: string;
}

export function LinkPreview({ url, className }: LinkPreviewProps) {
  const [previewData, setPreviewData] = useState<LinkPreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const domain = useMemo(() => {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return url;
    }
  }, [url]);

  useEffect(() => {
    const fetchPreview = async () => {
      if (!url) return;
      
      setLoading(true);
      setError(null);

      try {
        // Try to use a CORS proxy service to fetch the page content
        // This is a common approach for client-side link previews
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        
        const response = await fetch(proxyUrl);
        const data = await response.json();
        
        if (data.contents) {
          // Parse the HTML content to extract metadata
          const parser = new DOMParser();
          const doc = parser.parseFromString(data.contents, 'text/html');
          
          // Extract title
          const title = doc.querySelector('title')?.textContent || 
                       doc.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
                       doc.querySelector('meta[name="title"]')?.getAttribute('content') ||
                       domain;
          
          // Extract description
          const description = doc.querySelector('meta[name="description"]')?.getAttribute('content') ||
                            doc.querySelector('meta[property="og:description"]')?.getAttribute('content') ||
                            `Content from ${domain}`;
          
          // Extract image
          const image = doc.querySelector('meta[property="og:image"]')?.getAttribute('content') ||
                       doc.querySelector('meta[name="image"]')?.getAttribute('content') ||
                       undefined;
          
          const preview: LinkPreviewData = {
            url,
            domain,
            title,
            description,
            image,
          };
          
          setPreviewData(preview);
        } else {
          throw new Error('Failed to fetch page content');
        }
      } catch (err) {
        console.warn('Failed to fetch link preview:', err);
        
        // Fallback to basic domain info
        const fallbackPreview: LinkPreviewData = {
          url,
          domain,
          title: domain,
          description: `Link to ${domain}`,
        };
        setPreviewData(fallbackPreview);
      } finally {
        setLoading(false);
      }
    };

    fetchPreview();
  }, [url, domain]);

  if (loading) {
    return (
      <Card className={`w-full max-w-md ${className}`}>
        <CardContent className="p-4">
          <div className="space-y-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !previewData) {
    return null;
  }

  return (
    <Card className={`w-full max-w-md hover:shadow-md transition-shadow ${className}`}>
      <a
        href={previewData.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        {previewData.image && (
          <div className="aspect-video w-full overflow-hidden rounded-t-lg bg-muted">
            <img
              src={previewData.image}
              alt={previewData.title || 'Preview image'}
              className="h-full w-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
        )}
        <div className="p-4 space-y-2">
          <div className="flex items-start justify-between">
            <h3 className="text-sm font-medium line-clamp-2 flex-1 pr-2">
              {previewData.title}
            </h3>
            <ExternalLink className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          </div>
          
          {previewData.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {previewData.description}
            </p>
          )}
          
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {previewData.domain}
            </span>
          </div>
        </div>
      </a>
    </Card>
  );
}
