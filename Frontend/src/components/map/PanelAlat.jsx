const PanelAlat = ({ ikon: Ikon, warnaIkon = 'bg-kkp-800', judul, keterangan, kepala, kaki, children, className = '' }) => (
  <div className="pointer-events-none absolute right-full mr-3 top-4 bottom-0 flex items-center w-[21rem] max-w-[calc(100vw-6.5rem)]">
    <section
      aria-label={judul}
      className={`pointer-events-auto w-full bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden
                  animate-fade-in flex flex-col
                  max-h-[min(100%,max(220px,calc(100vh-33rem)))]
                  sm:max-h-[min(100%,max(220px,calc(100vh-28rem)))]
                  xl:max-h-full ${className}`}
    >
      <div className="shrink-0 px-3.5 pt-3.5 pb-3 space-y-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white ${warnaIkon}`}>
            <Ikon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-[14px] font-bold leading-tight text-kkp-900">{judul}</h2>
            {keterangan && <p className="text-[11.5px] leading-snug text-slate-500">{keterangan}</p>}
          </div>
        </div>
        {kepala}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">{children}</div>
      {kaki}
    </section>
  </div>
);

export default PanelAlat;
