from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='ExternalAPIConfig',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('kode', models.CharField(help_text='BIG, BPS, BMKG, KKP, BNPB', max_length=20, unique=True)),
                ('nama', models.CharField(max_length=100)),
                ('base_url', models.URLField(blank=True)),
                ('api_key_env_var', models.CharField(blank=True, help_text='Env var name for API key', max_length=50)),
                ('status', models.CharField(choices=[('ACTIVE', 'Aktif - API Connected'), ('MOCK', 'Mock - Data Simulasi'), ('DISABLED', 'Nonaktif')], default='MOCK', max_length=10)),
                ('last_successful_fetch', models.DateTimeField(blank=True, null=True)),
                ('fetch_interval_hours', models.IntegerField(default=2160, help_text='Default 90 days = 2160 hours')),
                ('retry_count', models.IntegerField(default=0)),
                ('max_retries', models.IntegerField(default=3)),
                ('notes', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name_plural': 'External API Configs',
                'db_table': 'data_acquisition_api_config',
            },
        ),
        migrations.CreateModel(
            name='FetchLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('endpoint', models.CharField(max_length=500)),
                ('started_at', models.DateTimeField(auto_now_add=True)),
                ('completed_at', models.DateTimeField(blank=True, null=True)),
                ('result', models.CharField(choices=[('SUCCESS', 'Success'), ('PARTIAL', 'Partial'), ('FAILED', 'Failed'), ('MOCK', 'Mock Data Used')], max_length=10)),
                ('records_count', models.IntegerField(default=0)),
                ('response_time_ms', models.IntegerField(default=0)),
                ('error_message', models.TextField(blank=True)),
                ('request_params', models.JSONField(blank=True, default=dict)),
                ('response_summary', models.JSONField(blank=True, default=dict)),
                ('api_config', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='fetch_logs', to='penarikan_data.externalapiconfig')),
            ],
            options={
                'verbose_name_plural': 'Fetch Logs',
                'db_table': 'data_acquisition_fetch_log',
                'ordering': ['-started_at'],
            },
        ),
    ]
