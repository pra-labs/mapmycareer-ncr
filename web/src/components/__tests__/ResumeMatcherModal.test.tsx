import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ResumeMatcherModal } from '../ResumeMatcherModal';
import { Job } from '../../types/job';

const mockJobs: Job[] = [
  {
    id: 1,
    title: 'Senior SDET Engineer',
    company: 'TestLabs',
    city: 'Bengaluru',
    hub: 'Bellandur',
    lat: 12.93,
    lon: 77.68,
    experience_level: 'Senior',
    skills: ['Python', 'Selenium', 'Playwright', 'Docker'],
  },
  {
    id: 2,
    title: 'Frontend Developer',
    company: 'WebCo',
    city: 'Delhi NCR',
    hub: 'DLF Cyber City',
    lat: 28.49,
    lon: 77.09,
    experience_level: 'Entry',
    skills: ['React', 'CSS'],
  },
];

describe('ResumeMatcherModal Component', () => {
  it('should not render when isOpen is false', () => {
    const { container } = render(
      <ResumeMatcherModal
        isOpen={false}
        onClose={vi.fn()}
        jobs={mockJobs}
        activeProfile={null}
        minThreshold={35}
        onApplyProfile={vi.fn()}
        onClearProfile={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('should render modal header, candidate profile preview, and match count', () => {
    render(
      <ResumeMatcherModal
        isOpen={true}
        onClose={vi.fn()}
        jobs={mockJobs}
        activeProfile={null}
        minThreshold={35}
        onApplyProfile={vi.fn()}
        onClearProfile={vi.fn()}
      />
    );

    expect(screen.getByText('Resume-to-Job Matcher & Career Radar')).toBeInTheDocument();
    expect(screen.getByText('Detected Candidate Profile')).toBeInTheDocument();
    expect(screen.getByText(/Matching Openings Found/i)).toBeInTheDocument();
  });

  it('should call onApplyProfile when clicking Apply button', () => {
    const onApply = vi.fn();
    render(
      <ResumeMatcherModal
        isOpen={true}
        onClose={vi.fn()}
        jobs={mockJobs}
        activeProfile={null}
        minThreshold={35}
        onApplyProfile={onApply}
        onClearProfile={vi.fn()}
      />
    );

    const applyBtn = screen.getByRole('button', { name: /Apply to Job Radar/i });
    fireEvent.click(applyBtn);

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply.mock.calls[0][0].skills.length).toBeGreaterThan(0);
  });

  it('renders Gap & Fit Explainability with missing skills and seniority alignment', () => {
    render(
      <ResumeMatcherModal
        isOpen={true}
        onClose={vi.fn()}
        jobs={mockJobs}
        activeProfile={null}
        minThreshold={20}
        onApplyProfile={vi.fn()}
        onClearProfile={vi.fn()}
      />
    );

    expect(screen.getByText(/Gap & Fit Explainability/i)).toBeInTheDocument();
    expect(screen.getByText(/Why This Role Matched/i)).toBeInTheDocument();
    expect(screen.getByText(/Missing Skills \/ Stack Gaps/i)).toBeInTheDocument();
  });
});
