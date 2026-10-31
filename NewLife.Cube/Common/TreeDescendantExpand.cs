using NewLife.Data;
using NewLife.Log;
using NewLife.Reflection;
using NewLife.Web;
using XCode;
using XCode.Configuration;

namespace NewLife.Cube;

/// <summary>树表命中行扩子孙（OSC-26100514b7）。扁平返回，不嵌套 children。</summary>
public static class TreeDescendantExpand
{
    /// <summary>单次响应扩后总行默认硬顶</summary>
    public const Int32 DefaultMaxRows = 100_000;

    /// <summary>分层 IN 查询每批父键数</summary>
    public const Int32 QueryBatchSize = 200;

    /// <summary>小于该总行数走实体缓存建索引</summary>
    public const Int32 CacheCountThreshold = 10_000;

    /// <summary>请求是否声明树表视图</summary>
    public static Boolean IsTreeViewRequest(String viewKind) =>
        !viewKind.IsNullOrEmpty() && viewKind.EqualIgnoreCase("tree");

    /// <summary>从分页参数读取 viewKind</summary>
    public static Boolean IsTreeViewRequest(Pager p) =>
        p != null && IsTreeViewRequest(p["viewKind"]);

    /// <summary>请求是否声明树懒加载（大树按需展开）</summary>
    public static Boolean IsTreeLazyRequest(String treeLazy) =>
        !treeLazy.IsNullOrEmpty() && (treeLazy == "1" || treeLazy.EqualIgnoreCase("true"));

    /// <summary>从分页参数读取 treeLazy</summary>
    public static Boolean IsTreeLazyRequest(Pager p) =>
        p != null && IsTreeLazyRequest(p["treeLazy"]);

    /// <summary>把配置封顶规范到 [1, 1_000_000]；0 及负数回落到默认</summary>
    public static Int32 ResolveMaxRows(Int32 configured)
    {
        if (configured <= 0) return DefaultMaxRows;
        if (configured > 1_000_000) return 1_000_000;
        return configured;
    }

    /// <summary>命中行扩全部子孙。先保持 hits 原序，再 BFS 追加未见过的子孙。</summary>
    public static IList<T> Expand<T>(
        IList<T> hits,
        Func<T, Object> getId,
        Func<IReadOnlyList<Object>, IEnumerable<T>> findChildrenByParentIds,
        Func<T, Boolean> canView = null,
        Int32 maxRows = DefaultMaxRows,
        Action<Int32, Int32> onTruncated = null)
    {
        if (hits == null || hits.Count == 0) return hits ?? new List<T>();
        if (getId == null) throw new ArgumentNullException(nameof(getId));
        if (findChildrenByParentIds == null) throw new ArgumentNullException(nameof(findChildrenByParentIds));

        maxRows = ResolveMaxRows(maxRows);
        canView ??= static _ => true;

        var result = new List<T>();
        var seen = new HashSet<String>(StringComparer.Ordinal);
        var queue = new Queue<T>();

        foreach (var hit in hits)
        {
            if (hit == null || !canView(hit)) continue;
            var key = KeyOf(getId(hit));
            if (key.Length == 0 || !seen.Add(key)) continue;
            result.Add(hit);
            queue.Enqueue(hit);
            if (result.Count >= maxRows)
            {
                onTruncated?.Invoke(hits.Count, result.Count);
                return result;
            }
        }

        while (queue.Count > 0)
        {
            var batch = new List<Object>();
            while (queue.Count > 0 && batch.Count < QueryBatchSize)
            {
                var id = getId(queue.Dequeue());
                if (id != null) batch.Add(id);
            }
            if (batch.Count == 0) continue;

            IEnumerable<T> children;
            try
            {
                children = findChildrenByParentIds(batch) ?? [];
            }
            catch (Exception ex)
            {
                XTrace.WriteLine("[TreeExpand] Failed to load children: {0}", ex.Message);
                children = [];
            }

            foreach (var child in children)
            {
                if (child == null || !canView(child)) continue;
                var key = KeyOf(getId(child));
                if (key.Length == 0 || !seen.Add(key)) continue;
                result.Add(child);
                queue.Enqueue(child);
                if (result.Count >= maxRows)
                {
                    onTruncated?.Invoke(hits.Count, result.Count);
                    return result;
                }
            }
        }

        return result;
    }

    /// <summary>实体列表扩子孙：小表缓存索引，大表 ParentID IN 分层查询</summary>
    public static IList<TEntity> ExpandEntities<TEntity>(
        IList<TEntity> hits,
        String parentField,
        Func<TEntity, Boolean> canView = null,
        Int32 maxRows = DefaultMaxRows,
        String typeName = null)
        where TEntity : Entity<TEntity>, new()
    {
        if (hits == null || hits.Count == 0) return hits ?? new List<TEntity>();
        if (parentField.IsNullOrEmpty()) return hits;

        var idField = Entity<TEntity>.Meta.Unique;
        var parentFi = Entity<TEntity>.Meta.Table.FindByName(parentField);
        if (idField is null || parentFi is null) return hits;

        var finder = BuildChildFinder<TEntity>(parentFi);
        return Expand(
            hits,
            e => e[idField.Name],
            finder,
            canView,
            maxRows,
            (hitCount, total) =>
                XTrace.WriteLine("[TreeExpand] truncated type={0} hits={1} total={2} max={3}",
                    typeName ?? typeof(TEntity).Name, hitCount, total, ResolveMaxRows(maxRows)));
    }

    /// <summary>懒加载标记核心：rows 中主键出现在 childParentKeys 的行标记为「有子级」</summary>
    /// <typeparam name="T">行类型</typeparam>
    /// <param name="rows">当前层行集</param>
    /// <param name="getId">主键提取</param>
    /// <param name="childParentKeys">存在子级的父键集合（子行查询结果）</param>
    /// <param name="mark">行标记回调（true=有子级）</param>
    public static void MarkLazy<T>(
        IList<T> rows,
        Func<T, Object> getId,
        IEnumerable<Object> childParentKeys,
        Action<T, Boolean> mark)
    {
        if (rows == null || rows.Count == 0) return;
        if (getId == null) throw new ArgumentNullException(nameof(getId));
        mark ??= (_, _) => { };

        var withChild = new HashSet<String>(StringComparer.Ordinal);
        if (childParentKeys != null)
        {
            foreach (var key in childParentKeys)
            {
                if (key != null) withChild.Add(key.ToString());
            }
        }

        foreach (var row in rows)
        {
            if (row == null) continue;
            var id = getId(row);
            mark(row, id != null && withChild.Contains(id.ToString()));
        }
    }

    /// <summary>实体行懒加载标记：写入行扩展 __treeLazy=1；有可见直接子级的行写入 children=true（前端 VTable 展开占位）</summary>
    /// <param name="rows">当前层行集（根层或某节点的直接子级）</param>
    /// <param name="parentField">父级字段名</param>
    /// <param name="canView">可见性过滤（行权）：不可见子级不计入「有子级」</param>
    public static void MarkLazyChildren<TEntity>(
        IList<TEntity> rows,
        String parentField,
        Func<TEntity, Boolean> canView = null)
        where TEntity : Entity<TEntity>, new()
    {
        if (rows == null || rows.Count == 0) return;
        if (parentField.IsNullOrEmpty()) return;

        var idField = Entity<TEntity>.Meta.Unique;
        var parentFi = Entity<TEntity>.Meta.Table.FindByName(parentField);
        if (idField is null || parentFi is null) return;

        // 收集主键 → 只查父列的批量存在性（省流量；行权可见的子级才计入）
        var ids = new List<Object>();
        foreach (var row in rows)
        {
            if (row == null) continue;
            var id = row[idField.Name];
            if (id != null) ids.Add(id);
        }

        var parentKeys = new List<Object>();
        if (ids.Count > 0)
        {
            try
            {
                var children = Entity<TEntity>.FindAll(parentFi.In(ids.ToArray()), null, parentFi.Name);
                if (children != null)
                {
                    foreach (var child in children)
                    {
                        if (child == null || (canView != null && !canView(child))) continue;
                        var key = child[parentFi.Name];
                        if (key != null) parentKeys.Add(key);
                    }
                }
            }
            catch (Exception ex)
            {
                XTrace.WriteLine("[TreeLazy] Child probe failed: {0}", ex.Message);
            }
        }

        MarkLazy(rows, e => e[idField.Name], parentKeys, (e, hasChild) =>
        {
            if (e is not IExtend ext) return;
            ext.Items["__treeLazy"] = 1;
            if (hasChild) ext.Items["children"] = true;
        });
    }

    static Func<IReadOnlyList<Object>, IEnumerable<TEntity>> BuildChildFinder<TEntity>(FieldItem parentFi)
        where TEntity : Entity<TEntity>, new()
    {
        var count = Entity<TEntity>.Meta.Session.Count;
        if (count > 0 && count <= CacheCountThreshold)
        {
            var index = new Dictionary<String, List<TEntity>>(StringComparer.Ordinal);
            foreach (var entity in Entity<TEntity>.FindAllWithCache())
            {
                var pk = KeyOf(entity[parentFi.Name]);
                if (pk.Length == 0) continue;
                if (!index.TryGetValue(pk, out var list))
                {
                    list = [];
                    index[pk] = list;
                }
                list.Add(entity);
            }

            return ids =>
            {
                var acc = new List<TEntity>();
                foreach (var id in ids)
                {
                    if (index.TryGetValue(KeyOf(id), out var kids)) acc.AddRange(kids);
                }
                return acc;
            };
        }

        return ids =>
        {
            if (ids == null || ids.Count == 0) return [];
            return Entity<TEntity>.FindAll(parentFi.In(ids.ToArray()));
        };
    }

    static String KeyOf(Object id) => id == null ? "" : id.ToString();
}
