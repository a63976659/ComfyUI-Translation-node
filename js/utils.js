/**
 * ComfyUI-Translation-node 工具模块
 */

/**
 * 错误日志函数
 * @param  {...any} args 错误信息参数
 */
export function error(...args) {
    console.error("[Translation-node]", ...args);
}

/**
 * 检查文本是否包含中文字符
 * @param {string} text 要检查的文本
 * @returns {boolean} 是否包含中文字符
 */
export function containsChineseCharacters(text) {
    if (!text) return false;
    const chineseRegex = /[\u4e00-\u9fff\uf900-\ufaff\u3000-\u303f]/;
    return chineseRegex.test(text);
}

/**
 * 检查文本是否看起来已经被翻译过
 * @param {string} originalName 原始英文名称
 * @param {string} currentLabel 当前显示标签
 * @returns {boolean} 是否已被翻译
 */
export function isAlreadyTranslated(originalName, currentLabel) {
    if (!originalName || !currentLabel) return false;
    
    if (currentLabel !== originalName && containsChineseCharacters(currentLabel)) {
        return true;
    }
    
    if (currentLabel !== originalName && 
        currentLabel !== originalName.toLowerCase() &&
        currentLabel !== originalName.toUpperCase()) {
        return true;
    }
    
    return false;
}

/**
 * 不需要翻译的设置项列表
 */
export const nativeTranslatedSettings = [
    "Comfy", "画面", "外观", "3D", "遮罩编辑器",
];

// 存储当前翻译状态
let currentTranslationEnabled = true;

/**
 * 从配置文件获取翻译状态
 */
async function loadConfig() {
    try {
        const response = await fetch("./translation_node/get_config");
        if (response.ok) {
            const config = await response.json();
            currentTranslationEnabled = config.translation_enabled;
            return config.translation_enabled;
        }
    } catch (e) {
        error("获取配置失败:", e);
    }
    return true;
}

/**
 * 保存翻译状态到配置文件
 */
async function saveConfig(enabled) {
    try {
        const formData = new FormData();
        formData.append('translation_enabled', enabled.toString());

        const response = await fetch("./translation_node/set_config", {
            method: "POST",
            body: formData
        });

        if (response.ok) {
            const result = await response.json();
            if (result.success) {
                currentTranslationEnabled = enabled;
                return true;
            }
        }
    } catch (e) {
        error("保存配置失败:", e);
    }
    return false;
}

/**
 * 检查翻译是否启用
 */
export function isTranslationEnabled() {
    return currentTranslationEnabled;
}

/**
 * 初始化配置
 */
export async function initConfig() {
    await loadConfig();
}

/**
 * 切换翻译状态
 */
export async function toggleTranslation() {
    const newEnabled = !currentTranslationEnabled;
    const success = await saveConfig(newEnabled);
    if (success) {
        setTimeout(() => location.reload(), 100);
    } else {
        error("切换翻译状态失败");
    }
}