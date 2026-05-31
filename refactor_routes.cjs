const fs = require('fs');
const path = require('path');

const apiDir = path.join(__dirname, 'src', 'app', 'api');

function processDir(dir) {
    if (!fs.existsSync(dir)) return;
    
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDir(fullPath);
        } else if (file === '_route.ts') {
            const routePath = path.join(dir, 'route.ts');
            // Move _route.ts to route.ts, overwriting it
            fs.renameSync(fullPath, routePath);
            console.log(`Moved ${fullPath} to ${routePath}`);
        }
    }
}

// 1. Delete walk-in-orders/route-fixed.ts
try {
    fs.unlinkSync(path.join(apiDir, 'walk-in-orders', 'route-fixed.ts'));
    console.log('Deleted route-fixed.ts');
} catch(e) {}

// 3. Delete public/.gitkeep
try {
    fs.unlinkSync(path.join(__dirname, 'public', '.gitkeep'));
    console.log('Deleted .gitkeep');
} catch(e) {}

// 4. Delete favicon folder completely
const faviconDir = path.join(apiDir, 'favicon');
try {
    fs.rmSync(faviconDir, { recursive: true, force: true });
    console.log('Deleted favicon directory');
} catch(e) {}

// 2. Refactor all _route.ts to route.ts
processDir(apiDir);
