importScripts("https://storage.googleapis.com/workbox-cdn/releases/5.0.0-beta.1/workbox-sw.js"),workbox.core.skipWaiting(),workbox.core.clientsClaim(),workbox.routing.registerRoute(/\.(?:js|css|json5)$/,new workbox.strategies.StaleWhileRevalidate({cacheName:"static-resources"})),workbox.routing.registerRoute(/^https:\/\/fonts\.googleapis\.com/,new workbox.strategies.StaleWhileRevalidate({cacheName:"google-fonts-stylesheets"})),workbox.routing.registerRoute(/^https:\/\/fonts\.gstatic\.com/,new workbox.strategies.CacheFirst({cacheName:"google-fonts-webfonts",plugins:[new workbox.cacheableResponse.CacheableResponsePlugin({statuses:[0,200]}),new workbox.expiration.ExpirationPlugin({maxAgeSeconds:31536e3,maxEntries:30})]})),self.addEventListener("message",(function(e){e.data&&"SKIP_WAITING"===e.data.type&&("SKIP_WAITING"===e.data.type||console.warn("SW: Invalid message type: ".concat(e.data.type)))})),workbox.precaching.precacheAndRoute([{'revision':null,'url':'./205.bundle.029f63b637236ecea7c0.js'},{'revision':'4e0e34f265fae8f33b01b27ae29d9d6f','url':'./205.bundle.029f63b637236ecea7c0.js.LICENSE.txt'},{'revision':null,'url':'./295.bundle.6ebd92f6d3ccd9a1cec7.js'},{'revision':'4e0e34f265fae8f33b01b27ae29d9d6f','url':'./295.bundle.6ebd92f6d3ccd9a1cec7.js.LICENSE.txt'},{'revision':null,'url':'./365.bundle.ce319e1531d616d0becb.js'},{'revision':'4e0e34f265fae8f33b01b27ae29d9d6f','url':'./365.bundle.ce319e1531d616d0becb.js.LICENSE.txt'},{'revision':'aa0260a379ee1f02e5b6bccf38cb01af','url':'./365.css'},{'revision':'c377e1f5fe4a207d270c3f7a8dd3e3ca','url':'./5004fdc02f329ce53b69.wasm'},{'revision':null,'url':'./569.bundle.b4ba3cc5270b28ffe20e.js'},{'revision':'4e0e34f265fae8f33b01b27ae29d9d6f','url':'./569.bundle.b4ba3cc5270b28ffe20e.js.LICENSE.txt'},{'revision':'00ae0590a2f2d9bcfb113283d0f5625c','url':'./610.min.worker.js'},{'revision':'522037ad4b6d6f8dab8473efa602e0c2','url':'./610.min.worker.js.map'},{'revision':'ce10eced3ce34e663d86569b27f5bffb','url':'./65916ef3def695744bda.wasm'},{'revision':'cf3e4d4fa8884275461c195421812256','url':'./75788f12450d4c5ed494.wasm'},{'revision':null,'url':'./799.bundle.0099a0e8035e20ad3a46.js'},{'revision':'459156d6f4993394a0c10d576a49fff8','url':'./888.min.worker.js'},{'revision':'9d0df99bb27801143bf270a525dd3595','url':'./888.min.worker.js.map'},{'revision':null,'url':'./953.bundle.a8d5652eb59848def386.js'},{'revision':'4e0e34f265fae8f33b01b27ae29d9d6f','url':'./953.bundle.a8d5652eb59848def386.js.LICENSE.txt'},{'revision':'d1895aa7a4595dc279c382e5a31ef9f4','url':'./_headers'},{'revision':'6839a719b6810111d8097998b11293a1','url':'./_redirects'},{'revision':'ffa40c578aa20bbf86566b2f4841430b','url':'./app-config.js'},{'revision':'e08f6347b43e7110e5028154dbcf6758','url':'./app.bundle.7ae89e31549812fb6860.js.LICENSE.txt'},{'revision':'ec9a4f96bc778b56a76422c5ca063bd8','url':'./app.bundle.css'},{'revision':'cb4f64534cdf8dd88f1d7219d44490db','url':'./assets/android-chrome-144x144.png'},{'revision':'5cde390de8a619ebe55a669d2ac3effd','url':'./assets/android-chrome-192x192.png'},{'revision':'e7466a67e90471de05401e53b8fe20be','url':'./assets/android-chrome-256x256.png'},{'revision':'9bbe9b80156e930d19a4e1725aa9ddae','url':'./assets/android-chrome-36x36.png'},{'revision':'5698b2ac0c82fe06d84521fc5482df04','url':'./assets/android-chrome-384x384.png'},{'revision':'56bef3fceec344d9747f8abe9c0bba27','url':'./assets/android-chrome-48x48.png'},{'revision':'3e8b8a01290992e82c242557417b0596','url':'./assets/android-chrome-512x512.png'},{'revision':'517925e91e2ce724432d296b687d25e2','url':'./assets/android-chrome-72x72.png'},{'revision':'4c3289bc690f8519012686888e08da71','url':'./assets/android-chrome-96x96.png'},{'revision':'cf464289183184df09292f581df0fb4f','url':'./assets/apple-touch-icon-1024x1024.png'},{'revision':'0857c5282c594e4900e8b31e3bade912','url':'./assets/apple-touch-icon-114x114.png'},{'revision':'4208f41a28130a67e9392a9dfcee6011','url':'./assets/apple-touch-icon-120x120.png'},{'revision':'cb4f64534cdf8dd88f1d7219d44490db','url':'./assets/apple-touch-icon-144x144.png'},{'revision':'977d293982af7e9064ba20806b45cf35','url':'./assets/apple-touch-icon-152x152.png'},{'revision':'6de91b4d2a30600b410758405cb567b4','url':'./assets/apple-touch-icon-167x167.png'},{'revision':'87bff140e3773bd7479a620501c4aa5c','url':'./assets/apple-touch-icon-180x180.png'},{'revision':'647386c34e75f1213830ea9a38913525','url':'./assets/apple-touch-icon-57x57.png'},{'revision':'0c200fe83953738b330ea431083e7a86','url':'./assets/apple-touch-icon-60x60.png'},{'revision':'517925e91e2ce724432d296b687d25e2','url':'./assets/apple-touch-icon-72x72.png'},{'revision':'c9989a807bb18633f6dcf254b5b56124','url':'./assets/apple-touch-icon-76x76.png'},{'revision':'87bff140e3773bd7479a620501c4aa5c','url':'./assets/apple-touch-icon-precomposed.png'},{'revision':'87bff140e3773bd7479a620501c4aa5c','url':'./assets/apple-touch-icon.png'},{'revision':'05fa74ea9c1c0c3931ba96467999081d','url':'./assets/apple-touch-startup-image-1182x2208.png'},{'revision':'9e2cd03e1e6fd0520eea6846f4278018','url':'./assets/apple-touch-startup-image-1242x2148.png'},{'revision':'5591e3a1822cbc8439b99c1a40d53425','url':'./assets/apple-touch-startup-image-1496x2048.png'},{'revision':'337de578c5ca04bd7d2be19d24d83821','url':'./assets/apple-touch-startup-image-1536x2008.png'},{'revision':'cafb4ab4eafe6ef946bd229a1d88e7de','url':'./assets/apple-touch-startup-image-320x460.png'},{'revision':'d9bb9e558d729eeac5efb8be8d6111cc','url':'./assets/apple-touch-startup-image-640x1096.png'},{'revision':'038b5b02bac8b82444bf9a87602ac216','url':'./assets/apple-touch-startup-image-640x920.png'},{'revision':'2177076eb07b1d64d663d7c03268be00','url':'./assets/apple-touch-startup-image-748x1024.png'},{'revision':'4fc097443815fe92503584c4bd73c630','url':'./assets/apple-touch-startup-image-750x1294.png'},{'revision':'2e29914062dce5c5141ab47eea2fc5d9','url':'./assets/apple-touch-startup-image-768x1004.png'},{'revision':'f692ec286b3a332c17985f4ed38b1076','url':'./assets/browserconfig.xml'},{'revision':'f3d9a3b647853c45b0e132e4acd0cc4a','url':'./assets/coast-228x228.png'},{'revision':'ad6e1def5c66193d649a31474bbfe45d','url':'./assets/favicon-16x16.png'},{'revision':'84d1dcdb6cdfa55e2f46be0c80fa5698','url':'./assets/favicon-32x32.png'},{'revision':'95fb44c4998a46109e49d724c060db24','url':'./assets/favicon.ico'},{'revision':'5df2a5b0cee399ac0bc40af74ba3c2cb','url':'./assets/firefox_app_128x128.png'},{'revision':'11fd9098c4b07c8a07e1d2a1e309e046','url':'./assets/firefox_app_512x512.png'},{'revision':'27cddfc922dca3bfa27b4a00fc2f5e36','url':'./assets/firefox_app_60x60.png'},{'revision':'2017d95fae79dcf34b5a5b52586d4763','url':'./assets/manifest.webapp'},{'revision':'cb4f64534cdf8dd88f1d7219d44490db','url':'./assets/mstile-144x144.png'},{'revision':'334895225e16a7777e45d81964725a97','url':'./assets/mstile-150x150.png'},{'revision':'e295cca4af6ed0365cf7b014d91b0e9d','url':'./assets/mstile-310x150.png'},{'revision':'cbefa8c42250e5f2443819fe2c69d91e','url':'./assets/mstile-310x310.png'},{'revision':'aa411a69df2b33a1362fa38d1257fa9d','url':'./assets/mstile-70x70.png'},{'revision':'5609af4f69e40e33471aee770ea1d802','url':'./assets/yandex-browser-50x50.png'},{'revision':'cfea70d7ddc8f06f276ea0c85c4b2adf','url':'./assets/yandex-browser-manifest.json'},{'revision':'7edb59d2be7c993050cb31ded36afa31','url':'./c22b37c3488e1d6c3aa4.wasm'},{'revision':'46af2c6d41526c97b1af6a7719da942d','url':'./config/aws.js'},{'revision':'ffa40c578aa20bbf86566b2f4841430b','url':'./config/default.js'},{'revision':'baec54a1a05d520359df1b5f068f7028','url':'./config/demo.js'},{'revision':'86853d231a7edf570dfe9f2fb650d898','url':'./config/dicomweb-server.js'},{'revision':'ca10ed29647ee193e0e72aaccf2aeca7','url':'./config/dicomweb_relative.js'},{'revision':'5ee84891681bc9a76478b0c70a0950d6','url':'./config/docker_nginx-orthanc.js'},{'revision':'80462df8bc93fe78238f674f00dee283','url':'./config/docker_openresty-orthanc-keycloak.js'},{'revision':'ca84afbe249ea813a54837f84e723afb','url':'./config/docker_openresty-orthanc.js'},{'revision':'964db2e72fc482b3b57b4117e94e0ab2','url':'./config/e2e.js'},{'revision':'00a82f2002a8273a9d65317c366e1856','url':'./config/example.json'},{'revision':'70b5fbebe1348c5039b4c200d3f1ba4f','url':'./config/google.js'},{'revision':'121054291e03cb8996d6388bcd023c02','url':'./config/idc.js'},{'revision':'250aee033b384d8db1fb3aa61f0f6089','url':'./config/local_dcm4chee.js'},{'revision':'36c6ba2ddc0ffd23ad6a982c7c669af9','url':'./config/local_orthanc.js'},{'revision':'a4cf8fd11d565fa909af968ca3126361','url':'./config/local_static.js'},{'revision':'b7d0c3bb0e780b64d37118adfee6b72e','url':'./config/netlify.js'},{'revision':'af2d315a98611b70f91c3bd41283d4b5','url':'./config/public_dicomweb.js'},{'revision':'da64fb430eb5ebdc7d019bdb36ff47f8','url':'./cornerstoneWADOImageLoader.min.js'},{'revision':'7a263753fc4208b156ec1a69c42c3cef','url':'./cornerstoneWADOImageLoader.min.js.map'},{'revision':'72ca174b61ecc42692210fbeb5d04780','url':'./es6-shim.min.js'},{'revision':'020680fc0de257a26ef6c1df902f8d8f','url':'./es6-shim.min.js.LICENSE.txt'},{'revision':'70b5fbebe1348c5039b4c200d3f1ba4f','url':'./google.js'},{'revision':'eb1f41aa706a7ce8fa39d7b5ac09da3f','url':'./html-templates/index.html'},{'revision':'e4108052c489e4779caa89a3d51e3023','url':'./html-templates/rollbar.html'},{'revision':'4bf2089c705b2f56edb093e7af325400','url':'./index.html'},{'revision':'0b745e3a1e54f36cc6abb368e15a5d2e','url':'./index.worker.min.worker.js'},{'revision':'9aaf07948e800df0df81353c75339bd0','url':'./index.worker.min.worker.js.map'},{'revision':'7b7066a3c589cdfe6639b1e3da21824b','url':'./init-service-worker.js'},{'revision':'fbf69161525638a69adb904ed9377f71','url':'./logo.svg'},{'revision':'74fc9658b62903be2048c1f82a22b4d4','url':'./manifest.json'},{'revision':'3fa71aa0af3e34b4ebd9a71eee0f4bdd','url':'./ohif-logo-light.svg'},{'revision':'7e81da785c63e75650101db6c5d7560e','url':'./ohif-logo.svg'},{'revision':'922f9678d4b920857e9325c5ed4aa018','url':'./oidc-client.min.js'},{'revision':'b5a040ab8895994d381772e7fa6e3a84','url':'./oidc-client.min.js.LICENSE.txt'},{'revision':'f5fd3850f3da362de535533e3803383f','url':'./polyfill.min.js'},{'revision':'f528b6861c82ee4415fce0821fd695c1','url':'./silent-refresh.html'},{'revision':'e312e5b526269ef53febce08236cedaa','url':'./umd/@ischemaview/dicom-neuro-rma/index.umd.js'},{'revision':'c1a8a7c69fd517087d63304dddecd524','url':'./umd/@ischemaview/dicom-neuro-rma/index.umd.js.map'},{'revision':'1fcc2c7af5a066a014815583940f3229','url':'./umd/@ischemaview/dicom-neuro-rwa/index.umd.js'},{'revision':'8dfad8dba0f7398778d61890174aa8fd','url':'./umd/@ischemaview/dicom-neuro-rwa/index.umd.js.map'},{'revision':'cdccc9b94d061e3990cbffb29bfaee0b','url':'./umd/@ischemaview/dicom-pulmonary-rma/index.umd.js'},{'revision':'95f493f02ff00afdc60bdb1a23a2db64','url':'./umd/@ischemaview/dicom-pulmonary-rma/index.umd.js.map'},{'revision':'b2f8e3ba9d056ab1c875a96a19182e0c','url':'./umd/@ischemaview/dicom-pulmonary-rwa/index.umd.js'},{'revision':'c44e15c303375ffb9ac949a2652cc96f','url':'./umd/@ischemaview/dicom-pulmonary-rwa/index.umd.js.map'},{'revision':'378e22da040745f2719b39a967127602','url':'./umd/@ischemaview/dicom-rapidai-extension/index.umd.js'},{'revision':'cd143d483b4ab78792103ee15c09b2e9','url':'./umd/@ischemaview/dicom-rapidai-extension/index.umd.js.LICENSE.txt'}]);