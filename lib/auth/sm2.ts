/**
 * SM2 公钥解混淆与密码加密（国密）
 *
 * 1. GET /auth/getSm2PublicKey → 混淆串（Base64 + XOR）
 * 2. 解混淆得到 SPKI（Base64）
 * 3. 从 SPKI DER 取出未压缩公钥（04||X||Y）十六进制
 * 4. 用 sm-crypto 对明文密码做 SM2 加密
 */

import { sm2 } from "sm-crypto"

/** 与后端约定的 XOR 种子 */
const SM2_XOR_SEED = [0xb8, 0x2d, 0xf1, 0x6a, 0x4c, 0xe3, 0x97, 0x05]

/** SM2 密文排列：1 = C1C3C2（常见默认），0 = C1C2C3 */
const SM2_CIPHER_MODE = 1

function bytesToHex(bytes: Uint8Array): string {
  let hex = ""
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0")
  }
  return hex
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/**
 * 解混淆 SM2 公钥：Base64 解码后按字节 XOR，得到 SPKI Base64 串
 */
export function deobfuscateSm2PublicKey(obfuscated: string): string {
  const trimmed = String(obfuscated ?? "").trim()
  if (!trimmed) {
    throw new Error("SM2 公钥为空")
  }

  let decoded: string
  try {
    decoded = atob(trimmed)
  } catch {
    throw new Error("SM2 公钥 Base64 解码失败")
  }

  let result = ""
  for (let i = 0; i < decoded.length; i++) {
    result += String.fromCharCode(
      decoded.charCodeAt(i) ^ SM2_XOR_SEED[i % SM2_XOR_SEED.length],
    )
  }
  return result
}

/**
 * 将解混淆后的 SPKI（Base64）转为 sm-crypto 可用的十六进制公钥（含 04 前缀）
 * 若已是十六进制公钥则原样返回
 */
export function spkiToSm2PublicKeyHex(spkiOrHex: string): string {
  const raw = String(spkiOrHex ?? "").trim()
  if (!raw) {
    throw new Error("SM2 公钥无效")
  }

  // 已是 hex（可带 04）
  if (/^(04)?[0-9a-fA-F]{128}$/.test(raw)) {
    return raw.startsWith("04") || raw.startsWith("04".toLowerCase())
      ? raw
      : `04${raw}`
  }

  let der: Uint8Array
  try {
    der = base64ToBytes(raw)
  } catch {
    throw new Error("SM2 SPKI Base64 解码失败")
  }

  // SPKI 中未压缩公钥一般为末尾 65 字节：04 + X(32) + Y(32)
  if (der.length >= 65) {
    const slice = der.slice(der.length - 65)
    if (slice[0] === 0x04) {
      return bytesToHex(slice)
    }
  }

  // 兜底：扫描首个 04 + 64 字节
  for (let i = 0; i <= der.length - 65; i++) {
    if (der[i] === 0x04) {
      return bytesToHex(der.slice(i, i + 65))
    }
  }

  throw new Error("无法从 SPKI 中解析 SM2 公钥")
}

/**
 * 使用 SM2 公钥加密密码
 */
export function encryptPasswordBySm2(plainPassword: string, publicKeySpkiOrHex: string): string {
  const pwd = String(plainPassword ?? "")
  if (!pwd) {
    throw new Error("密码不能为空")
  }

  const publicKeyHex = spkiToSm2PublicKeyHex(publicKeySpkiOrHex)
  return sm2.doEncrypt(pwd, publicKeyHex, SM2_CIPHER_MODE)
}
