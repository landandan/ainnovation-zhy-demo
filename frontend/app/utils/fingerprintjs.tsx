import FingerprintJS from '@fingerprintjs/fingerprintjs';

/**
 * 获取设备唯一标识
 * @returns 设备唯一标识
 */
async function getDeviceId() {
    const fp = await FingerprintJS.load();
    const result = await fp.get();
    // result.visitorId 即为设备唯一标识
    console.log("🚀 ~ getDeviceId ~ result.visitorId: ", result.visitorId);
    return result.visitorId;
}

export default getDeviceId;
