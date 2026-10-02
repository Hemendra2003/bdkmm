import type { ReactNode } from 'react';
import { Card } from '../components/Card.tsx';
export function FormPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main
      style={{
        flex: 1,
        padding: 'var(--space-4)',
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Card
        padding="lg"
        style={{
          width: '100%',
          maxWidth: 460,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)',
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--font-pixel)',
            fontSize: 'var(--text-lg)',
            color: 'var(--color-gold)',
          }}
        >
          {title}
        </h1>
        {children}
      </Card>
    </main>
  );
}
