import { 
  containsChineseCharacters, 
  nativeTranslatedSettings,
  error
} from "./utils.js";

/**
 * 翻译执行器类
 */
class 翻译执行器 {
  static 翻译数据 = null;

  /**
   * 翻译指定文本
   * @param {string} 文本 需要翻译的文本
   * @returns {string|null} 翻译后的文本或null
   */
  菜单翻译(文本) {
    // 如果文本已经包含中文字符，跳过翻译
    if (containsChineseCharacters(文本)) {
      return null;
    }
    return this.翻译数据?.菜单?.[文本] || this.翻译数据?.菜单?.[文本?.trim?.()];
  }

  constructor() {
    // 不需要翻译的CSS类列表
    this.排除类名 = ["lite-search-item-type"];
    // 记录已注册的观察者，便于后续管理
    this.观察者列表 = [];
  }

  /**
   * 检查是否需要跳过翻译
   * @param {HTMLElement} 节点 DOM节点
   * @returns {boolean} 是否需要跳过
   */
  跳过翻译(节点) {
    try {
      // 判断node.classList 是否包含 排除类名中的一个
      return this.排除类名.some((类名) => 节点.classList?.contains(类名));
    } catch (e) {
      // 如果出错，默认不跳过
      return false;
    }
  }

  /**
   * 翻译KJ弹窗描述
   * @param {HTMLElement} 节点 DOM节点
   * @returns {boolean} 是否成功翻译
   */
  翻译KJ弹窗描述(节点) {
    try {
      let 翻译数据 = this.翻译数据;
      if (!翻译数据) return false;
      if (!节点 || !节点.querySelectorAll) return false;
      if (!节点?.classList?.contains("kj-documentation-popup")) return false;
      
      const 所有元素 = 节点.querySelectorAll("*");
      for (const 元素 of 所有元素) {
        this.替换文本(元素);
      }
      
      return true;
    } catch (e) {
      error("翻译KJ弹窗出错:", e);
      return false;
    }
  }

  /**
   * 翻译所有文本
   * @param {HTMLElement} 节点 DOM节点
   */
  翻译所有文本(节点) {
    try {
      let 翻译数据 = this.翻译数据;
      if (!翻译数据) return;
      if (!节点 || !节点.querySelectorAll) return;
      
      const 所有元素 = 节点.querySelectorAll("*");
      for (const 元素 of 所有元素) {
        if (元素.textContent && nativeTranslatedSettings.includes(元素.textContent)) {
          continue;
        }
        this.替换文本(元素);
      }
    } catch (e) {
      error("翻译所有文本出错:", e);
    }
  }

  /**
   * 替换文本内容为翻译后的文本
   * @param {Node} 目标节点 目标节点
   */
  替换文本(目标节点) {
    try {
      if (!目标节点) return;
      if (!this.翻译数据) return;
      if (this.跳过翻译(目标节点)) return;
      
      // 如果节点的内容是原生已翻译的设置项，跳过翻译
      if (目标节点.textContent && nativeTranslatedSettings.includes(目标节点.textContent)) {
        return;
      }
      
      // 处理子节点
      if (目标节点.childNodes && 目标节点.childNodes.length) {
        // 创建一个副本来遍历，避免在遍历过程中修改导致问题
        const 子节点列表 = Array.from(目标节点.childNodes);
        for (const 子节点 of 子节点列表) {
          this.替换文本(子节点);
        }
      }
      
      // 处理当前节点
      if (目标节点.nodeType === Node.TEXT_NODE) {
        // 文本节点
        if (目标节点.nodeValue && !containsChineseCharacters(目标节点.nodeValue)) {
          const 翻译结果 = this.菜单翻译(目标节点.nodeValue);
          if (翻译结果) {
            目标节点.nodeValue = 翻译结果;
          }
        }
      } else if (目标节点.nodeType === Node.ELEMENT_NODE) {
        // 元素节点
        
        // 处理 title 属性
        if (目标节点.title && !containsChineseCharacters(目标节点.title)) {
          const 标题翻译 = this.菜单翻译(目标节点.title);
          if (标题翻译) {
            目标节点.title = 标题翻译;
          }
        }

        // 处理按钮值
        if (目标节点.nodeName === "INPUT" && 目标节点.type === "button" && 
            !containsChineseCharacters(目标节点.value)) {
          const 值翻译 = this.菜单翻译(目标节点.value);
          if (值翻译) {
            目标节点.value = 值翻译;
          }
        }

        // 处理文本内容
        if (目标节点.innerText && !containsChineseCharacters(目标节点.innerText)) {
          const 内部文本翻译 = this.菜单翻译(目标节点.innerText);
          if (内部文本翻译) {
            目标节点.innerText = 内部文本翻译;
          }
        }
        
        // 处理select和option元素
        if (目标节点.nodeName === "SELECT") {
          // 确保翻译下拉框中的选项
          Array.from(目标节点.options).forEach(选项 => {
            if (选项.text && !containsChineseCharacters(选项.text)) {
              const 选项文本翻译 = this.菜单翻译(选项.text);
              if (选项文本翻译) {
                选项.text = 选项文本翻译;
              }
            }
          });
        }
      }
    } catch (e) {
      error("替换文本出错:", e);
    }
  }

  /**
   * 清理观察者
   */
  清理观察者() {
    try {
      this.观察者列表.forEach(观察者 => {
        if (观察者 && typeof 观察者.disconnect === 'function') {
          观察者.disconnect();
        }
      });
      this.观察者列表 = [];
    } catch (e) {
      error("清理观察者出错:", e);
    }
  }
}

// 创建翻译执行器实例
let 翻译执行器实例 = new 翻译执行器();

/**
 * 应用菜单翻译
 * @param {Object} 翻译数据 翻译数据对象
 */
export function applyMenuTranslation(翻译数据) {
  try {
    翻译执行器实例.清理观察者();
    翻译执行器实例.翻译数据 = 翻译数据;
    
    翻译执行器实例.翻译所有文本(document.querySelector(".litegraph"));
    
    const 主体观察者 = 观察者工厂(document.querySelector("body.litegraph"), (变更列表) => {
      for (let 变更 of 变更列表) {
        for (const 节点 of 变更.addedNodes) {
          if (节点.classList?.contains("comfy-modal")) {
            翻译执行器实例.翻译所有文本(节点);
            观察模态框节点(节点);
          } else if (节点.classList?.contains("p-dialog-mask")) {
            const 对话框 = 节点.querySelector(".p-dialog");
            if (对话框) {
              翻译执行器实例.翻译所有文本(对话框);
              观察者工厂(对话框, 处理设置对话框, 对话框?.role === "dialog");
            }
          } else {
            翻译执行器实例.翻译所有文本(节点);
          }
        }
      }
    }, true);
    
    翻译执行器实例.观察者列表.push(主体观察者);
    
    document.querySelectorAll(".comfy-modal").forEach(节点 => {
      观察模态框节点(节点);
    });
    
    if (document.querySelector(".comfyui-menu")) {
      const 菜单观察者 = 观察者工厂(document.querySelector(".comfyui-menu"), 处理新版UI菜单, true);
      翻译执行器实例.观察者列表.push(菜单观察者);
    }
    
    document.querySelectorAll(".comfyui-popup").forEach(节点 => {
      const 弹窗观察者 = 观察者工厂(节点, 处理新版UI菜单, true);
      翻译执行器实例.观察者列表.push(弹窗观察者);
    });
    
    处理历史和队列按钮();
    处理设置对话框();
    设置搜索框观察者();
  } catch (e) {
    error("应用菜单翻译出错:", e);
  }
}

/**
 * 观察者工厂函数
 * @param {HTMLElement} 观察目标 观察目标
 * @param {Function} 回调函数 回调函数
 * @param {boolean} 观察子树 是否观察子树
 * @returns {MutationObserver} 观察者实例
 */
export function 观察者工厂(观察目标, 回调函数, 观察子树 = false) {
  if (!观察目标) return null;
  try {
    const 观察者 = new MutationObserver(function (变更列表, 观察者实例) {
      回调函数(变更列表, 观察者实例);
    });

    观察者.observe(观察目标, {
      childList: true,
      attributes: true,
      subtree: 观察子树,
    });
    return 观察者;
  } catch (e) {
    error("创建观察者出错:", e);
    return null;
  }
}

/**
 * 处理模态框节点
 * @param {HTMLElement} 节点 模态框节点
 */
function 观察模态框节点(节点) {
  const 观察者 = 观察者工厂(节点, (变更列表) => {
    for (let 变更 of 变更列表) {
      翻译执行器实例.翻译所有文本(变更.target);
    }
  });
  if (观察者) {
    翻译执行器实例.观察者列表.push(观察者);
  }
}

/**
 * 处理ComfyUI新版UI菜单
 * @param {MutationRecord[]} 变更列表 变更记录列表
 */
function 处理新版UI菜单(变更列表) {
  for (let 变更 of 变更列表) {
    翻译执行器实例.翻译所有文本(变更.target);
  }
}

/**
 * 处理历史和队列按钮
 */
function 处理历史和队列按钮() {
  const 查看历史按钮 = document.getElementById("comfy-view-history-button");
  const 查看队列按钮 = document.getElementById("comfy-view-queue-button");

  [查看历史按钮, 查看队列按钮].filter(Boolean).forEach(按钮 => {
    const 观察者 = 观察者工厂(按钮, (变更列表) => {
      for (let 变更 of 变更列表) {
        if (变更.type === "childList") {
          const 翻译值 = 翻译执行器实例.菜单翻译(变更.target.textContent);
          if (翻译值) {
            变更.target.innerText = 翻译值;
          }
        }
      }
    });
    if (观察者) {
      翻译执行器实例.观察者列表.push(观察者);
    }
  });
  
  if (document.querySelector(".comfy-menu")) {
    const 菜单观察者 = 观察者工厂(document.querySelector(".comfy-menu"), 处理视图队列列表观察者);
    if (菜单观察者) {
      翻译执行器实例.观察者列表.push(菜单观察者);
    }

    const 列表元素 = document.querySelector(".comfy-menu").querySelectorAll(".comfy-list");
    if (列表元素.length > 0) {
      const 列表0观察者 = 观察者工厂(列表元素[0], 处理视图队列列表观察者);
      if (列表0观察者) {
        翻译执行器实例.观察者列表.push(列表0观察者);
      }
      
      if (列表元素.length > 1) {
        const 列表1观察者 = 观察者工厂(列表元素[1], 处理视图队列列表观察者);
        if (列表1观察者) {
          翻译执行器实例.观察者列表.push(列表1观察者);
        }
      }
    }
  }
}

/**
 * 处理视图队列和Comfy列表观察者
 * @param {MutationRecord[]} 变更列表 变更记录列表
 */
function 处理视图队列列表观察者(变更列表) {
  for (let 变更 of 变更列表) {
    翻译执行器实例.替换文本(变更.target);
    if (变更.type === "childList" && 变更.addedNodes.length > 0) {
      for (const 节点 of 变更.addedNodes) {
        翻译执行器实例.替换文本(节点);
      }
    }
  }
}

/**
 * 处理设置对话框
 */
function 处理设置对话框() {
  const 设置对话框 = document.querySelector("#comfy-settings-dialog");
  if (!设置对话框) return;

  // 老版设置面板的翻译
  if (设置对话框?.querySelector("tbody")) {
    const 观察者 = 观察者工厂(设置对话框.querySelector("tbody"), (变更列表) => {
      for (let 变更 of 变更列表) {
        if (变更.type === "childList" && 变更.addedNodes.length > 0) {
          翻译设置对话框(设置对话框);
        }
      }
    });
    if (观察者) {
      翻译执行器实例.观察者列表.push(观察者);
    }
  }

  // 新版设置面板处理
  const 新版设置面板 = document.querySelectorAll(".p-dialog-content, .p-tabview-panels");
  for (const 面板 of 新版设置面板) {
    const 观察者 = 观察者工厂(面板, 处理新版设置观察者, true);
    if (观察者) {
      翻译执行器实例.观察者列表.push(观察者);
    }
  }
  
  // 初始翻译
  翻译设置对话框(设置对话框);
}

/**
 * 处理新版设置观察者
 * @param {MutationRecord[]} 变更列表 变更记录列表
 */
function 处理新版设置观察者(变更列表) {
  for (let 变更 of 变更列表) {
    if (变更.type === "childList") {
      for (const 节点 of 变更.addedNodes) {
        翻译执行器实例.翻译所有文本(节点);
      }
    }
  }
}

/**
 * 翻译设置对话框
 * @param {HTMLElement} 设置对话框 设置对话框
 */
function 翻译设置对话框(设置对话框) {
  if (!设置对话框) return;
  
  const 所有元素 = 设置对话框.querySelectorAll("*");
  for (const 元素 of 所有元素) {
    // 跳过已经有中文的元素
    if (containsChineseCharacters(元素.innerText) || 
        nativeTranslatedSettings.includes(元素.innerText)) {
      continue;
    }
    
    let 目标语言文本 = 翻译执行器实例.菜单翻译(元素.innerText);
    let 标题文本 = 翻译执行器实例.菜单翻译(元素.title);
    if (标题文本) 元素.title = 标题文本;
    if (!目标语言文本) {
      if (元素.nodeName === "INPUT" && 元素.type === "button") {
        目标语言文本 = 翻译执行器实例.菜单翻译(元素.value);
        if (!目标语言文本) continue;
        元素.value = 目标语言文本;
      }
      continue;
    }
    翻译执行器实例.替换文本(元素);
  }
}

/**
 * 设置搜索框观察者
 */
function 设置搜索框观察者() {
  const 搜索观察者 = 观察者工厂(document.querySelector(".litegraph"), (变更列表, 观察者实例) => {
    // 存储搜索框观察者的引用
    if (!观察者实例.搜索框观察者列表) {
      观察者实例.搜索框观察者列表 = [];
    }
    
    for (let 变更 of 变更列表) {
      // 清理旧的搜索框观察者
      if (变更.removedNodes.length > 0 && 观察者实例.搜索框观察者列表.length > 0) {
        观察者实例.搜索框观察者列表.forEach(观察者 => {
          if (观察者 && typeof 观察者.disconnect === 'function') {
            观察者.disconnect();
          }
        });
        观察者实例.搜索框观察者列表 = [];
        continue;
      }
      
      // 处理新添加的搜索框
      for (const 搜索框 of 变更.addedNodes) {
        if (!搜索框 || !搜索框.querySelector) continue;
        const 助手元素 = 搜索框.querySelector(".helper");
        if (!助手元素) continue;
        
        // 观察搜索助手内容变化
        const 助手观察者 = 观察者工厂(助手元素, (变更列表) => {
          for (let 变更 of 变更列表) {
            for (const 项目 of 变更.addedNodes) {
              if (项目.innerText && 翻译执行器实例.翻译数据.节点[项目.innerText]) {
                项目.innerText = 翻译执行器实例.翻译数据.节点[项目.innerText]["标题"] || 项目.innerText;
              }
            }
          }
        });
        
        if (助手观察者) {
          观察者实例.搜索框观察者列表.push(助手观察者);
        }
        
        // 翻译现有搜索项
        for (let 项目 of 助手元素.querySelectorAll(".lite-search-item")) {
          if (项目.innerText && 翻译执行器实例.翻译数据.节点[项目.innerText]) {
            项目.innerText = 翻译执行器实例.翻译数据.节点[项目.innerText]["标题"] || 项目.innerText;
          }
        }
      }
    }
  });
  
  if (搜索观察者) {
    翻译执行器实例.观察者列表.push(搜索观察者);
  }
}