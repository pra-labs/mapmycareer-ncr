import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AtsBulletOptimizerModal } from '../AtsBulletOptimizerModal';

describe('AtsBulletOptimizerModal Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should not render when isOpen is false', () => {
    const { container } = render(<AtsBulletOptimizerModal isOpen={false} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('should render modal title, textarea, character counter, and sample buttons', () => {
    render(<AtsBulletOptimizerModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText('AI Resume Bullet Optimizer')).toBeInTheDocument();
    expect(screen.getByText(/Edge AI · XYZ Formula/i)).toBeInTheDocument();
    expect(screen.getByText(/The Google XYZ Formula:/i)).toBeInTheDocument();
    expect(screen.getByText('0 / 600')).toBeInTheDocument();
  });

  it('should populate textarea when a sample bullet is clicked', () => {
    render(<AtsBulletOptimizerModal isOpen={true} onClose={vi.fn()} />);

    const sampleBtn = screen.getByText(/Worked on microservices migration/i);
    fireEvent.click(sampleBtn);

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.value).toContain('Worked on microservices migration');
    expect(screen.getByText(`${textarea.value.length} / 600`)).toBeInTheDocument();
  });

  it('should clear input and output when Clear is clicked', () => {
    render(<AtsBulletOptimizerModal isOpen={true} onClose={vi.fn()} initialBullet="Initial test bullet" />);

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.value).toBe('Initial test bullet');

    const clearBtn = screen.getByText('Clear');
    fireEvent.click(clearBtn);

    expect(textarea.value).toBe('');
    expect(screen.getByText('0 / 600')).toBeInTheDocument();
  });

  it('should stream chunks and display completed result when optimized', async () => {
    // Mock fetch with a readable stream of SSE chunks
    const sseChunks = [
      'data: {"chunk": "Architected "}\n\n',
      'data: {"chunk": "event-driven microservices "}\n\n',
      'data: {"chunk": "reducing P99 latency by 45%."}\n\n',
      'data: [DONE]\n\n',
    ];

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        for (const chunk of sseChunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: stream,
    });

    render(<AtsBulletOptimizerModal isOpen={true} onClose={vi.fn()} initialBullet="Made microservices faster" />);

    const optimizeBtn = screen.getByText('Optimize with Edge AI');
    fireEvent.click(optimizeBtn);

    await waitFor(() => {
      expect(screen.getByText(/Architected event-driven microservices reducing P99 latency by 45%./i)).toBeInTheDocument();
    });

    expect(screen.getByText('Copy')).toBeInTheDocument();
  });
});
