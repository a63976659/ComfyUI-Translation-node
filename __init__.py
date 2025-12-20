"""
ComfyUI-Chinese-Translation 插件主初始化文件
主要功能：提供翻译服务的后端API，管理翻译配置和资源文件
版本: 1
"""

import os
import json
import platform
import sys
import shutil
import atexit
import server
import folder_paths
from aiohttp import web
from pathlib import Path

# 插件版本信息
VERSION = "1"
# 插件名称
ADDON_NAME = "ComfyUI-Chinese-Translation"
# ComfyUI 主程序路径
COMFY_PATH = Path(folder_paths.__file__).parent
# 当前插件路径
CUR_PATH = Path(__file__).parent

def load_config():
    """
    读取插件配置文件
    返回: 翻译是否启用的布尔值
    """
    config_path = CUR_PATH.joinpath("config.json")
    if config_path.exists():
        try:
            config_data = try_get_json(config_path)
            return config_data.get("translation_enabled", True)
        except Exception:
            return True
    return True

# 全局配置变量 - 存储翻译启用状态
TRANSLATION_ENABLED = load_config()


def try_get_json(path: Path):
    """
    尝试使用不同编码读取JSON文件
    参数: path - 文件路径
    返回: 解析后的JSON数据字典
    """
    for coding in ["utf-8", "gbk"]:
        try:
            return json.loads(path.read_text(encoding=coding))
        except Exception:
            continue
    return {}


def get_nodes_translation(locale):
    """
    获取指定语言的节点翻译数据
    参数: locale - 语言代码 (如: zh-CN, en_US)
    返回: 节点翻译字典
    """
    path = CUR_PATH.joinpath(locale, "Nodes")
    if not path.exists():
        path = CUR_PATH.joinpath("en_US")
    if not path.exists():
        return {}
    translations = {}
    for jpath in path.glob("*.json"):
        translations.update(try_get_json(jpath))
    return translations


def get_category_translation(locale):
    """
    获取指定语言的节点分类翻译数据
    参数: locale - 语言代码
    返回: 分类翻译字典
    """
    cats = {}
    for cat_json in CUR_PATH.joinpath(locale, "Categories").glob("*.json"):
        cats.update(try_get_json(cat_json))
    path = CUR_PATH.joinpath(locale, "NodeCategory.json")
    if not path.exists():
        path = CUR_PATH.joinpath("en_US", "NodeCategory.json")
    if path.exists():
        cats.update(try_get_json(path))
    return cats


def get_menu_translation(locale):
    """
    获取指定语言的菜单翻译数据
    参数: locale - 语言代码
    返回: 菜单翻译字典
    """
    menus = {}
    for menu_json in CUR_PATH.joinpath(locale, "Menus").glob("*.json"):
        menus.update(try_get_json(menu_json))
    path = CUR_PATH.joinpath(locale, "Menu.json")
    if not path.exists():
        path = CUR_PATH.joinpath("en_US", "Menu.json")
    if path.exists():
        menus.update(try_get_json(path))
    return menus


def compile_translation(locale):
    """
    编译指定语言的完整翻译数据
    参数: locale - 语言代码
    返回: 包含节点、分类、菜单翻译的JSON字符串
    """
    nodes_translation = get_nodes_translation(locale)
    node_category_translation = get_category_translation(locale)
    menu_translation = get_menu_translation(locale)

    return json.dumps({
        "Nodes": nodes_translation,
        "NodeCategory": node_category_translation,
        "Menu": menu_translation
    }, ensure_ascii=False)


def compress_json(data, method="gzip"):
    """
    压缩JSON数据
    参数: data - 要压缩的数据, method - 压缩方法
    返回: 压缩后的数据
    """
    if method == "gzip":
        import gzip
        return gzip.compress(data.encode("utf-8"))
    return data


@server.PromptServer.instance.routes.post("/translation_node/get_translation")
async def get_translation(request: web.Request):
    """
    API端点: 获取翻译数据
    处理前端请求，返回指定语言的翻译数据
    """
    post = await request.post()
    locale = post.get("locale", "en_US")
    accept_encoding = request.headers.get("Accept-Encoding", "")
    json_data = "{}"
    headers = {}

    # 实时检查配置文件中的翻译开关
    current_enabled = load_config()
    if not current_enabled:
        return web.Response(status=200, body=json_data, headers=headers)

    try:
        json_data = compile_translation(locale)
        if "gzip" in accept_encoding:
            json_data = compress_json(json_data, method="gzip")
            headers["Content-Encoding"] = "gzip"
    except Exception:
        pass

    return web.Response(status=200, body=json_data, headers=headers)


@server.PromptServer.instance.routes.get("/translation_node/get_config")
async def get_config(request: web.Request):
    """
    API端点: 获取插件配置
    返回当前的翻译启用状态
    """
    current_enabled = load_config()
    config_data = {"translation_enabled": current_enabled}
    return web.Response(status=200, body=json.dumps(config_data), headers={"Content-Type": "application/json"})


@server.PromptServer.instance.routes.post("/translation_node/set_config")
async def set_config(request: web.Request):
    """
    API端点: 设置插件配置
    更新翻译启用状态并保存到配置文件
    """
    try:
        post = await request.post()
        enabled = post.get("translation_enabled", "true").lower() == "true"

        # 更新配置文件
        config_path = CUR_PATH.joinpath("config.json")
        config_data = {"translation_enabled": enabled}

        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(config_data, f, indent=2, ensure_ascii=False)

        # 更新全局变量
        global TRANSLATION_ENABLED
        TRANSLATION_ENABLED = enabled

        return web.Response(status=200, body=json.dumps({"success": True, "translation_enabled": enabled}),
                          headers={"Content-Type": "application/json"})
    except Exception as e:
        return web.Response(status=500, body=json.dumps({"success": False, "error": str(e)}),
                          headers={"Content-Type": "application/json"})


def rmtree(path: Path):
    """
    递归删除目录或文件
    参数: path - 要删除的路径
    """
    if not path.exists():
        return
    if Path(path.resolve()).as_posix() != path.as_posix():
        path.unlink()
        return
    if path.is_file():
        path.unlink()
    elif path.is_dir():
        if path.name == ".git":
            if platform.system() == "darwin":
                from subprocess import call
                call(['rm', '-rf', path.as_posix()])
            elif platform.system() == "Windows":
                os.system(f'rd/s/q "{path.as_posix()}"')
            return
        for child in path.iterdir():
            rmtree(child)
        try:
            path.rmdir()
        except BaseException:
            pass


def register():
    """
    注册插件到ComfyUI系统
    创建符号链接或复制文件到web扩展目录
    """
    import nodes
    translation_node_ext_path = COMFY_PATH.joinpath("web", "extensions", ADDON_NAME)
    if hasattr(nodes, "EXTENSION_WEB_DIRS"):
        rmtree(translation_node_ext_path)
        return
    
    try:
        if os.name == "nt":
            try:
                import _winapi
                _winapi.CreateJunction(CUR_PATH.as_posix(), translation_node_ext_path.as_posix())
            except WindowsError:
                shutil.copytree(CUR_PATH.as_posix(), translation_node_ext_path.as_posix(), ignore=shutil.ignore_patterns(".git"))
        else:
            shutil.copytree(CUR_PATH.as_posix(), translation_node_ext_path.as_posix(), ignore=shutil.ignore_patterns(".git"))
    except Exception:
        pass


def unregister():
    """
    注销插件
    清理web扩展目录中的插件文件
    """
    translation_node_ext_path = COMFY_PATH.joinpath("web", "extensions", ADDON_NAME)
    try:
        rmtree(translation_node_ext_path)
    except BaseException:
        pass


# 注册插件
register()
# 注册退出时的清理函数
atexit.register(unregister)

# ComfyUI 插件标准导出
NODE_CLASS_MAPPINGS = {}
WEB_DIRECTORY = "./js"

__all__ = ["NODE_CLASS_MAPPINGS", "WEB_DIRECTORY"]
__version__ = VERSION