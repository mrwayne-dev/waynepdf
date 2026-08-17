import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, errorInfo: null };
  }
  componentDidCatch(error, errorInfo) {
    // Catch errors in any components below and re-render with error message
    this.setState({
      error: error,
      errorInfo: errorInfo,
    });
    // You can also log error messages to an error reporting service here
  }
  render() {
    if (this.state.errorInfo) {
      // Error path
      return (
        <div>
          <p>Error occurs</p>
          <button
            onClick={() => {
              window.location.reload();
            }}
            style={{
              font: 'inherit',
              color: 'var(--wp-color-fg)',
              background: 'var(--wp-color-canvas)',
              padding: 'var(--wp-space-2) var(--wp-space-3)',
              border: '1px solid var(--wp-color-border)',
              borderRadius: 'var(--wp-radius)',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            Reload This Page
          </button>
        </div>
      );
    }
    // Normally, just render children
    return this.props.children;
  }
}

export default ErrorBoundary;
