Place the official Supabase JavaScript v2 browser UMD bundle here as `supabase.js`.
The page loads this local file and uses the global `supabase.createClient`.

For example, run the following from the archive root on a machine with npm registry access:

    tmp_dir=$(mktemp -d)
    npm pack @supabase/supabase-js@2.49.4 --pack-destination "$tmp_dir"
    tar -xOzf "$tmp_dir/supabase-supabase-js-2.49.4.tgz" package/dist/umd/supabase.js > site/vendor/supabase.js
