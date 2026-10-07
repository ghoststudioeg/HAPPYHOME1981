console.log('Environment variable keys:', Object.keys(process.env).filter(k => k.includes('SUPABASE') || k.includes('VITE') || k.includes('FIREBASE')));
