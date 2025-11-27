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

版本号 = "1.9.0"
插件名称 = "ComfyUI-Translation"
COMFY路径 = Path(folder_paths.__file__).parent
当前路径 = Path(__file__).parent

# 读取配置文件
def 加载配置():
    配置路径 = 当前路径.joinpath("config.json")
    if 配置路径.exists():
        try:
            配置数据 = 尝试读取json(配置路径)
            return 配置数据.get("translation_enabled", True)
        except Exception:
            return True
    return True

# 全局配置变量
翻译启用状态 = 加载配置()


def 尝试读取json(路径: Path):
    for 编码 in ["utf-8", "gbk"]:
        try:
            return json.loads(路径.read_text(encoding=编码))
        except Exception:
            continue
    return {}


def 获取节点翻译(语言环境):
    路径 = 当前路径.joinpath(语言环境, "Nodes")
    if not 路径.exists():
        路径 = 当前路径.joinpath("en_US")
    if not 路径.exists():
        return {}
    翻译数据 = {}
    for json路径 in 路径.glob("*.json"):
        翻译数据.update(尝试读取json(json路径))
    return 翻译数据


def 获取分类翻译(语言环境):
    分类数据 = {}
    for 分类json in 当前路径.joinpath(语言环境, "Categories").glob("*.json"):
        分类数据.update(尝试读取json(分类json))
    路径 = 当前路径.joinpath(语言环境, "NodeCategory.json")
    if not 路径.exists():
        路径 = 当前路径.joinpath("en_US", "NodeCategory.json")
    if 路径.exists():
        分类数据.update(尝试读取json(路径))
    return 分类数据


def 获取菜单翻译(语言环境):
    菜单数据 = {}
    for 菜单json in 当前路径.joinpath(语言环境, "Menus").glob("*.json"):
        菜单数据.update(尝试读取json(菜单json))
    路径 = 当前路径.joinpath(语言环境, "Menu.json")
    if not 路径.exists():
        路径 = 当前路径.joinpath("en_US", "Menu.json")
    if 路径.exists():
        菜单数据.update(尝试读取json(路径))
    return 菜单数据


def 编译翻译数据(语言环境):
    节点翻译 = 获取节点翻译(语言环境)
    节点分类翻译 = 获取分类翻译(语言环境)
    菜单翻译 = 获取菜单翻译(语言环境)

    return json.dumps({
        "Nodes": 节点翻译,
        "NodeCategory": 节点分类翻译,
        "Menu": 菜单翻译
    }, ensure_ascii=False)


def 压缩json(数据, 方法="gzip"):
    if 方法 == "gzip":
        import gzip
        return gzip.compress(数据.encode("utf-8"))
    return 数据


@server.PromptServer.instance.routes.post("/translation/get_translation")
async def 获取翻译数据(请求: web.Request):
    表单数据 = await 请求.post()
    语言环境 = 表单数据.get("locale", "en_US")
    接受编码 = 请求.headers.get("Accept-Encoding", "")
    json数据 = "{}"
    响应头 = {}

    # 实时检查配置文件中的翻译开关
    当前启用状态 = 加载配置()
    if not 当前启用状态:
        return web.Response(status=200, body=json数据, headers=响应头)

    try:
        json数据 = 编译翻译数据(语言环境)
        if "gzip" in 接受编码:
            json数据 = 压缩json(json数据, 方法="gzip")
            响应头["Content-Encoding"] = "gzip"
    except Exception:
        pass

    return web.Response(status=200, body=json数据, headers=响应头)


@server.PromptServer.instance.routes.get("/translation/get_config")
async def 获取配置(请求: web.Request):
    # 实时读取配置文件
    当前启用状态 = 加载配置()
    配置数据 = {"translation_enabled": 当前启用状态}
    return web.Response(status=200, body=json.dumps(配置数据), headers={"Content-Type": "application/json"})


@server.PromptServer.instance.routes.post("/translation/set_config")
async def 设置配置(请求: web.Request):
    try:
        表单数据 = await 请求.post()
        启用状态 = 表单数据.get("translation_enabled", "true").lower() == "true"

        # 更新配置文件
        配置路径 = 当前路径.joinpath("config.json")
        配置数据 = {"translation_enabled": 启用状态}

        with open(配置路径, 'w', encoding='utf-8') as 文件:
            json.dump(配置数据, 文件, indent=2, ensure_ascii=False)

        # 更新全局变量
        global 翻译启用状态
        翻译启用状态 = 启用状态

        return web.Response(status=200, body=json.dumps({"success": True, "translation_enabled": 启用状态}),
                          headers={"Content-Type": "application/json"})
    except Exception as 错误:
        return web.Response(status=500, body=json.dumps({"success": False, "error": str(错误)}),
                          headers={"Content-Type": "application/json"})


def 删除目录树(路径: Path):
    if not 路径.exists():
        return
    if Path(路径.resolve()).as_posix() != 路径.as_posix():
        路径.unlink()
        return
    if 路径.is_file():
        路径.unlink()
    elif 路径.is_dir():
        if 路径.name == ".git":
            if platform.system() == "darwin":
                from subprocess import call
                call(['rm', '-rf', 路径.as_posix()])
            elif platform.system() == "Windows":
                os.system(f'rd/s/q "{路径.as_posix()}"')
            return
        for 子项 in 路径.iterdir():
            删除目录树(子项)
        try:
            路径.rmdir()
        except BaseException:
            pass


def 注册插件():
    import nodes
    插件扩展路径 = COMFY路径.joinpath("web", "extensions", 插件名称)
    if hasattr(nodes, "EXTENSION_WEB_DIRS"):
        删除目录树(插件扩展路径)
        return
    
    try:
        if os.name == "nt":
            try:
                import _winapi
                _winapi.CreateJunction(当前路径.as_posix(), 插件扩展路径.as_posix())
            except WindowsError:
                shutil.copytree(当前路径.as_posix(), 插件扩展路径.as_posix(), ignore=shutil.ignore_patterns(".git"))
        else:
            shutil.copytree(当前路径.as_posix(), 插件扩展路径.as_posix(), ignore=shutil.ignore_patterns(".git"))
    except Exception:
        pass


def 注销插件():
    插件扩展路径 = COMFY路径.joinpath("web", "extensions", 插件名称)
    try:
        删除目录树(插件扩展路径)
    except BaseException:
        pass


注册插件()
atexit.register(注销插件)
节点类映射 = {}
WEB目录 = "./js"

__all__ = ["节点类映射", "WEB目录"]
__version__ = 版本号