Run order and expectations are in the project README. In the output, every line beginning with `ERROR:` under a
heading is an *expected* rejection (the heading says what is being attempted). Lines without ERROR are the
observed values, e.g. `SWAP_PENDING` / `COMPLETED` after the two-party confirmation.
Before running `00_supabase_stubs.sql` create the roles once:
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
