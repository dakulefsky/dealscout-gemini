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
      <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-12">
        <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm text-center" role="alert" aria-live="assertive">
          <div className="mx-auto h-11 w-11 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center text-xl font-black" aria-hidden="true">!</div>
          <h1 className="font-heading mt-4 text-2xl font-black text-slate-950">DealScout hit a temporary snag</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">Your saved preferences are still on this device. Reload the app to recover and fetch the latest verified deals.</p>
          <button type="button" onClick={this.handleRetry} className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700 focus-visible:ring-offset-2">
            Reload DealScout
          </button>
        </section>
      </main>
    );
  }
}
