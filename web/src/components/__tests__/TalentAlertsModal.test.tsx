import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TalentAlertsModal } from '../TalentAlertsModal';

describe('TalentAlertsModal Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should not render anything when isOpen is false', () => {
    const { container } = render(<TalentAlertsModal isOpen={false} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('should render dialog header, DPDP notice, and form elements when open', () => {
    render(<TalentAlertsModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText('Voluntary Talent Radar & Job Alerts')).toBeInTheDocument();
    expect(screen.getByText(/Digital Personal Data Protection \(DPDP\) Standard/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Target Role \/ Domain/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Preferred City \/ Tech Hub/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Notice Period/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/LinkedIn URL/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Affirmative Consent/i)).toBeInTheDocument();
  });

  it('should pre-populate defaultRole and defaultCity if provided', () => {
    render(
      <TalentAlertsModal
        isOpen={true}
        onClose={vi.fn()}
        defaultRole="Full-Stack Engineer"
        defaultCity="Bengaluru"
      />
    );

    const roleInput = screen.getByLabelText(/Target Role/i) as HTMLInputElement;
    const citySelect = screen.getByLabelText(/Preferred City/i) as HTMLSelectElement;

    expect(roleInput.value).toBe('Full-Stack Engineer');
    expect(citySelect.value).toBe('Bengaluru');
  });

  it('requires affirmative DPDP consent checkbox to enable submit button', () => {
    render(<TalentAlertsModal isOpen={true} onClose={vi.fn()} />);

    const submitBtn = screen.getByRole('button', { name: /Join Radar & Get Alerts/i });
    expect(submitBtn).toBeDisabled();

    const consentCheckbox = screen.getByLabelText(/Affirmative Consent/i);
    fireEvent.click(consentCheckbox);

    expect(submitBtn).not.toBeDisabled();
  });

  it('shows error if submitting with invalid email format', async () => {
    render(<TalentAlertsModal isOpen={true} onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: 'Abhinav' } });
    fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'not-an-email' } });
    fireEvent.change(screen.getByLabelText(/Target Role/i), { target: { value: 'Backend Dev' } });
    fireEvent.click(screen.getByLabelText(/Affirmative Consent/i));

    const submitBtn = screen.getByRole('button', { name: /Join Radar & Get Alerts/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Please enter a valid work or personal email address/i)).toBeInTheDocument();
    });
  });

  it('successfully submits valid candidate opt-in and renders DPDP confirmation screen', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        message: 'Successfully enrolled',
        id: 1,
        timestamp: '2026-11-23T11:00:00.000Z',
      }),
    });
    global.fetch = fetchMock;

    render(<TalentAlertsModal isOpen={true} onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: 'Abhinav Prakash' } });
    fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'abhinav@pralabs.org' } });
    fireEvent.change(screen.getByLabelText(/Target Role/i), { target: { value: 'Lead AI Engineer' } });
    fireEvent.change(screen.getByLabelText(/Preferred City/i), { target: { value: 'Gurugram' } });
    fireEvent.change(screen.getByLabelText(/Notice Period/i), { target: { value: 'Immediate' } });
    fireEvent.change(screen.getByLabelText(/LinkedIn URL/i), { target: { value: 'https://linkedin.com/in/abhinav' } });
    fireEvent.click(screen.getByLabelText(/Affirmative Consent/i));

    const submitBtn = screen.getByRole('button', { name: /Join Radar & Get Alerts/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/talent-alerts',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            name: 'Abhinav Prakash',
            email: 'abhinav@pralabs.org',
            target_role: 'Lead AI Engineer',
            preferred_city: 'Gurugram',
            notice_period: 'Immediate',
            linkedin_url: 'https://linkedin.com/in/abhinav',
            consent_given: true,
            consent_version: 'v1.0',
          }),
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByText("You're On the Radar!")).toBeInTheDocument();
      expect(screen.getByText(/DPDP Consent Logged \(Version v1.0\)/i)).toBeInTheDocument();
    });
  });
});
