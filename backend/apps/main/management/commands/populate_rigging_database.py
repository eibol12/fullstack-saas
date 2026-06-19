from django.core.management.base import BaseCommand
from apps.main.utils.rigging_utils import load_rigging_csvs

class Command(BaseCommand):
    help = 'Populates the design database with the CSV files'

    def handle(self, *args, **options):
        load_rigging_csvs(self)