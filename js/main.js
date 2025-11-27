import { app } from "../../../scripts/app.js";
import { $el } from "../../../scripts/ui.js";
import { applyMenuTranslation, observeFactory } from "./MenuTranslate.js";
import {
  containsChineseCharacters,
  isAlreadyTranslated,
  nativeTranslatedSettings,
  isTranslationEnabled,
  toggleTranslation,
  initConfig,
  error
} from "./utils.js";

export class TUtils {
  static T = {
    菜单: {},
    节点: {},
    节点分类: {},
  };
  
  static async 同步翻译(完成回调 = () => {}) {
    try {
      if (!isTranslationEnabled()) {
        // 如果翻译被禁用，清空翻译数据并直接返回
        TUtils.T = {
          菜单: {},
          节点: {},
          节点分类: {},
        };
        完成回调();
        return;
      }
      
      try {
        const response = await fetch("./translation/get_translation", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: `locale=zh-CN`
        });
        
        if (!response.ok) {
          throw new Error(`请求翻译数据失败: ${response.status} ${response.statusText}`);
        }
        
        const resp = await response.json();
        for (var key in TUtils.T) {
          if (key in resp) TUtils.T[key] = resp[key];
          else TUtils.T[key] = {};
        }
        
        const isComfyUI中文原生 = document.documentElement.lang === 'zh-CN';
        
        if (isComfyUI中文原生) {
          const 原始菜单 = TUtils.T.菜单 || {};
          TUtils.T.菜单 = {};
          for (const key in 原始菜单) {
            if (!nativeTranslatedSettings.includes(key) && 
                !nativeTranslatedSettings.includes(原始菜单[key]) &&
                !containsChineseCharacters(key)) {
              TUtils.T.菜单[key] = 原始菜单[key];
            }
          }
        } else {
          // 将节点分类合并到菜单中 
          TUtils.T.菜单 = Object.assign(TUtils.T.菜单 || {}, TUtils.T.节点分类 || {});
        }
        
        // 提取节点中key到菜单
        for (let key in TUtils.T.节点) {
          let 节点 = TUtils.T.节点[key];
          if(节点 && 节点["标题"]) {
            TUtils.T.菜单 = TUtils.T.菜单 || {};
            TUtils.T.菜单[key] = 节点["标题"] || key;
          }
        }
        
      } catch (e) {
        error("获取翻译数据失败:", e);
      }
      
      完成回调();
    } catch (err) {
      error("同步翻译过程出错:", err);
      完成回调();
    }
  }

  static 增强绘制节点控件() {
    try {
      let 原始绘制节点控件 = LGraphCanvas.prototype.drawNodeWidgets;
      LGraphCanvas.prototype.drawNodeWidgets = function (节点, 位置Y, 上下文, 激活的控件) {
        if (!节点.widgets || !节点.widgets.length) {
          return 0;
        }
        const 控件列表 = 节点.widgets.filter((w) => w.type === "slider");
        控件列表.forEach((控件) => {
          控件._原始标签 = 控件.label;
          const 精度 = 控件.options.precision != null ? 控件.options.precision : 3;
          控件.label = (控件.label || 控件.name) + ": " + Number(控件.value).toFixed(精度).toString();
        });
        let 结果;
        try {
          结果 = 原始绘制节点控件.call(this, 节点, 位置Y, 上下文, 激活的控件);
        } finally {
          控件列表.forEach((控件) => {
            控件.label = 控件._原始标签;
            delete 控件._原始标签;
          });
        }
        return 结果;
      };
    } catch (e) {
      error("增强节点控件绘制失败:", e);
    }
  }

  static 应用节点类型翻译扩展(节点名称) {
    try {
      let 节点翻译 = this.T.节点;
      var 节点类型 = LiteGraph.registered_node_types[节点名称];
      if (!节点类型) return;
      
      let 类类型 = 节点类型.comfyClass ? 节点类型.comfyClass : 节点类型.type;
      if (节点翻译.hasOwnProperty(类类型)) {
        const 有原生翻译 = 节点类型.title && containsChineseCharacters(节点类型.title);
        if (!有原生翻译 && 节点翻译[类类型]["标题"]) {
          节点类型.title = 节点翻译[类类型]["标题"];
        }
      }
    } catch (e) {
      error(`为节点类型 ${节点名称} 应用翻译失败:`, e);
    }
  }

  static 应用Vue节点显示名称翻译(节点定义) {
    try {
      const 节点翻译 = TUtils.T.节点;
      const 类类型 = 节点定义.name;
      if (节点翻译.hasOwnProperty(类类型)) {
        const 有原生翻译 = 节点定义.display_name && containsChineseCharacters(节点定义.display_name);
        if (!有原生翻译 && 节点翻译[类类型]["标题"]) {
          节点定义.display_name = 节点翻译[类类型]["标题"];
        }
      }
    } catch (e) {
      error(`为Vue节点 ${节点定义?.name} 应用显示名称翻译失败:`, e);
    }
  }

  static 应用Vue节点翻译(节点定义) {
    try {
      const 分类翻译 = TUtils.T.节点分类;
      if (!节点定义.category) return;
      const 分类数组 = 节点定义.category.split("/");
      节点定义.category = 分类数组.map((分类) => 分类翻译?.[分类] || 分类).join("/");
    } catch (e) {
      error(`为Vue节点 ${节点定义?.name} 应用翻译失败:`, e);
    }
  }

  static 应用节点类型翻译(应用实例) {
    try {
      if (!isTranslationEnabled()) return;
      
      for (let 节点名称 in LiteGraph.registered_node_types) {
        this.应用节点类型翻译扩展(节点名称);
      }
    } catch (e) {
      error("应用节点类型翻译失败:", e);
    }
  }

  static 需要翻译(项目) {
    if (!项目 || !项目.hasOwnProperty("name")) return false;
    
    if (isAlreadyTranslated(项目.name, 项目.label)) {
      return false;
    }
    
    if (containsChineseCharacters(项目.name)) {
      return false;
    }
    
    return true;
  }

  static 安全应用翻译(项目, 翻译文本) {
    if (this.需要翻译(项目) && 翻译文本) {
      // 保存原始名称
      if (!项目._原始名称) {
        项目._原始名称 = 项目.name;
      }
      项目.label = 翻译文本;
    }
  }

  // 还原翻译方法
  static 还原原始翻译(项目) {
    if (项目._原始名称) {
      项目.label = 项目._原始名称;
      delete 项目._原始名称;
    } else if (项目.label && 项目.name) {
      // 如果没有保存原始名称，则使用name作为回退
      项目.label = 项目.name;
    }
  }

  static 应用节点翻译(节点) {
    try {
      // 基本验证
      if (!节点) {
        error("应用节点翻译: 节点为空");
        return;
      }
      
      if (!节点.constructor) {
        error("应用节点翻译: 节点构造函数为空");
        return;
      }

      let 键列表 = ["inputs", "outputs", "widgets"];
      let 节点翻译 = this.T.节点;
      let 类类型 = 节点.constructor.comfyClass ? 节点.constructor.comfyClass : 节点.constructor.type;
      
      if (!类类型) {
        error("应用节点翻译: 无法获取节点类型");
        return;
      }

      if (!isTranslationEnabled()) {
        // 如果翻译被禁用，还原所有翻译
        for (let 键 of 键列表) {
          if (!节点.hasOwnProperty(键)) continue;
          if (!节点[键] || !Array.isArray(节点[键])) continue;
          节点[键].forEach((项目) => {
            // 只还原那些确实被我们翻译过的项目（有_原始名称标记的）
            if (项目._原始名称) {
              this.还原原始翻译(项目);
            }
          });
        }
        
        // 还原标题 - 只还原那些确实被我们翻译过的标题
        if (节点._原始标题 && !节点._自定义标题) {
          节点.title = 节点._原始标题;
          节点.constructor.title = 节点._原始标题;
          delete 节点._原始标题;
        }
        return;
      }
      
      if (!节点翻译 || !节点翻译.hasOwnProperty(类类型)) return;
      
      var 翻译数据 = 节点翻译[类类型];
      if (!翻译数据) return;
      
      for (let 键 of 键列表) {
        if (!翻译数据.hasOwnProperty(键)) continue;
        if (!节点.hasOwnProperty(键)) continue;
        if (!节点[键] || !Array.isArray(节点[键])) continue;
        
        节点[键].forEach((项目) => {
          if (!项目 || !项目.name) return;
          if (项目.name in 翻译数据[键]) {
            // 检查是否有原生翻译
            const 有原生翻译 = 项目.label && containsChineseCharacters(项目.label) && !项目._原始名称;
            
            // 如果没有原生翻译，才应用我们的翻译
            if (!有原生翻译) {
              this.安全应用翻译(项目, 翻译数据[键][项目.name]);
            }
          }
        });
      }
      
      if (翻译数据.hasOwnProperty("标题")) {
        const 有原生翻译 = 节点.title && containsChineseCharacters(节点.title);
        const 是自定义标题 = 节点._自定义标题 || 
          (节点.title && 节点.title !== (节点.constructor.comfyClass || 节点.constructor.type) && 节点.title !== 翻译数据["标题"]);
        
        if (!是自定义标题 && !有原生翻译) {
          // 保存原始标题
          if (!节点._原始标题) {
            节点._原始标题 = 节点.constructor.comfyClass || 节点.constructor.type;
          }
          节点.title = 翻译数据["标题"];
          节点.constructor.title = 翻译数据["标题"];
        }
      }

      // 转换控件到输入时需要刷新socket信息
      let 原始添加输入 = 节点.addInput;
      节点.addInput = function (名称, 类型, 额外信息) {
        var 旧输入列表 = [];
        if (this.inputs && Array.isArray(this.inputs)) {
          this.inputs.forEach((输入) => 旧输入列表.push(输入.name));
        }
        var 结果 = 原始添加输入.apply(this, arguments);
        if (this.inputs && Array.isArray(this.inputs)) {
          this.inputs.forEach((输入) => {
            if (旧输入列表.includes(输入.name)) return;
            if (翻译数据["widgets"] && 输入.widget?.name in 翻译数据["widgets"]) {
              TUtils.安全应用翻译(输入, 翻译数据["widgets"][输入.widget?.name]);
            }
          });
        }
        return 结果;
      };

      let 原始输入添加 = 节点.onInputAdded;
      节点.onInputAdded = function (插槽) {
        let 结果;
        if (原始输入添加) {
          结果 = 原始输入添加.apply(this, arguments);
        }
        let 翻译数据 = TUtils.T.节点[this.comfyClass];
        if (翻译数据?.["widgets"] && 插槽.name in 翻译数据["widgets"]) {
          if (TUtils.需要翻译(插槽)) {
            插槽.localized_name = 翻译数据["widgets"][插槽.name];
          }
        }
        return 结果;
      };
    } catch (e) {
      error(`为节点 ${节点?.title || '未知'} 应用翻译失败:`, e);
    }
  }

  static 应用节点描述翻译(节点类型, 节点数据, 应用实例) {
    try {
      // 如果翻译被禁用，直接返回
      if (!isTranslationEnabled()) {
        return;
      }
      
      let 节点翻译 = this.T.节点;
      var 翻译数据 = 节点翻译[节点类型.comfyClass];
      if (翻译数据?.["描述"]) {
        节点数据.description = 翻译数据["描述"];
      }

      if (翻译数据) {
        var 节点输入翻译 = 翻译数据["inputs"] || {};
        var 节点控件翻译 = 翻译数据["widgets"] || {};
        for (let 输入类型 in 节点数据.input) {
          for (let socket名称 in 节点数据.input[输入类型]) {
            let 输入 = 节点数据.input[输入类型][socket名称];
            if (输入[1] === undefined || !输入[1].tooltip) continue;
            var 提示文本 = 输入[1].tooltip;
            var 翻译提示 = 节点输入翻译[提示文本] || 节点控件翻译[提示文本] || 提示文本;
            输入[1].tooltip = 翻译提示;
          }
        }
        
        var 节点输出翻译 = 翻译数据["outputs"] || {};
        for (var i = 0; i < (节点数据.output_tooltips || []).length; i++) {
          var 提示文本 = 节点数据.output_tooltips[i];
          var 翻译提示 = 节点输出翻译[提示文本] || 提示文本;
          节点数据.output_tooltips[i] = 翻译提示;
        }
      }
    } catch (e) {
      error(`为节点 ${节点类型?.comfyClass || '未知'} 应用描述翻译失败:`, e);
    }
  }

  static 应用菜单翻译(应用实例) {
    try {
      if (!isTranslationEnabled()) return;
      
      applyMenuTranslation(TUtils.T);
      
      // 队列大小单独处理
      const 拖拽手柄 = 应用实例.ui.menuContainer.querySelector(".drag-handle");
      if (拖拽手柄 && 拖拽手柄.childNodes[1]) {
        observeFactory(拖拽手柄.childNodes[1], (变更列表, 观察者) => {
          for (let 变更 of 变更列表) {
            for (let 节点 of 变更.addedNodes) {
              var 匹配 = 节点.data?.match(/(Queue size:) (\w+)/);
              if (匹配?.length == 3) {
                const 翻译文本 = TUtils.T.菜单[匹配[1]] ? TUtils.T.菜单[匹配[1]] : 匹配[1];
                节点.data = 翻译文本 + " " + 匹配[2];
              }
            }
          }
        });
      }
    } catch (e) {
      error("应用菜单翻译失败:", e);
    }
  }

  static 应用上下文菜单翻译(应用实例) {
    try {
      if (!isTranslationEnabled()) return;
      
      // 右键上下文菜单
      var 原始函数 = LGraphCanvas.prototype.getCanvasMenuOptions;
      LGraphCanvas.prototype.getCanvasMenuOptions = function () {
        var 结果 = 原始函数.apply(this, arguments);
        let 菜单翻译 = TUtils.T.菜单;
        for (let 项目 of 结果) {
          if (项目 == null || !项目.hasOwnProperty("content")) continue;
          if (项目.content in 菜单翻译) {
            项目.content = 菜单翻译[项目.content];
          }
        }
        return 结果;
      };
      
      const 原始上下文菜单 = LiteGraph.ContextMenu;
      LiteGraph.ContextMenu = function (值列表, 选项) {
        if (选项?.hasOwnProperty("title") && 选项.title in TUtils.T.节点) {
          选项.title = TUtils.T.节点[选项.title]["标题"] || 选项.title;
        }
        
        var 菜单翻译 = TUtils.T.菜单;
        var 节点翻译 = TUtils.T.节点;
        var 输入正则 = /Convert (.*) to input/;
        var 控件正则 = /Convert (.*) to widget/;
        var 转换文本 = 菜单翻译["Convert "] || "Convert ";
        var 到输入文本 = 菜单翻译[" to input"] || " to input";
        var 到控件文本 = 菜单翻译[" to widget"] || " to widget";
        
        for (let 值 of 值列表) {
          if (值 == null || !值.hasOwnProperty("content")) continue;
          
          if (值.value in 节点翻译) {
            值.content = 节点翻译[值.value]["标题"] || 值.content;
            continue;
          }
          
          if (值.content in 菜单翻译) {
            值.content = 菜单翻译[值.content];
            continue;
          }
          
          var 额外信息 = 选项.extra || 选项.parentMenu?.options?.extra;
          
          var 输入匹配 = 值.content?.match(输入正则);
          if (输入匹配) {
            var 匹配项 = 输入匹配[1];
            额外信息?.inputs?.find((输入) => {
              if (输入.name != 匹配项) return false;
              匹配项 = 输入.label ? 输入.label : 输入.name;
            });
            额外信息?.widgets?.find((控件) => {
              if (控件.name != 匹配项) return false;
              匹配项 = 控件.label ? 控件.label : 控件.name;
            });
            值.content = 转换文本 + 匹配项 + 到输入文本;
            continue;
          }
          
          var 控件匹配 = 值.content?.match(控件正则);
          if (控件匹配) {
            var 匹配项 = 控件匹配[1];
            额外信息?.inputs?.find((输入) => {
              if (输入.name != 匹配项) return false;
              匹配项 = 输入.label ? 输入.label : 输入.name;
            });
            额外信息?.widgets?.find((控件) => {
              if (控件.name != 匹配项) return false;
              匹配项 = 控件.label ? 控件.label : 控件.name;
            });
            值.content = 转换文本 + 匹配项 + 到控件文本;
            continue;
          }
        }

        const 上下文 = 原始上下文菜单.call(this, 值列表, 选项);
        return 上下文;
      };
      LiteGraph.ContextMenu.prototype = 原始上下文菜单.prototype;
    } catch (e) {
      error("应用上下文菜单翻译失败:", e);
    }
  }

  static 添加注册节点定义回调(应用实例) {
    try {
      const 原始函数 = 应用实例.registerNodeDef;
      应用实例.registerNodeDef = async function (节点ID, 节点数据) {
        var 结果 = 原始函数.apply(this, arguments);
        结果.then(() => {
          TUtils.应用节点类型翻译扩展(节点ID);
        });
        return 结果;
      };
    } catch (e) {
      error("添加节点定义注册回调失败:", e);
    }
  }

  static 添加面板按钮(应用实例) {
    try {
      if(document.getElementById("切换翻译按钮")) return;
      
      const 翻译已启用 = isTranslationEnabled();
      
      // 创建样式元素，添加按钮动画效果
      const 样式元素 = document.createElement('style');
      样式元素.textContent = `
        @keyframes 流动效果 {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }
        
        .翻译激活状态 {
          background: linear-gradient(90deg, #e6a919, #f4d03f, #f9e79f, #f4d03f, #e6a919);
          background-size: 300% 100%;
          color: #333;
          border: none;
          animation: 流动效果 5s ease infinite;
          text-shadow: 0 1px 1px rgba(0,0,0,0.1);
          box-shadow: 0 0 5px rgba(244, 208, 63, 0.5);
          transition: all 0.3s ease;
        }
        
        .翻译未激活状态 {
          background: linear-gradient(90deg, #1a5276, #2980b9, #3498db, #2980b9, #1a5276);
          background-size: 300% 100%;
          color: white;
          border: none;
          animation: 流动效果 7s ease infinite;
          box-shadow: 0 0 5px rgba(52, 152, 219, 0.5);
          transition: all 0.3s ease;
        }
        
        .翻译按钮:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(0,0,0,0.2);
          cursor: pointer;
        }

        .翻译按钮 {
          cursor: pointer;
        }
      `;
      document.head.appendChild(样式元素);
      
      // 添加旧版UI的切换按钮
      if(document.querySelector(".comfy-menu") && !document.getElementById("切换翻译按钮")) {
        应用实例.ui.menuContainer.appendChild(
          $el("button.翻译按钮", {
            id: "切换翻译按钮",
            textContent: 翻译已启用 ? "附加翻译" : "官方实现",
            className: 翻译已启用 ? "翻译按钮 翻译激活状态" : "翻译按钮 翻译未激活状态",
            style: {
              fontWeight: "bold",
              fontSize: "12px",
              padding: "5px 10px",
              borderRadius: "4px",
            },
            title: 翻译已启用 ? "已开启额外附加翻译" : "已使用官方原生翻译",
            onclick: async () => {
              await toggleTranslation();
            },
          })
        );
      }
      
      // 添加新版UI的切换按钮
      try {
        if(window?.comfyAPI?.button?.ComfyButton && window?.comfyAPI?.buttonGroup?.ComfyButtonGroup) {
          var ComfyButtonGroup = window.comfyAPI.buttonGroup.ComfyButtonGroup;
          var ComfyButton = window.comfyAPI.button.ComfyButton;
          
          var 按钮 = new ComfyButton({
            action: async () => {
              await toggleTranslation();
            },
            tooltip: 翻译已启用 ? "已开启额外附加翻译" : "已使用官方原生翻译",
            content: 翻译已启用 ? "附加翻译" : "官方实现",
            classList: "切换翻译按钮"
          });
          
          // 设置按钮样式
          if(按钮.element) {
            按钮.element.classList.add("翻译按钮");
            按钮.element.classList.add(翻译已启用 ? "翻译激活状态" : "翻译未激活状态");
            按钮.element.style.fontWeight = "bold";
            按钮.element.style.fontSize = "12px";
            按钮.element.style.padding = "5px 10px";
            按钮.element.style.borderRadius = "4px";
          }
          
          var 按钮组 = new ComfyButtonGroup(按钮.element);
          if(应用实例.menu?.settingsGroup?.element) {
            应用实例.menu.settingsGroup.element.before(按钮组.element);
          }
        }
      } catch(e) {
        error("添加新版UI语言按钮失败:", e);
      }
    } catch (e) {
      error("添加面板按钮失败:", e);
    }
  }

  static 添加节点标题监控(应用实例) {
    try {
      if (typeof LGraphNode === 'undefined') {
        error("LGraphNode未定义，无法设置标题监听");
        return;
      }
      
      const 原始设置标题 = LGraphNode.prototype.setTitle || function(标题) {
        this.title = 标题;
      };
      
      LGraphNode.prototype.setTitle = function(标题) {
        if (标题 && 标题 !== this.constructor.title) {
          this._自定义标题 = true;
        }
        return 原始设置标题.call(this, 标题);
      };
    } catch (e) {
      error("添加节点标题监听失败:", e);
    }
  }
}

const 扩展 = {
  name: "ComfyUI-Translation.翻译插件",
  
  async init(应用实例) {
    try {
      await initConfig();
      TUtils.增强绘制节点控件();
      await TUtils.同步翻译();
    } catch (e) {
      error("扩展初始化失败:", e);
    }
  },
  
  async setup(应用实例) {
    try {      
      const isComfyUI中文原生 = document.documentElement.lang === 'zh-CN';
      
      TUtils.添加节点标题监控(应用实例);
      
      if (isTranslationEnabled()) {
        TUtils.应用节点类型翻译(应用实例);
        TUtils.应用上下文菜单翻译(应用实例);
        
        if (!isComfyUI中文原生) {
          TUtils.应用菜单翻译(应用实例);
        }
        
        TUtils.添加注册节点定义回调(应用实例);
      }
      
      TUtils.添加面板按钮(应用实例);
    } catch (e) {
      error("扩展设置失败:", e);
    }
  },
  
  async beforeRegisterNodeDef(节点类型, 节点数据, 应用实例) {
    try {
      TUtils.应用节点描述翻译(节点类型, 节点数据, 应用实例);
    } catch (e) {
      error(`注册节点定义前处理失败 (${节点类型?.comfyClass || '未知'}):`, e);
    }
  },
  
  beforeRegisterVueAppNodeDefs(节点定义列表) {
    try {
      // 如果翻译被禁用，直接返回
      if (!isTranslationEnabled()) {
        return;
      }
      
      节点定义列表.forEach(TUtils.应用Vue节点显示名称翻译);
      节点定义列表.forEach(TUtils.应用Vue节点翻译);
    } catch (e) {
      error("注册Vue应用节点定义前处理失败:", e);
    }
  },
  
  loadedGraphNode(节点, 应用实例) {
    try {
      const 原始标题 = 节点.constructor.comfyClass || 节点.constructor.type;
      const 节点翻译 = TUtils.T.节点[原始标题];
      const 翻译标题 = 节点翻译?.标题;
      
      if (节点.title && 
          节点.title !== 原始标题 && 
          节点.title !== 翻译标题) {
        节点._自定义标题 = true;
      }
      
      // 无论翻译是否启用都调用，让方法内部判断
      TUtils.应用节点翻译(节点);
    } catch (e) {
      error(`加载图表节点处理失败 (${节点?.title || '未知'}):`, e);
    }
  },
  
  nodeCreated(节点, 应用实例) {
    try {
      // 无论翻译是否启用都调用，让方法内部判断
      TUtils.应用节点翻译(节点);
    } catch (e) {
      error(`创建节点处理失败 (${节点?.title || '未知'}):`, e);
    }
  },
};

应用实例.registerExtension(扩展);