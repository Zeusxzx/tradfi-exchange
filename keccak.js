'use strict';
/* keccak-256, the Ethereum one -- NOT node's 'sha3-256', which is the NIST
   variant with different padding and would produce silently wrong ids.
   ~60 lines is cheaper than a dependency in a repo that has none. */
const RC = [
  0x00000001n, 0x00008082n, 0x800000000000808An, 0x8000000080008000n,
  0x000000000000808Bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n,
  0x000000000000008An, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000An,
  0x000000008000808Bn, 0x800000000000008Bn, 0x8000000000008089n, 0x8000000000008003n,
  0x8000000000008002n, 0x8000000000000080n, 0x000000000000800An, 0x800000008000000An,
  0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n
];
const R = [0,1,62,28,27,36,44,6,55,20,3,10,43,25,39,41,45,15,21,8,18,2,61,56,14];
const M = (1n << 64n) - 1n;
const rotl = (x, n) => n === 0n ? x : ((x << n) | (x >> (64n - n))) & M;

function keccakF(A) {
  for (let round = 0; round < 24; round++) {
    const C = new Array(5);
    for (let x = 0; x < 5; x++) C[x] = A[x] ^ A[x+5] ^ A[x+10] ^ A[x+15] ^ A[x+20];
    for (let x = 0; x < 5; x++) {
      const D = C[(x+4)%5] ^ rotl(C[(x+1)%5], 1n);
      for (let y = 0; y < 5; y++) A[x + 5*y] ^= D;
    }
    const B = new Array(25);
    for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) {
      B[y + 5*((2*x + 3*y) % 5)] = rotl(A[x + 5*y], BigInt(R[x + 5*y]));
    }
    for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) {
      A[x + 5*y] = B[x + 5*y] ^ ((~B[(x+1)%5 + 5*y] & M) & B[(x+2)%5 + 5*y]);
    }
    A[0] ^= RC[round];
  }
  return A;
}

/** keccak-256 of a Buffer, as a 0x-prefixed hex string. */
function keccak256(buf) {
  const rate = 136;
  const padded = Buffer.alloc(Math.ceil((buf.length + 1) / rate) * rate);
  buf.copy(padded);
  padded[buf.length] ^= 0x01;              // keccak domain padding
  padded[padded.length - 1] ^= 0x80;
  let A = new Array(25).fill(0n);
  for (let off = 0; off < padded.length; off += rate) {
    for (let i = 0; i < rate / 8; i++) A[i] ^= padded.readBigUInt64LE(off + i * 8);
    A = keccakF(A);
  }
  let out = '';
  for (let i = 0; i < 4; i++) {
    out += A[i].toString(16).padStart(16, '0').match(/../g).reverse().join('');
  }
  return '0x' + out;
}
module.exports = { keccak256 };
