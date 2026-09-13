const fs = require('fs');
const glob = require('glob'); // Not available? I'll use child_process.execSync

const { execSync } = require('child_process');

// Find all files with <img
const files = execSync('grep -rl "<img" src/').toString().split('\n').filter(Boolean);

let changedFiles = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  // Add import if needed
  if (!content.includes('isValidImageSrc') && !content.includes('getValidImageSrc')) {
    // We'll add the import if we modify the file
  }

  // Common patterns to replace:
  // src={product.mainImageUrl || ""} -> src={getValidImageSrc(product.mainImageUrl)}
  content = content.replace(/src={([^}]+)\s*\|\|\s*""\s*}/g, 'src={getValidImageSrc($1)}');
  content = content.replace(/src={([^}]+)\s*\|\|\s*''\s*}/g, 'src={getValidImageSrc($1)}');

  // String interpolations: src={`${foo}`} where it might be empty
  // Not easily replaced with regex. Let's just do manual edits for complex ones, or general replacement.

  // To be safe, any src={variable} can be wrapped: src={getValidImageSrc(variable)}
  // Wait, if it's already wrapped or it's a string literal like src="logo.png"
  
  if (content !== originalContent) {
     // add import
     const importStmt = `import { getValidImageSrc, isValidImageSrc } from '@/utils/imageUtils';\n`; // Wait, does the project use @/? Let's check tsconfig.
     // Let's use relative paths.
     // To compute relative path:
     const depth = file.split('/').length - 2;
     const rel = depth === 0 ? './' : '../'.repeat(depth);
     const importLine = `import { getValidImageSrc, isValidImageSrc } from '${rel}utils/imageUtils';\n`;
     
     // add after last import
     const lines = content.split('\n');
     let lastImport = -1;
     for (let i=0; i<lines.length; i++) {
        if (lines[i].startsWith('import ')) lastImport = i;
     }
     if (lastImport !== -1) {
        lines.splice(lastImport + 1, 0, importLine);
        content = lines.join('\n');
     }
     
     fs.writeFileSync(file, content, 'utf8');
     changedFiles++;
  }
}
console.log(`Changed ${changedFiles} files`);
