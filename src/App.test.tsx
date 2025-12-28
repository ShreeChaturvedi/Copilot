import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { useAuthStore } from '@/stores/authStore';

vi.mock('./components/layout/MainLayout', () => ({
  MainLayout: () => <div>Mock MainLayout</div>,
}));

vi.mock('./pages/Login', () => ({
  LoginPage: () => <div>Login Page</div>,
}));

import App from './App';

const resetAuthState = () => {
  useAuthStore.setState({
    isAuthenticated: false,
    isLoading: false,
    authMethod: null,
    jwtTokens: null,
    user: null,
    googleTokens: null,
    googleUser: null,
    error: null,
  });
};

const setAuthenticatedState = () => {
  useAuthStore.setState({
    isAuthenticated: true,
    isLoading: false,
    authMethod: 'jwt',
    jwtTokens: {
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      expiresAt: Date.now() + 60 * 60 * 1000,
    },
    user: {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    googleTokens: null,
    googleUser: null,
    error: null,
  });
};

describe('App', () => {
  beforeEach(() => {
    resetAuthState();
  });

  it('renders the login screen for unauthenticated users', async () => {
    render(<App />);
    expect(await screen.findByText(/Login Page/i)).toBeInTheDocument();
  });

  it('renders the main layout for authenticated users', async () => {
    setAuthenticatedState();
    render(<App />);

    expect(await screen.findByText(/Mock MainLayout/i)).toBeInTheDocument();
  });
});
