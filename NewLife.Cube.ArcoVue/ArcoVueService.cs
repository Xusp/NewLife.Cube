using System.ComponentModel;
using System.Reflection;
using Microsoft.Extensions.FileProviders;
using NewLife.Cube.Extensions;
using NewLife.Cube.Modules;

namespace NewLife.Cube.ArcoVue;

/// <summary>ArcoVue前端皮肤服务</summary>
public static class ArcoVueService
{
    /// <summary>使用ArcoVue前端皮肤。UseCube 已自动发现并启用皮肤包，通常无需调用；本方法仅用于强制指定 ArcoVue 皮肤</summary>
    /// <remarks>静态资源与 SPA 回退统一由 NewLife.Cube 的 CubeSkinService 提供，避免与其它皮肤重复注册中间件与回退路由</remarks>
    /// <param name="app"></param>
    /// <param name="env"></param>
    /// <returns></returns>
    public static WebApplication UseArcoVue(this WebApplication app, IWebHostEnvironment env) => app.UseCubeSkin(env, "ArcoVue");
}

/// <summary>ArcoVue前端皮肤。由魔方自动发现，多个皮肤包共存时可通过设置项 SpaSkin 切换</summary>
internal sealed class ArcoVueSkin : ICubeSkin
{
    /// <summary>皮肤标识</summary>
    public String Name => "ArcoVue";

    /// <summary>显示名称</summary>
    public String DisplayName => "Vue3 + Arco Design Vue";

    /// <summary>创建静态资源文件提供者。前端编译产物编译时嵌入程序集，无需物理文件</summary>
    /// <returns></returns>
    public IFileProvider CreateFileProvider()
    {
        var assembly = Assembly.GetExecutingAssembly();
        return new CubeEmbeddedFileProvider(assembly, "NewLife.Cube.ArcoVue.wwwroot");
    }
}

/// <summary>ArcoVue前端皮肤模块</summary>
/// <remarks>静态资源与 SPA 回退由 UseCube 的皮肤注册统一处理，模块不再接管 WebRootFileProvider，避免重复注册中间件</remarks>
[DisplayName("ArcoVue前端皮肤")]
internal class ArcoVueModule : IModule
{
    /// <summary>添加模块</summary>
    /// <param name="services"></param>
    public void Add(IServiceCollection services) { }

    /// <summary>使用模块。皮肤由 UseCube 统一注册，此处无需额外动作</summary>
    /// <param name="app"></param>
    /// <param name="env"></param>
    public void Use(IApplicationBuilder app, IWebHostEnvironment env) { }
}