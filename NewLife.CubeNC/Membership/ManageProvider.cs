﻿using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Principal;
using System.Threading;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Net.Http.Headers;
using NewLife.Log;
using NewLife.Model;
using XCode;
using XCode.Membership;
using IServiceCollection = Microsoft.Extensions.DependencyInjection.IServiceCollection;
using JwtBuilder = NewLife.Web.JwtBuilder;

namespace NewLife.Cube
{
    /// <inheritdoc />
    public class ManageProvider2 : ManageProvider
    {
        #region 静态实例
        internal static IHttpContextAccessor Context;
        #endregion

        #region 属性
        /// <summary>保存于Session的凭证</summary>
        public String SessionKey { get; set; } = "Admin";
        #endregion

        ///// <summary>当前管理提供者</summary>
        //public new static IManageProvider Provider => ObjectContainer.Current.ResolveInstance<IManageProvider>();

        #region IManageProvider 接口
        /// <summary>获取当前用户</summary>
        /// <param name="context"></param>
        /// <returns></returns>
        public override IManageUser GetCurrent(IServiceProvider context = null)
        {
            var ctx = (context?.GetService<IHttpContextAccessor>() ?? Context)
                ?.HttpContext;
            if (ctx == null) return null;

            try
            {
                if (ctx.Items["CurrentUser"] is IManageUser user) return user;

                var session = ctx.Items["Session"] as IDictionary<String, Object>;

                user = session?[SessionKey] as IManageUser;
                ctx.Items["CurrentUser"] = user;

                return user;
            }
            catch (InvalidOperationException ex)
            {
                // 这里捕获一下，防止初始化应用中session还没初始化好报的异常
                // 这里有个问题就是这里的ctx会有两个不同的值
                XTrace.WriteException(ex);
                return null;
            }
        }

        /// <summary>设置当前用户</summary>
        /// <param name="user"></param>
        /// <param name="context"></param>
        public override void SetCurrent(IManageUser user, IServiceProvider context = null)
        {
            var ctx = (context?.GetService<IHttpContextAccessor>() ?? Context)
                ?.HttpContext;
            if (ctx == null) return;

            ctx.Items["CurrentUser"] = user;

            var session = ctx.Items["Session"] as IDictionary<String, Object>;
            if (session == null) return;

            var key = SessionKey;
            // 特殊处理注销
            if (user == null)
            {
                session.Remove(key);
                session.Remove("userId");
            }
            else
            {
                session[key] = user;
                session["userId"] = user.ID;
            }
        }

        /// <summary>登录</summary>
        /// <param name="name"></param>
        /// <param name="password"></param>
        /// <param name="remember">是否记住密码</param>
        /// <returns></returns>
        public override IManageUser Login(String name, String password, Boolean remember)
        {
            XCode.Membership.User user;
            try
            {
                // 用户登录，依次支持用户名、邮箱、手机、编码
                var account = name.Trim();
                user = XCode.Membership.User.FindByName(account);
                if (user == null && account.Contains("@")) user = XCode.Membership.User.FindByMail(account);
                if (user == null && account.ToLong() > 0) user = XCode.Membership.User.FindByMobile(account);
                if (user == null) user = XCode.Membership.User.FindByCode(account);

                if (user == null) throw new EntityException("帐号{0}不存在！", account);
                if (!user.Enable) throw new EntityException("账号{0}被禁用！", account);

                // 数据库为空密码，任何密码均可登录
                if (!user.Password.IsNullOrEmpty())
                {
                    var ss = password.Split(':');
                    if (ss.Length <= 1)
                    {
                        if (!password.MD5().EqualIgnoreCase(user.Password)) throw new EntityException("密码不正确！");
                    }
                    else
                    {
                        var salt = ss[1];
                        var pass = (user.Password.ToLower() + salt).MD5();
                        if (!ss[0].EqualIgnoreCase(pass)) throw new EntityException("密码不正确！");
                    }
                }

                // 保存登录信息
                user.Logins++;
                user.LastLogin = DateTime.Now;
                user.LastLoginIP = UserHost;
                user.Update();

                XCode.Membership.User.WriteLog("登录", true, $"用户[{user}]使用[{name}]登录成功");
            }
            catch (Exception ex)
            {
                XCode.Membership.User.WriteLog("登录", false, name + "登录失败！" + ex.Message);
                throw;
            }

            Current = user;

            // 过期时间
            var set = Setting.Current;
            var expire = TimeSpan.FromMinutes(0);
            if (remember && user != null)
            {
                expire = TimeSpan.FromDays(365);
            }
            else
            {
                if (set.SessionTimeout > 0)
                    expire = TimeSpan.FromSeconds(set.SessionTimeout);
            }

            // 保存Cookie
            var context = Context?.HttpContext;
            this.SaveCookie(user, expire, context);

            return user;
        }

        /// <summary>注销</summary>
        public override void Logout()
        {
            // 注销时销毁所有Session
            var context = Context?.HttpContext;
            var session = context.Items["Session"] as IDictionary<String, Object>;
            session?.Clear();

            // 销毁Cookie
            this.SaveCookie(null, TimeSpan.Zero, context);

            base.Logout();
        }
        #endregion
    }

    /// <summary>管理提供者助手</summary>
    public static class ManagerProviderHelper
    {
        /// <summary>设置当前用户</summary>
        /// <param name="provider">提供者</param>
        /// <param name="context">Http上下文，兼容NetCore</param>
        public static void SetPrincipal(this IManageProvider provider, IServiceProvider context = null)
        {
            var ctx = context.GetService<IHttpContextAccessor>()?.HttpContext;
            if (ctx == null) return;

            var user = provider.GetCurrent(context);
            if (user == null) return;

            if (!(user is IIdentity id) || ctx.User?.Identity == id) return;

            // 角色列表
            var roles = new List<String>();
            if (user is IUser user2) roles.AddRange(user2.Roles.Select(e => e + ""));

            var up = new GenericPrincipal(id, roles.ToArray());
            ctx.User = up;
            Thread.CurrentPrincipal = up;
        }

        /// <summary>尝试登录。如果Session未登录则借助Cookie</summary>
        /// <param name="provider">提供者</param>
        /// <param name="context">Http上下文，兼容NetCore</param>
        public static IManageUser TryLogin(this IManageProvider provider, HttpContext context)
        {
            var serviceProvider = context?.RequestServices;

            // 判断当前登录用户
            var user = provider.GetCurrent(serviceProvider);
            if (user == null)
            {
                // 尝试从Cookie登录
                user = provider.LoadCookie(true, context);
                if (user != null) provider.SetCurrent(user, serviceProvider);
            }

            // 设置前端当前用户
            if (user != null) provider.SetPrincipal(serviceProvider);

            return user;
        }

        /// <summary>生成令牌</summary>
        /// <returns></returns>
        private static JwtBuilder GetJwt()
        {
            var set = Setting.Current;

            // 生成令牌
            var ss = set.JwtSecret.Split(':');
            var jwt = new JwtBuilder
            {
                Algorithm = ss[0],
                Secret = ss[1],
            };

            return jwt;
        }

        #region Cookie
        /// <summary>从Cookie加载用户信息</summary>
        /// <param name="provider">提供者</param>
        /// <param name="autologin">是否自动登录</param>
        /// <param name="context">Http上下文，兼容NetCore</param>
        /// <returns></returns>
        public static IManageUser LoadCookie(this IManageProvider provider, Boolean autologin, HttpContext context)
        {
            var key = "token";
            var req = context?.Request;
            var token = req?.Cookies[key];

            // 尝试从url中获取token
            if (token.IsNullOrEmpty() || token.Split(".").Length != 3) token = req?.Query["token"];
            if (token.IsNullOrEmpty() || token.Split(".").Length != 3) token = req?.Query["jwtToken"];

            // 尝试从头部获取token
            if (token.IsNullOrEmpty() || token.Split(".").Length != 3) token = req?.Headers[HeaderNames.Authorization];

            if (token.IsNullOrEmpty() || token.Split(".").Length != 3) return null;

            token = token.Replace("Bearer ", "", StringComparison.OrdinalIgnoreCase);

            var jwt = GetJwt();
            if (!jwt.TryDecode(token, out var msg))
            {
                XTrace.WriteLine("令牌无效：{0}, token={1}", msg, token);

                return null;
            }

            var user = jwt.Subject;
            if (user.IsNullOrEmpty()) return null;

            // 判断有效期
            if (jwt.Expire < DateTime.Now)
            {
                XTrace.WriteLine("令牌过期：{0} {1}", jwt.Expire, token);

                return null;
            }

            var u = provider.FindByName(user);
            if (u == null || !u.Enable) return null;

            // 保存登录信息
            if (autologin && u is IAuthUser mu)
            {
                mu.SaveLogin(null);

                LogProvider.Provider.WriteLog("用户", "自动登录", true, $"{user} Time={jwt.IssuedAt} Expire={jwt.Expire} Token={token}", u.ID, u + "", ip: context.GetUserHost());
            }

            return u;
        }

        /// <summary>保存用户信息到Cookie</summary>
        /// <param name="provider">提供者</param>
        /// <param name="user">用户</param>
        /// <param name="expire">过期时间</param>
        /// <param name="context">Http上下文，兼容NetCore</param>
        public static void SaveCookie(this IManageProvider provider, IManageUser user, TimeSpan expire, HttpContext context)
        {
            var res = context?.Response;
            if (res == null) return;

            var option = new CookieOptions
            {
                SameSite = Microsoft.AspNetCore.Http.SameSiteMode.Unspecified,
                Secure = true
            };

            var token = "";
            if (user != null)
            {
                // 令牌有效期，默认2小时
                var exp = DateTime.Now.Add(expire.TotalSeconds > 0 ? expire : TimeSpan.FromHours(2));
                var jwt = GetJwt();
                jwt.Subject = user.Name;
                jwt.Expire = exp;

                token = jwt.Encode(null);
                if (expire.TotalSeconds > 0) option.Expires = DateTimeOffset.Now.Add(expire);
            }
            else
            {
                option.Expires = DateTimeOffset.MinValue;
            }
            res.Cookies.Append("token", token, option);

            context.Items["jwtToken"] = token;
        }
        #endregion

        /// <summary>
        /// 添加管理提供者
        /// </summary>
        /// <param name="service"></param>
        public static void AddManageProvider(this IServiceCollection service)
        {
            service.TryAddSingleton<IHttpContextAccessor, HttpContextAccessor>();
            service.TryAddSingleton<IManageProvider, ManageProvider2>();
        }

        /// <summary>
        /// 使用管理提供者
        /// </summary>
        /// <param name="app"></param>
        public static void UseManagerProvider(this IApplicationBuilder app)
        {
            XTrace.WriteLine("初始化ManageProvider");

            ManageProvider.Provider = app.ApplicationServices.GetService<IManageProvider>();
            ManageProvider2.Context = app.ApplicationServices.GetService<IHttpContextAccessor>();

            // 初始化数据库
            _ = Role.Meta.Count;
        }
    }
}