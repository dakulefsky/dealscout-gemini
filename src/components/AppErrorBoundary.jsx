import { Component } from 'react';

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[DealScout] Unhandled app render error:', error, info);
  }

  handleRetry = () => {
    this.setState({ error: null });
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="min-h-screen bg-[#fbfaf7] flex items-center px-4 py-12">
        <section className="w-full max-w-3xl mx-auto border-y border-emerald-950/10 py-12 sm:py-16" role="alert" aria-live="assertive">
          <div className="ds-kicker">Something went wrong</div>
          <h1 className="font-heading mt-2 text-3xl sm:text-4xl font-bold text-emerald-950">DealScout hit a temporary snag.</h1>
          <p className="mt-4 text-sm leading-relaxed text-slate-600 max-w-xl">Reload to reconnect and fetch the latest verified deals. Your local saved preferences are not cleared by this screen.</p>
          <button type="button" onClick={this.handleRetry} className="mt-7 inline-flex min-h-11 items-center justify-center bg-emerald-950 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-800 focus-visible:ring-offset-2">
            Reload DealScout
          </button>
        </section>
      </main>
    );
  }
}
