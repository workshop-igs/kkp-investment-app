import { useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronRight, CircleHelp, MapPin, Search, XCircle } from 'lucide-react';
import { keDesimal, keDMS } from '../../utils/koordinat';
import { gabungZona, persenArea, ringkasKkprlZona } from '../../utils/normalisasiAnalisis';

const GAYA = {
  SESUAI: { kotak: 'bg-emerald-50 border-emerald-200', teks: 'text-emerald-800', titik: 'bg-emerald-500', Ikon: CheckCircle2 },
  SESUAI_BERSYARAT: { kotak: 'bg-amber-50 border-amber-200', teks: 'text-amber-800', titik: 'bg-amber-500', Ikon: AlertTriangle },
  TIDAK_SESUAI: { kotak: 'bg-rose-50 border-rose-200', teks: 'text-rose-800', titik: 'bg-rose-500', Ikon: XCircle },
  BELUM_TERVERIFIKASI: { kotak: 'bg-slate-50 border-slate-300', teks: 'text-slate-800', titik: 'bg-slate-400', Ikon: CircleHelp },
};

const KETENTUAN = {
  DIIZINKAN: { tanda: '✓', teks: 'text-emerald-700', pil: 'bg-emerald-50 text-emerald-700 ring-emerald-200', batang: 'bg-emerald-500' },
  BERSYARAT: { tanda: '±', teks: 'text-amber-700', pil: 'bg-amber-50 text-amber-800 ring-amber-200', batang: 'bg-amber-400' },
  TIDAK_DIIZINKAN: { tanda: '✕', teks: 'text-rose-700', pil: 'bg-rose-50 text-rose-700 ring-rose-200', batang: 'bg-rose-500' },
};
const KETENTUAN_KOSONG = { tanda: '?', teks: 'text-slate-500', pil: 'bg-slate-100 text-slate-600 ring-slate-200', batang: 'bg-slate-300' };
const ketentuan = (kode) => KETENTUAN[kode] || KETENTUAN_KOSONG;

const LABEL_KEGIATAN = [
  ['DIIZINKAN', 'Diperbolehkan'],
  ['BERSYARAT', 'Diperbolehkan bersyarat'],
  ['TIDAK_DIIZINKAN', 'Tidak diperbolehkan'],
];

const KOLOM_PERDA = [
  ['diperbolehkan', 'Diperbolehkan', 'DIIZINKAN'],
  ['bersyarat', 'Bersyarat', 'BERSYARAT'],
  ['tidak_diperbolehkan', 'Tidak diperbolehkan', 'TIDAK_DIIZINKAN'],
];

const TANDA_PARAMETER = {
  true: ['DIIZINKAN', '✓', 'Sangat sesuai'],
  false: ['BERSYARAT', '!', 'Perlu dinilai di lapangan'],
  null: [null, '?', 'Tidak terukur'],
};

const HASIL_TAMBAHAN = {
  true: ['DIIZINKAN', 'Sesuai'],
  false: ['TIDAK_DIIZINKAN', 'Tidak sesuai'],
  null: [null, 'Tidak terukur'],
};

const BATAS_SYARAT_TABEL = 240;

const angka = (v, d = 0) => Number(v || 0).toLocaleString('id-ID', { maximumFractionDigits: d });

const Judul = ({ children }) => (
  <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{children}</h4>
);

const Sub = ({ children }) => (
  <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">{children}</div>
);

const Pil = ({ kode, children, className = '', title }) => (
  <span
    title={title}
    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold ring-1 ring-inset ${ketentuan(kode).pil} ${className}`}
  >
    {children}
  </span>
);

const Tanda = ({ kode, tanda, title }) => (
  <span
    title={title}
    className={`mt-px grid h-4 w-4 shrink-0 place-items-center rounded-full text-[9px] font-bold ring-1 ring-inset ${ketentuan(kode).pil}`}
  >
    {tanda || ketentuan(kode).tanda}
  </span>
);

const DaftarStatus = ({ bagian, kosong = 'Tidak ada' }) => (
  <div className="space-y-3">
    {bagian.map(([kode, label, butir]) => (
      <div key={kode}>
        <Pil kode={kode}>
          {ketentuan(kode).tanda} {label}
          <span className="ml-1.5 tabular-nums opacity-70">{butir.length}</span>
        </Pil>
        {butir.length ? (
          <ul className="mt-1.5 gap-x-6 sm:columns-2 xl:columns-3">
            {butir.map((b) => (
              <li key={b} className="mb-1 flex break-inside-avoid gap-2 text-[11.5px] leading-snug text-slate-700">
                <span className={`mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full ${ketentuan(kode).batang}`} />
                {b}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-[11.5px] text-slate-400">{kosong}</p>
        )}
      </div>
    ))}
  </div>
);

const Ringkasan = ({ s }) => {
  const gaya = GAYA[s.status] || GAYA.BELUM_TERVERIFIKASI;
  const { Ikon } = gaya;
  const acuan = s.acuan.map((a) => `${a.label} ${angka(a.persen, 1)}%`).join(', ');
  const terukur = s.parameter?.filter((p) => p.nilai !== null).length || 0;
  const sel = [
    ['Cakupan acuan tata ruang', `${angka(s.cakupan_persen, 1)}%`, acuan || 'Tidak ada acuan', 'text-slate-800'],
    s.karakter && [
      'Karakter lokasi',
      s.karakter.cocok ? 'Cocok' : 'Belum cocok',
      `untuk ${s.sektor_nama.toLowerCase()}`,
      s.karakter.cocok ? 'text-emerald-700' : 'text-rose-700',
    ],
    s.persen_sangat_sesuai != null && [
      'Parameter sangat sesuai',
      `${angka(s.persen_sangat_sesuai)}%`,
      `dari ${terukur} parameter terukur`,
      'text-slate-800',
    ],
    [
      'KKPRL tumpang tindih',
      angka(s.kkprl.length),
      s.kkprl.length ? 'izin terbit beririsan dengan area' : 'tidak ada izin terbit beririsan',
      s.kkprl.length ? 'text-rose-700' : 'text-slate-800',
    ],
  ].filter(Boolean);

  return (
    <div className={`overflow-hidden rounded-xl border ${gaya.kotak}`}>
      <div className="flex items-start gap-3 p-4">
        <Ikon className={`mt-0.5 h-7 w-7 shrink-0 ${gaya.teks}`} />
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Tahap 1 · Screening kesesuaian ruang
          </div>
          <div className={`text-xl font-bold leading-snug ${gaya.teks}`}>{s.status_label}</div>
          <p className="mt-0.5 text-xs text-slate-600">
            <span className="font-semibold text-slate-700">{s.sektor_nama}</span> ·{' '}
            {s.lanjut
              ? 'lokasi dapat dilanjutkan ke Tahap 2 (parameter finansial).'
              : 'analisis berhenti di Tahap 1 dan tidak dilanjutkan ke Tahap 2.'}
          </p>
        </div>
      </div>
      <dl className={`grid grid-cols-2 gap-px border-t border-black/5 bg-black/5 ${sel.length === 4 ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
        {sel.map(([label, nilai, ket, warna]) => (
          <div key={label} className="bg-white/80 px-4 py-2.5">
            <dt className="text-[10.5px] font-medium text-slate-500">{label}</dt>
            <dd className={`text-base font-bold tabular-nums ${warna}`}>{nilai}</dd>
            <dd className="text-[10.5px] leading-snug text-slate-500">{ket}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
};

const KomposisiZona = ({ zona }) => (
  <section>
    <Judul>Zona acuan pada area</Judul>
    <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-200/70">
      {zona.map((z) => (
        <span
          key={z.kunci}
          title={`${z.nama}: ${persenArea(z.persen)}`}
          className={`h-full border-r border-white/80 last:border-0 ${ketentuan(z.ketentuan).batang}`}
          style={{ width: `${z.persen}%` }}
        />
      ))}
    </div>
    <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
      {zona.map((z) => (
        <li key={z.kunci} className="flex items-start gap-3 px-3 py-2.5">
          <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-sm ${ketentuan(z.ketentuan).batang}`} />
          <div className="min-w-0 flex-1 text-xs">
            <div className="font-medium text-slate-800">{z.nama}</div>
            <div className="text-[11px] leading-snug text-slate-500">
              {z.sub_zona_label} · {z.tingkat_label} · {z.sumber_label}
              {z.regulasi ? ` · ${z.regulasi}` : ''}
            </div>
            {z.syarat && (
              <p className="mt-1 text-[11px] leading-snug text-slate-500">
                {z.syarat.length > BATAS_SYARAT_TABEL ? 'Syarat: lihat ketentuan khusus zona di bawah.' : z.syarat}
              </p>
            )}
          </div>
          <div className="shrink-0 text-right">
            <div className="text-xs font-semibold tabular-nums text-slate-800">{persenArea(z.persen)}</div>
            <Pil kode={z.ketentuan} className="mt-1">{z.ketentuan_label}</Pil>
          </div>
        </li>
      ))}
    </ul>
  </section>
);

const RincianJenis = ({ s }) => {
  const kelompok = [];
  s.zona.forEach((z) => {
    if (!z.rincian) return;
    const kunci = JSON.stringify(z.rincian);
    const ada = kelompok.find((k) => k.kunci === kunci);
    if (ada) ada.nama.add(z.nama);
    else kelompok.push({ kunci, rincian: z.rincian, ketentuan: z.ketentuan, label: z.ketentuan_label, nama: new Set([z.nama]) });
  });
  if (!kelompok.length) return null;
  return (
    <section>
      <Judul>Rincian kegiatan {s.sektor_nama.toLowerCase()} menurut matriks Perda</Judul>
      <div className="space-y-2">
        {kelompok.map((k) => (
          <div key={k.kunci} className="rounded-lg border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
              <span className="text-xs font-medium text-slate-800">{[...k.nama].join(', ')}</span>
              <Pil kode={k.ketentuan}>{k.label}</Pil>
            </div>
            <div className="px-3 py-2.5">
              <DaftarStatus bagian={LABEL_KEGIATAN.map(([kode, label]) => [kode, label, k.rincian[kode]])} />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[10.5px] leading-snug text-slate-400">
        Status jenis investasi di tiap zona diturunkan dari rincian ini: diizinkan bila seluruh rinciannya diperbolehkan,
        bersyarat bila sebagian rinciannya dibatasi atau dilarang, dan tidak diizinkan bila seluruhnya dilarang.
      </p>
    </section>
  );
};

const KarakterLokasi = ({ s }) => {
  const terukur = s.parameter?.filter((p) => p.nilai !== null).length || 0;
  return (
    <section>
      <Judul>Karakter lokasi {s.sektor_nama.toLowerCase()}</Judul>
      <div className="rounded-lg border border-slate-200 bg-white text-xs">
        <div className="grid gap-px overflow-hidden rounded-t-lg bg-slate-100 sm:grid-cols-2">
          <div className="bg-white px-3 py-2">
            <div className="text-[10.5px] font-semibold text-slate-500">Kebutuhan</div>
            <p className="mt-0.5 leading-snug text-slate-700">{s.karakter.kebutuhan || 'Tidak ada syarat karakter khusus.'}</p>
          </div>
          <div className="bg-white px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10.5px] font-semibold text-slate-500">Kondisi area</span>
              <Pil kode={s.karakter.cocok ? 'DIIZINKAN' : 'TIDAK_DIIZINKAN'}>{s.karakter.cocok ? 'Cocok' : 'Belum cocok'}</Pil>
            </div>
            <p className="mt-0.5 leading-snug text-slate-700">{s.karakter.terukur}</p>
          </div>
        </div>
        {s.parameter?.length > 0 && (
          <div className="border-t border-slate-100 px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-semibold text-slate-800">
                {angka(s.persen_sangat_sesuai)}% dari {terukur} parameter terukur sangat sesuai
              </span>
              <div className="h-1.5 min-w-[6rem] flex-1 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${s.persen_sangat_sesuai || 0}%` }} />
              </div>
            </div>
            <ul className="mt-2 grid gap-x-5 gap-y-1 sm:grid-cols-2">
              {s.parameter.map((p) => {
                const [kode, tanda, ket] = TANDA_PARAMETER[p.nilai];
                return (
                  <li key={p.label} className="flex gap-2 leading-snug text-slate-700" title={ket}>
                    <Tanda kode={kode} tanda={tanda} />
                    {p.label}
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-[10.5px] leading-snug text-slate-400">
              Ambang Peta Sebaran Wilayah Potensial: 75% dari sedikitnya 5 parameter terukur; di zona peruntukan lain yang
              hanya mengizinkan bersyarat seluruh parameter lain wajib terukur dan sangat sesuai.
            </p>
          </div>
        )}
      </div>
    </section>
  );
};

const ParameterTambahan = ({ daftar }) => (
  <section>
    <Judul>Parameter tambahan dari administrator</Judul>
    <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
      {daftar.map((t) => {
        const [kode, label] = HASIL_TAMBAHAN[t.hasil];
        return (
          <li key={t.id} className="flex items-start gap-3 px-3 py-2 text-xs">
            <div className="min-w-0 flex-1">
              <div className="font-medium text-slate-800">
                {t.nama} <span className="font-normal text-slate-400">· {t.peran_label}</span>
              </div>
              <div className="text-[10.5px] text-slate-500">{t.keterangan}</div>
              {t.sumber && <div className="text-[10.5px] text-slate-400">{t.sumber}</div>}
            </div>
            <Pil kode={kode} className="shrink-0">{label}</Pil>
          </li>
        );
      })}
    </ul>
  </section>
);

const RincianPerda = ({ perda }) => {
  const [cari, setCari] = useState('');
  const kata = cari.trim().toLowerCase();
  const total = KOLOM_PERDA.reduce((n, [k]) => n + perda[k].length, 0);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">
          Rincian kegiatan menurut Perda
          {perda.kode_zona.length > 0 && (
            <span className="font-normal normal-case tracking-normal text-slate-400"> · kode zona {perda.kode_zona.join(', ')}</span>
          )}
        </div>
        <label className="relative flex items-center">
          <Search className="absolute left-2 h-3 w-3 text-slate-400" />
          <input
            type="search"
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            placeholder={`Cari di ${total} kegiatan`}
            className="w-44 rounded-md border border-slate-200 bg-white py-1 pl-6 pr-2 text-[11px] focus:border-kkp-500 focus:outline-none"
          />
        </label>
      </div>
      <div className="mt-2">
        <DaftarStatus
          kosong={kata ? 'Tidak ada yang cocok' : 'Tidak ada'}
          bagian={KOLOM_PERDA.map(([k, label, kode]) => [kode, label, perda[k].filter((b) => !kata || b.toLowerCase().includes(kata))])}
        />
      </div>
      {perda.ketentuan_khusus && (
        <details className="mt-2 text-[11px] text-slate-600">
          <summary className="cursor-pointer text-kkp-700">Ketentuan khusus zona ini</summary>
          <p className="mt-1 leading-relaxed">{perda.ketentuan_khusus}</p>
        </details>
      )}
      <p className="mt-1.5 text-[10.5px] text-slate-400">{perda.sumber}</p>
    </div>
  );
};

const ZonaKetentuan = ({ z, sektor, sama, terbuka }) => {
  const statusJenis = LABEL_KEGIATAN.find(([kode]) => z.kegiatan[kode].includes(sektor));
  const adaKegiatan = LABEL_KEGIATAN.some(([kode]) => z.kegiatan[kode].length);
  return (
    <details className="group" open={terbuka}>
      <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-2.5 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
        <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-90" />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-slate-800">{z.nama}</div>
          <div className="text-[11px] leading-snug text-slate-500">
            {z.jenis_label} / {z.sub_zona_label}
            {z.persen != null && ` · ${persenArea(z.persen)} area`}
          </div>
        </div>
        {statusJenis && (
          <span className="hidden shrink-0 flex-col items-end gap-0.5 sm:flex">
            <span className="text-[10px] text-slate-400">{sektor}</span>
            <Pil kode={statusJenis[0]}>{statusJenis[1]}</Pil>
          </span>
        )}
      </summary>
      <div className="space-y-3 border-t border-slate-100 bg-slate-50/60 px-3 py-3 text-xs">
        <div>
          <Sub>Jenis investasi</Sub>
          {adaKegiatan ? (
            <div className="space-y-1.5">
              {LABEL_KEGIATAN.map(([kode, label]) => (
                <div key={kode} className="flex flex-wrap items-center gap-1.5">
                  <span className={`w-44 shrink-0 text-[11px] font-semibold ${ketentuan(kode).teks}`}>
                    {label} ({z.kegiatan[kode].length})
                  </span>
                  {z.kegiatan[kode].length ? z.kegiatan[kode].map((n) => (
                    <Pil key={n} kode={kode} className={n === sektor ? 'ring-2' : ''}>{n}</Pil>
                  )) : <span className="text-[11px] text-slate-400">Tidak ada</span>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500">Ketentuan per jenis investasi belum ditetapkan untuk sub-zona ini.</p>
          )}
        </div>
        {z.perda && (sama ? (
          <p className="text-slate-500">
            <span className="font-semibold text-slate-700">Rincian kegiatan menurut Perda</span> sama dengan {sama.nama} di atas.
          </p>
        ) : (
          <RincianPerda perda={z.perda} />
        ))}
        <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 border-t border-slate-200/70 pt-2 text-[11px]">
          {z.dasar_zona && (
            <>
              <dt className="font-semibold text-slate-700">Dasar zona</dt>
              <dd className="text-slate-600">{z.dasar_zona}</dd>
            </>
          )}
          <dt className="font-semibold text-slate-700">Sumber aturan</dt>
          <dd className="text-slate-600">{z.sumber_aturan?.join('; ') || 'Belum ditetapkan'}</dd>
          {z.ketentuan_khusus?.length > 0 && (
            <>
              <dt className="font-semibold text-slate-700">Ketentuan khusus</dt>
              <dd className="text-slate-600">
                <details>
                  <summary className="cursor-pointer text-kkp-700">Tampilkan syarat untuk kegiatan bersyarat</summary>
                  {z.ketentuan_khusus.map((t) => <p key={t} className="mt-1 leading-relaxed">{t}</p>)}
                </details>
              </dd>
            </>
          )}
          <dt className="font-semibold text-slate-700">KKPRL terbit</dt>
          <dd className="text-slate-600">{ringkasKkprlZona(z.kkprl_terbit)}</dd>
        </dl>
      </div>
    </details>
  );
};

const KetentuanArea = ({ s }) => {
  const pertama = new Map();
  s.informasi_ruang.forEach((z) => {
    const k = z.perda && `${z.perda.sumber}|${z.perda.nama_zona}`;
    if (k && !pertama.has(k)) pertama.set(k, z);
  });
  return (
    <section>
      <Judul>Ketentuan kegiatan pada area analisis</Judul>
      <p className="-mt-1 mb-2 text-[11px] text-slate-400">
        Seluruh jenis investasi dan rincian kegiatan Perda per zona. Klik zona untuk membuka rinciannya.
      </p>
      <div className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">
        {s.informasi_ruang.map((z, i) => {
          const k = z.perda && `${z.perda.sumber}|${z.perda.nama_zona}`;
          const sama = k && pertama.get(k) !== z ? pertama.get(k) : null;
          return <ZonaKetentuan key={`${z.nama}-${z.sub_zona_label}-${i}`} z={z} sektor={s.sektor_nama} sama={sama} terbuka={i === 0} />;
        })}
      </div>
    </section>
  );
};

const KartuScreening = ({ screening: s, onPilihSektor, onLihatLokasi }) => {
  const gaya = GAYA[s.status] || GAYA.BELUM_TERVERIFIKASI;
  const zona = gabungZona(s.zona);

  return (
    <div className="space-y-5">
      <Ringkasan s={s} />

      {s.alasan.length > 0 && (
        <section>
          <Judul>Dasar keputusan</Judul>
          <ul className="space-y-1.5">
            {s.alasan.map((a, i) => (
              <li key={i} className="flex gap-2.5 text-xs leading-relaxed text-slate-700">
                <span className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${gaya.titik}`} />
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {zona.length > 0 && <KomposisiZona zona={zona} />}
      <RincianJenis s={s} />
      {s.karakter && <KarakterLokasi s={s} />}
      {s.parameter_tambahan?.length > 0 && <ParameterTambahan daftar={s.parameter_tambahan} />}
      {s.informasi_ruang?.length > 0 && <KetentuanArea s={s} />}

      {s.kkprl.length > 0 && (
        <section>
          <Judul>KKPRL terbit yang tumpang tindih</Judul>
          <div className="overflow-x-auto rounded-lg border border-rose-200 bg-white">
            <table className="w-full text-left text-xs">
              <thead className="bg-rose-50 text-rose-700">
                <tr>
                  <th className="px-3 py-2 font-semibold">Nomor izin</th>
                  <th className="px-3 py-2 font-semibold">Kegiatan</th>
                  <th className="px-3 py-2 text-right font-semibold">Irisan (m²)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rose-100">
                {s.kkprl.map((k) => (
                  <tr key={k.nomor_izin}>
                    <td className="px-3 py-2 font-mono text-[11px] text-slate-700">{k.nomor_izin}</td>
                    <td className="px-3 py-2 text-slate-600">{k.kegiatan}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">{angka(k.luas_m2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {s.rekomendasi && (
        <div className="space-y-5 border-t border-slate-200 pt-5">
          <section>
            <Judul>Jenis investasi yang sesuai di lokasi ini</Judul>
            {s.rekomendasi.sektor_alternatif.length ? (
              <div className="flex flex-wrap gap-2">
                {s.rekomendasi.sektor_alternatif.map((a) =>
                  onPilihSektor ? (
                    <button
                      key={a.kode}
                      type="button"
                      onClick={() => onPilihSektor(a.kode)}
                      className="rounded-full border border-kkp-200 bg-kkp-100 px-2.5 py-1 text-xs font-semibold text-kkp-800 transition-colors hover:bg-kkp-700 hover:text-white"
                    >
                      {a.nama} · {a.status_label}
                    </button>
                  ) : (
                    <span key={a.kode} className="rounded-full border border-kkp-200 bg-kkp-100 px-2.5 py-1 text-xs font-semibold text-kkp-800">
                      {a.nama} · {a.status_label}
                    </span>
                  )
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                {s.kkprl.length
                  ? 'Tidak ada: lokasi sudah dibebani KKPRL yang terbit, sehingga tidak dapat dipakai untuk jenis investasi apa pun.'
                  : 'Tidak ada jenis investasi yang dapat diverifikasi sesuai di lokasi ini dengan acuan yang tersedia.'}
              </p>
            )}
          </section>

          <section>
            <Judul>Lokasi alternatif terdekat untuk {s.sektor_nama}</Judul>
            {s.rekomendasi.lokasi_alternatif.length ? (
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
                {s.rekomendasi.lokasi_alternatif.map((l) => (
                  <li key={l.id ?? l.zona_id} className="flex items-start gap-3 px-3 py-2.5">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-kkp-700" />
                    <div className="min-w-0 flex-1 text-xs">
                      <div className="font-semibold text-slate-800">{l.nama}</div>
                      <div className="text-slate-500">
                        {l.sub_zona_label} · {l.provinsi} · {angka(l.jarak_km, 1)} km ke arah {l.arah} · {l.status_label}
                      </div>
                      <div className="font-mono text-[10.5px] text-slate-400">
                        {keDMS(l.titik[1], 'lat')} {keDMS(l.titik[0], 'lng')} ({keDesimal(l.titik[1])}, {keDesimal(l.titik[0])})
                      </div>
                    </div>
                    {onLihatLokasi && (
                      <button
                        type="button"
                        onClick={() => onLihatLokasi(l)}
                        className="shrink-0 rounded-md border border-kkp-200 px-2.5 py-1 text-xs font-semibold text-kkp-700 hover:bg-kkp-100"
                      >
                        Lihat di peta
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-500">
                Tidak ada lokasi potensial {s.sektor_nama.toLowerCase()} pada Peta Sebaran Wilayah Potensial dalam radius 100 km.
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  );
};

export default KartuScreening;
