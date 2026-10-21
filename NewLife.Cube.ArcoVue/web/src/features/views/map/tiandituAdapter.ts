/**
 * 天地图适配（JS API 4.0，脚本 api.tianditu.gov.cn/api?v=4.0&tk=）
 *
 * 全局对象为 T（与腾讯 TMap 不同）。底图经纬度为 CGCS2000，实用上按 WGS-84 换算。
 * 标记用 T.Overlay.extend 自定义 DOM（官方无 HTML content 标记）；卫星用影像注记混合图。
 * JS API 4.0 无内置暗色样式，setDark 降级为空操作（与百度一致）。
 */
import type { MapAdapter, MapAdapterOptions, MapAdapterPoint } from './mapAdapter';
import { CHINA_CENTER, MARKER_SIZE, clampZoom, viewForBounds } from './mapAdapter';
import { createMarkerElement } from './mapMarkerDom';
import { loadMapScript } from './mapScript';

type AnySdk = Record<string, any>;

export async function createTiandituAdapter(opts: MapAdapterOptions = {}): Promise<MapAdapter> {
  await loadMapScript('tianditu', opts.key ?? '', opts.scriptUrl);
  const T = (window as AnySdk).T;
  if (!T?.Map || !T?.LngLat || !T?.Overlay?.extend) throw new Error('天地图 SDK 未就绪');

  let map: AnySdk | null = null;
  let host: HTMLElement | null = null;
  let basemapNotified = false;
  const markers = new Map<string, AnySdk>();
  const viewportCbs = new Set<() => void>();
  const clickCbs = new Set<(id: string) => void>();
  const mapClickCbs = new Set<(lng: number, lat: number) => void>();
  const hoverCbs = new Set<(id: string | null, x: number, y: number) => void>();

  const emitViewport = () => {
    for (const cb of viewportCbs) cb();
  };

  const MarkerOverlay = T.Overlay.extend({
    initialize(this: AnySdk, lnglat: AnySdk, el: HTMLElement) {
      this.lnglat = lnglat;
      this._el = el;
    },
    onAdd(this: AnySdk, host: AnySdk) {
      this.map = host;
      const div = document.createElement('div');
      div.style.position = 'absolute';
      div.style.zIndex = '500';
      div.appendChild(this._el as HTMLElement);
      this._div = div;
      host.getPanes().overlayPane.appendChild(div);
      this.update();
    },
    onRemove(this: AnySdk) {
      const div = this._div as HTMLElement | undefined;
      div?.parentNode?.removeChild(div);
      this.map = null;
      this._div = null;
    },
    update(this: AnySdk) {
      const host = this.map as AnySdk | null;
      const div = this._div as HTMLElement | undefined;
      if (!host || !div) return;
      const pos = host.lngLatToLayerPoint(this.lnglat);
      div.style.left = `${pos.x - MARKER_SIZE / 2}px`;
      div.style.top = `${pos.y - MARKER_SIZE / 2}px`;
    },
  });

  const hoverPixel = (ev: MouseEvent) => {
    const host = map?.getContainer?.() as HTMLElement | undefined;
    const rect = host?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
  };

  const onTileError = (ev: Event) => {
    if (basemapNotified) return;
    const img = ev.target;
    if (!(img instanceof HTMLImageElement)) return;
    const src = img.currentSrc || img.src || '';
    if (!/tianditu\.(gov\.cn|com)/i.test(src)) return;
    if (!/\/(vec|cva|img|cia|ter|cta)_[wc]\//i.test(src) && !/wmts|DataServer/i.test(src)) return;
    basemapNotified = true;
    opts.onBasemapError?.(
      '天地图底图瓦片被拒绝。请改用「浏览器端」密钥：服务器端密钥不能在浏览器加载底图。并在天地图控制台把当前站点域名加入该密钥白名单。',
    );
  };

  return {
    mount(el) {
      const center = opts.center ?? CHINA_CENTER;
      host = el;
      el.addEventListener('error', onTileError, true);
      const m = new T.Map(el);
      map = m;
      m.centerAndZoom(new T.LngLat(center[0], center[1]), clampZoom(opts.zoom ?? 5));
      m.addEventListener('moveend', emitViewport);
      m.addEventListener('zoomend', emitViewport);
      m.addEventListener('click', (e: AnySdk) => {
        const lnglat = e?.lnglat;
        const lng = Number(lnglat?.getLng?.() ?? lnglat?.lng);
        const lat = Number(lnglat?.getLat?.() ?? lnglat?.lat);
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
        for (const cb of mapClickCbs) cb(lng, lat);
      });
    },
    destroy() {
      host?.removeEventListener('error', onTileError, true);
      host = null;
      map?.clearOverLays?.();
      map = null;
      markers.clear();
    },
    zoomIn() {
      if (map) map.setZoom(clampZoom(Number(map.getZoom()) + 1));
    },
    zoomOut() {
      if (map) map.setZoom(clampZoom(Number(map.getZoom()) - 1));
    },
    getZoom() {
      return map ? Number(map.getZoom()) : 0;
    },
    getBounds() {
      if (!map) return null;
      const b = map.getBounds?.();
      if (!b) return null;
      const sw = b.getSouthWest();
      const ne = b.getNorthEast();
      return {
        minLng: Number(sw.getLng()),
        minLat: Number(sw.getLat()),
        maxLng: Number(ne.getLng()),
        maxLat: Number(ne.getLat()),
      };
    },
    fit(bounds) {
      if (!map || !bounds) return;
      const v = viewForBounds(bounds);
      map.centerAndZoom(new T.LngLat(v.center[0], v.center[1]), v.zoom);
    },
    setCenter(lng, lat, zoom) {
      if (!map) return;
      map.centerAndZoom(new T.LngLat(lng, lat), clampZoom(zoom ?? Number(map.getZoom())));
    },
    setDark() {
      // JS API 4.0 无内置暗色底图；降级保持标准底图
    },
    setSatellite(on) {
      if (!map?.setMapType) return;
      const w = window as AnySdk;
      const normal = w.TMAP_NORMAL_MAP;
      const hybrid = w.TMAP_HYBRID_MAP ?? w.TMAP_SATELLITE_MAP;
      if (normal == null || hybrid == null) return;
      map.setMapType(on ? hybrid : normal);
    },
    onViewportChange(cb) {
      viewportCbs.add(cb);
      return () => viewportCbs.delete(cb);
    },
    onClick(cb) {
      clickCbs.add(cb);
      return () => clickCbs.delete(cb);
    },
    onMapClick(cb) {
      mapClickCbs.add(cb);
      return () => mapClickCbs.delete(cb);
    },
    onPointHover(cb) {
      hoverCbs.add(cb);
      return () => hoverCbs.delete(cb);
    },
    addPoints(points: readonly MapAdapterPoint[]) {
      if (!map) return;
      for (const p of points) {
        if (markers.has(p.id)) continue;
        const el = createMarkerElement(p.style);
        el.addEventListener('click', (ev) => {
          ev.stopPropagation();
          for (const cb of clickCbs) cb(p.id);
        });
        el.addEventListener('mouseover', (ev) => {
          const px = hoverPixel(ev);
          for (const cb of hoverCbs) cb(p.id, px.x, px.y);
        });
        el.addEventListener('mousemove', (ev) => {
          const px = hoverPixel(ev);
          for (const cb of hoverCbs) cb(p.id, px.x, px.y);
        });
        el.addEventListener('mouseout', () => {
          for (const cb of hoverCbs) cb(null, 0, 0);
        });
        const overlay = new MarkerOverlay(new T.LngLat(p.lng, p.lat), el);
        map.addOverLay(overlay);
        markers.set(p.id, overlay);
      }
    },
    removePoints(ids: readonly string[]) {
      if (!map) return;
      for (const id of ids) {
        const overlay = markers.get(id);
        if (!overlay) continue;
        map.removeOverLay(overlay);
        markers.delete(id);
      }
    },
  };
}
