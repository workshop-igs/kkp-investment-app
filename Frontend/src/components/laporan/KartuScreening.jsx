import { useState } from 'react';
import { AlertTriangle, CheckCircle2, CircleHelp, MapPin, Search, XCircle } from 'lucide-react';
import { keDesimal, keDMS } from '../../utils/koordinat';
import { ringkasKkprlZona } from '../../utils/normalisasiAnalisis';

const GAYA = {
  SESUAI: { kotak: 'bg-emerald-50 border-emerald-200', teks: 'text-emerald-800', Ikon: CheckCircle2 },
  SESUAI_BERSYARAT: { kotak: 'bg-amber-50 border-amber-200', teks: 'text-amber-800', Ikon: AlertTriangle },
  TIDAK_SESUAI: { kotak: 'bg-rose-50 border-rose-200', teks: 'text-rose-800', Ikon: XCircle },
  BELUM_TERVERIFIKASI: { kotak: 'bg-slate-50 border-slate-300', teks: 'text-slate-800', Ikon: CircleHelp },
};

const WARNA_KETENTUAN = {
  DIIZINKAN: 'text-emerald-700',
  BERSYARAT: 'text-amber-700',
  TIDAK_DIIZINKAN: 'text-rose-700',
};

const LABEL_KEGIATAN = [
  ['DIIZINKAN', 'Diperbolehkan'],
  ['BERSYARAT', 'Diperbolehkan bersyarat'],
  ['TIDAK_DIIZINKAN', 'Tidak diperbolehkan'],
];

const BATAS_SYARAT_TABEL = 120;

const angka = (v, d = 0) => Number(v || 0).toLocaleString('id-ID', { maximumFractionDigits: d });

const Judul = ({ children }) => (
  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">{children}</div>
);

const KOLOM_PERDA = [
  ['diperbolehkan', 'Diperbolehkan', 'DIIZINKAN', 'bg-emerald-50/60'],
  ['bersyarat', 'Bersyarat', 'BERSYARAT', 'bg-amber-50/60'],
  ['tidak_diperbolehkan', 'Tidak diperbolehkan', 'TIDAK_DIIZINKAN', 'bg-rose-50/60'],
];
const BATAS_BUTIR = 8;

const RincianPerda = ({ perda }) => {
  const [cari, setCari] = useState('');
  const [penuh, setPenuh] = useState(false);
  const kata = cari.trim().toLowerCase();
  const total = KOLOM_PERDA.reduce((n, [k]) => n + perda[k].length, 0);

  return (
    <div className="px-3 py-2.5 border-t border-slate-100">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="font-semibold text-slate-700">
          Rincian kegiatan menurut Perda
          {perda.kode_zona.length > 0 && (
            <span className="font-normal text-slate-500"> · kode zona {perda.kode_zona.join(', ')}</span>
          )}
        </div>
        <label className="relative flex items-center">
          <Search className="absolute left-2 w-3 h-3 text-slate-400" />
          <input
            type="search"
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            placeholder={`Cari di ${total} kegiatan`}
            className="w-44 rounded-md border border-slate-200 bg-white py-1 pl-6 pr-2 text-[11px] focus:border-kkp-500 focus:outline-none"
          />
        </label>
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        {KOLOM_PERDA.map(([kunci, label, status, latar]) => {
          const daftar = perda[kunci].filter((b) => !kata || b.toLowerCase().includes(kata));
          const tampil = penuh || kata ? daftar : daftar.slice(0, BATAS_BUTIR);
          return (
            <div key={kunci} className={`rounded-md p-2 ${latar}`}>
              <div className={`text-[10.5px] font-semibold uppercase tracking-wide ${WARNA_KETENTUAN[status]}`}>
                {label} <span className="font-normal text-slate-500">({daftar.length})</span>
              </div>
              {tampil.length ? (
                <ul className="mt-1 space-y-1 text-slate-700 leading-snug">
                  {tampil.map((b) => <li key={b}>{b}</li>)}
                </ul>
              ) : (
                <p className="mt-1 text-slate-400">{kata ? 'Tidak ada yang cocok' : '-'}</p>
              )}
            </div>
          );
        })}
      </div>
      {!kata && KOLOM_PERDA.some(([k]) => perda[k].length > BATAS_BUTIR) && (
        <button type="button" onClick={() => setPenuh(!penuh)} className="mt-1.5 text-[11px] font-medium text-kkp-700 hover:underline">
          {penuh ? 'Ringkas daftar' : `Tampilkan semua ${total} kegiatan`}
        </button>
      )}
      {perda.ketentuan_khusus && (
        <details className="mt-1.5 text-[11px] text-slate-600">
          <summary className="cursor-pointer text-kkp-700">Ketentuan khusus zona ini</summary>
          <p className="mt-1 leading-relaxed">{perda.ketentuan_khusus}</p>
        </details>
      )}
      <p className="mt-1.5 text-[10.5px] text-slate-400">{perda.sumber}</p>
    </div>
  );
};

const TANDA_PARAMETER = {
  true: ['✓', 'text-emerald-700', 'Sangat sesuai'],
  false: ['!', 'text-amber-700', 'Perlu dinilai di lapangan'],
  null: ['?', 'text-slate-400', 'Tidak terukur'],
};

const RincianJenis = ({ s }) => {
  const kelompok = [];
  s.zona.forEach((z) => {
    if (!z.rincian) return;
    const kunci = JSON.stringify(z.rincian);
    const ada = kelompok.find((k) => k.kunci === kunci);
    if (ada) ada.zona.push(z);
    else kelompok.push({ kunci, rincian: z.rincian, ketentuan: z.ketentuan, label: z.ketentuan_label, zona: [z] });
  });
  if (!kelompok.length) return null;
  return (
    <div>
      <Judul>Rincian kegiatan {s.sektor_nama.toLowerCase()} menurut matriks Perda</Judul>
      <div className="space-y-2">
        {kelompok.map((k) => (
          <div key={k.kunci} className="border border-slate-200 rounded-lg text-xs overflow-hidden">
            <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="font-medium text-slate-800">{k.zona.map((z) => z.nama).join(', ')}</span>
              <span className={`font-semibold ${WARNA_KETENTUAN[k.ketentuan] || 'text-slate-500'}`}>{k.label}</span>
            </div>
            <div className="p-2 grid gap-2 sm:grid-cols-3">
              {LABEL_KEGIATAN.map(([kode, label]) => (
                <div key={kode} className={`rounded-md p-2 ${KOLOM_PERDA.find((p) => p[2] === kode)[3]}`}>
                  <div className={`text-[10.5px] font-semibold uppercase tracking-wide ${WARNA_KETENTUAN[kode]}`}>
                    {label} <span className="font-normal text-slate-500">({k.rincian[kode].length})</span>
                  </div>
                  {k.rincian[kode].length ? (
                    <ul className="mt-1 space-y-1 text-slate-700 leading-snug">
                      {k.rincian[kode].map((b) => <li key={b}>{b}</li>)}
                    </ul>
                  ) : (
                    <p className="mt-1 text-slate-400">-</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-1 text-[10.5px] text-slate-400">
        Status jenis investasi di tiap zona diturunkan dari rincian ini: diizinkan bila seluruh rinciannya diperbolehkan,
        bersyarat bila sebagian rinciannya dibatasi atau dilarang, dan tidak diizinkan bila seluruhnya dilarang.
      </p>
    </div>
  );
};

const KarakterLokasi = ({ s }) => (
  <div>
    <Judul>Karakter lokasi {s.sektor_nama.toLowerCase()}</Judul>
    <div className="border border-slate-200 rounded-lg text-xs overflow-hidden">
      <dl className="px-3 py-2 grid grid-cols-[auto,1fr] gap-x-3 gap-y-1">
        <dt className="font-semibold text-slate-700">Kebutuhan</dt>
        <dd className="text-slate-600">{s.karakter.kebutuhan || 'Tidak ada syarat karakter khusus.'}</dd>
        <dt className="font-semibold text-slate-700">Kondisi area</dt>
        <dd className="text-slate-600">{s.karakter.terukur}</dd>
        <dt className="font-semibold text-slate-700">Kecocokan</dt>
        <dd className={`font-semibold ${s.karakter.cocok ? 'text-emerald-700' : 'text-rose-700'}`}>
          {s.karakter.cocok ? 'Cocok' : 'Belum cocok'}
        </dd>
      </dl>
      {s.parameter?.length > 0 && (
        <div className="px-3 py-2 border-t border-slate-100">
          <div className="font-semibold text-slate-700">
            {angka(s.persen_sangat_sesuai)}% dari {s.parameter.filter((p) => p.nilai !== null).length} parameter terukur sangat sesuai
            <span className="font-normal text-slate-500"> · ambang Peta Sebaran Wilayah Potensial: 75% dari sedikitnya 5 parameter terukur</span>
          </div>
          <ul className="mt-1 grid gap-x-4 gap-y-0.5 sm:grid-cols-2">
            {s.parameter.map((p) => {
              const [tanda, warna, ket] = TANDA_PARAMETER[p.nilai];
              return (
                <li key={p.label} className="flex gap-1.5 text-slate-700" title={ket}>
                  <span className={`font-bold w-3 shrink-0 ${warna}`}>{tanda}</span>
                  {p.label}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  </div>
);

const KartuScreening = ({ screening: s, onPilihSektor, onLihatLokasi }) => {
  const gaya = GAYA[s.status] || GAYA.BELUM_TERVERIFIKASI;
  const { Ikon } = gaya;
  const acuan = s.acuan.map((a) => `${a.label} ${angka(a.persen, 1)}%`).join(', ');

  return (
    <div className="space-y-4">
      <div className={`flex items-start gap-3 p-4 rounded-lg border ${gaya.kotak}`}>
        <Ikon className={`w-6 h-6 shrink-0 mt-0.5 ${gaya.teks}`} />
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Tahap 1 · Screening kesesuaian ruang
          </div>
          <div className={`text-lg font-bold leading-snug ${gaya.teks}`}>{s.status_label}</div>
          <p className="text-xs text-slate-600 mt-0.5">
            {s.sektor_nama} · cakupan acuan tata ruang {angka(s.cakupan_persen, 1)}%{acuan && ` (${acuan})`}
          </p>
          <p className="text-xs font-medium text-slate-700 mt-1.5">
            {s.lanjut
              ? 'Lokasi dapat dilanjutkan ke Tahap 2 (parameter finansial).'
              : 'Analisis berhenti di Tahap 1 dan tidak dilanjutkan ke Tahap 2.'}
          </p>
        </div>
      </div>

      {s.alasan.length > 0 && (
        <ul className="space-y-1.5 text-xs text-slate-700">
          {s.alasan.map((a, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-slate-400 shrink-0">&bull;</span>
              <span>{a}</span>
            </li>
          ))}
        </ul>
      )}

      {s.zona.length > 0 && (
        <div>
          <Judul>Zona acuan pada area</Judul>
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-semibold">Zona</th>
                  <th className="px-3 py-2 font-semibold">Sub-zona</th>
                  <th className="px-3 py-2 font-semibold">Acuan</th>
                  <th className="px-3 py-2 font-semibold text-right">Porsi</th>
                  <th className="px-3 py-2 font-semibold">Ketentuan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {s.zona.map((z) => (
                  <tr key={`${z.id}-${z.tingkat}`}>
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-800">{z.nama}</div>
                      <div className="text-[10.5px] text-slate-400">{z.sumber_label}{z.regulasi ? ` · ${z.regulasi}` : ''}</div>
                    </td>
                    <td className="px-3 py-2 text-slate-600">{z.sub_zona_label}</td>
                    <td className="px-3 py-2 text-slate-600">{z.tingkat_label}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">{angka(z.persen, 1)}%</td>
                    <td className="px-3 py-2">
                      <span className={`font-semibold ${WARNA_KETENTUAN[z.ketentuan] || 'text-slate-500'}`}>
                        {z.ketentuan_label}
                      </span>
                      {z.syarat && (
                        <div className="text-[10.5px] text-slate-500 mt-0.5">
                          {z.syarat.length > BATAS_SYARAT_TABEL ? 'Syarat: lihat ketentuan khusus zona di bawah.' : z.syarat}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <RincianJenis s={s} />
      {s.karakter && <KarakterLokasi s={s} />}

      {s.informasi_ruang?.length > 0 && (
        <div>
          <Judul>Ketentuan kegiatan pada area analisis</Judul>
          <div className="space-y-2">
            {s.informasi_ruang.map((z) => (
              <div key={`${z.nama}-${z.sub_zona_label}`} className="border border-slate-200 rounded-lg text-xs overflow-hidden">
                <div className="px-3 py-2 bg-slate-50 border-b border-slate-200">
                  <div className="font-medium text-slate-800">
                    {z.nama} <span className="font-normal text-slate-400">· {z.jenis_label} / {z.sub_zona_label}</span>
                  </div>
                  {(z.persen != null || z.dasar_zona) && (
                    <div className="text-[10.5px] text-slate-400">
                      {[z.persen != null && `${angka(z.persen, 1)}% area`, z.dasar_zona].filter(Boolean).join(' · ')}
                    </div>
                  )}
                </div>
                {LABEL_KEGIATAN.some(([kode]) => z.kegiatan[kode].length) ? (
                  <table className="w-full table-fixed text-left">
                    <thead>
                      <tr className="border-b border-slate-100 align-top">
                        {LABEL_KEGIATAN.map(([kode, label]) => (
                          <th key={kode} className={`px-3 py-1.5 font-semibold ${WARNA_KETENTUAN[kode]}`}>{label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="align-top">
                        {LABEL_KEGIATAN.map(([kode]) => (
                          <td key={kode} className="px-3 py-1.5 text-slate-700">
                            {z.kegiatan[kode].length ? (
                              <ul className="space-y-0.5">
                                {z.kegiatan[kode].map((n) => <li key={n}>{n}</li>)}
                              </ul>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                ) : (
                  <p className="px-3 py-2 text-slate-500">Ketentuan per jenis investasi belum ditetapkan untuk sub-zona ini.</p>
                )}
                {z.perda && <RincianPerda perda={z.perda} />}
                <dl className="px-3 py-2 border-t border-slate-100 grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-[11px]">
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
            ))}
          </div>
        </div>
      )}

      {s.kkprl.length > 0 && (
        <div>
          <Judul>KKPRL terbit yang tumpang tindih</Judul>
          <div className="overflow-x-auto border border-rose-200 rounded-lg">
            <table className="w-full text-xs text-left">
              <thead className="bg-rose-50 text-rose-700">
                <tr>
                  <th className="px-3 py-2 font-semibold">Nomor izin</th>
                  <th className="px-3 py-2 font-semibold">Kegiatan</th>
                  <th className="px-3 py-2 font-semibold text-right">Irisan (m²)</th>
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
        </div>
      )}

      {s.rekomendasi && (
        <div className="border-t border-slate-200 pt-4 space-y-4">
          <div>
            <Judul>Jenis investasi yang sesuai di lokasi ini</Judul>
            {s.rekomendasi.sektor_alternatif.length ? (
              <div className="flex flex-wrap gap-2">
                {s.rekomendasi.sektor_alternatif.map((a) =>
                  onPilihSektor ? (
                    <button
                      key={a.kode}
                      type="button"
                      onClick={() => onPilihSektor(a.kode)}
                      className="px-2.5 py-1 rounded-full text-xs font-semibold border border-kkp-200 bg-kkp-100 text-kkp-800 hover:bg-kkp-700 hover:text-white transition-colors"
                    >
                      {a.nama} · {a.status_label}
                    </button>
                  ) : (
                    <span key={a.kode} className="px-2.5 py-1 rounded-full text-xs font-semibold border border-kkp-200 bg-kkp-100 text-kkp-800">
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
          </div>

          <div>
            <Judul>Lokasi alternatif terdekat untuk {s.sektor_nama}</Judul>
            {s.rekomendasi.lokasi_alternatif.length ? (
              <ul className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                {s.rekomendasi.lokasi_alternatif.map((l) => (
                  <li key={l.id ?? l.zona_id} className="flex items-start gap-3 px-3 py-2.5">
                    <MapPin className="w-4 h-4 text-kkp-700 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0 text-xs">
                      <div className="font-semibold text-slate-800">{l.nama}</div>
                      <div className="text-slate-500">
                        {l.sub_zona_label} · {l.provinsi} · {angka(l.jarak_km, 1)} km ke arah {l.arah} · {l.status_label}
                      </div>
                      <div className="text-[10.5px] text-slate-400 font-mono">
                        {keDMS(l.titik[1], 'lat')} {keDMS(l.titik[0], 'lng')} ({keDesimal(l.titik[1])}, {keDesimal(l.titik[0])})
                      </div>
                    </div>
                    {onLihatLokasi && (
                      <button
                        type="button"
                        onClick={() => onLihatLokasi(l)}
                        className="shrink-0 px-2.5 py-1 text-xs font-semibold text-kkp-700 border border-kkp-200 rounded-md hover:bg-kkp-100"
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
          </div>
        </div>
      )}
    </div>
  );
};

export default KartuScreening;
