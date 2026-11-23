// reviewed behavior-focused mock: expo-observe needs its native module, which
// jest cannot load. calls are recorded for assertions, and the root keeps a
// real error boundary so fallback tests exercise the actual recovery path.
import { Component, type ReactElement, type ReactNode } from 'react';

type FallbackProps = { error: unknown; resetError: () => void };
type Fallback = ReactElement | null | ((props: FallbackProps) => ReactNode);

export const Observe = {
  configure: jest.fn(),
  reportError: jest.fn(),
  markInteractive: jest.fn(),
};

// render errors the boundary caught, in order
export const boundaryErrors: unknown[] = [];

export function useObserve() {
  return { markInteractive: Observe.markInteractive };
}

type BoundaryProps = { fallback: Fallback; children: ReactNode };
type BoundaryState = { hasError: boolean; error: unknown };

export class ObserveErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { hasError: false, error: undefined };

  static getDerivedStateFromError(error: unknown): BoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown) {
    boundaryErrors.push(error);
  }

  resetError = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    const { fallback } = this.props;
    return typeof fallback === 'function'
      ? fallback({ error: this.state.error, resetError: this.resetError })
      : fallback;
  }
}

export function ObserveRoot({ children, errorBoundaryFallback }: {
  children: ReactNode;
  errorBoundaryFallback?: Fallback;
}) {
  if (errorBoundaryFallback === undefined) return <>{children}</>;
  return <ObserveErrorBoundary fallback={errorBoundaryFallback}>{children}</ObserveErrorBoundary>;
}
