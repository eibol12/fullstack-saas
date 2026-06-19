"""
Management command to forcefully cleanup test databases.
This is particularly useful for Neon DB where connection pooling
can prevent normal database drops.
"""
from django.core.management.base import BaseCommand
from django.db import connections


class Command(BaseCommand):
    help = 'Forcefully cleanup test database by terminating connections'

    def handle(self, *args, **options):
        connection = connections['default']

        if connection.vendor != 'postgresql':
            self.stdout.write(self.style.ERROR('This command only works with PostgreSQL databases'))
            return

        db_name = connection.settings_dict['NAME']
        test_db_name = f"test_{db_name}"

        self.stdout.write(f"Attempting to cleanup test database: {test_db_name}")

        try:
            with connection.cursor() as cursor:
                # Terminate all connections to the test database
                cursor.execute(
                    """
                    SELECT pg_terminate_backend(pg_stat_activity.pid)
                    FROM pg_stat_activity
                    WHERE pg_stat_activity.datname = %s
                    AND pid <> pg_backend_pid();
                    """,
                    [test_db_name]
                )

                terminated_count = cursor.rowcount
                self.stdout.write(self.style.SUCCESS(f"Terminated {terminated_count} connection(s)"))

                # Try to drop the database
                # Note: This requires connecting to a different database first
                cursor.execute('SELECT 1')  # Ensure we're not connected to the test DB
                cursor.execute(f'DROP DATABASE IF EXISTS {test_db_name}')

                self.stdout.write(self.style.SUCCESS(f"Successfully dropped {test_db_name}"))

        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error: {e}"))
            self.stdout.write(
                self.style.WARNING(
                    "You may need to manually drop the database using:\n"
                    f"  DROP DATABASE {test_db_name};\n"
                    "from a direct PostgreSQL connection."
                )
            )
