"""
Django management command to configure the Site object for email verification.

This command updates the Django Sites framework to use the correct domain
for generating email verification links.

Usage:
    python manage.py setup_site

For production:
    FRONTEND_URL=https://yourdomain.com python manage.py setup_site
"""
from django.conf import settings
from django.contrib.sites.models import Site
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Configure Django Site for email verification with correct domain'

    def handle(self, *args, **options):
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
        
        # Extract domain from URL (remove http:// or https://)
        domain = frontend_url.replace('http://', '').replace('https://', '').rstrip('/')
        
        try:
            site = Site.objects.get(id=settings.SITE_ID)
            old_domain = site.domain
            old_name = site.name
            
            site.domain = domain
            site.name = domain
            site.save()
            
            self.stdout.write(
                self.style.SUCCESS(
                    f'✓ Successfully updated Site configuration:\n'
                    f'  Old domain: {old_domain}\n'
                    f'  New domain: {domain}\n'
                    f'  Email verification links will now use: {frontend_url}'
                )
            )
        except Site.DoesNotExist:
            # Create site if it doesn't exist
            site = Site.objects.create(
                id=settings.SITE_ID,
                domain=domain,
                name=domain
            )
            self.stdout.write(
                self.style.SUCCESS(
                    f'✓ Created Site configuration:\n'
                    f'  Domain: {domain}\n'
                    f'  Email verification links will use: {frontend_url}'
                )
            )
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(
                    f'✗ Failed to configure Site: {str(e)}'
                )
            )
