import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  readonly children: ReactNode;
}

interface State {
  readonly failed: boolean;
}

/** A failure inside the 3D canvas must not take the rest of the workspace down. */
export class SceneErrorBoundary extends Component<Props, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('3D view failed', error, info.componentStack);
  }

  override render(): ReactNode {
    if (this.state.failed) {
      return (
        <p role="alert" className="p-4 text-[#ff7b72]" data-testid="scene-render-error">
          {'✕'} The 3D view failed to render. The summary below still shows the result.
        </p>
      );
    }
    return this.props.children;
  }
}
