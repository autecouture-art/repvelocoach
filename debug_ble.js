
function base64ToBytes(base64) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

function readFloatLE(bytes, offset) {
    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    for (let i = 0; i < 4; i++) {
        view.setUint8(i, bytes[offset + i]);
    }
    return view.getFloat32(0, true);
}

function readInt32LE(bytes, offset) {
    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    for (let i = 0; i < 4; i++) {
        view.setUint8(i, bytes[offset + i]);
    }
    return view.getInt32(0, true);
}

function readInt16LE(bytes, offset) {
    const buffer = new ArrayBuffer(2);
    const view = new DataView(buffer);
    for (let i = 0; i < 2; i++) {
        view.setUint8(i, bytes[offset + i]);
    }
    return view.getInt16(0, true);
}


const base64 = "OwBTAZFAIAFwBNIIGQB1BA==";
const bytes = base64ToBytes(base64);

console.log("Hex:", Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' '));

console.log("--- As Float32 ---");
console.log("Mean V:", readFloatLE(bytes, 0));
console.log("Peak V:", readFloatLE(bytes, 4));
console.log("ROM:", readFloatLE(bytes, 8));
console.log("Duration:", readFloatLE(bytes, 12));

console.log("--- As Int32 ---");
console.log("Mean V:", readInt32LE(bytes, 0));
console.log("Peak V:", readInt32LE(bytes, 4));
console.log("ROM:", readInt32LE(bytes, 8));
console.log("Duration:", readInt32LE(bytes, 12));

console.log("--- As Int16 ---");
console.log("0-1:", readInt16LE(bytes, 0));
console.log("2-3:", readInt16LE(bytes, 2));
console.log("4-5:", readInt16LE(bytes, 4));
console.log("6-7:", readInt16LE(bytes, 6));

