/**
 * Voice Input Debug Demo Test
 * 
 * This test renders the debug component for manual testing of voice input
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { VoiceInputDebug } from '../components/VoiceInputDebug';

describe('Voice Input Debug Demo', () => {
  it('renders debug interface for manual voice input testing', () => {
    render(
      <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
        <h1>Voice Input Debug Interface</h1>
        <p>Use this interface to test and debug voice input functionality.</p>
        <VoiceInputDebug />
      </div>
    );

    // Verify the debug interface renders
    expect(screen.getByText('Voice Input Debug Interface')).toBeInTheDocument();
    expect(screen.getByText('Voice Input Debug')).toBeInTheDocument();
    expect(screen.getByText('Final Transcript:')).toBeInTheDocument();
    expect(screen.getByText('Interim Transcript:')).toBeInTheDocument();
    expect(screen.getByText('Browser Support:')).toBeInTheDocument();
    expect(screen.getByText('Debug Logs:')).toBeInTheDocument();
    
    // Should have voice input buttons (voice input + clear logs)
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
    
    // Should show instructions
    expect(screen.getByText('Instructions:')).toBeInTheDocument();
  });
});