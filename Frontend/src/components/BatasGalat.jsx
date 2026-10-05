import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

class BatasGalat extends React.Component {
  constructor(props) {
    super(props);
    this.state = { galat: null };
  }

  static getDerivedStateFromError(galat) {
    return { galat };
  }

  componentDidCatch(galat, info) {
    console.error('Galat tertangkap oleh BatasGalat:', galat, info?.componentStack);
    if (typeof this.props.onGalat === 'function') {
      this.props.onGalat(galat, info);
    }
  }

  pulihkan = () => this.setState({ galat: null });

  render() {
    if (!this.state.galat) return this.props.children;

    if (this.props.ringkas) {
      return (
        <div className="p-3 text-[12px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">{this.props.judul || 'Bagian ini gagal ditampilkan'}</p>
            <button
              onClick={this.pulihkan}
              className="mt-1 text-kkp-700 hover:underline font-semibold"
            >
              Coba lagi
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="w-full h-full min-h-[60vh] flex items-center justify-center p-6 bg-slate-50">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl shadow-lg p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-1.5">
            {this.props.judul || 'Terjadi gangguan pada halaman ini'}
          </h2>
          <p className="text-[13px] text-slate-500 leading-relaxed mb-5">
            Bagian lain aplikasi tetap berjalan. Coba muat ulang bagian ini; bila
            masih gagal, segarkan halaman.
          </p>

          <div className="flex items-center justify-center gap-2">
            <button
              onClick={this.pulihkan}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-kkp-700 text-white text-[13px] font-semibold hover:bg-kkp-800 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Muat ulang bagian ini
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-[13px] font-semibold hover:bg-slate-50 transition-colors"
            >
              Segarkan halaman
            </button>
          </div>

          <details className="mt-5 text-left">
            <summary className="text-[11px] text-slate-400 cursor-pointer hover:text-slate-600">
              Rincian teknis
            </summary>
            <pre className="mt-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] text-slate-600 overflow-x-auto whitespace-pre-wrap">
              {String(this.state.galat?.message || this.state.galat)}
            </pre>
          </details>
        </div>
      </div>
    );
  }
}

export default BatasGalat;
