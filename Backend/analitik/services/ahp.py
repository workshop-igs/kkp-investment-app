import logging
from typing import Dict, Tuple

import numpy as np

from .konstanta import (
    KELAS_RISIKO_LABEL,
    KRITERIA_BAWAAN,
    RANDOM_INDEX,
    kelas_risiko_investasi,
)
from .pengaturan import atur

logger = logging.getLogger('analitik')


def hitung_bobot_ahp(pairwise_matrix: np.ndarray) -> Tuple[np.ndarray, float, bool]:
    matrix = np.asarray(pairwise_matrix, dtype=float)
    n = matrix.shape[0]

    col_sums = matrix.sum(axis=0)
    normalized = matrix / col_sums

    weights = normalized.mean(axis=1)

    if n <= 2:
        return weights, 0.0, True

    weighted_sum = matrix @ weights
    lambda_values = weighted_sum / weights
    lambda_max = lambda_values.mean()

    ci = (lambda_max - n) / (n - 1)

    ri = RANDOM_INDEX.get(n, 1.49)
    cr = ci / ri if ri > 0 else 0.0

    is_consistent = cr < atur('AMBANG_KONSISTENSI_AHP')

    if not is_consistent:
        logger.error(
            f'[AHP] Matriks TIDAK konsisten: CR={cr:.4f} (harus < {atur("AMBANG_KONSISTENSI_AHP")}). '
            f'Bobotnya TIDAK boleh dipakai — pemanggil wajib menolaknya. '
            f'Lihat bobot_dari_matriks().'
        )

    return weights, float(cr), is_consistent


class MatriksTidakKonsisten(ValueError):  # noqa: N818
    pass


def bobot_dari_matriks(matriks, kriteria, sumber: str) -> Tuple[Dict[str, float], float]:
    bobot, cr, konsisten = hitung_bobot_ahp(matriks)
    if not konsisten:
        raise MatriksTidakKonsisten(
            f'Matriks AHP "{sumber}" tidak konsisten: CR={cr:.4f} '
            f'(ambang {atur("AMBANG_KONSISTENSI_AHP")}). Perbaiki perbandingan '
            f'berpasangannya sebelum bobotnya dipakai menilai kelayakan.'
        )
    return (
        {k: round(float(bobot[i]), 4) for i, k in enumerate(kriteria)},
        cr,
    )


def _bobot_default() -> Tuple[Dict[str, float], float]:
    return bobot_dari_matriks(
        atur('MATRIKS_PERBANDINGAN_BAWAAN'), KRITERIA_BAWAAN, 'MATRIKS_PERBANDINGAN_BAWAAN'
    )


def ambil_bobot_sektor(sektor_kode: str | None = None) -> Tuple[Dict[str, float], float]:
    from django.core.cache import cache

    kunci = f'ahp:bobot:{sektor_kode or "_default"}'
    tersimpan = cache.get(kunci)
    if tersimpan is not None:
        return tersimpan

    hasil = _bobot_dari_basis_data(sektor_kode) or _bobot_default()
    cache.set(kunci, hasil, 600)
    return hasil


def _bobot_dari_basis_data(sektor_kode: str | None):
    try:
        from analitik.models import ParameterAHP

        baris = []
        if sektor_kode:
            baris = list(
                ParameterAHP.objects.filter(sektor__kode__iexact=sektor_kode).order_by('urutan')
            )
        if not baris:
            baris = list(ParameterAHP.objects.filter(sektor__isnull=True).order_by('urutan'))
        if not baris:
            return None

        bobot = {b.kode_kriteria: float(b.bobot or 0) for b in baris}
        jumlah = sum(bobot.values())
        if jumlah <= 0:
            logger.warning(
                f'[AHP] ParameterAHP untuk sektor {sektor_kode} berjumlah nol; '
                f'memakai matriks bawaan.'
            )
            return None

        default_bobot, _ = _bobot_default()
        lengkap = dict(default_bobot)
        lengkap.update({k: v / jumlah for k, v in bobot.items()})

        total = sum(lengkap.values())
        lengkap = {k: round(v / total, 4) for k, v in lengkap.items()}

        return lengkap, 0.0
    except Exception as e:
        logger.warning(f'[AHP] Gagal membaca ParameterAHP ({e}); memakai matriks bawaan.')
        return None


def skor_finansial(npv: float, irr: float, payback: float, roi: float, investasi_miliar: float) -> Tuple[float, Dict]:
    if npv > 0:
        npv_score = min(1.0, npv / (investasi_miliar * 1e9 * atur('FAKTOR_NORMALISASI_NPV')))
    else:
        npv_score = max(0.0, 0.3 + (npv / (investasi_miliar * 1e9 * atur('FAKTOR_NORMALISASI_NPV'))))

    irr_score = min(1.0, max(0.0, irr / atur('BATAS_ATAS_IRR_PERSEN')))

    if payback <= atur('PAYBACK_THRESHOLDS')['excellent']:
        payback_score = 1.0
    elif payback <= atur('PAYBACK_THRESHOLDS')['good']:
        payback_score = 0.8
    elif payback <= atur('PAYBACK_THRESHOLDS')['fair']:
        payback_score = 0.5
    else:
        payback_score = max(0.1, 1.0 - payback / 20.0)

    roi_score = min(1.0, max(0.0, roi / atur('ROI_CEILING_PCT')))

    score = (npv_score * atur('FINANCIAL_WEIGHTS')['npv'] +
             irr_score * atur('FINANCIAL_WEIGHTS')['irr'] +
             payback_score * atur('FINANCIAL_WEIGHTS')['payback'] +
             roi_score * atur('FINANCIAL_WEIGHTS')['roi'])

    detail = {
        'npv_score': round(npv_score, 3),
        'irr_score': round(irr_score, 3),
        'payback_score': round(payback_score, 3),
        'roi_score': round(roi_score, 3),
        'composite': round(score, 3),
    }

    return round(score, 4), detail


def skor_risiko_investasi(
    risiko_pasar: float,
    risiko_operasional: float,
    risiko_regulasi: float,
    risiko_lingkungan: float,
    risiko_sosial: float,
) -> Tuple[float, Dict]:
    scores = {
        'pasar': 1.0 - risiko_pasar,
        'operasional': 1.0 - risiko_operasional,
        'regulasi': 1.0 - risiko_regulasi,
        'lingkungan': 1.0 - risiko_lingkungan,
        'sosial': 1.0 - risiko_sosial,
    }

    composite = sum(scores[k] * atur('RISK_WEIGHTS')[k] for k in scores)
    return round(composite, 4), {k: round(v, 3) for k, v in scores.items()}


def skor_lokasi(
    kesesuaian_tr: bool, potensi_sda: float, aksesibilitas: float, kondisi_sosek: float
) -> Tuple[float, Dict]:
    tr_score = atur('TATA_RUANG_PASS_SCORE') if kesesuaian_tr else atur('TATA_RUANG_FAIL_SCORE')
    score = (tr_score * atur('LOCATION_WEIGHTS')['tata_ruang'] +
             potensi_sda * atur('LOCATION_WEIGHTS')['potensi_sda'] +
             aksesibilitas * atur('LOCATION_WEIGHTS')['aksesibilitas'] +
             kondisi_sosek * atur('LOCATION_WEIGHTS')['sosial_ekonomi'])

    detail = {
        'tata_ruang': round(tr_score, 3),
        'potensi_sda': round(potensi_sda, 3),
        'aksesibilitas': round(aksesibilitas, 3),
        'sosial_ekonomi': round(kondisi_sosek, 3),
    }
    return round(score, 4), detail


def skor_prediksi(prediksi_keuntungan: float, investasi_miliar: float) -> Tuple[float, Dict]:
    if investasi_miliar <= 0:
        return 0.5, {'note': 'Tidak ada data investasi'}

    ratio = prediksi_keuntungan / (investasi_miliar * 1e9)
    score = min(1.0, max(0.0, ratio / atur('PROFIT_RATIO_CEILING')))

    return round(score, 4), {
        'profit_ratio': round(ratio, 3),
        'score': round(score, 3),
    }


def _determine_decision(total_score: float, kesesuaian_tr: bool, npv: float) -> Tuple[str, str]:
    layak_threshold = atur('DECISION_THRESHOLDS')['layak']['min_score']
    bersyarat_threshold = atur('DECISION_THRESHOLDS')['bersyarat']['min_score']

    if total_score >= layak_threshold and kesesuaian_tr and npv > 0:
        keputusan = 'LAYAK'
        prioritas = 'TINGGI' if total_score >= atur('PRIORITY_THRESHOLDS')['tinggi'] else 'SEDANG'
    elif total_score >= bersyarat_threshold and (kesesuaian_tr or npv > 0):
        keputusan = 'BERSYARAT'
        prioritas = 'SEDANG' if total_score >= atur('PRIORITY_THRESHOLDS')['sedang_bersyarat'] else 'RENDAH'
    else:
        keputusan = 'TIDAK_LAYAK'
        prioritas = 'RENDAH'
    return keputusan, prioritas


def _determine_risk_class(
    risiko_pasar: float,
    risiko_operasional: float,
    risiko_regulasi: float,
    risiko_lingkungan: float,
    risiko_sosial: float,
) -> str:
    kode = kelas_risiko_investasi(
        risiko_pasar, risiko_operasional, risiko_regulasi, risiko_lingkungan, risiko_sosial
    )
    return KELAS_RISIKO_LABEL[kode]


def _angka_id(nilai: float, desimal: int = 1) -> str:
    teks = f'{nilai:,.{desimal}f}'
    return teks.replace(',', '\x00').replace('.', ',').replace('\x00', '.')


def _rupiah(nilai: float) -> str:
    if round(abs(nilai) / 1e9, 1) >= 1000:
        return f'Rp {_angka_id(nilai / 1e12, 2)} triliun'
    if abs(nilai) >= 1e9:
        return f'Rp {_angka_id(nilai / 1e9)} miliar'
    if abs(nilai) >= 1e6:
        return f'Rp {_angka_id(nilai / 1e6)} juta'
    return f'Rp {_angka_id(nilai, 0)}'


def _temuan_keputusan(keputusan: str, skor: float, kesesuaian_tr: bool, npv: float) -> str:
    batas_layak = atur('DECISION_THRESHOLDS')['layak']['min_score']
    batas_bersyarat = atur('DECISION_THRESHOLDS')['bersyarat']['min_score']
    skor_teks = _angka_id(skor, 2)

    if keputusan == 'LAYAK':
        return (
            f'Keputusan LAYAK pada skor gabungan {skor_teks}: melewati ambang '
            f'{_angka_id(batas_layak, 2)}, lokasi sesuai rencana tata ruang, dan NPV positif.'
        )

    ambang = batas_layak if keputusan == 'BERSYARAT' else batas_bersyarat
    sebab = []
    if skor < ambang:
        sebab.append(f'skor gabungan {skor_teks} di bawah ambang {_angka_id(ambang, 2)}')
    if not kesesuaian_tr:
        sebab.append('lokasi belum sesuai rencana tata ruang laut')
    if npv is not None and npv <= 0:
        sebab.append('NPV tidak positif')

    label = 'TIDAK LAYAK' if keputusan == 'TIDAK_LAYAK' else 'BERSYARAT'
    alasan = '; '.join(sebab) if sebab else f'skor gabungan {skor_teks}'
    return f'Keputusan {label} - {alasan}.'


def _temuan_finansial(
    npv: float,
    irr: float,
    payback: float,
    roi: float,
    payback_tercapai,
    wacc_pct,
    umur_proyek,
) -> list:
    temuan = []
    if npv is not None and npv <= 0:
        konteks = ''
        if wacc_pct is not None and umur_proyek:
            konteks = f' pada discount rate {_angka_id(wacc_pct)}% selama {umur_proyek} tahun'
        temuan.append(
            f'NPV negatif ({_rupiah(npv)}): arus kas terdiskonto tidak menutup CapEx'
            f'{konteks}. Tinjau ulang CapEx, asumsi pendapatan, atau umur proyek.'
        )
    if irr is not None and wacc_pct is not None and irr < wacc_pct:
        temuan.append(
            f'IRR {_angka_id(irr)}% berada di bawah discount rate {_angka_id(wacc_pct)}% - imbal hasil '
            'proyek lebih rendah daripada biaya modalnya.'
        )
    if npv is not None and npv <= 0 and irr is not None and wacc_pct is not None and irr - wacc_pct > 0.1:
        temuan.append(
            f'IRR {_angka_id(irr)}% di atas discount rate tetapi NPV negatif: arus kas tahun-tahun akhir '
            'negatif karena biaya tumbuh melampaui pendapatan, sehingga IRR tidak tunggal dan '
            'tidak dapat dipakai. Kelayakan mengikuti NPV.'
        )
    if payback_tercapai is False:
        umur = f'{umur_proyek} tahun umur proyek' if umur_proyek else 'umur proyek'
        temuan.append(f'Modal tidak kembali dalam {umur}; perlu penjadwalan ulang investasi.')
    elif payback is not None and payback > atur('PAYBACK_THRESHOLDS')['fair']:
        batas = atur('PAYBACK_THRESHOLDS')['fair']
        temuan.append(
            f'Payback {_angka_id(payback)} tahun melewati ambang wajar {batas} tahun.'
        )
    if roi is not None and roi <= 0:
        temuan.append(
            f'ROI {_angka_id(roi)}% - proyek tidak mengembalikan nilai investasinya '
            'sepanjang umur proyek.'
        )
    return temuan


def _temuan_lokasi(
    kesesuaian_tr: bool,
    potensi_sda: float,
    aksesibilitas: float,
    kondisi_sosek: float,
    risiko_regulasi: float,
) -> list:
    temuan = []
    if not kesesuaian_tr and risiko_regulasi <= 0.5:
        temuan.append(
            'Kesesuaian dengan rencana tata ruang laut belum terpenuhi - selesaikan sebelum '
            'permohonan KKPRL diajukan.'
        )
    if aksesibilitas < 0.4:
        temuan.append(
            f'Aksesibilitas rendah (skor {_angka_id(aksesibilitas, 2)}): jarak ke pelabuhan, '
            'jalan, listrik, atau air bersih akan menaikkan biaya logistik dan penyambungan daya.'
        )
    if potensi_sda < 0.4:
        temuan.append(
            f'Potensi sumber daya alam terbatas (skor {_angka_id(potensi_sda, 2)}) menurut data '
            'yang tersedia untuk sektor ini.'
        )
    if kondisi_sosek < 0.4:
        temuan.append(
            f'Kondisi sosial-ekonomi wilayah lemah (skor {_angka_id(kondisi_sosek, 2)}): '
            'ketersediaan tenaga kerja dan daya dukung wilayah perlu diperiksa lebih dulu.'
        )
    return temuan


def _temuan_risiko(
    risiko_pasar: float,
    risiko_operasional: float,
    risiko_regulasi: float,
    risiko_lingkungan: float,
    risiko_sosial: float,
) -> list:
    strategi = []
    if risiko_regulasi > 0.5:
        strategi.append('Verifikasi kesesuaian RTR/RZ dan status KKPRL sebelum investasi')
    if risiko_lingkungan > 0.5:
        strategi.append('Lakukan AMDAL komprehensif dan monitoring ekosistem berkala')
    if risiko_sosial > 0.5:
        strategi.append('Lakukan konsultasi publik dan program pemberdayaan masyarakat')
    if risiko_pasar > 0.5:
        strategi.append('Diversifikasi produk/pasar dan buat kontrak offtake agreement')
    if risiko_operasional > 0.5:
        strategi.append('Asuransi proyek dan SOP manajemen bencana')
    return strategi


def _susun_temuan(
    *,
    keputusan: str,
    skor_total: float,
    npv: float,
    irr: float,
    payback: float,
    roi: float,
    payback_tercapai,
    wacc_pct,
    umur_proyek,
    risiko_pasar: float,
    risiko_operasional: float,
    risiko_regulasi: float,
    risiko_lingkungan: float,
    risiko_sosial: float,
    kesesuaian_tr: bool,
    potensi_sda: float,
    aksesibilitas: float,
    kondisi_sosek: float,
    skor_prediksi: float,
    rasio_laba,
    catatan_spasial,
) -> list:
    temuan = [_temuan_keputusan(keputusan, skor_total, kesesuaian_tr, npv)]
    temuan += _temuan_finansial(npv, irr, payback, roi, payback_tercapai, wacc_pct, umur_proyek)
    temuan += list(catatan_spasial or [])
    temuan += _temuan_risiko(
        risiko_pasar, risiko_operasional, risiko_regulasi, risiko_lingkungan, risiko_sosial
    )
    temuan += _temuan_lokasi(
        kesesuaian_tr, potensi_sda, aksesibilitas, kondisi_sosek, risiko_regulasi
    )
    if skor_prediksi < 0.4:
        laba = ''
        if rasio_laba is not None:
            laba = (
                f' - perkiraan laba hanya {_angka_id(rasio_laba * 100, 0)}% '
                'dari nilai investasi'
            )
        temuan.append(f'Prediksi keuntungan rendah (skor {_angka_id(skor_prediksi, 2)}){laba}.')

    if len(temuan) == 1:
        temuan.append(
            'Tidak ada aspek yang melewati ambang perhatian - lanjutkan dengan monitoring berkala.'
        )
    return temuan


def jalankan_analisis_ahp(
    npv: float,
    irr: float,
    payback: float,
    roi: float,
    investasi_miliar: float,
    risiko_pasar: float = 0.5,
    risiko_operasional: float = 0.5,
    risiko_regulasi: float = 0.5,
    risiko_lingkungan: float = 0.5,
    risiko_sosial: float = 0.5,
    kesesuaian_tr: bool = False,
    potensi_sda: float = 0.5,
    aksesibilitas: float = 0.5,
    kondisi_sosek: float = 0.5,
    prediksi_keuntungan: float = 0,
    sektor_kode: str | None = None,
    wacc_pct: float | None = None,
    umur_proyek: int | None = None,
    payback_tercapai: bool | None = None,
    catatan_spasial: list | None = None,
) -> Dict:
    weights, cr = ambil_bobot_sektor(sektor_kode)

    skor_fin, detail_fin = skor_finansial(npv, irr, payback, roi, investasi_miliar)
    skor_risk, detail_risk = skor_risiko_investasi(
        risiko_pasar, risiko_operasional, risiko_regulasi, risiko_lingkungan, risiko_sosial
    )
    skor_lok, detail_lok = skor_lokasi(kesesuaian_tr, potensi_sda, aksesibilitas, kondisi_sosek)
    skor_pred, detail_pred = skor_prediksi(prediksi_keuntungan, investasi_miliar)

    skor_rek = (skor_fin * atur('RECOMMENDATION_WEIGHTS')['finansial'] +
                skor_risk * atur('RECOMMENDATION_WEIGHTS')['risiko'] +
                skor_lok * atur('RECOMMENDATION_WEIGHTS')['lokasi'] +
                skor_pred * atur('RECOMMENDATION_WEIGHTS')['prediksi'])

    aspect_scores = {
        'FINANSIAL': skor_fin,
        'RISIKO': skor_risk,
        'LOKASI': skor_lok,
        'PREDIKSI': skor_pred,
        'REKOMENDASI': skor_rek,
    }

    total_score = sum(aspect_scores[k] * weights.get(k, 0.2) for k in aspect_scores)

    keputusan, prioritas = _determine_decision(total_score, kesesuaian_tr, npv)

    kelas_risiko = _determine_risk_class(
        risiko_pasar, risiko_operasional, risiko_regulasi, risiko_lingkungan, risiko_sosial
    )

    strategi_mitigasi = _susun_temuan(
        keputusan=keputusan,
        skor_total=total_score,
        npv=npv,
        irr=irr,
        payback=payback,
        roi=roi,
        payback_tercapai=payback_tercapai,
        wacc_pct=wacc_pct,
        umur_proyek=umur_proyek,
        risiko_pasar=risiko_pasar,
        risiko_operasional=risiko_operasional,
        risiko_regulasi=risiko_regulasi,
        risiko_lingkungan=risiko_lingkungan,
        risiko_sosial=risiko_sosial,
        kesesuaian_tr=kesesuaian_tr,
        potensi_sda=potensi_sda,
        aksesibilitas=aksesibilitas,
        kondisi_sosek=kondisi_sosek,
        skor_prediksi=skor_pred,
        rasio_laba=detail_pred.get('profit_ratio'),
        catatan_spasial=catatan_spasial,
    )

    logger.info(f'[AHP] Score={total_score:.3f} -> {keputusan} (CR={cr:.4f}, Risiko={kelas_risiko})')

    return {
        'skor_ahp_total': round(total_score, 4),
        'consistency_ratio': round(cr, 4),
        'is_consistent': cr < atur('AMBANG_KONSISTENSI_AHP'),
        'keputusan': keputusan,
        'prioritas': prioritas,
        'kelas_risiko': kelas_risiko,
        'bobot_kriteria': weights,
        'skor_per_aspek': {
            'finansial': {'skor': skor_fin, 'bobot': weights.get('FINANSIAL', 0), 'detail': detail_fin},
            'risiko': {'skor': skor_risk, 'bobot': weights.get('RISIKO', 0), 'detail': detail_risk},
            'lokasi': {'skor': skor_lok, 'bobot': weights.get('LOKASI', 0), 'detail': detail_lok},
            'prediksi': {'skor': skor_pred, 'bobot': weights.get('PREDIKSI', 0), 'detail': detail_pred},
            'rekomendasi': {'skor': round(skor_rek, 4), 'bobot': weights.get('REKOMENDASI', 0)},
        },
        'strategi_mitigasi': strategi_mitigasi,
    }
