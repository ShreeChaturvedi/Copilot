export interface PasswordStrengthResult {
  score: number; // 0-4
  strength: 'very-weak' | 'weak' | 'fair' | 'strong' | 'very-strong';
  feedback: string[];
  checks: {
    length: boolean;
    lowercase: boolean;
    uppercase: boolean;
    numbers: boolean;
    symbols: boolean;
  };
}

export function calculatePasswordStrength(password: string): PasswordStrengthResult {
  const checks = {
    length: password.length >= 8,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    numbers: /\d/.test(password),
    symbols: /[^a-zA-Z0-9]/.test(password),
  };

  const feedback: string[] = [];
  let score = 0;

  // Base score for length
  if (password.length >= 8) score += 1;
  else feedback.push('Use at least 8 characters');

  if (password.length >= 12) score += 1;
  else if (password.length >= 8) feedback.push('Consider using 12+ characters for better security');

  // Character variety
  if (checks.lowercase && checks.uppercase) score += 1;
  else feedback.push('Mix uppercase and lowercase letters');

  if (checks.numbers) score += 1;
  else feedback.push('Include numbers');

  if (checks.symbols) score += 1;
  else feedback.push('Include symbols (!@#$%^&*)');

  // Bonus for very long passwords
  if (password.length >= 16) score = Math.min(score + 1, 4);

  // Penalty for common patterns
  const commonPatterns = [
    /123456/,
    /password/i,
    /qwerty/i,
    /abc/i,
    /(.)\1{2,}/, // repeated characters
  ];

  for (const pattern of commonPatterns) {
    if (pattern.test(password)) {
      score = Math.max(score - 1, 0);
      feedback.push('Avoid common patterns and repeated characters');
      break;
    }
  }

  // Determine strength level
  let strength: PasswordStrengthResult['strength'];
  if (score === 0) strength = 'very-weak';
  else if (score === 1) strength = 'weak';
  else if (score === 2) strength = 'fair';
  else if (score === 3) strength = 'strong';
  else strength = 'very-strong';

  return {
    score: Math.max(0, Math.min(4, score)),
    strength,
    feedback: [...new Set(feedback)], // Remove duplicates
    checks,
  };
}

export function getStrengthColor(strength: PasswordStrengthResult['strength']): string {
  switch (strength) {
    case 'very-weak':
      return 'bg-red-500';
    case 'weak':
      return 'bg-orange-500';
    case 'fair':
      return 'bg-yellow-500';
    case 'strong':
      return 'bg-blue-500';
    case 'very-strong':
      return 'bg-green-500';
  }
}

export function getStrengthText(strength: PasswordStrengthResult['strength']): string {
  switch (strength) {
    case 'very-weak':
      return 'Very Weak';
    case 'weak':
      return 'Weak';
    case 'fair':
      return 'Fair';
    case 'strong':
      return 'Strong';
    case 'very-strong':
      return 'Very Strong';
  }
}