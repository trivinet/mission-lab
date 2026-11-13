import { it } from 'vitest';
import {
  sin,
  cos,
  atan2,
  acos,
  sqrt,
  sinh,
  cosh,
  fromNumber,
  ulpError,
  relErrorInU,
  toNumber,
} from '../hp/bigfloat';
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}
it('a3', () => {
  const r = rng(5);
  const args: Record<string, number[]> = {
    small: [],
    generic: [],
    nearMultHalfPi: [],
    large: [],
    huge: [],
  };
  for (let i = 0; i < 1500; i++) {
    args.small!.push((r() < 0.5 ? -1 : 1) * 10 ** (-300 * r()));
    args.generic!.push((r() - 0.5) * 20);
    const k = Math.floor(r() * 9) - 4;
    args.nearMultHalfPi!.push((k * Math.PI) / 2 + (r() - 0.5) * 10 ** (-16 * r()));
    args.large!.push((r() - 0.5) * 2000);
    args.huge!.push((r() - 0.5) * 2e6);
  }
  args.nearMultHalfPi!.push(Math.PI, 2 * Math.PI, Math.PI / 2, (3 * Math.PI) / 2, -Math.PI);
  const t0 = Date.now();
  for (const [cls, xs] of Object.entries(args)) {
    let ws = 0,
      wc = 0,
      us = 0,
      uc = 0;
    for (const x of xs) {
      const X = fromNumber(x);
      ws = Math.max(ws, relErrorInU(Math.sin(x), sin(X)));
      us = Math.max(us, ulpError(Math.sin(x), sin(X)));
      wc = Math.max(wc, relErrorInU(Math.cos(x), cos(X)));
      uc = Math.max(uc, ulpError(Math.cos(x), cos(X)));
    }
    console.log(
      cls,
      'sin relU',
      ws.toFixed(3),
      'ulp',
      us.toFixed(3),
      'cos relU',
      wc.toFixed(3),
      'ulp',
      uc.toFixed(3),
    );
  }
  let wa = 0,
    ua = 0;
  for (let i = 0; i < 3000; i++) {
    const y = (r() - 0.5) * 10 ** (12 * r() - 6),
      x = (r() - 0.5) * 10 ** (12 * r() - 6);
    wa = Math.max(wa, relErrorInU(Math.atan2(y, x), atan2(fromNumber(y), fromNumber(x))));
    ua = Math.max(ua, ulpError(Math.atan2(y, x), atan2(fromNumber(y), fromNumber(x))));
  }
  console.log('atan2 relU', wa.toFixed(3), 'ulp', ua.toFixed(3));
  let wq = 0,
    uq = 0;
  for (let i = 0; i < 2000; i++) {
    const x =
      i % 2
        ? r() * 2 - 1
        : r() < 0.5
          ? 1 - 2 ** -53 * Math.floor(r() * 1e6)
          : -1 + 2 ** -53 * Math.floor(r() * 1e6);
    wq = Math.max(wq, relErrorInU(Math.acos(x), acos(fromNumber(x))));
    uq = Math.max(uq, ulpError(Math.acos(x), acos(fromNumber(x))));
  }
  console.log('acos relU', wq.toFixed(3), 'ulp', uq.toFixed(3));
  let bad = 0,
    wsq = 0;
  for (let i = 0; i < 3000; i++) {
    const x = 10 ** (40 * r() - 20) * (1 + r());
    const ex = toNumber(sqrt(fromNumber(x)));
    if (ex !== Math.sqrt(x)) bad++;
    wsq = Math.max(wsq, ulpError(Math.sqrt(x), sqrt(fromNumber(x))));
  }
  console.log('sqrt mismatches', bad, 'max ulp', wsq.toFixed(3));
  let wh = 0,
    uh = 0,
    wch = 0,
    uch = 0;
  for (let i = 0; i < 1500; i++) {
    const x = i % 2 ? (r() - 0.5) * 100 : (r() - 0.5) * 10 ** (-10 * r());
    const X = fromNumber(x);
    wh = Math.max(wh, relErrorInU(Math.sinh(x), sinh(X)));
    uh = Math.max(uh, ulpError(Math.sinh(x), sinh(X)));
    wch = Math.max(wch, relErrorInU(Math.cosh(x), cosh(X)));
    uch = Math.max(uch, ulpError(Math.cosh(x), cosh(X)));
  }
  console.log(
    'sinh relU',
    wh.toFixed(3),
    'ulp',
    uh.toFixed(3),
    'cosh relU',
    wch.toFixed(3),
    'ulp',
    uch.toFixed(3),
  );
  console.log('ms', Date.now() - t0, process.version);
}, 600000);
