---
"ui": minor
---

Upload project logos and builder avatars instead of pasting a URL. The storage plugin from
feedback.nearbuilders.org is now attached as a remote (`plugins.storage`), and the project form,
/join and the builder profile editor use it to upload PNG, JPEG, WebP or GIF images up to 5 MB. Type
and size are checked in the browser and again by the plugin. Uploaded images go through the same
safe-image check as before, the NEAR Social avatar is still used when nothing is uploaded, and the
NEAR Catalog readiness check counts an uploaded logo as complete.
