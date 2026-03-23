import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) return (
      <div className="p-10 text-center h-screen flex flex-col items-center justify-center bg-red-50 text-red-800">
        <h1 className="text-3xl font-bold mb-4">Application Error</h1>
        <pre className="bg-white p-4 rounded shadow text-left text-xs mb-4 border border-red-200 overflow-auto max-w-lg">{this.state.error?.toString()}</pre>
        <button onClick={() => window.location.reload()} className="px-6 py-2 bg-red-700 text-white rounded hover:bg-red-800">Reload Application</button>
      </div>
    );
    return this.props.children;
  }
}

export default ErrorBoundary;
