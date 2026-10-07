// Hand-assembled minimal WASM module exporting add(i32,i32)->i32.
// No toolchain needed for a throwaway CSP spike.
const bytes = new Uint8Array([
  0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, 0x01, 0x07, 0x01, 0x60, 0x02, 0x7f, 0x7f, 0x01,
  0x7f, 0x03, 0x02, 0x01, 0x00, 0x07, 0x07, 0x01, 0x03, 0x61, 0x64, 0x64, 0x00, 0x00, 0x0a, 0x09,
  0x01, 0x07, 0x00, 0x20, 0x00, 0x20, 0x01, 0x6a, 0x0b,
]);

(async () => {
  const result = document.getElementById('result');
  try {
    const module = await WebAssembly.compile(bytes);
    const instance = await WebAssembly.instantiate(module, {});
    const sum = instance.exports.add(2, 3);
    const ok = sum === 5;
    result.textContent = ok ? 'wasm-ok:5' : `wasm-wrong:${sum}`;
    document.title = ok ? 'wasm-ok' : 'wasm-wrong';
  } catch (e) {
    result.textContent = `wasm-fail:${e.message}`;
    document.title = 'wasm-fail';
  }
})();
