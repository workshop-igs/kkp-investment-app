from django.contrib import admin

from .models import KabupatenKota, LogSinkronisasi, ProfilPengguna, Provinsi, SektorInvestasi, SumberData


@admin.register(Provinsi)
class ProvinsiAdmin(admin.ModelAdmin):
    list_display = ['kode_bps', 'nama', 'luas_laut_km2']
    search_fields = ['nama', 'kode_bps']


@admin.register(KabupatenKota)
class KabupatenKotaAdmin(admin.ModelAdmin):
    list_display = ['kode_bps', 'nama', 'jenis', 'provinsi', 'pesisir']
    list_filter = ['jenis', 'pesisir', 'provinsi']
    search_fields = ['nama', 'kode_bps']


@admin.register(SektorInvestasi)
class SektorInvestasiAdmin(admin.ModelAdmin):
    list_display = ['kode', 'nama', 'rasio_tk_per_miliar', 'aktif', 'urutan']
    list_filter = ['aktif']


@admin.register(ProfilPengguna)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'instansi', 'provinsi']


@admin.register(SumberData)
class DataSourceAdmin(admin.ModelAdmin):
    list_display = ['kode', 'nama', 'tipe', 'status', 'last_sync']
    list_filter = ['status', 'tipe']


@admin.register(LogSinkronisasi)
class DataSyncLogAdmin(admin.ModelAdmin):
    list_display = ['data_source', 'started_at', 'result', 'records_fetched']
    list_filter = ['result', 'data_source']
