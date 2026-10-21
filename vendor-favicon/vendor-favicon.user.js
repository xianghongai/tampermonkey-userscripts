// ==UserScript==
// @name         Vendor Favicon
// @namespace    https://github.com/xianghongai
// @version      1.0.0
// @description  Restore the original favicon of self-hosted Jira, Confluence and Axhub whose icon was replaced, so their tabs are easy to tell apart. For personal use: replace the @match addresses with your real ones.
// @description:zh-CN  为内网或私有部署、被换掉图标的 Jira、Confluence、Axhub 还原原厂图标，方便在标签页中辨认；自用脚本，使用前把 @match 换成真实地址。
// @description:zh-TW  為內網或私有部署、被換掉圖示的 Jira、Confluence、Axhub 還原原廠圖示，方便在分頁中辨認；自用腳本，使用前把 @match 換成真實位址。
// @author       xianghongai <xianghongai@gmail.com>
// @license      MIT
// @homepageURL  https://github.com/xianghongai/tampermonkey-userscripts
// @supportURL   https://github.com/xianghongai/tampermonkey-userscripts/issues
// @icon         https://xinlu.ink/favicon.ico
// 以下为占位地址，使用前换成真实的内网地址；仓库中只保留占位地址，不提交真实地址
// @match        *://jira.example.com/*
// @match        *://wiki.example.com/*
// @match        *://axhub.example.com/*
// @grant        none
// @run-at       document-start
// @noframes
// ==/UserScript==

console.log(GM_info.script.name);

(() => {
  'use strict';

  // ---------- 规则 ----------
  // 主机名包含关键词时使用对应的图标，按顺序取第一个命中的。
  // 真实地址的主机名不含这些关键词时，在这里改成能区分它们的关键词。
  // 图标为原厂图标，以 data URI 内嵌，内网无法访问外部网络时也能显示；新增产品时取其公开站点的 32×32 PNG。
  const RULES = [
    ['jira.', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAADuklEQVR42sXWS0wTQRgA4AoByytIFYSAINBSUcREjInxIJHEyM2oAyLhLUiVh0BQHhGK3RaIiQdv6sF4NfFgvGyMHutBMfKMPBRBagSlKvKQQuH3n2W7LEsppKtw+JMeZqbfzPz/v6MAgG3uhoYBNo6B327Gzzgj1CrkAOIM8AgXAhnxSR6AgXRZACOMyAIk6cEXF3q/ZQAa+0xwDBeb2jIADa0BTuKCli0D0DhwB1S4aB3GGwyrloFpGvh7xm1AAgN7cBHiCHWTnUTXz5DImkkSXmklweXfiEpnIYFFg8Q/d4D4ZPUQ74yuNK/0jmyvjM48ZWZPSmIrRLgNwAGp4gkawyLENNggsm4awqt/we6KcdhV8hV2FH+GgIKP4JvTB94Xu8EzrR0UZ9tozPvl9KW4D2AgHGPOFSKURwQVjyBicBVCmdld6DZArwcPHPhcOnF9RD8iejiEMrMrH+fY3E5CHHgUY3YtRBRFXJcgLi0jvC900WbVIasKcGARTph3imicg6h6HlGJiFJE6HhEbj/4ZPUSjRHqZZchn5B9ayNmEDGxCuFfMECSWiAQxw7K7gPJelBqm+E0Nh4GF3iA8ZAGIvpXIqwCIrBomHAdsxmScOz3VQD6RaOfVQ2zyMY2zrOR9X/YiBuTbFjVDzakdIxVXf3CBl4eZv3zP7DK7F4WM5zF5GIxw1nFubZnCvL6BI8AKSK4dBRUJRbi2EC8ATQ49gXGggDA3bwSjvPWwtIimFgRjkXKxkB1xYI7GQJEgE92L3hldIEHeeeo9Zf8SXDXEcsjHPNDsVmJT5E8Bk9sakdwfA1u3kRPwLTiTtdD5EkRb80OgDNEeLWVuLpWxf5mUPM9W4Lg65xPLClCmbWE8CTtFGBccbciBG3bLgF8hletym6KaJAi8E51KxHY+82YYKeclVmsfh6iG2zrA+i98LuwSxHRLhB+eQO0zs2pd2E7ju90htAy9vUBwuPCAMn8Q1P4hKpdnUQhl5hm7k1gguPOOib9im4YwPV/AI+DzRAUb4SEuBY4REPdaD+/hJhaQlQsI3YUDpmFZmWCM9xrVw7AaRekCOE6poTez9W5zmIWj0V8DF8V1n8KcFwHh6gVIcpGzU4frPfAF3uMFt+MO2UDNK0QL84JAYGf4rDKcbOcp9yGANpWCMA/nxAQTXbRSUz8fwDfK56Ik4tD3Jyl1bE5AKyKw9Iyo4i9DbbNAXBXwcA1/ONFCWLzALRHYK1n4R+PixCbB3BE4m0IwRIrx6fWUwTclwP4C5vOtJQ4/zrMAAAAAElFTkSuQmCC'],
    ['wiki.', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAFKElEQVRYhZ2We4icZxXGf8+Z3aStuk3S3aRNYm3iurSxSBWpQikIEUVSSFNrQ6Xb1HhLkXYptiq4GINbCVYxitHiSi60EdJCItj8kShFSCo1ijZEY7uJtZdkm6sm0mA3u3Me/5jLTuaWsQdeZub73nN+z3Pe733nE/Vxx5+uAPqBV9nx4XMN9/+PuPKLr3wSsVyKrYWuwv4zGxe4fk40yRsEdkvaHp/5y12FlQdmvR347DWvXaNCrIso3B+F2C7p4b4Hj/fWz9NFau78c69hl6SbJSFpQhH7I2KTFM+89eQNpzuB9z14QsWpqW9JrJUkKUAqRug5RayPiN+Of3/OZIOAwsoDdwu2SJohCSIoC5mMiBek2KLQr97c1D/eTkDvA28sBbZJmieVa4TKteKcIrZFaMPr63sOVwXM+Oxfr8A8hVgmRU2CqClSlOKQQr+MiJ1I//j3z949VQufO3TyFuBxSTfWgaFSL4QUL0bET6oCLrvn0FLQDoV66sHUiwlZ0lFF7A3FXoX+KUU30i2Ce5AW1oCmc+t/S2cF8I77xgq2f460us5xsy5c7Kgk5oIUIam7BQhNL2c5LyzY0gWgiBsFn6px2AAm6oRMgyRpZjMwbboAHBB8twsgCoXlQtcoNL1OTRy3amU7UG0XKrWB88D3xoZ1pCQgCmcU+o+knrZFqgLbgxrarYs2G8BmYAdAWUCMKnRQEZ8LxTKF+miAdOAw6n43j93Ao2PDmmg4B+YOneyWdFNErFLECoXmNwPTyjFAazDAc8Dnx4b1UuVC09kLHjlbkLREEYOKuEvStaVnrQ7cusX1YWAPMFQLbymgEu/55vmQ4n2KWBmhO6W4XlJ3h9BKnAU2UXroTtTf7KhK/7pJobha0sck3QZ8BFgIzGyRksAp4FlgFNg3NqzJZhM7tlGJgRHPKMNvKI/rgF7gMmACGAcOAvuBsbFhXWhX75ICBkbcDbwXuBn4ADC/BnYaeBV4ETgEHL0UsGMBAyMuAB8FvgR8HLia5u8PlMUcBf6A/Yzt39k+fmRtV8MLSEcCBkbcCzxUhje8RLQK29ietP2SM5+2vd3Ow6985/LsWMDAiBcBG4DbaO24loqr8IR0RYhtv2bn004/Yftvr69/V7GtgDJ8FFjaiVtchVVH47XE6XHbO5251fYLb/xgTnVHVAUMjPgq4BfA7W8HXLqepe/ZUtApZ+6yvdnO50/+aN6FKMO7gK8By9uBM7NmFMni9HCxSBazNGrn1I5isS8z78vMXzt9P5T/jIBlwJr6JSmtb1tHje5rOtB8boLdYzMXoGtgxNcC3wB6Ol/fvCSI2nm110s5p4CdlQ48TOmQaeEym4Emy095t23RGtRCFHsQB0oC7E8bouQo27TY2D5mvA2zz85JpxfZvtXOW51eYFtt3Zc+z2O2nRu9bhKgK+1vO3PI9vubui+3GnwIWJOZ+8Yfm1094eY9dHoUu9+ZK9J5t+0l2AVnS/e/B/ZdtA0Xr51Y7PSQnYNOz26i/CQweOyxWXvabdGrvjI+384VTq+y86byEtWamsJ84c3N/VsrOQHw8rqZL2fmVzO9MjOfzcypytZxFsnMx41/0w4OcGbj/PF//XThRjuXOf3lzNybxZwobc8iWcyDmbm7NqfhKF749XNznL43Mx+wvRj7j8CK4z/sPXYpAfXxztVHZtn+hDNX2/4g5tH/PnH9j9sKAFjwyFkVi1MfcnoVsOvEhr7dzeZ1GpcP/v1KwyLsw289ueR87b3/AaPHxyTsnFoAAAAAAElFTkSuQmCC'],
    ['axhub.', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAJ+SURBVHgB7Zm7SwNBEMYnIggKYmE6FSGNWvkqFbXR8ixsRStbtbWzsdX/QBG1Ek1KKxNsLHw2PoqAil0sRFCwijcJkUN2ZmcfegbuByEHm8d+O9/Mzt6lYH22DHVMA9Q5iYC4SQTETSIgbhrBE92t7bA5uVB558g/38Lq6SE8vL2AD7wJOJ5Z0U4eme8bDT+Xhon9NfCBFwv1p7tEk68x3tFj9HkOLwJwQqZMZ4bAB14EBJlhMCX4LwLQClQEssWLMGnvlGP4nbamFnDFWcB4Ry85tnp6AMuFHXJ8vm8EXHEWMBdWFRWvnx9wVXqqvPBahQ8bOQloa2om7YMTV11HwerlaiMnAZx9csXz7+tCuHmpwAXoT3eCC04CgswgOZaPTDpPCEBcy6mTAOrPsU2I2gYrEZUHVA5JsRZQLYPNyjHVikctFYXLIwnWAriVU02W2g8QFxs5RIBOYFXVyRIRQIK/FsA1b7jSqlYZc4CKAv6WbXNnJYAL+XXp0WrM1kZWAriQc1b5DRsZC8BQo4VUcDZBuHJq29wZn8i45MWSWF7aBluwudu4PDL6jnEEXDceDhsbGQlw3XR02DR3RgJ8HQMpbJo7IwFc8+YL00UySmIugbduTuBReK8HV3pxYEo5hjm2VNgFKWIBXPOGLBf2whL5DhI4AbU848pxFLGFuOpTre+yySO6/cLERmIB0tOXlFzxjBwLfAvQ3UnjTlwU1DkZMWnuRAK4kP48fUnh2grdf0YRCRhj7GOz+jVyHpo7rQCuedNNQgeXyNLmTiuAS97qJO7BlqxGvOTOXUr3oLvan6jrf+3umwtcb4X5pXsQkkqe1MdMIiBuEgFx8wXw+uRoEo2GpgAAAABJRU5ErkJggg=='],
  ];

  const icon = RULES.find(([keyword]) => location.hostname.includes(keyword))?.[1];
  if (!icon) return;

  // ---------- 图标 ----------
  // rel 中含 icon 一词的 <link>，即 icon 与 shortcut icon
  const ICON_LINKS = 'link[rel~="icon" i]';

  /** 把页面上所有图标链接都指向原厂图标，没有时补一个；只改不同的，避免自己的修改再次触发监听。 */
  function applyIcon() {
    const links = [...document.querySelectorAll(ICON_LINKS)];
    for (const link of links) {
      if (link.getAttribute('href') === icon) continue;
      // 原链接的 type、sizes 描述的是原图标，留着可能让浏览器误判或优先选用别的尺寸
      link.removeAttribute('type');
      link.removeAttribute('sizes');
      link.href = icon;
    }
    if (links.length === 0 && document.head) {
      const link = document.createElement('link');
      link.rel = 'icon';
      link.className = 'user-script-vendor-favicon-link';
      link.href = icon;
      document.head.append(link);
    }
  }

  // 页面在加载过程中才写入图标，有的应用还会动态更换图标（例如显示通知数），所以持续监听并换回
  new MutationObserver(applyIcon).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['href', 'rel'] });
  applyIcon();
})();
