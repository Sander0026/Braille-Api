const { execSync } = require('child_process');
try {
  execSync('npx jest src/site-config/site-config.controller.spec.ts --no-color', { stdio: 'pipe' });
} catch (e) {
  require('fs').writeFileSync('jest_error.txt', e.stderr.toString() + '\n' + e.stdout.toString(), 'utf8');
}
