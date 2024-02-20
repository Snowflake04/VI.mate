import { registerFont, createCanvas } from 'canvas';
import { writeFileSync } from 'fs';

const getProfile = (name) => {
  // registerFont('src/fonts/Charmonman.ttf', { family: 'Charmonman Bold' });
  const pallet = [
    '#D7EDEB',
    '#EBF8F5',
    '#FFF8BC',
    '#FFAF92',
    '#FF876F',
    '#7EE6DE',
  ];
  const canvas = createCanvas(128, 128);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = pallet[Math.round(Math.random() * pallet.length)];
  ctx.fillRect(0, 0, 128, 128);

  ctx.font = '40pt Sans';
  let width = ctx.measureText(name).width;

  // Center the text horizontally and vertically within the image.
  let x = (128 - width) / 2;
  let y = 85;

  ctx.fillStyle = '#000';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 3;
  ctx.fillText(name, x, y);

  const buffer = canvas.toBuffer();
  console.log(buffer);
};

getProfile('NS');
