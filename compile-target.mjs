import fs from 'fs';
import { loadImage } from 'canvas';
import * as tf from '@tensorflow/tfjs';
import { OfflineCompiler } from './pkg/package/src/image-target/offline-compiler.js';

const input = '/home/user/the-key-spike0/target-test.png';
const output = '/home/user/the-key-spike0/target-test.mind';

async function main() {
  await tf.setBackend('cpu');
  await tf.ready();
  const img = await loadImage(input);
  const compiler = new OfflineCompiler();
  console.log('Compiling target:', input, img.width, img.height);
  await compiler.compileImageTargets([img], (percent) => {
    if (Math.abs(percent - Math.round(percent)) < 0.001) {
      console.log(`progress ${Math.round(percent)}%`);
    }
  });
  const buffer = compiler.exportData();
  fs.writeFileSync(output, Buffer.from(buffer));
  console.log('Wrote', output, fs.statSync(output).size, 'bytes');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
