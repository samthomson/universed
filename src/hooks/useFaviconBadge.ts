import { useEffect, useRef } from 'react';

/**
 * Hook to dynamically update the favicon with a notification badge
 */
export function useFaviconBadge(count: number) {
	const originalFaviconRef = useRef<string | null>(null);
	const canvasRef = useRef<HTMLCanvasElement | null>(null);

	useEffect(() => {
		// Store original favicon URL on first run
		if (!originalFaviconRef.current) {
			const faviconLink = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
			originalFaviconRef.current = faviconLink?.href || '/universes-logo.png';
		}

		// Create canvas if it doesn't exist
		if (!canvasRef.current) {
			canvasRef.current = document.createElement('canvas');
			canvasRef.current.width = 32;
			canvasRef.current.height = 32;
		}

		const canvas = canvasRef.current;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		// Load the original favicon
		const img = new Image();
		img.crossOrigin = 'anonymous';

		img.onload = () => {
			// Clear canvas
			ctx.clearRect(0, 0, 32, 32);

			// Draw original favicon
			ctx.drawImage(img, 0, 0, 32, 32);

			// Draw badge if count > 0
			if (count > 0) {
				const badgeText = count > 99 ? '99+' : count.toString();
				const badgeRadius = badgeText.length > 2 ? 11 : 9; // Larger radius for 99+

				// Badge background (red circle) - positioned in bottom-right
				ctx.fillStyle = '#ef4444'; // red-500
				ctx.beginPath();
				ctx.arc(24, 24, badgeRadius, 0, 2 * Math.PI);
				ctx.fill();

				// Badge border
				ctx.strokeStyle = '#ffffff';
				ctx.lineWidth = 2;
				ctx.stroke();

				// Badge text
				ctx.fillStyle = '#ffffff';
				ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';
				ctx.fillText(badgeText, 24, 24);
			}

			// Update favicon
			const dataURL = canvas.toDataURL('image/png');
			updateFavicon(dataURL);
		};

		img.onerror = () => {
			// If image fails to load, just update with count if needed
			if (count === 0 && originalFaviconRef.current) {
				updateFavicon(originalFaviconRef.current);
			}
		};

		img.src = originalFaviconRef.current || '/universes-logo.png';
	}, [count]);

	// Cleanup: restore original favicon when component unmounts
	useEffect(() => {
		return () => {
			if (originalFaviconRef.current) {
				updateFavicon(originalFaviconRef.current);
			}
		};
	}, []);
}

function updateFavicon(href: string) {
	let faviconLink = document.querySelector('link[rel="icon"]') as HTMLLinkElement;

	if (!faviconLink) {
		faviconLink = document.createElement('link');
		faviconLink.rel = 'icon';
		faviconLink.type = 'image/png';
		document.head.appendChild(faviconLink);
	}

	faviconLink.href = href;
}
