// frontend/src/components/ErrorDisplay.tsx
import { forwardRef } from 'react';
import { X } from 'lucide-react';

interface ErrorDisplayProps {
  error: string;
  className?: string;
  onRetry?: () => void;
}

const ErrorDisplay = forwardRef<HTMLDivElement, ErrorDisplayProps>(
  ({ error, className = '', onRetry }, ref) => {
    return (
      <div 
        ref={ref}
        className={`bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}
        tabIndex={-1}
        role="alert"
        aria-live="polite"
      >
        <div className="flex">
          <div className="flex-shrink-0">
            <X className="h-5 w-5 text-red-400" aria-hidden="true" />
          </div>
          <div className="ml-3 flex-1">
            <p className="text-sm text-red-800">{error}</p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="mt-2 text-sm font-medium text-red-800 hover:text-red-600 underline"
              >
                Try again
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
);

ErrorDisplay.displayName = 'ErrorDisplay';

export default ErrorDisplay; 
