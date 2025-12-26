/**
 * ComfyUI-Chinese-Translation 主逻辑模块
 * 负责翻译功能的核心实现，包括节点翻译、菜单翻译、上下文菜单翻译等
 * 管理翻译数据的同步和应用
 */

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

/**
 * 翻译工具类
 * 提供各种翻译相关的静态方法
 */
export class TUtils {
  // 翻译数据存储对象
  static T = {
    Menu: {},
    Nodes: {},
    NodeCategory: {},
  };

  /**
   * 同步翻译数据
   * 从服务器获取最新的翻译数据并处理
   * @param {Function} OnFinished 完成回调函数
   */
  static async syncTranslation(OnFinished = () => {}) {
    try {
      if (!isTranslationEnabled()) {
        // 如果翻译被禁用，清空翻译数据并直接返回
        TUtils.T = {
          Menu: {},
          Nodes: {},
          NodeCategory: {},
        };
        OnFinished();
        return;
      }
      
      try {
        const response = await fetch("./translation_node/get_translation", {
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
        
        const isComfyUIChineseNative = document.documentElement.lang === 'zh-CN';
        
        if (isComfyUIChineseNative) {
          const originalMenu = TUtils.T.Menu || {};
          TUtils.T.Menu = {};
          for (const key in originalMenu) {
            if (!nativeTranslatedSettings.includes(key) && 
                !nativeTranslatedSettings.includes(originalMenu[key]) &&
                !containsChineseCharacters(key)) {
              TUtils.T.Menu[key] = originalMenu[key];
            }
          }
        } else {
          // 将NodeCategory合并到Menu中 
          TUtils.T.Menu = Object.assign(TUtils.T.Menu || {}, TUtils.T.NodeCategory || {});
        }
        
        // 提取 Node 中 key 到 Menu
        for (let key in TUtils.T.Nodes) {
          let node = TUtils.T.Nodes[key];
          if(node && node["title"]) {
            TUtils.T.Menu = TUtils.T.Menu || {};
            TUtils.T.Menu[key] = node["title"] || key;
          }
        }
        
      } catch (e) {
        error("获取翻译数据失败:", e);
      }
      
      OnFinished();
    } catch (err) {
      error("同步翻译过程出错:", err);
      OnFinished();
    }
  }

  /**
   * 增强节点小部件绘制功能
   * 修改滑块控件的显示，在拖动时显示精确值
   */
  static enhandeDrawNodeWidgets() {
    try {
      let drawNodeWidgets = LGraphCanvas.prototype.drawNodeWidgets;
      LGraphCanvas.prototype.drawNodeWidgets = function (node, posY, ctx, active_widget) {
        if (!node.widgets || !node.widgets.length) {
          return 0;
        }
        const widgets = node.widgets.filter((w) => w.type === "slider");
        widgets.forEach((widget) => {
          widget._ori_label = widget.label;
          const fixed = widget.options.precision != null ? widget.options.precision : 3;
          widget.label = (widget.label || widget.name) + ": " + Number(widget.value).toFixed(fixed).toString();
        });
        let result;
        try {
          result = drawNodeWidgets.call(this, node, posY, ctx, active_widget);
        } finally {
          widgets.forEach((widget) => {
            widget.label = widget._ori_label;
            delete widget._ori_label;
          });
        }
        return result;
      };
    } catch (e) {
      error("增强节点小部件绘制失败:", e);
    }
  }

  /**
   * 应用节点类型翻译
   * 为特定节点类型应用标题翻译
   * @param {string} nodeName 节点名称
   */
  static applyNodeTypeTranslationEx(nodeName) {
    try {
      let nodesT = this.T.Nodes;
      var nodeType = LiteGraph.registered_node_types[nodeName];
      if (!nodeType) return;
      
      let class_type = nodeType.comfyClass ? nodeType.comfyClass : nodeType.type;
      if (nodesT.hasOwnProperty(class_type)) {
        const hasNativeTranslation = nodeType.title && containsChineseCharacters(nodeType.title);
        if (!hasNativeTranslation && nodesT[class_type]["title"]) {
          nodeType.title = nodesT[class_type]["title"];
        }
      }
    } catch (e) {
      error(`为节点类型 ${nodeName} 应用翻译失败:`, e);
    }
  }

  /**
   * 应用Vue节点显示名称翻译
   * 为Vue组件节点应用显示名称翻译
   * @param {Object} nodeDef 节点定义对象
   */
  static applyVueNodeDisplayNameTranslation(nodeDef) {
    try {
      const nodesT = TUtils.T.Nodes;
      const class_type = nodeDef.name;
      if (nodesT.hasOwnProperty(class_type)) {
        const hasNativeTranslation = nodeDef.display_name && containsChineseCharacters(nodeDef.display_name);
        if (!hasNativeTranslation && nodesT[class_type]["title"]) {
          nodeDef.display_name = nodesT[class_type]["title"];
        }
      }
    } catch (e) {
      error(`为Vue节点 ${nodeDef?.name} 应用显示名称翻译失败:`, e);
    }
  }

  /**
   * 应用Vue节点分类翻译
   * 为Vue组件节点应用分类路径翻译
   * @param {Object} nodeDef 节点定义对象
   */
  static applyVueNodeTranslation(nodeDef) {
    try {
      const catsT = TUtils.T.NodeCategory;
      if (!nodeDef.category) return;
      const catArr = nodeDef.category.split("/");
      nodeDef.category = catArr.map((cat) => catsT?.[cat] || cat).join("/");
    } catch (e) {
      error(`为Vue节点 ${nodeDef?.name} 应用翻译失败:`, e);
    }
  }

  /**
   * 应用所有节点类型翻译
   * 遍历所有注册的节点类型并应用翻译
   * @param {Object} app 应用实例
   */
  static applyNodeTypeTranslation(app) {
    try {
      if (!isTranslationEnabled()) return;
      
      for (let nodeName in LiteGraph.registered_node_types) {
        this.applyNodeTypeTranslationEx(nodeName);
      }
    } catch (e) {
      error("应用节点类型翻译失败:", e);
    }
  }

  /**
   * 检查项目是否需要翻译
   * 判断项目是否已经被翻译或包含中文
   * @param {Object} item 要检查的项目
   * @returns {boolean} 是否需要翻译
   */
  static needsTranslation(item) {
    if (!item || !item.hasOwnProperty("name")) return false;
    
    if (isAlreadyTranslated(item.name, item.label)) {
      return false;
    }
    
    if (containsChineseCharacters(item.name)) {
      return false;
    }
    
    return true;
  }

  /**
   * 安全应用翻译
   * 在确保需要翻译的情况下应用翻译，并保存原始名称
   * @param {Object} item 要翻译的项目
   * @param {string} translation 翻译文本
   */
  static safeApplyTranslation(item, translation) {
    if (this.needsTranslation(item) && translation) {
      // 保存原始名称
      if (!item._original_name) {
        item._original_name = item.name;
      }
      item.label = translation;
    }
  }

  /**
   * 还原原始翻译
   * 将项目的标签还原为原始名称
   * @param {Object} item 要还原的项目
   */
  static restoreOriginalTranslation(item) {
    if (item._original_name) {
      item.label = item._original_name;
      delete item._original_name;
    } else if (item.label && item.name) {
      // 如果没有保存原始名称，则使用name作为fallback
      item.label = item.name;
    }
  }

  /**
   * 应用节点翻译
   * 为单个节点应用输入、输出、小部件和标题的翻译
   * @param {Object} node 节点实例
   */
  static applyNodeTranslation(node) {
    try {
      // 基本验证
      if (!node) {
        error("applyNodeTranslation: 节点为空");
        return;
      }
      
      if (!node.constructor) {
        error("applyNodeTranslation: 节点构造函数为空");
        return;
      }

      let keys = ["inputs", "outputs", "widgets"];
      let nodesT = this.T.Nodes;
      let class_type = node.constructor.comfyClass ? node.constructor.comfyClass : node.constructor.type;
      
      if (!class_type) {
        error("applyNodeTranslation: 无法获取节点类型");
        return;
      }

      if (!isTranslationEnabled()) {
        // 如果翻译被禁用，还原所有翻译
        for (let key of keys) {
          if (!node.hasOwnProperty(key)) continue;
          if (!node[key] || !Array.isArray(node[key])) continue;
          node[key].forEach((item) => {
            // 只还原那些确实被我们翻译过的项目（有_original_name标记的）
            if (item._original_name) {
              this.restoreOriginalTranslation(item);
            }
          });
        }
        
        // 还原标题 - 只还原那些确实被我们翻译过的标题
        if (node._original_title && !node._translation_custom_title) {
          node.title = node._original_title;
          node.constructor.title = node._original_title;
          delete node._original_title;
        }
        return;
      }
      
      if (!nodesT || !nodesT.hasOwnProperty(class_type)) return;
      
      var t = nodesT[class_type];
      if (!t) return;
      
      for (let key of keys) {
        if (!t.hasOwnProperty(key)) continue;
        if (!node.hasOwnProperty(key)) continue;
        if (!node[key] || !Array.isArray(node[key])) continue;
        
        node[key].forEach((item) => {
          if (!item || !item.name) return;
          if (item.name in t[key]) {
            // 检查是否有原生翻译
            const hasNativeTranslation = item.label && containsChineseCharacters(item.label) && !item._original_name;
            
            // 如果没有原生翻译，才应用我们的翻译
            if (!hasNativeTranslation) {
              this.safeApplyTranslation(item, t[key][item.name]);
            }
          }
        });
      }
      
      if (t.hasOwnProperty("title")) {
        const hasNativeTranslation = node.title && containsChineseCharacters(node.title);
        const isCustomizedTitle = node._translation_custom_title || 
          (node.title && node.title !== (node.constructor.comfyClass || node.constructor.type) && node.title !== t["title"]);
        
        if (!isCustomizedTitle && !hasNativeTranslation) {
          // 保存原始标题
          if (!node._original_title) {
            node._original_title = node.constructor.comfyClass || node.constructor.type;
          }
          node.title = t["title"];
          node.constructor.title = t["title"];
        }
      }
      
      // 转换 widget 到 input 时需要刷新socket信息
      let addInput = node.addInput;
      node.addInput = function (name, type, extra_info) {
        var oldInputs = [];
        if (this.inputs && Array.isArray(this.inputs)) {
          this.inputs.forEach((i) => oldInputs.push(i.name));
        }
        var res = addInput.apply(this, arguments);
        if (this.inputs && Array.isArray(this.inputs)) {
          this.inputs.forEach((i) => {
            if (oldInputs.includes(i.name)) return;
            if (t["widgets"] && i.widget?.name in t["widgets"]) {
              TUtils.safeApplyTranslation(i, t["widgets"][i.widget?.name]);
            }
          });
        }
        return res;
      };
      
      let onInputAdded = node.onInputAdded;
      node.onInputAdded = function (slot) {
        let res;
        if (onInputAdded) {
          res = onInputAdded.apply(this, arguments);
        }
        let t = TUtils.T.Nodes[this.comfyClass];
        if (t?.["widgets"] && slot.name in t["widgets"]) {
          if (TUtils.needsTranslation(slot)) {
            slot.localized_name = t["widgets"][slot.name];
          }
        }
        return res;
      };
    } catch (e) {
      error(`为节点 ${node?.title || '未知'} 应用翻译失败:`, e);
    }
  }

  /**
   * 应用节点描述翻译
   * 为节点描述、工具提示等应用翻译
   * @param {Object} nodeType 节点类型
   * @param {Object} nodeData 节点数据
   * @param {Object} app 应用实例
   */
  static applyNodeDescTranslation(nodeType, nodeData, app) {
    try {
      // 如果翻译被禁用，直接返回
      if (!isTranslationEnabled()) {
        return;
      }
      
      let nodesT = this.T.Nodes;
      var t = nodesT[nodeType.comfyClass];
      if (t?.["description"]) {
        nodeData.description = t["description"];
      }

      if (t) {
        var nodeInputT = t["inputs"] || {};
        var nodeWidgetT = t["widgets"] || {};
        for (let itype in nodeData.input) {
          for (let socketname in nodeData.input[itype]) {
            let inp = nodeData.input[itype][socketname];
            if (inp[1] === undefined || !inp[1].tooltip) continue;
            var tooltip = inp[1].tooltip;
            var tooltipT = nodeInputT[tooltip] || nodeWidgetT[tooltip] || tooltip;
            inp[1].tooltip = tooltipT;
          }
        }
        
        var nodeOutputT = t["outputs"] || {};
        for (var i = 0; i < (nodeData.output_tooltips || []).length; i++) {
          var tooltip = nodeData.output_tooltips[i];
          var tooltipT = nodeOutputT[tooltip] || tooltip;
          nodeData.output_tooltips[i] = tooltipT;
        }
      }
    } catch (e) {
      error(`为节点 ${nodeType?.comfyClass || '未知'} 应用描述翻译失败:`, e);
    }
  }

  /**
   * 应用菜单翻译
   * 翻译主界面菜单和队列大小显示
   * @param {Object} app 应用实例
   */
  static applyMenuTranslation(app) {
    try {
      if (!isTranslationEnabled()) return;
      
      applyMenuTranslation(TUtils.T);
      
      // Queue size 单独处理
      const dragHandle = app.ui.menuContainer.querySelector(".drag-handle");
      if (dragHandle && dragHandle.childNodes[1]) {
        observeFactory(dragHandle.childNodes[1], (mutationsList, observer) => {
          for (let mutation of mutationsList) {
            for (let node of mutation.addedNodes) {
              var match = node.data?.match(/(Queue size:) (\w+)/);
              if (match?.length == 3) {
                const t = TUtils.T.Menu[match[1]] ? TUtils.T.Menu[match[1]] : match[1];
                node.data = t + " " + match[2];
              }
            }
          }
        });
      }
    } catch (e) {
      error("应用菜单翻译失败:", e);
    }
  }

  /**
   * 应用上下文菜单翻译
   * 翻译右键菜单和节点上下文菜单
   * @param {Object} app 应用实例
   */
  static applyContextMenuTranslation(app) {
    try {
      if (!isTranslationEnabled()) return;
      
      // 右键上下文菜单
      var f = LGraphCanvas.prototype.getCanvasMenuOptions;
      LGraphCanvas.prototype.getCanvasMenuOptions = function () {
        var res = f.apply(this, arguments);
        let menuT = TUtils.T.Menu;
        for (let item of res) {
          if (item == null || !item.hasOwnProperty("content")) continue;
          if (item.content in menuT) {
            item.content = menuT[item.content];
          }
        }
        return res;
      };
      
      const f2 = LiteGraph.ContextMenu;
      LiteGraph.ContextMenu = function (values, options) {
        if (options?.hasOwnProperty("title") && options.title in TUtils.T.Nodes) {
          options.title = TUtils.T.Nodes[options.title]["title"] || options.title;
        }
        
        var t = TUtils.T.Menu;
        var tN = TUtils.T.Nodes;
        var reInput = /Convert (.*) to input/;
        var reWidget = /Convert (.*) to widget/;
        var cvt = t["Convert "] || "Convert ";
        var tinp = t[" to input"] || " to input";
        var twgt = t[" to widget"] || " to widget";
        
        for (let value of values) {
          if (value == null || !value.hasOwnProperty("content")) continue;
          
          if (value.value in tN) {
            value.content = tN[value.value]["title"] || value.content;
            continue;
          }
          
          if (value.content in t) {
            value.content = t[value.content];
            continue;
          }
          
          var extra_info = options.extra || options.parentMenu?.options?.extra;
          
          var matchInput = value.content?.match(reInput);
          if (matchInput) {
            var match = matchInput[1];
            extra_info?.inputs?.find((i) => {
              if (i.name != match) return false;
              match = i.label ? i.label : i.name;
            });
            extra_info?.widgets?.find((i) => {
              if (i.name != match) return false;
              match = i.label ? i.label : i.name;
            });
            value.content = cvt + match + tinp;
            continue;
          }
          
          var matchWidget = value.content?.match(reWidget);
          if (matchWidget) {
            var match = matchWidget[1];
            extra_info?.inputs?.find((i) => {
              if (i.name != match) return false;
              match = i.label ? i.label : i.name;
            });
            extra_info?.widgets?.find((i) => {
              if (i.name != match) return false;
              match = i.label ? i.label : i.name;
            });
            value.content = cvt + match + twgt;
            continue;
          }
        }

        const ctx = f2.call(this, values, options);
        return ctx;
      };
      LiteGraph.ContextMenu.prototype = f2.prototype;
    } catch (e) {
      error("应用上下文菜单翻译失败:", e);
    }
  }

  /**
   * 添加节点定义注册回调
   * 在节点注册时自动应用翻译
   * @param {Object} app 应用实例
   */
  static addRegisterNodeDefCB(app) {
    try {
      const f = app.registerNodeDef;
      app.registerNodeDef = async function (nodeId, nodeData) {
        var res = f.apply(this, arguments);
        res.then(() => {
          TUtils.applyNodeTypeTranslationEx(nodeId);
        });
        return res;
      };
    } catch (e) {
      error("添加节点定义注册回调失败:", e);
    }
  }

  /**
   * 添加面板按钮
   * 在界面上添加翻译切换按钮
   * @param {Object} app 应用实例
   */
  static addPanelButtons(app) {
    try {
      if(document.getElementById("toggle-translation-button")) return;
      
      const translationEnabled = isTranslationEnabled();
      
      // 创建样式元素，添加按钮动画效果
      const styleElem = document.createElement('style');
      styleElem.textContent = `
        @keyframes flowEffect {
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
        
        .translation-active {
          background: linear-gradient(90deg, #ff0000, #ff8000, #ffff00, #80ff00, #00ff80, #0080ff, #8000ff, #ff0080, #ff0000);
          background-size: 400% 100%;
          color: white;
          border: none;
          animation: flowEffect 8s ease infinite;
          text-shadow: 0 1px 2px rgba(0,0,0,0.7);
          box-shadow: 0 0 8px rgba(255,255,255,0.3);
          transition: all 0.3s ease;
          font-weight: bold;
        }
        
        .translation-inactive {
          background: linear-gradient(90deg, #f0f0f0, #d0d0d0, #b0b0b0, #909090, #707070, #909090, #b0b0b0, #d0d0d0, #f0f0f0);
          background-size: 300% 100%;
          color: #333;
          border: none;
          animation: flowEffect 6s ease infinite;
          box-shadow: 0 0 5px rgba(0,0,0,0.2);
          transition: all 0.3s ease;
          font-weight: bold;
        }
        
        .translation-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 12px rgba(0,0,0,0.3);
          cursor: pointer;
        }

        .translation-btn {
          cursor: pointer;
          border-radius: 6px;
          padding: 6px 12px;
          font-size: 12px;
          border: 1px solid rgba(0,0,0,0.1);
        }
      `;
      document.head.appendChild(styleElem);
      
      // 添加旧版UI的切换按钮
      if(document.querySelector(".comfy-menu") && !document.getElementById("toggle-translation-button")) {
        app.ui.menuContainer.appendChild(
          $el("button.translation-btn", {
            id: "toggle-translation-button",
            textContent: translationEnabled ? "汉化已开启" : "汉化已关闭",
            className: translationEnabled ? "translation-btn translation-active" : "translation-btn translation-inactive",
            style: {
              fontWeight: "bold",
              fontSize: "12px",
              padding: "6px 12px",
              borderRadius: "6px",
              margin: "2px",
            },
            title: translationEnabled ? "已开启汉化效果" : "已使用原生语言",
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
          
          var btn = new ComfyButton({
            action: async () => {
              await toggleTranslation();
            },
            tooltip: translationEnabled ? "已开启汉化效果" : "已使用原生语言",
            content: translationEnabled ? "汉化已开启" : "汉化已关闭",
            classList: "toggle-translation-button"
          });
          
          // 设置按钮样式
          if(btn.element) {
            btn.element.classList.add("translation-btn");
            btn.element.classList.add(translationEnabled ? "translation-active" : "translation-inactive");
            btn.element.style.fontWeight = "bold";
            btn.element.style.fontSize = "12px";
            btn.element.style.padding = "6px 12px";
            btn.element.style.borderRadius = "6px";
            btn.element.style.margin = "2px";
          }
          
          var group = new ComfyButtonGroup(btn.element);
          if(app.menu?.settingsGroup?.element) {
            app.menu.settingsGroup.element.before(group.element);
          }
        }
      } catch(e) {
        error("添加新版UI语言按钮失败:", e);
      }
    } catch (e) {
      error("添加面板按钮失败:", e);
    }
  }

  /**
   * 添加节点标题监控
   * 监控节点标题变化，标记自定义标题
   * @param {Object} app 应用实例
   */
  static addNodeTitleMonitoring(app) {
    try {
      if (typeof LGraphNode === 'undefined') {
        error("LGraphNode未定义，无法设置标题监听");
        return;
      }
      
      const originalSetTitle = LGraphNode.prototype.setTitle || function(title) {
        this.title = title;
      };
      
      LGraphNode.prototype.setTitle = function(title) {
        if (title && title !== this.constructor.title) {
          this._translation_custom_title = true;
        }
        return originalSetTitle.call(this, title);
      };
    } catch (e) {
      error("添加节点标题监听失败:", e);
    }
  }
}

/**
 * ComfyUI 扩展定义
 * 注册翻译插件的各种生命周期回调
 */
const ext = {
  name: "ComfyUI.TranslationNode",
  
  /**
   * 初始化扩展
   * 加载配置并同步翻译数据
   */
  async init(app) {
    try {
      await initConfig();
      TUtils.enhandeDrawNodeWidgets();
      await TUtils.syncTranslation();
    } catch (e) {
      error("扩展初始化失败:", e);
    }
  },
  
  /**
   * 设置扩展
   * 应用各种翻译并添加界面元素
   */
  async setup(app) {
    try {      
      const isComfyUIChineseNative = document.documentElement.lang === 'zh-CN';
      
      TUtils.addNodeTitleMonitoring(app);
      
      if (isTranslationEnabled()) {
        TUtils.applyNodeTypeTranslation(app);
        TUtils.applyContextMenuTranslation(app);
        
        if (!isComfyUIChineseNative) {
          TUtils.applyMenuTranslation(app);
        }
        
        TUtils.addRegisterNodeDefCB(app);
      }
      
      TUtils.addPanelButtons(app);
    } catch (e) {
      error("扩展设置失败:", e);
    }
  },
  
  /**
   * 注册节点定义前处理
   * 应用节点描述和工具提示翻译
   */
  async beforeRegisterNodeDef(nodeType, nodeData, app) {
    try {
      TUtils.applyNodeDescTranslation(nodeType, nodeData, app);
    } catch (e) {
      error(`注册节点定义前处理失败 (${nodeType?.comfyClass || '未知'}):`, e);
    }
  },
  
  /**
   * 注册Vue应用节点定义前处理
   * 应用Vue节点的显示名称和分类翻译
   */
  beforeRegisterVueAppNodeDefs(nodeDefs) {
    try {
      // 如果翻译被禁用，直接返回
      if (!isTranslationEnabled()) {
        return;
      }
      
      nodeDefs.forEach(TUtils.applyVueNodeDisplayNameTranslation);
      nodeDefs.forEach(TUtils.applyVueNodeTranslation);
    } catch (e) {
      error("注册Vue应用节点定义前处理失败:", e);
    }
  },
  
  /**
   * 加载图表节点处理
   * 为已加载的图表节点应用翻译
   */
  loadedGraphNode(node, app) {
    try {
      const originalTitle = node.constructor.comfyClass || node.constructor.type;
      const nodeT = TUtils.T.Nodes[originalTitle];
      const translatedTitle = nodeT?.title;
      
      if (node.title && 
          node.title !== originalTitle && 
          node.title !== translatedTitle) {
        node._translation_custom_title = true;
      }
      
      // 无论翻译是否启用都调用，让方法内部判断
      TUtils.applyNodeTranslation(node);
    } catch (e) {
      error(`加载图表节点处理失败 (${node?.title || '未知'}):`, e);
    }
  },
  
  /**
   * 创建节点处理
   * 为新创建的节点应用翻译
   */
  nodeCreated(node, app) {
    try {
      // 无论翻译是否启用都调用，让方法内部判断
      TUtils.applyNodeTranslation(node);
    } catch (e) {
      error(`创建节点处理失败 (${node?.title || '未知'}):`, e);
    }
  },
};

// 注册扩展到ComfyUI
app.registerExtension(ext);