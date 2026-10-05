from django.contrib import admin

from .models import KetentuanRuang


@admin.register(KetentuanRuang)
class KetentuanRuangAdmin(admin.ModelAdmin):
    list_display = ['sektor', 'sub_zona', 'provinsi', 'status', 'sumber']
    list_filter = ['sektor', 'status', 'provinsi']
