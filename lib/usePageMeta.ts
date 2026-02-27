"use client";

import { useEffect } from "react";

type PageMetaOptions = {
    title: string;
    url: string;
    basePath: string;
    description?: string;
    ogImage?: string;
    themeColor?: string;
};

export function usePageMeta(opts: PageMetaOptions) {
    const { title, url, basePath, description, ogImage, themeColor = "#000000" } = opts;

    useEffect(() => {
        document.title = title;

        const setMeta = (key: string, val: string, prop = false) => {
            let el = document.querySelector(prop ? `meta[property="${key}"]` : `meta[name="${key}"]`) as HTMLMetaElement;
            if (!el) {
                el = document.createElement("meta");
                prop ? el.setAttribute("property", key) : (el.name = key);
                document.head.appendChild(el);
            }
            el.content = val;
        };

        const setLink = (rel: string, href: string, options: { sizes?: string; type?: string } = {}) => {
            const { sizes, type } = options;
            let el = document.querySelector(`link[rel="${rel}"]${sizes ? `[sizes="${sizes}"]` : ""}${type ? `[type="${type}"]` : ""}`) as HTMLLinkElement;
            if (!el) {
                el = document.createElement("link");
                el.rel = rel;
                document.head.appendChild(el);
            }
            if (sizes) el.sizes = sizes;
            else el.removeAttribute("sizes");
            if (type) el.type = type;
            else el.removeAttribute("type");
            el.href = href;
        };

        // App meta
        setMeta("theme-color", themeColor);
        setMeta("mobile-web-app-capable", "yes");
        setMeta("apple-mobile-web-app-capable", "yes");
        setMeta("apple-mobile-web-app-status-bar-style", "black-translucent");
        setMeta("apple-mobile-web-app-title", title);
        setMeta("viewport", "width=device-width, initial-scale=1.0, viewport-fit=cover");

        // Open Graph
        setMeta("og:type", "website", true);
        setMeta("og:title", title, true);
        setMeta("og:url", url, true);

        if (description) {
            setMeta("description", description);
            setMeta("og:description", description, true);
        }

        if (ogImage) {
            setMeta("og:image", ogImage, true);
            setMeta("og:image:width", "1200", true);
            setMeta("og:image:height", "630", true);
        }
    }, [title, url, basePath, description, ogImage, themeColor]);
}
