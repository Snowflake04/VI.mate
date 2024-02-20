import { useRef, useEffect } from 'react';

const Profile = ({ name }) => {
  const canv = useRef(null);
  const pallet = [
    '#D7EDEB',
    '#EBF8F5',
    '#FFF8BC',
    '#FFAF92',
    '#FF876F',
    '#7EE6DE',
  ];

  useEffect(() => {
    const ctx = canv.current.getContext('2d');
    ctx.fillStyle = pallet[Math.round(Math.random() * (pallet.length - 1))];
    ctx.fillRect(0, 0, 60, 60);

    ctx.font = '20pt Sans';
    let width = ctx.measureText(name).width;

    // Center the text horizontally and vertically within the image.
    let x = (60 - width) / 2;
    let y = 40;

    ctx.fillStyle = '#000';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.fillText(name, x, y);
  });
  return <canvas ref={canv} height={60} width={60} />;
};

export default Profile;
