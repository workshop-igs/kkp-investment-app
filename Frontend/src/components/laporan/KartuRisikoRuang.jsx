import { AlertTriangle } from 'lucide-react';
import KartuLaporan, { AngkaBesar, TabelRingkas } from './KartuLaporan';
import { angkaRingkas as nf } from '../../utils/pemformat';
import { PENJELASAN_RISIKO } from '../../utils/normalisasiAnalisis';

const warnaRisiko = (nilai) => {
  if (nilai === null || nilai === undefined) return '#cbd5e1';
  if (nilai >= 0.7) return '#991b1b';
  if (nilai >= 0.5) return '#ef4444';
  if (nilai >= 0.3) return '#eab308';
  return '#16a34a';
};

const rapi = (t) =>
  String(t || '').replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase());

const ada = (v) => v !== null && v !== undefined;

const Ukur = ({ label, nilai, catatan }) => (
  <div className="mb-2.5 last:mb-0">
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[13px] font-semibold text-slate-700">{label}</span>
      <span className="text-[13px] font-bold font-mono-custom text-slate-900">
        {ada(nilai) ? nf(nilai, 2) : '—'}
      </span>
    </div>
    <div className="mt-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
      <div
        className="h-full rounded-full"
        style={{
          width: `${Math.max(0, Math.min(1, nilai || 0)) * 100}%`,
          background: warnaRisiko(nilai),
        }}
      />
    </div>
    {catatan && <p className="mt-1 text-[11px] text-slate-400 leading-snug">{catatan}</p>}
  </div>
);

const Peringatan = ({ children }) => (
  <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded">
    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-px" />
    <p className="text-[13px] text-amber-800 leading-relaxed">{children}</p>
  </div>
);

const KartuRisikoRuang = ({ risiko, memuat, galat }) => {
  if (memuat) {
    return (
      <KartuLaporan judul="Risiko Lingkungan & Sosial">
        <p className="text-[13px] text-slate-400">Menghitung risiko dari geometri area…</p>
      </KartuLaporan>
    );
  }
  if (galat) {
    return (
      <KartuLaporan judul="Risiko Lingkungan & Sosial">
        <Peringatan>{galat}</Peringatan>
      </KartuLaporan>
    );
  }

  const eko = risiko?.lingkungan;
  const tren = eko?.tren;
  const sos = risiko?.sosial;
  const adat = risiko?.wilayah_adat || [];
  const sumber = risiko?.sumber || {};
  const hanyaBencana = eko && !ada(eko.indeks);

  return (
    <>
      <KartuLaporan
        judul="Risiko Lingkungan"
        pengantar={
          eko
            ? PENJELASAN_RISIKO.lingkungan
            : undefined
        }
        catatan={
          eko
            ? `Sumber: ${sumber.lingkungan || '—'}`
              + (eko.sumber_ekosistem === 'GMW:Mangrove'
                ? ' · sebaran dari Global Mangrove Watch karena penarikan KKP belum mencapai perairan ini; GMW tidak menilai kondisi tutupan'
                : '')
            : undefined
        }
        keterangan={
          'Indeks kesehatan ekosistem dihitung dari sebaran dan kondisi tutupan mangrove '
          + '(2021) Portal Satu Data KKP, ditambah sebaran terumbu karang dan padang lamun '
          + '2025 dari Sidako Ekosistem KKP. Tekanan bencana memakai indeks risiko '
          + 'BNPB InaRISK; ia menjawab pertanyaan yang BERBEDA — "apa yang akan merusak '
          + 'bangunannya" — sehingga bobotnya lebih kecil.'
        }
      >
        {!eko || !ada(eko.gabungan) ? (
          <Peringatan>
            Tidak ada ekosistem maupun indeks bencana terdata untuk area ini. Artinya belum
            tercatat, BUKAN berarti tidak ada — komponennya dilewati dari perhitungan, tidak
            diisi angka netral.
            {tren && ' Riwayat mangrovenya tetap dapat dibaca pada kartu di bawah.'}
          </Peringatan>
        ) : (
          <>
            <AngkaBesar
              item={[
                { nilai: nf(eko.gabungan, 2), satuan: 'Risiko Lingkungan' },
                { nilai: ada(eko.indeks) ? nf(eko.indeks, 2) : '—', satuan: 'Indeks Ekosistem' },
                {
                  nilai: ada(eko.tekanan_bencana) ? nf(eko.tekanan_bencana, 2) : '—',
                  satuan: 'Tekanan Bencana',
                },
              ]}
            />
            {hanyaBencana && (
              <div className="mb-2">
                <Peringatan>
                  Angka di atas berdiri di atas <b>tekanan bencana saja</b> — belum ada
                  ekosistem terdata yang beririsan dengan area ini, sehingga indeks kesehatan
                  ekosistemnya dilewati dan bobot sisanya dinormalkan ulang. Jangan dibaca
                  sebagai penilaian ekosistem.
                </Peringatan>
              </div>
            )}
            <div className="pt-2.5 border-t border-slate-100">
              <Ukur
                label="Kesehatan ekosistem"
                nilai={eko.indeks}
                catatan={
                  ada(eko.indeks)
                    ? `Bobot ${nf((eko.bobot?.ekosistem || 0) * 100)}% — disebut tegas oleh spektek, karena itu dominan`
                    : 'Belum ada ekosistem terdata yang beririsan dengan area ini'
                }
              />
              <Ukur
                label="Tekanan bencana"
                nilai={eko.tekanan_bencana}
                catatan={
                  ada(eko.tekanan_bencana)
                    ? `Bobot ${nf((eko.bobot?.bencana || 0) * 100)}% — rincian per jenis bahaya ada pada tema Tata Ruang & Perizinan`
                    : 'Area berada di luar cakupan raster InaRISK'
                }
              />
            </div>
            {eko.rincian?.length > 0 && (
              <div className="mt-2">
                <TabelRingkas
                  kolom={['Ekosistem', 'Kondisi', 'Objek', 'Luas (ha)', 'Sumber']}
                  baris={eko.rincian.map((r) => [
                    rapi(r.jenis),
                    r.kondisi || (r.sumber === 'GMW:Mangrove' ? 'Tidak dinilai' : 'Tidak tercatat'),
                    nf(r.jumlah),
                    nf(r.luas_ha, 1),
                    r.sumber === 'GMW:Mangrove' ? 'GMW' : 'KKP',
                  ])}
                />
              </div>
            )}
          </>
        )}
      </KartuLaporan>

      {tren && (
        <KartuLaporan
          judul="Tren Mangrove 1996–2020"
          pengantar={
            tren.berarti
              ? `Mangrove di area ini ${tren.perubahan_persen < 0 ? 'berkurang' : 'bertambah'} `
                + `${nf(Math.abs(tren.perubahan_persen), 1)}% dalam ${tren.tahun_akhir - tren.tahun_awal} tahun.`
              : 'Luas mangrove di area ini praktis tidak berubah sejak 1996.'
          }
          catatan={`Sumber: ${tren.sumber}`}
          keterangan={
            'INI YANG TIDAK DAPAT DIBERIKAN LAPISAN KKP: lapisan itu satu tahun saja (2021), '
            + 'sehingga pertanyaan "mangrovenya sedang berkurang atau tidak" tidak punya '
            + 'jawaban di sana. Global Mangrove Watch memetakan sebaran mangrove tiap tahun '
            + 'sejak 1996 dengan metode yang seragam sedunia. Angka ini KETERANGAN — ia '
            + 'BELUM ikut berbobot pada skor risiko lingkungan, karena arahnya tidak '
            + 'sesederhana kelihatannya: mangrove yang sudah hilang berarti lebih sedikit '
            + 'yang dipertaruhkan, sementara tegakan yang MASIH ADA di daerah yang sedang '
            + 'kehilangan mangrove justru memikul beban dampak kumulatif.'
          }
        >
          <AngkaBesar
            item={[
              { nilai: nf(tren.luas_awal_ha, 0), satuan: `Hektare ${tren.tahun_awal}` },
              { nilai: nf(tren.luas_akhir_ha, 0), satuan: `Hektare ${tren.tahun_akhir}` },
              {
                nilai: `${tren.perubahan_persen > 0 ? '+' : ''}${nf(tren.perubahan_persen, 1)}%`,
                satuan: 'Perubahan',
              },
            ]}
          />
          {!tren.berarti && (
            <p className="text-[11px] text-slate-400 leading-snug mt-1">
              Perubahan di bawah 5% tidak disebut sebagai tren: selisih sekecil itu antara dua
              tahun lebih mungkin berasal dari perbedaan penafsiran citra daripada dari
              perubahan tutupan yang sebenarnya.
            </p>
          )}
        </KartuLaporan>
      )}

      <KartuLaporan
        judul="Risiko Sosial"
        pengantar={
          sos
            ? PENJELASAN_RISIKO.sosial
            : undefined
        }
        catatan={
          sos
            ? `Sumber: ${sumber.sosial || '—'}${sos.tahun_data ? ` · statistik ${sos.tahun_data}` : ''}`
            : undefined
        }
        keterangan={
          'Kemiskinan memakai bagian penduduk yang terdaftar pada DTKS desil 1–4 — pendataan '
          + 'kesejahteraan Kemensos, BUKAN angka kemiskinan BPS yang dihitung terhadap garis '
          + 'kemiskinan rupiah per kapita per bulan. Keduanya berdekatan di banyak kabupaten '
          + 'tetapi bukan bilangan yang sama. Skalanya dipatok pada persentil 10 dan 90 dari '
          + '281 kabupaten/kota PESISIR, bukan seluruh 514, karena area yang dinilai selalu '
          + 'berada di perairan.'
        }
      >
        {!sos ? (
          <Peringatan>
            Kabupaten/kota yang menaungi area ini belum berdata, sehingga risiko sosial
            dilewati dari perhitungan — tidak diisi angka netral.
          </Peringatan>
        ) : (
          <>
            <AngkaBesar
              item={[
                { nilai: nf(sos.nilai, 2), satuan: 'Risiko Sosial' },
                { nilai: ada(sos.nilai_kemiskinan) ? nf(sos.nilai_kemiskinan, 2) : '—', satuan: 'Kemiskinan' },
                { nilai: ada(sos.nilai_tenurial) ? nf(sos.nilai_tenurial, 2) : '—', satuan: 'Konflik Tenurial' },
              ]}
            />
            <div className="pt-2.5 border-t border-slate-100">
              <Ukur
                label="Kemiskinan"
                nilai={sos.nilai_kemiskinan}
                catatan={
                  ada(sos.rasio_dtks)
                    ? `${nf(sos.rasio_dtks * 100, 1)}% penduduk ${sos.kabupaten_kota} terdaftar DTKS desil 1–4 `
                      + `(${nf(sos.penduduk_dtks)} dari ${nf(sos.jumlah_penduduk)} jiwa)`
                    : 'Belum berdata untuk kabupaten ini'
                }
              />
              <Ukur
                label="Konflik tenurial"
                nilai={sos.nilai_tenurial}
                catatan={
                  ada(sos.rasio_nelayan)
                    ? `${nf(sos.jumlah_nelayan)} nelayan (${nf(sos.rasio_nelayan * 100, 1)}% penduduk)`
                      + (adat.length ? ' · dinaikkan karena beririsan wilayah adat' : '')
                      + (sos.sub_zona_melekat
                        ? ` · dinaikkan karena berada di ${rapi(sos.sub_zona_melekat).toLowerCase()}`
                        : '')
                    : 'Belum berdata untuk kabupaten ini'
                }
              />
            </div>
          </>
        )}
      </KartuLaporan>

      <KartuLaporan
        judul="Wilayah Kelola Masyarakat Hukum Adat"
        pengantar={
          adat.length
            ? 'Ada pihak yang sudah memegang hak kelola atas perairan ini. Statusnya '
              + 'memperberat perizinan dan menuntut kesepakatan dengan pemegang haknya.'
            : undefined
        }
        catatan={adat.length ? 'Sumber: Sidako KKP (wilayah kelola MHA 2024), Portal Satu Data KKP, dan RTRW Provinsi' : undefined}
        keterangan={
          'Cakupan data wilayah adat BARU ENAM PROVINSI — Papua, Papua Barat, Papua Barat Daya, '
          + 'Maluku, Sulawesi Tenggara, dan Sulawesi Utara; di Papua ditambah zona RTRW Provinsi yang '
          + 'ditandai berada di wilayah kelola adat. Karena itu ketiadaan irisan berarti BELUM '
          + 'TERCATAT, bukan tidak ada klaim, dan lapisan ini hanya menaikkan risiko '
          + 'tenurial — tidak pernah menurunkannya.'
        }
      >
        {adat.length ? (
          <TabelRingkas
            kolom={['Wilayah adat', 'Jenis', 'Provinsi']}
            baris={adat.map((a) => [a.nama, a.jenis || '—', a.provinsi || '—'])}
          />
        ) : (
          <p className="text-[13px] text-slate-500 leading-relaxed">
            Tidak ada wilayah kelola masyarakat hukum adat tercatat yang beririsan dengan area
            ini. Baca keterangan di atas sebelum memperlakukannya sebagai bebas klaim.
          </p>
        )}
      </KartuLaporan>
    </>
  );
};

export default KartuRisikoRuang;
