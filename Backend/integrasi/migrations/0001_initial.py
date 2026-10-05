from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='DJPRLSync',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nama_dataset', models.CharField(max_length=255)),
                ('direction', models.CharField(choices=[('PUSH', 'Push ke DJPRL'), ('PULL', 'Pull dari DJPRL'), ('BOTH', 'Bidirectional')], default='PULL', max_length=5)),
                ('status', models.CharField(choices=[('PENDING', 'Menunggu'), ('SYNCING', 'Sedang Sinkronisasi'), ('SUCCESS', 'Berhasil'), ('FAILED', 'Gagal'), ('MOCK', 'Mock Mode')], default='MOCK', max_length=10)),
                ('endpoint_url', models.URLField(blank=True)),
                ('last_sync', models.DateTimeField(blank=True, null=True)),
                ('records_synced', models.IntegerField(default=0)),
                ('error_message', models.TextField(blank=True)),
                ('config_json', models.JSONField(blank=True, default=dict, help_text='Mapping & transformation config')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name_plural': 'DJPRL Sync Config',
                'db_table': 'integration_djprl_sync',
                'ordering': ['-last_sync'],
            },
        ),
    ]
