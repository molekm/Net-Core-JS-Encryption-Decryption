﻿function encryptionHandler() {

    this.decrypt = function (encryptedData, passPhrase) {
        var that = this;
        var cO = JSON.parse(encryptedData);
        var dKey = that.getDerivedKey(passPhrase, cO); //This key is in PBKDF2
        var ciphertext = _base64ToArrayBuffer(cO.CipherOutputText);
        return webcryptoBinaryDecrypt(ciphertext, dKey, cO, true);
    }

    
    // Binary must be a UInt8Array!!

    this.decryptBinary = function (rawEncryptedData, passPhrase, options, returnUtf8Text = false) {
        var that = this;
        var derivedKey = that.getDerivedKey(passPhrase, options);
        return webcryptoBinaryDecrypt(rawEncryptedData, derivedKey, options, returnUtf8Text);
    }

    this.decryptBinaryWithDerivedKey = function (rawEncryptedData, derivedKey, options, returnUtf8Text = false) {
        return webcryptoBinaryDecrypt(rawEncryptedData, derivedKey, options, returnUtf8Text);
    }

    
    
    // Returns PBKDF2 key
    this.getDerivedKey = function(passPhrase, options)
    {
        var cO = options;
        //Encoding the Salt in from UTF8 to byte array
        var Salt = CryptoJS.enc.Base64.parse(cO["Salt"]);
        //Creating the Vector Key
        var DerivedKey;

        //Creating the key in PBKDF2 format to be used during the decryption
        if (cO["DerivationType"] == "scrypt") {
            var sc = new scryptHandler();
            DerivedKey = hexStringToUint8Array(sc.GetOnlyHashInHexString(passPhrase, cO));
        } else {
            var Pass = CryptoJS.enc.Utf8.parse(passPhrase);
            DerivedKey =
                CryptoJS.PBKDF2(Pass.toString(CryptoJS.enc.Utf8), Salt, { keySize: cO["KeySizeInBytes"] * 8 / 32, iterations: cO["DerivationIterations"] });
        }
        return DerivedKey;
    }


    // return Utf8Text true = returns text, else returns binary
    function webcryptoBinaryDecrypt(rawEncryptedData, derivedKey, options, returnUtf8Text = true) {
        return new Promise(function (resolve, reject) {
            var iv = _base64ToArrayBuffer(options.AesRijndaelIv);
            crypto.subtle.importKey("raw", derivedKey, "aes-cbc", false, ["decrypt"])
                .then(function (key) {
                    return crypto.subtle.decrypt({ name: "aes-cbc", iv: iv }, key, rawEncryptedData);
                },
                    reject)
                .then(function (plainText) {
                    if (returnUtf8Text) {
                        resolve(new TextDecoder("utf-8").decode(plainText));
                    } else {
                        resolve(plainText);
                    }

                },
                    reject);
        });

    }

  
    /*
     * First, get your derived key, then you can decrypt binary data to binary with this
     *
     */

    /*
     PasswordDerivationOptions (options):
     {
            "DerivationType": "scrypt", // optionally: rfc
            "Salt": "3a069e9126af66a839067f8a272081136d8ce63ed72176dc8a29973d2b15361f", //SALT must be in Hex
            "Cost": 16384, //only for DerivationType "scrypt", not for "rfc"
            "BlockSize": 8, //only for DerivationType "scrypt", not for "rfc"
            "Parallel": 1, //only for DerivationType "scrypt", not for "rfc"
            "KeySizeInBytes": 32,
            "DerivationIterations": 0 // Only for DerivationType "rfc", not needed for "scrypt"

        }
        */
     

    // Send rawPlainData in Uint8Array!
    function webcryptoBinaryEncrypt(rawPlainData, derivedKey, options, returnFullCryptoObject = false) {
        return new Promise(function (resolve, reject) {
            var iv = _base64ToArrayBuffer(options.AesRijndaelIv);
            crypto.subtle.importKey("raw", derivedKey, "aes-cbc", false, ["encrypt"])
                .then(function (key) {
                        return crypto.subtle.encrypt({ name: "aes-cbc", iv: iv }, key, rawPlainData);
                    },
                    reject)
                .then(function (cipherText) {
                    if (returnFullCryptoObject) {
                            options.CipherOutputText = _arrayBufferToBase64(cipherText);
                            resolve(JSON.stringify(options));
                        } else {
                            resolve(cipherText);
                        }
                    },
                    reject);
        });
    }

    function autocompleteOptions(options) {
        var rijndaelIv;
        var salt;
        if (options == null || options.AesRijndaelIv == null || options.Salt == null) {
            var array1 = new Uint8Array(16);
            var array2 = new Uint8Array(32);
            rijndaelIv = _arrayBufferToBase64(window.crypto.getRandomValues(array1));
            salt = arrayBufferToHex(window.crypto.getRandomValues(array2));
        
        }
        if (options == null) { // Scrypt is default (not rfc)
            options = {
                "DerivationType": "scrypt",
                "Salt": salt, //(can be empty or null, then string is automatically created)
                "Cost": 16384, //(the "N" of scrypt, default is 16384)
                "BlockSize": 8, // (the "r", default is 8)
                "Parallel": 1, // (the "p", default is 1)
                "KeySizeInBytes": 32, // (default is 32),
                "AesRijndaelIv": rijndaelIv
            }
        } else {
            // if one of the options exist, but others not
            ('DerivationType' in options) || (options.DerivationType = "scrypt");
            ('Salt' in options) || (options.Salt = salt);
            ('Cost' in options) || (options.Cost = 16384);
            ('BlockSize' in options) || (options.BlockSize = 8);
            ('Parallel' in options) || (options.Parallel = 1);
            ('KeySizeInBytes' in options) || (options.KeySizeInBytes = 32);
            ('DerivationIterations' in options) || (options.DerivationIterations = 10000);
            ('AesRijndaelIv' in options) || (options.AesRijndaelIv = rijndaelIv);
        }
        return options;
    }

    this.encryptBinary = function (rawPlainData, derivedKey, options, returnFullCryptoObject = false) {
        options = autocompleteOptions(options);
        return webcryptoBinaryEncrypt(rawPlainData, derivedKey, options, returnFullCryptoObject);
    }



    this.encrypt = function (plainText, passPhrase, options) {
        var that = this;
        var rawPlainData;
        options = autocompleteOptions(options);
        var derivedKey = that.getDerivedKey(passPhrase, options);
        rawPlainData = string2arraybuffer(plainText);
        return webcryptoBinaryEncrypt(rawPlainData, derivedKey, options, true);
    }

    this.transformTextToHex = function(text) {
        var utf8 = CryptoJS.enc.Utf8.parse(text);
        return CryptoJS.enc.Hex.stringify(utf8);
    }

    function _base64ToArrayBuffer(base64) {
        var binary_string = window.atob(base64);
        var len = binary_string.length;
        var bytes = new Uint8Array(len);
        for (var i = 0; i < len; i++) {
            bytes[i] = binary_string.charCodeAt(i);
        }
        return bytes.buffer;
    }

    function _arrayBufferToBase64(buffer) {
        var binary = '';
        var bytes = new Uint8Array(buffer);
        var len = bytes.byteLength;
        for (var i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    }

    function failAndLog(error) {
        console.log(error);
    }

    function hexStringToUint8Array(hexString) {
        if (hexString.length % 2 != 0)
            throw "Invalid hexString";
        var arrayBuffer = new Uint8Array(hexString.length / 2);

        for (var i = 0; i < hexString.length; i += 2) {
            var byteValue = parseInt(hexString.substr(i, 2), 16);
            if (byteValue == NaN)
                throw "Invalid hexString";
            arrayBuffer[i / 2] = byteValue;
        }

        return arrayBuffer;
    }

    function bytesToHexString(bytes) {
        if (!bytes)
            return null;

        bytes = new Uint8Array(bytes);
        var hexBytes = [];

        for (var i = 0; i < bytes.length; ++i) {
            var byteString = bytes[i].toString(16);
            if (byteString.length < 2)
                byteString = "0" + byteString;
            hexBytes.push(byteString);
        }

        return hexBytes.join("");
    }
    function asciiToUint8Array(str) {
        var chars = [];
        for (var i = 0; i < str.length; ++i)
            chars.push(str.charCodeAt(i));
        return new Uint8Array(chars);
    }
    function bytesToASCIIString(bytes) {
        return String.fromCharCode.apply(null, new Uint8Array(bytes));
    }

    function hexToArrayBuffer(hex) {
        if (typeof hex !== 'string') {
            throw new TypeError('Expected input to be a string');
        }

        if ((hex.length % 2) !== 0) {
            throw new RangeError('Expected string to be an even number of characters');
        }

        var view = new Uint8Array(hex.length / 2);

        for (var i = 0; i < hex.length; i += 2) {
            view[i / 2] = parseInt(hex.substring(i, i + 2), 16);
        }

        return view.buffer;
    }

    function arrayBufferToHex(arrayBuffer) {
        if (typeof arrayBuffer !== 'object' || arrayBuffer === null || typeof arrayBuffer.byteLength !== 'number') {
            throw new TypeError('Expected input to be an ArrayBuffer');
        }

        var view = new Uint8Array(arrayBuffer)
        var result = '';
        var value;

        for (var i = 0; i < view.length; i++) {
            value = view[i].toString(16);
            result += (value.length === 1 ? '0' + value : value);
        }

        return result;
    }

    // This is free and unencumbered software released into the public domain.

    // Marshals a string to an Uint8Array.
    function encodeUTF8(s) {
        var i = 0, bytes = new Uint8Array(s.length * 4);
        for (var ci = 0; ci != s.length; ci++) {
            var c = s.charCodeAt(ci);
            if (c < 128) {
                bytes[i++] = c;
                continue;
            }
            if (c < 2048) {
                bytes[i++] = c >> 6 | 192;
            } else {
                if (c > 0xd7ff && c < 0xdc00) {
                    if (++ci >= s.length)
                        throw new Error('UTF-8 encode: incomplete surrogate pair');
                    var c2 = s.charCodeAt(ci);
                    if (c2 < 0xdc00 || c2 > 0xdfff)
                        throw new Error('UTF-8 encode: second surrogate character 0x' + c2.toString(16) + ' at index ' + ci + ' out of range');
                    c = 0x10000 + ((c & 0x03ff) << 10) + (c2 & 0x03ff);
                    bytes[i++] = c >> 18 | 240;
                    bytes[i++] = c >> 12 & 63 | 128;
                } else bytes[i++] = c >> 12 | 224;
                bytes[i++] = c >> 6 & 63 | 128;
            }
            bytes[i++] = c & 63 | 128;
        }
        return bytes.subarray(0, i);
    }

    // Unmarshals a string from an Uint8Array.
    function decodeUTF8(bytes) {
        var i = 0, s = '';
        while (i < bytes.length) {
            var c = bytes[i++];
            if (c > 127) {
                if (c > 191 && c < 224) {
                    if (i >= bytes.length)
                        throw new Error('UTF-8 decode: incomplete 2-byte sequence');
                    c = (c & 31) << 6 | bytes[i++] & 63;
                } else if (c > 223 && c < 240) {
                    if (i + 1 >= bytes.length)
                        throw new Error('UTF-8 decode: incomplete 3-byte sequence');
                    c = (c & 15) << 12 | (bytes[i++] & 63) << 6 | bytes[i++] & 63;
                } else if (c > 239 && c < 248) {
                    if (i + 2 >= bytes.length)
                        throw new Error('UTF-8 decode: incomplete 4-byte sequence');
                    c = (c & 7) << 18 | (bytes[i++] & 63) << 12 | (bytes[i++] & 63) << 6 | bytes[i++] & 63;
                } else throw new Error('UTF-8 decode: unknown multibyte start 0x' + c.toString(16) + ' at index ' + (i - 1));
            }
            if (c <= 0xffff) s += String.fromCharCode(c);
            else if (c <= 0x10ffff) {
                c -= 0x10000;
                s += String.fromCharCode(c >> 10 | 0xd800)
                s += String.fromCharCode(c & 0x3FF | 0xdc00)
            } else throw new Error('UTF-8 decode: code point 0x' + c.toString(16) + ' exceeds UTF-16 reach');
        }
        return s;
    }

    function byteArrayToWordArray(ba) {
        var wa = [],
            i;
        for (i = 0; i < ba.length; i++) {
            wa[(i / 4) | 0] |= ba[i] << (24 - 8 * i);
        }

        return CryptoJS.lib.WordArray.create(wa, ba.length);
    }

    function wordToByteArray(word, length) {
        var ba = [],
            i,
            xFF = 0xFF;
        if (length > 0)
            ba.push(word >>> 24);
        if (length > 1)
            ba.push((word >>> 16) & xFF);
        if (length > 2)
            ba.push((word >>> 8) & xFF);
        if (length > 3)
            ba.push(word & xFF);

        return ba;
    }

    function wordArrayToByteArray(wordArray, length) {
        if (wordArray.hasOwnProperty("sigBytes") && wordArray.hasOwnProperty("words")) {
            length = wordArray.sigBytes;
            wordArray = wordArray.words;
        }

        var result = [],
            bytes,
            i = 0;
        while (length > 0) {
            bytes = wordToByteArray(wordArray[i], Math.min(4, length));
            length -= bytes.length;
            result.push(bytes);
            i++;
        }
        return [].concat.apply([], result);
    }
    function arraybuffer2string(buf) {
        return String.fromCharCode.apply(null, new Uint16Array(buf));
    }
    function string2arraybuffer(str) {
        var buf = new ArrayBuffer(str.length * 2); // 2 bytes for each char
        var bufView = new Uint16Array(buf);
        for (var i = 0, strLen = str.length; i < strLen; i++) {
            bufView[i] = str.charCodeAt(i);
        }
        return buf;
    }

}




