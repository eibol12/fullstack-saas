from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("main", "0008_remove_stripewebhookevent_related_customer_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="company_logo",
            field=models.FileField(
                blank=True,
                help_text="Optional company logo used on branded engineering reports.",
                null=True,
                upload_to="company_logos/",
            ),
        ),
        migrations.AddField(
            model_name="userprofile",
            name="report_prepared_by",
            field=models.CharField(
                blank=True,
                help_text="Optional default prepared-by name used on engineering reports.",
                max_length=150,
            ),
        ),
    ]
