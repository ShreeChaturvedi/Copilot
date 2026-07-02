/**
 * Auth form submit flows (test-audit §L4 / §6.8). LoginForm + SignupForm over
 * MSW: success navigates home and seats the JWT, a backend 401 surfaces the
 * error, and the register form's client-side strong-password policy (#66) plus
 * the confirm-match check block the request before it leaves the browser.
 */
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  beforeEach,
  vi,
} from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { http } from 'msw';
import { setupServer } from 'msw/node';
import { LoginForm } from '../login-form';
import { SignupPage } from '@/pages/Signup';
import { useAuthStore } from '@/stores/authStore';
import { ok, fail } from '@/test/optimistic';

const authPayload = {
  user: {
    id: 'u1',
    email: 'ada@example.com',
    name: 'Ada',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  tokens: {
    accessToken: 'access-1',
    refreshToken: 'refresh-1',
    expiresAt: Date.now() + 60 * 60 * 1000,
  },
};

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});
afterAll(() => server.close());

beforeEach(() => {
  act(() => useAuthStore.getState().clearJWTAuth());
});

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginForm />} />
        <Route path="/" element={<div>HOME VIEW</div>} />
        <Route path="/signup" element={<div>SIGNUP VIEW</div>} />
        <Route path="/forgot-password" element={<div>FORGOT VIEW</div>} />
      </Routes>
    </MemoryRouter>
  );
}

function renderSignup() {
  return render(
    <MemoryRouter initialEntries={['/signup']}>
      <Routes>
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/" element={<div>HOME VIEW</div>} />
        <Route path="/login" element={<div>LOGIN VIEW</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('LoginForm', () => {
  it('navigates home and seats the JWT on a successful sign in', async () => {
    server.use(http.post('/api/auth/login', () => ok(authPayload)));
    renderLogin();

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'ada@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'whatever' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

    await waitFor(() =>
      expect(screen.getByText('HOME VIEW')).toBeInTheDocument()
    );
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().jwtTokens?.accessToken).toBe('access-1');
  });

  it('surfaces the error and stays on the form when sign in fails (401)', async () => {
    server.use(
      http.post('/api/auth/login', () =>
        fail('Invalid email or password', 401)
      )
    );
    renderLogin();

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'ada@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'wrong' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Invalid email or password'
      )
    );
    expect(screen.queryByText('HOME VIEW')).not.toBeInTheDocument();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});

describe('SignupForm', () => {
  const fillStrong = (password: string, confirm = password) => {
    fireEvent.change(screen.getByLabelText('Full name'), {
      target: { value: 'Ada Lovelace' },
    });
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'ada@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: password },
    });
    fireEvent.change(screen.getByLabelText('Confirm password'), {
      target: { value: confirm },
    });
  };

  it('creates the account and navigates home on success', async () => {
    server.use(http.post('/api/auth/register', () => ok(authPayload)));
    renderSignup();

    fillStrong('Str0ng!Pass');
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() =>
      expect(screen.getByText('HOME VIEW')).toBeInTheDocument()
    );
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('blocks submission and shows the policy error for a weak password (#66)', async () => {
    let hit = false;
    server.use(
      http.post('/api/auth/register', () => {
        hit = true;
        return ok(authPayload);
      })
    );
    renderSignup();

    // 8+ chars but no uppercase/number/symbol -> fails the strong-password policy
    fillStrong('weakpassword');
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        /at least 8 characters and include an uppercase/i
      )
    );
    expect(hit).toBe(false);
    expect(screen.queryByText('HOME VIEW')).not.toBeInTheDocument();
  });

  it('blocks submission when the passwords do not match', async () => {
    let hit = false;
    server.use(
      http.post('/api/auth/register', () => {
        hit = true;
        return ok(authPayload);
      })
    );
    renderSignup();

    fillStrong('Str0ng!Pass', 'Different1!');
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Passwords do not match.'
      )
    );
    expect(hit).toBe(false);
  });

  it('surfaces the backend error when registration fails', async () => {
    server.use(
      http.post('/api/auth/register', () =>
        fail('Email already registered', 409)
      )
    );
    renderSignup();

    fillStrong('Str0ng!Pass');
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Email already registered'
      )
    );
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});
