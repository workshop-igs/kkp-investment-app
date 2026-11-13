import { useEffect, useState } from 'react';
import { getOAuthConfig } from '../api/autentikasi';

const Bagian = ({ judul, children }) => (
  <section className="space-y-2">
    <h2 className="text-base font-bold text-kkp-900">{judul}</h2>
    <div className="space-y-2 text-sm leading-relaxed text-slate-600">{children}</div>
  </section>
);

const KebijakanPrivasiPage = () => {
  const [privasi, setPrivasi] = useState({ kontak: '', simpan_log_hari: 365 });

  useEffect(() => {
    getOAuthConfig().then((k) => k.privasi && setPrivasi(k.privasi)).catch(() => {});
  }, []);

  const kontak = privasi.kontak || 'administrator platform di Direktorat Jenderal Penataan Ruang Laut';

  return (
    <div className="h-full pt-[72px] overflow-y-auto bg-white custom-scrollbar">
      <article className="max-w-3xl mx-auto p-5 lg:p-8 space-y-7">
        <header>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-kkp-700">Pelindungan Data Pribadi</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-kkp-900">Kebijakan Privasi</h1>
          <p className="mt-2 text-sm text-slate-500">
            Berlaku sejak 13 November 2026. Kebijakan ini menjelaskan bagaimana Platform Manajemen Investasi Ruang Laut
            memproses data pribadi Anda sesuai Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi.
          </p>
        </header>

        <Bagian judul="Pengendali data">
          <p>
            Kementerian Kelautan dan Perikanan (KKP) melalui Direktorat Jenderal Penataan Ruang Laut adalah pengendali
            data pribadi di platform ini. Platform dijalankan di server KKP.
          </p>
        </Bagian>

        <Bagian judul="Data yang kami kumpulkan">
          <ul className="list-disc pl-5 space-y-1">
            <li>Data akun: nama lengkap, username, email, nomor telepon, instansi, dan provinsi wilayah kerja.</li>
            <li>Kata sandi, yang disimpan dalam bentuk teracak sehingga tidak dapat dibaca siapa pun.</li>
            <li>Catatan aktivitas: waktu, alamat IP, dan jenis peramban saat Anda masuk, keluar, mendaftar, atau mengubah data.</li>
            <li>Data proyek investasi yang diisi Tim KKP, termasuk nama investor dan pembuat proyek.</li>
          </ul>
          <p>Platform tidak mengumpulkan data pribadi yang bersifat spesifik, seperti data kesehatan, biometrik, atau keuangan pribadi.</p>
        </Bagian>

        <Bagian judul="Tujuan dan dasar pemrosesan">
          <p>
            Data dipakai untuk membuat dan mengamankan akun, mengatur hak akses, menghubungi Anda terkait penggunaan
            platform, dan mencatat jejak perubahan data. Pendaftaran mandiri diproses berdasarkan persetujuan Anda;
            akun pegawai yang dibuat administrator diproses dalam rangka pelaksanaan tugas dan kewenangan KKP.
          </p>
          <p>
            Skor kelayakan dan risiko di platform menilai lokasi ruang laut, bukan orang. Platform tidak membuat
            keputusan otomatis tentang Anda.
          </p>
        </Bagian>

        <Bagian judul="Pembagian data">
          <p>
            Data akun tidak dijual dan tidak dibagikan kepada pihak lain, serta tidak ikut diterbitkan di Unduh Data,
            Direktori Layanan Peta, maupun layanan WMS, WFS, dan WCS.
          </p>
          <p>
            Peta latar (Esri dan OpenStreetMap) dan huruf (Google Fonts) dimuat langsung oleh peramban Anda dari
            penyedianya. Seperti kunjungan web pada umumnya, penyedia tersebut menerima alamat IP peramban Anda.
          </p>
        </Bagian>

        <Bagian judul="Asisten AI">
          <p>
            Pertanyaan kepada Asisten AI diolah oleh model bahasa di server KKP dan tidak disimpan maupun dicatat.
            Hindari menuliskan data pribadi dalam pertanyaan. Jawaban disusun oleh AI dan dapat keliru, sehingga perlu
            diperiksa kembali sebelum dipakai.
          </p>
        </Bagian>

        <Bagian judul="Masa simpan">
          <ul className="list-disc pl-5 space-y-1">
            <li>Data akun disimpan selama akun ada dan terhapus saat akun dihapus.</li>
            <li>Catatan aktivitas dihapus otomatis setelah {privasi.simpan_log_hari} hari.</li>
            <li>Salinan cadangan basis data dienkripsi dan dihapus setelah 7 hari.</li>
          </ul>
        </Bagian>

        <Bagian judul="Keamanan">
          <p>
            Seluruh lalu lintas dienkripsi dengan TLS 1.3. Percobaan masuk yang gagal berulang kali ditahan sementara,
            akses dibatasi menurut level akun, dan setiap perubahan data tercatat.
          </p>
        </Bagian>

        <Bagian judul="Hak Anda">
          <ul className="list-disc pl-5 space-y-1">
            <li>Melihat dan memperbarui data diri serta mengganti kata sandi di halaman Profil.</li>
            <li>Meminta salinan data pribadi Anda.</li>
            <li>Meminta penghentian pemrosesan, penghapusan akun, atau menarik kembali persetujuan.</li>
            <li>Mengajukan keberatan dan mendapat penjelasan atas pemrosesan data Anda.</li>
          </ul>
          <p>Permintaan diajukan kepada {kontak}.</p>
        </Bagian>

        <Bagian judul="Bila terjadi kegagalan pelindungan data">
          <p>
            KKP akan memberi tahu Anda secara tertulis paling lambat 3 x 24 jam sejak mengetahui kegagalan pelindungan
            data pribadi, termasuk data yang terdampak dan langkah penanganannya.
          </p>
        </Bagian>

        <Bagian judul="Perubahan kebijakan">
          <p>Perubahan kebijakan ini diumumkan di halaman ini dengan tanggal berlaku yang baru.</p>
        </Bagian>
      </article>
    </div>
  );
};

export default KebijakanPrivasiPage;
