import React from 'react';
import { LoginPage } from '../LoginPage';
import { StoreSettings } from '../../types';

interface AdminLoginPageProps {
  navigate: (path: string) => void;
  settings: StoreSettings;
  onLoginSuccess: () => void;
}

export function AdminLoginPage({ navigate, settings, onLoginSuccess }: AdminLoginPageProps) {
  return (
    <LoginPage
      navigate={navigate}
      settings={settings}
      onLoginSuccess={onLoginSuccess}
      returnPath="/admin"
    />
  );
}
