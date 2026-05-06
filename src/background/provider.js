importScripts("../shared/constants.js");

(function initProvider(globalScope) {
  const config = globalScope.LinguaPopConfig;
  const encoder = new TextEncoder();
  const tencentConfig = {
    algorithm: "TC3-HMAC-SHA256",
    host: "tmt.intl.tencentcloudapi.com",
    endpoint: "https://tmt.intl.tencentcloudapi.com/",
    service: "tmt",
    action: "TextTranslate",
    version: "2018-03-21"
  };
  const baiduEndpoint = "https://fanyi-api.baidu.com/api/trans/vip/translate";

  function containsCjk(text) {
    return /[\u3400-\u9fff]/.test(text);
  }

  function getTargetLanguage(text) {
    return containsCjk(text) ? "en" : "zh";
  }

  function normalizeLanguage(language) {
    if (!language) {
      return "";
    }

    const normalized = String(language).replace("_", "-").toLowerCase();
    if (normalized.startsWith("en")) {
      return "EN";
    }
    if (normalized.startsWith("zh")) {
      return "ZH";
    }
    return normalized.toUpperCase();
  }

  async function sha256Hex(value) {
    const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
    return bytesToHex(new Uint8Array(digest));
  }

  async function hmacSha256Raw(keyBytes, message) {
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message));
    return new Uint8Array(signature);
  }

  async function hmacSha256Hex(keyBytes, message) {
    const raw = await hmacSha256Raw(keyBytes, message);
    return bytesToHex(raw);
  }

  function bytesToHex(bytes) {
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  function getUtcDate(timestampSeconds) {
    return new Date(timestampSeconds * 1000).toISOString().slice(0, 10);
  }

  function buildTencentPayload(input) {
    return JSON.stringify({
      SourceText: input.text.trim(),
      Source: "auto",
      Target: input.targetLang || getTargetLanguage(input.text),
      ProjectId: Number.parseInt(input.projectId, 10) || 0
    });
  }

  async function buildTencentAuthorization(input, payload, timestampSeconds) {
    const date = getUtcDate(timestampSeconds);
    const canonicalHeaders = `content-type:application/json; charset=utf-8\nhost:${tencentConfig.host}\n`;
    const signedHeaders = "content-type;host";
    const hashedRequestPayload = await sha256Hex(payload);
    const canonicalRequest = [
      "POST",
      "/",
      "",
      canonicalHeaders,
      signedHeaders,
      hashedRequestPayload
    ].join("\n");
    const credentialScope = `${date}/${tencentConfig.service}/tc3_request`;
    const hashedCanonicalRequest = await sha256Hex(canonicalRequest);
    const stringToSign = [
      tencentConfig.algorithm,
      String(timestampSeconds),
      credentialScope,
      hashedCanonicalRequest
    ].join("\n");

    const secretDate = await hmacSha256Raw(encoder.encode(`TC3${input.secretKey}`), date);
    const secretService = await hmacSha256Raw(secretDate, tencentConfig.service);
    const secretSigning = await hmacSha256Raw(secretService, "tc3_request");
    const signature = await hmacSha256Hex(secretSigning, stringToSign);

    return `${tencentConfig.algorithm} Credential=${input.secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  }

  async function translateWithTencent(input) {
    const text = input.text.trim();

    if (!input.secretId || !input.secretKey) {
      const error = new Error("missing-api-key");
      error.code = "missing-api-key";
      throw error;
    }

    const timestampSeconds = Math.floor(Date.now() / 1000);
    const payload = buildTencentPayload({
      ...input,
      text
    });
    const authorization = await buildTencentAuthorization(input, payload, timestampSeconds);

    const response = await fetch(tencentConfig.endpoint, {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json; charset=utf-8",
        "X-TC-Action": tencentConfig.action,
        "X-TC-Version": tencentConfig.version,
        "X-TC-Region": input.region || config.defaultSettings.tencentRegion,
        "X-TC-Timestamp": String(timestampSeconds)
      },
      body: payload
    });

    if (!response.ok) {
      const error = new Error("provider-error");
      error.code = response.status === 401 || response.status === 403 ? "invalid-api-key" : "provider-error";
      error.status = response.status;
      throw error;
    }

    const responseBody = await response.json();
    const apiResponse = responseBody.Response || {};

    if (apiResponse.Error) {
      const error = new Error(apiResponse.Error.Code || "provider-error");
      error.code = mapTencentErrorCode(apiResponse.Error.Code);
      error.providerCode = apiResponse.Error.Code;
      error.providerMessage = apiResponse.Error.Message;
      throw error;
    }

    if (!apiResponse.TargetText) {
      const error = new Error("invalid-provider-response");
      error.code = "provider-error";
      throw error;
    }

    return {
      originalText: text,
      translatedText: apiResponse.TargetText,
      sourceLang: normalizeLanguage(apiResponse.Source),
      targetLang: normalizeLanguage(apiResponse.Target)
    };
  }

  function md5(input) {
    function rotateLeft(value, amount) {
      return (value << amount) | (value >>> (32 - amount));
    }

    function addUnsigned(left, right) {
      const leftLow = left & 0xffff;
      const rightLow = right & 0xffff;
      const lowSum = leftLow + rightLow;
      const highSum = (left >>> 16) + (right >>> 16) + (lowSum >>> 16);
      return ((highSum & 0xffff) << 16) | (lowSum & 0xffff);
    }

    function toWordArray(str) {
      const utf8 = unescape(encodeURIComponent(str));
      const words = [];
      for (let index = 0; index < utf8.length; index += 1) {
        words[index >> 2] = words[index >> 2] || 0;
        words[index >> 2] |= utf8.charCodeAt(index) << ((index % 4) * 8);
      }
      words[utf8.length >> 2] = words[utf8.length >> 2] || 0;
      words[utf8.length >> 2] |= 0x80 << ((utf8.length % 4) * 8);
      words[(((utf8.length + 8) >> 6) + 1) * 16 - 2] = utf8.length * 8;
      return words;
    }

    function toHex(value) {
      let output = "";
      for (let index = 0; index <= 3; index += 1) {
        const byte = (value >>> (index * 8)) & 0xff;
        output += byte.toString(16).padStart(2, "0");
      }
      return output;
    }

    function ff(a, b, c, d, x, s, ac) {
      a = addUnsigned(a, addUnsigned(addUnsigned((b & c) | (~b & d), x), ac));
      return addUnsigned(rotateLeft(a, s), b);
    }

    function gg(a, b, c, d, x, s, ac) {
      a = addUnsigned(a, addUnsigned(addUnsigned((b & d) | (c & ~d), x), ac));
      return addUnsigned(rotateLeft(a, s), b);
    }

    function hh(a, b, c, d, x, s, ac) {
      a = addUnsigned(a, addUnsigned(addUnsigned(b ^ c ^ d, x), ac));
      return addUnsigned(rotateLeft(a, s), b);
    }

    function ii(a, b, c, d, x, s, ac) {
      a = addUnsigned(a, addUnsigned(addUnsigned(c ^ (b | ~d), x), ac));
      return addUnsigned(rotateLeft(a, s), b);
    }

    const words = toWordArray(input);
    let a = 0x67452301;
    let b = 0xefcdab89;
    let c = 0x98badcfe;
    let d = 0x10325476;

    for (let index = 0; index < words.length; index += 16) {
      const aa = a;
      const bb = b;
      const cc = c;
      const dd = d;

      a = ff(a, b, c, d, words[index + 0], 7, 0xd76aa478);
      d = ff(d, a, b, c, words[index + 1], 12, 0xe8c7b756);
      c = ff(c, d, a, b, words[index + 2], 17, 0x242070db);
      b = ff(b, c, d, a, words[index + 3], 22, 0xc1bdceee);
      a = ff(a, b, c, d, words[index + 4], 7, 0xf57c0faf);
      d = ff(d, a, b, c, words[index + 5], 12, 0x4787c62a);
      c = ff(c, d, a, b, words[index + 6], 17, 0xa8304613);
      b = ff(b, c, d, a, words[index + 7], 22, 0xfd469501);
      a = ff(a, b, c, d, words[index + 8], 7, 0x698098d8);
      d = ff(d, a, b, c, words[index + 9], 12, 0x8b44f7af);
      c = ff(c, d, a, b, words[index + 10], 17, 0xffff5bb1);
      b = ff(b, c, d, a, words[index + 11], 22, 0x895cd7be);
      a = ff(a, b, c, d, words[index + 12], 7, 0x6b901122);
      d = ff(d, a, b, c, words[index + 13], 12, 0xfd987193);
      c = ff(c, d, a, b, words[index + 14], 17, 0xa679438e);
      b = ff(b, c, d, a, words[index + 15], 22, 0x49b40821);

      a = gg(a, b, c, d, words[index + 1], 5, 0xf61e2562);
      d = gg(d, a, b, c, words[index + 6], 9, 0xc040b340);
      c = gg(c, d, a, b, words[index + 11], 14, 0x265e5a51);
      b = gg(b, c, d, a, words[index + 0], 20, 0xe9b6c7aa);
      a = gg(a, b, c, d, words[index + 5], 5, 0xd62f105d);
      d = gg(d, a, b, c, words[index + 10], 9, 0x02441453);
      c = gg(c, d, a, b, words[index + 15], 14, 0xd8a1e681);
      b = gg(b, c, d, a, words[index + 4], 20, 0xe7d3fbc8);
      a = gg(a, b, c, d, words[index + 9], 5, 0x21e1cde6);
      d = gg(d, a, b, c, words[index + 14], 9, 0xc33707d6);
      c = gg(c, d, a, b, words[index + 3], 14, 0xf4d50d87);
      b = gg(b, c, d, a, words[index + 8], 20, 0x455a14ed);
      a = gg(a, b, c, d, words[index + 13], 5, 0xa9e3e905);
      d = gg(d, a, b, c, words[index + 2], 9, 0xfcefa3f8);
      c = gg(c, d, a, b, words[index + 7], 14, 0x676f02d9);
      b = gg(b, c, d, a, words[index + 12], 20, 0x8d2a4c8a);

      a = hh(a, b, c, d, words[index + 5], 4, 0xfffa3942);
      d = hh(d, a, b, c, words[index + 8], 11, 0x8771f681);
      c = hh(c, d, a, b, words[index + 11], 16, 0x6d9d6122);
      b = hh(b, c, d, a, words[index + 14], 23, 0xfde5380c);
      a = hh(a, b, c, d, words[index + 1], 4, 0xa4beea44);
      d = hh(d, a, b, c, words[index + 4], 11, 0x4bdecfa9);
      c = hh(c, d, a, b, words[index + 7], 16, 0xf6bb4b60);
      b = hh(b, c, d, a, words[index + 10], 23, 0xbebfbc70);
      a = hh(a, b, c, d, words[index + 13], 4, 0x289b7ec6);
      d = hh(d, a, b, c, words[index + 0], 11, 0xeaa127fa);
      c = hh(c, d, a, b, words[index + 3], 16, 0xd4ef3085);
      b = hh(b, c, d, a, words[index + 6], 23, 0x04881d05);
      a = hh(a, b, c, d, words[index + 9], 4, 0xd9d4d039);
      d = hh(d, a, b, c, words[index + 12], 11, 0xe6db99e5);
      c = hh(c, d, a, b, words[index + 15], 16, 0x1fa27cf8);
      b = hh(b, c, d, a, words[index + 2], 23, 0xc4ac5665);

      a = ii(a, b, c, d, words[index + 0], 6, 0xf4292244);
      d = ii(d, a, b, c, words[index + 7], 10, 0x432aff97);
      c = ii(c, d, a, b, words[index + 14], 15, 0xab9423a7);
      b = ii(b, c, d, a, words[index + 5], 21, 0xfc93a039);
      a = ii(a, b, c, d, words[index + 12], 6, 0x655b59c3);
      d = ii(d, a, b, c, words[index + 3], 10, 0x8f0ccc92);
      c = ii(c, d, a, b, words[index + 10], 15, 0xffeff47d);
      b = ii(b, c, d, a, words[index + 1], 21, 0x85845dd1);
      a = ii(a, b, c, d, words[index + 8], 6, 0x6fa87e4f);
      d = ii(d, a, b, c, words[index + 15], 10, 0xfe2ce6e0);
      c = ii(c, d, a, b, words[index + 6], 15, 0xa3014314);
      b = ii(b, c, d, a, words[index + 13], 21, 0x4e0811a1);
      a = ii(a, b, c, d, words[index + 4], 6, 0xf7537e82);
      d = ii(d, a, b, c, words[index + 11], 10, 0xbd3af235);
      c = ii(c, d, a, b, words[index + 2], 15, 0x2ad7d2bb);
      b = ii(b, c, d, a, words[index + 9], 21, 0xeb86d391);

      a = addUnsigned(a, aa);
      b = addUnsigned(b, bb);
      c = addUnsigned(c, cc);
      d = addUnsigned(d, dd);
    }

    return [a, b, c, d].map(toHex).join("");
  }

  async function translateWithBaidu(input) {
    const text = input.text.trim();
    const baiduSecretKey = input.baiduSecretKey || input.secretKey;

    if (!input.appId || !baiduSecretKey) {
      const error = new Error("missing-api-key");
      error.code = "missing-api-key";
      throw error;
    }

    const salt = String(Date.now());
    const targetLang = input.targetLang || getTargetLanguage(text);
    const sign = md5(`${input.appId}${text}${salt}${baiduSecretKey}`);
    const params = new URLSearchParams();
    params.append("q", text);
    params.append("from", "auto");
    params.append("to", targetLang);
    params.append("appid", input.appId);
    params.append("salt", salt);
    params.append("sign", sign);

    const response = await fetch(baiduEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params.toString()
    });

    if (!response.ok) {
      const error = new Error("provider-error");
      error.code = response.status === 401 || response.status === 403 ? "invalid-api-key" : "provider-error";
      error.status = response.status;
      throw error;
    }

    const responseBody = await response.json();
    if (responseBody.error_code) {
      const error = new Error(responseBody.error_code);
      error.code = mapBaiduErrorCode(responseBody.error_code);
      error.providerCode = responseBody.error_code;
      error.providerMessage = responseBody.error_msg;
      throw error;
    }

    const firstTranslation = responseBody.trans_result && responseBody.trans_result[0];
    if (!firstTranslation || !firstTranslation.dst) {
      const error = new Error("invalid-provider-response");
      error.code = "provider-error";
      throw error;
    }

    return {
      originalText: text,
      translatedText: firstTranslation.dst,
      sourceLang: normalizeLanguage(responseBody.from),
      targetLang: normalizeLanguage(responseBody.to)
    };
  }

  function mapTencentErrorCode(code) {
    if (!code) {
      return "provider-error";
    }

    if (code.startsWith("AuthFailure")) {
      return "invalid-api-key";
    }
    if (code === "FailedOperation.UserNotRegistered") {
      return "provider-not-activated";
    }
    if (code === "UnsupportedOperation.TextTooLong") {
      return "text-too-long";
    }
    return "provider-error";
  }

  function mapBaiduErrorCode(code) {
    if (!code) {
      return "provider-error";
    }

    if (code === "54001" || code === "52003") {
      return "invalid-api-key";
    }
    if (code === "54003") {
      return "rate-limited";
    }
    if (code === "54005" || code === "58001") {
      return "provider-not-activated";
    }
    if (code === "54004" || code === "58000") {
      return "provider-error";
    }
    return "provider-error";
  }

  async function translate(input) {
    const selectedProvider = input.provider || config.defaultSettings.provider;

    if (selectedProvider === config.provider.tencent) {
      return translateWithTencent(input);
    }

    if (selectedProvider === config.provider.baidu) {
      return translateWithBaidu(input);
    }

    const error = new Error("unsupported-provider");
    error.code = "unsupported-provider";
    throw error;
  }

  globalScope.LinguaPopProvider = {
    translate
  };
})(self);
