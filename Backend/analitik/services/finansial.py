import logging
from typing import Any, Dict, Optional, Tuple

import numpy as np

from .pengaturan import atur

logger = logging.getLogger('analitik')

FALLBACK_USD_IDR = 16_350.0
FRANKFURTER_URL = 'https://api.frankfurter.app/latest'


def _arus_kas(base_annual_revenue, base_annual_opex, revenue_growth_pct, opex_growth_pct, years):
    hasil = []
    current_revenue = base_annual_revenue
    current_opex = base_annual_opex
    for _ in range(years):
        hasil.append((current_revenue, current_opex))
        current_revenue *= 1 + revenue_growth_pct / 100
        current_opex *= 1 + opex_growth_pct / 100
    return hasil


def calc_dcf_metrics(
    base_annual_revenue: float,
    base_annual_opex: float,
    capex: float,
    revenue_growth_pct: float,
    opex_growth_pct: float,
    wacc: float,
    years: int,
) -> Tuple[float, float, float, float, bool]:
    cash_flows = [
        p - b for p, b in _arus_kas(base_annual_revenue, base_annual_opex, revenue_growth_pct, opex_growth_pct, years)
    ]

    npv = sum(cf / ((1 + wacc) ** (t + 1)) for t, cf in enumerate(cash_flows)) - capex

    irr = _calc_irr_array(cash_flows, capex)

    cumulative = -capex
    payback_years = float(years)
    payback_tercapai = False
    for t, cf in enumerate(cash_flows, start=1):
        prev_cumulative = cumulative
        cumulative += cf
        if cumulative >= 0:
            fraction = abs(prev_cumulative) / cf if cf > 0 else 0
            payback_years = (t - 1) + fraction
            payback_tercapai = True
            break

    total_net_profit = sum(cash_flows) - capex
    roi = (total_net_profit / capex * 100) if capex > 0 else 0

    return (
        round(npv, 0),
        round(irr * 100, 1),
        round(payback_years, 1),
        round(roi, 1),
        payback_tercapai,
    )


IRR_BATAS_BAWAH = -0.99
IRR_BATAS_ATAS = 5.0


def _calc_irr_array(cash_flows: list, capex: float, tol: float = 1e-7) -> float:
    def npv_at(r):
        return sum(cf / ((1 + r) ** (t + 1)) for t, cf in enumerate(cash_flows)) - capex

    if npv_at(IRR_BATAS_ATAS) > 0:
        return IRR_BATAS_ATAS

    kisi = np.linspace(IRR_BATAS_BAWAH, IRR_BATAS_ATAS, 5991)
    tahun = np.arange(1, len(cash_flows) + 1)
    npv_kisi = ((1 + kisi)[:, None] ** -tahun) @ np.asarray(cash_flows, dtype=float) - capex
    positif = np.flatnonzero(npv_kisi > 0)
    if positif.size == 0:
        return IRR_BATAS_BAWAH
    lo, hi = float(kisi[positif[-1]]), float(kisi[min(positif[-1] + 1, kisi.size - 1)])

    for _ in range(200):
        mid = (lo + hi) / 2
        if hi - lo < tol:
            break
        if npv_at(mid) > 0:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


def _hitung_sensitivitas(
    base_annual_revenue: float,
    base_annual_opex: float,
    capex: float,
    rev_growth: float,
    opx_growth: float,
    wacc_val: float,
    years_val: int,
) -> Dict[str, list]:
    sensitivitas = {}
    for var_name in ['pendapatan', 'biaya']:
        var_results = []
        for pct in atur('SENSITIVITAS_FINANSIAL'):
            pct_pct = pct * 100
            if var_name == 'pendapatan':
                adj_rev = base_annual_revenue * (1 + pct)
                adj_opx = base_annual_opex
            else:
                adj_rev = base_annual_revenue
                adj_opx = base_annual_opex * (1 + pct)

            adj_npv, adj_irr, adj_payback, adj_roi, adj_tercapai = calc_dcf_metrics(
                adj_rev, adj_opx, capex, rev_growth, opx_growth, wacc_val, years_val
            )
            var_results.append(
                {
                    'perubahan_pct': pct_pct,
                    'npv': adj_npv,
                    'irr': adj_irr,
                    'payback': adj_payback,
                    'payback_tercapai': adj_tercapai,
                    'roi': adj_roi,
                }
            )
        sensitivitas[var_name] = var_results
    return sensitivitas


def _hitung_skenario(
    base_annual_revenue: float,
    base_annual_opex: float,
    capex: float,
    rev_growth: float,
    opx_growth: float,
    wacc_val: float,
    years_val: int,
) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    best_rev = base_annual_revenue * atur('BEST_CASE_REVENUE_MULTIPLIER')
    best_opx = base_annual_opex * atur('BEST_CASE_OPEX_MULTIPLIER')
    best_npv, best_irr, best_payback, best_roi, best_tercapai = calc_dcf_metrics(
        best_rev, best_opx, capex, rev_growth, opx_growth, wacc_val, years_val
    )
    skenario_terbaik = {
        'label': 'Best Case (+20% pendapatan awal, -10% biaya awal)',
        'npv': best_npv,
        'irr': best_irr,
        'payback': best_payback,
        'payback_tercapai': best_tercapai,
        'roi': best_roi,
    }

    worst_rev = base_annual_revenue * atur('WORST_CASE_REVENUE_MULTIPLIER')
    worst_opx = base_annual_opex * atur('WORST_CASE_OPEX_MULTIPLIER')
    worst_npv, worst_irr, worst_payback, worst_roi, worst_tercapai = calc_dcf_metrics(
        worst_rev, worst_opx, capex, rev_growth, opx_growth, wacc_val, years_val
    )
    skenario_terburuk = {
        'label': 'Worst Case (-20% pendapatan awal, +10% biaya awal)',
        'npv': worst_npv,
        'irr': worst_irr,
        'payback': worst_payback,
        'payback_tercapai': worst_tercapai,
        'roi': worst_roi,
    }
    return skenario_terbaik, skenario_terburuk


def jalankan_analisis_finansial(
    area_ha: float,
    sektor_kode: str = 'DEFAULT',
    capex_idr: Optional[float] = None,
    annual_revenue_idr: Optional[float] = None,
    annual_opex_idr: Optional[float] = None,
    revenue_growth_pct: Optional[float] = 0.0,
    opex_growth_pct: Optional[float] = 0.0,
    wacc_pct: Optional[float] = None,
    lifetime_yr: Optional[int] = None,
) -> Dict[str, Any]:
    if (
        capex_idr is None
        or annual_revenue_idr is None
        or annual_opex_idr is None
        or wacc_pct is None
        or lifetime_yr is None
    ):
        raise ValueError('Missing mandatory financial parameters. Calculations must be based on actual inputs.')

    capex = capex_idr
    base_annual_revenue = annual_revenue_idr
    base_annual_opex = annual_opex_idr
    rev_growth = revenue_growth_pct or 0.0
    opx_growth = opex_growth_pct or 0.0
    wacc_val = wacc_pct / 100.0
    years_val = lifetime_yr

    npv, irr, payback, roi, payback_tercapai = calc_dcf_metrics(
        base_annual_revenue, base_annual_opex, capex, rev_growth, opx_growth, wacc_val, years_val
    )

    sensitivitas = _hitung_sensitivitas(
        base_annual_revenue, base_annual_opex, capex, rev_growth, opx_growth, wacc_val, years_val
    )

    skenario_terbaik, skenario_terburuk = _hitung_skenario(
        base_annual_revenue, base_annual_opex, capex, rev_growth, opx_growth, wacc_val, years_val
    )

    return {
        'npv_idr': npv,
        'irr_pct': irr,
        'payback_period_tahun': payback,
        'payback_tercapai': payback_tercapai,
        'payback_metode': 'sederhana (tanpa diskonto)',
        'roi_metode': 'kumulatif seumur proyek (tanpa diskonto)',
        'roi_pct': roi,
        'capex_idr': round(capex, 2),
        'annual_revenue_idr': round(base_annual_revenue, 2),
        'annual_opex_idr': round(base_annual_opex, 2),
        'annual_net_idr': round(base_annual_revenue - base_annual_opex, 2),
        'revenue_growth_pct': round(rev_growth, 2),
        'opex_growth_pct': round(opx_growth, 2),
        'wacc_pct': round(wacc_val * 100, 2),
        'project_lifetime_yr': years_val,
        'sensitivitas': sensitivitas,
        'skenario_terbaik': skenario_terbaik,
        'skenario_terburuk': skenario_terburuk,
    }
