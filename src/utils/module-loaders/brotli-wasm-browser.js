import brotliPromise from 'brotli-wasm'; // Import the default export

const brotli = await brotliPromise; // Import is async in browsers due to wasm requirements!

export default brotli;