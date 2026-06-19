"""
Custom test runner to handle Neon DB connection issues during testing.
"""
from django.test.runner import DiscoverRunner
from django.db import connections


class NeonTestRunner(DiscoverRunner):
    """
    Custom test runner that forces database connection closure before teardown.
    This prevents the "database is being accessed by other users" error when
    using Neon DB with connection pooling.
    """

    def teardown_databases(self, old_config, **kwargs):
        """
        Destroy all test databases, ensuring connections are properly closed first.
        """
        # Force close all database connections before attempting to drop the test database
        for alias in connections:
            connection = connections[alias]
            if connection.settings_dict.get('NAME'):
                # Close the connection from Django's side
                connection.close()

                # For PostgreSQL/Neon, terminate all other connections to the test database
                if connection.vendor == 'postgresql':
                    self._terminate_postgres_connections(connection)

        # Call the parent teardown
        super().teardown_databases(old_config, **kwargs)

    def _terminate_postgres_connections(self, connection):
        """
        Terminate all PostgreSQL connections to the test database.
        This is necessary for Neon DB which may maintain pooled connections.
        """
        from django.db import connection as db_connection

        try:
            db_name = connection.settings_dict.get('NAME')
            if not db_name or not db_name.startswith('test_'):
                return

            # First close the current connection
            connection.close()

            # Wait a moment for connection to fully close
            import time
            time.sleep(0.5)

            # Create a raw connection using connection settings but to a different database
            db_settings = connection.settings_dict.copy()
            original_db = db_settings['NAME']

            # Connect to the original database (not the test one) to run termination
            db_settings['NAME'] = original_db.replace('test_', '')

            import psycopg
            conn_params = {
                'dbname': db_settings['NAME'],
                'user': db_settings['USER'],
                'password': db_settings['PASSWORD'],
                'host': db_settings['HOST'],
                'port': db_settings.get('PORT', 5432),
            }

            with psycopg.connect(**conn_params) as raw_conn:
                raw_conn.autocommit = True
                with raw_conn.cursor() as cursor:
                    cursor.execute(
                        """
                        SELECT pg_terminate_backend(pg_stat_activity.pid)
                        FROM pg_stat_activity
                        WHERE pg_stat_activity.datname = %s
                        AND pid <> pg_backend_pid();
                        """,
                        (original_db,)
                    )
                    print(f"Terminated connections to {original_db}")

        except Exception as e:
            # Log but don't fail if termination doesn't work
            print(f"Warning: Could not terminate connections to {db_name}: {e}")
