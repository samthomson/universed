import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { StarBackground } from './StarBackground';

describe('StarBackground', () => {
  it('renders without crashing', () => {
    render(<StarBackground />);

    // Check that canvas element is rendered
    const canvas = document.querySelector('canvas');
    expect(canvas).toBeInTheDocument();

    // Check that canvas has correct classes
    expect(canvas).toHaveClass('fixed', 'inset-0', 'pointer-events-none', 'z-0');
  });

  it('has transparent background', () => {
    render(<StarBackground />);

    const canvas = document.querySelector('canvas');
    expect(canvas).toHaveStyle({ background: 'transparent' });
  });

  it('is positioned behind other content', () => {
    render(<StarBackground />);

    const canvas = document.querySelector('canvas');
    expect(canvas).toHaveClass('z-0');
  });

  it('does not block pointer events', () => {
    render(<StarBackground />);

    const canvas = document.querySelector('canvas');
    expect(canvas).toHaveClass('pointer-events-none');
  });
});