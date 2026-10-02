import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card } from './Card.tsx';

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Hello world</Card>);
    expect(screen.getByText('Hello world')).toBeTruthy();
  });

  it('applies surface-card background', () => {
    const { container } = render(<Card>Content</Card>);
    const card = container.firstElementChild as HTMLElement;
    expect(card.style.background).toBe('var(--surface-card)');
  });

  it('applies custom style prop', () => {
    const { container } = render(<Card style={{ color: 'red' }}>X</Card>);
    const card = container.firstElementChild as HTMLElement;
    expect(card.style.color).toBe('red');
  });
});
