/**
 * ComfyUI-Translation 工具模块
 */

/**
 * 错误日志函数
 * @param  {...any} 参数 错误信息参数
 */
export function 错误日志(...参数) {
    console.error("[翻译插件]", ...参数);
}

/**
 * 检查文本是否包含中文字符
 * @param {string} 文本 要检查的文本
 * @returns {boolean} 是否包含中文字符
 */
export function 包含中文字符(文本) {
    if (!文本) return false;
    const 中文正则表达式 = /[\u4e00-\u9fff\uf900-\ufaff\u3000-\u303f]/;
    return 中文正则表达式.test(文本);
}

/**
 * 检查文本是否看起来已经被翻译过
 * @param {string} 原始名称 原始英文名称
 * @param {string} 当前标签 当前显示标签
 * @returns {boolean} 是否已被翻译
 */
export function 是否已翻译(原始名称, 当前标签) {
    if (!原始名称 || !当前标签) return false;
    
    if (当前标签 !== 原始名称 && 包含中文字符(当前标签)) {
        return true;
    }
    
    if (当前标签 !== 原始名称 && 
        当前标签 !== 原始名称.toLowerCase() &&
        当前标签 !== 原始名称.toUpperCase()) {
        return true;
    }
    
    return false;
}

/**
 * 不需要翻译的设置项列表
 */
export const 原生已翻译设置项 = [
    "Comfy", "画面", "外观", "3D", "遮罩编辑器",
];

// 存储当前翻译状态
let 当前翻译启用状态 = true;

/**
 * 从配置文件获取翻译状态
 */
async function 加载配置() {
    try {
        const 响应 = await fetch("./translation/get_config");
        if (响应.ok) {
            const 配置 = await 响应.json();
            当前翻译启用状态 = 配置.translation_enabled;
            return 配置.translation_enabled;
        }
    } catch (错误) {
        错误日志("获取配置失败:", 错误);
    }
    return true;
}

/**
 * 保存翻译状态到配置文件
 */
async function 保存配置(启用状态) {
    try {
        const 表单数据 = new FormData();
        表单数据.append('translation_enabled', 启用状态.toString());

        const 响应 = await fetch("./translation/set_config", {
            method: "POST",
            body: 表单数据
        });

        if (响应.ok) {
            const 结果 = await 响应.json();
            if (结果.success) {
                当前翻译启用状态 = 启用状态;
                return true;
            }
        }
    } catch (错误) {
        错误日志("保存配置失败:", 错误);
    }
    return false;
}

/**
 * 检查翻译是否启用
 */
export function 是否启用翻译() {
    return 当前翻译启用状态;
}

/**
 * 初始化配置
 */
export async function 初始化配置() {
    await 加载配置();
}

/**
 * 切换翻译状态
 */
export async function 切换翻译状态() {
    const 新启用状态 = !当前翻译启用状态;
    const 成功 = await 保存配置(新启用状态);
    if (成功) {
        setTimeout(() => location.reload(), 100);
    } else {
        错误日志("切换翻译状态失败");
    }
}

// 导出别名以保持向后兼容性
export { 
    错误日志 as error,
    包含中文字符 as containsChineseCharacters,
    是否已翻译 as isAlreadyTranslated,
    原生已翻译设置项 as nativeTranslatedSettings,
    是否启用翻译 as isTranslationEnabled,
    切换翻译状态 as toggleTranslation,
    初始化配置 as initConfig
};