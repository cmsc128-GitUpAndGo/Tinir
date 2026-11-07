const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
module.exports = defineConfig([
  expoConfig,
  { ignores: ['supabase/functions/**', 'src/lib/supabase/database.types.ts', 'coverage/**'] },
]);
