const fs = require('fs');
const path = require('path');

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('generateStaticParams')) {
        content = content.replace(/export async function generateStaticParams\(\)\s*\{[\s\S]*?\}/g, '');
        if (!content.includes('force-dynamic')) {
            content = "export const dynamic = 'force-dynamic';\n" + content;
        }
        fs.writeFileSync(fullPath, content);
        console.log('Updated ' + fullPath);
      }
    }
  }
}
processDir('src/app');
