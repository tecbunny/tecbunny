const fs = require('fs');
const path = require('path');

const filesToFix = [
  "src/app/mgmt/admin/users/[id]/analytics/page.tsx",
  "src/app/mgmt/sales/products/edit/[id]/page.tsx",
  "src/app/orders/[orderId]/invoice/page.tsx",
  "src/app/orders/[orderId]/page.tsx",
  "src/app/payment/[method]/[orderId]/page.tsx",
  "src/app/payment/payu/[orderId]/page.tsx",
  "src/app/payment/upi/[orderId]/page.tsx"
];

for (const file of filesToFix) {
  const filePath = path.join(__dirname, file);
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    content = content.replace(/\n\]\n\}\n/g, '\n');
    content = content.replace(/\];\r?\n\}/g, '');
    fs.writeFileSync(filePath, content);
    console.log(`Fixed ${file}`);
  } catch (err) {
    console.error(`Error with ${file}`, err);
  }
}

// Fix create-invoice/page.tsx
const invoiceFile = path.join(__dirname, "src/app/create-invoice/page.tsx");
try {
  let content = fs.readFileSync(invoiceFile, 'utf8');
  content = content.replace(/ssr:\s*false,\s*/g, '');
  fs.writeFileSync(invoiceFile, content);
  console.log(`Fixed create-invoice/page.tsx`);
} catch (err) {
  console.error(err);
}
