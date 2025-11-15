import { build } from 'esbuild';

(async function buildClient(){
  try{
    await build({
      entryPoints: ['index.tsx'],
      bundle: true,
      outfile: 'dist/public/app.js',
      format: 'esm',
      target: ['es2020'],
      sourcemap: false,
      minify: true,
      loader: { '.tsx': 'tsx', '.ts': 'ts' },
      external: [] // keep vendor libs bundled for now
    });
    console.log('Client bundle written to dist/public/app.js');
  }catch(err){
    console.error('Build failed', err);
    process.exit(1);
  }
})();
