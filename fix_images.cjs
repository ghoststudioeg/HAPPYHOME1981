const fs = require('fs');
const { execSync } = require('child_process');

// Find all files with <img
const files = execSync('grep -rl "<img" src/').toString().split('\n').filter(Boolean);
let changedFiles = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  const originalContent = content;

  // Replace src={...} with src={getValidImageSrc(...)}
  // Skip if already getValidImageSrc
  content = content.replace(/src=\{((?!getValidImageSrc)[^}]+)\}/g, 'src={getValidImageSrc($1)}');

  if (content !== originalContent) {
     const depth = file.split('/').length - 2;
     const rel = depth === 0 ? './' : '../'.repeat(depth);
     const importLine = `import { getValidImageSrc, isValidImageSrc } from '${rel}utils/imageUtils';\n`;
     
     const lines = content.split('\n');
     let lastImport = -1;
     let hasImport = false;
     for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('getValidImageSrc')) {
          hasImport = true;
          break;
        }
        if (lines[i].startsWith('import ')) lastImport = i;
     }
     
     if (!hasImport && lastImport !== -1) {
        lines.splice(lastImport + 1, 0, importLine);
        content = lines.join('\n');
     }
     
     fs.writeFileSync(file, content, 'utf8');
     changedFiles++;
     console.log('Fixed', file);
  }
}
console.log(`Changed ${changedFiles} files`);
