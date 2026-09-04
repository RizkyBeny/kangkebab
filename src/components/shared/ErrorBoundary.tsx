'use client';

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="min-h-[400px] flex items-center justify-center p-8">
          <div className="text-center space-y-4 max-w-sm">
            <AlertTriangle className="w-10 h-10 text-destructive mx-auto" />
            <h3 className="text-sm font-bold text-foreground">Terjadi Kesalahan</h3>
            <p className="text-xs text-muted-foreground">
              {this.state.error?.message || 'Komponen gagal dimuat. Silakan coba lagi.'}
            </p>
            <Button variant="outline" size="sm" onClick={this.handleReset} className="text-xs font-semibold">
              <RefreshCw className="w-3.5 h-3.5 mr-2" />
              Coba Lagi
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
