/**
 * Captive-portal layout: critical inline CSS so phones can still buy/redeem
 * when the main stylesheet fails (walled garden / captive browser).
 * JohnnyFlex brand: lime #c8f542 on ink #041a12.
 * Avoid modern-only CSS that old WebViews ignore (dvh, backdrop-filter).
 */
export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
.portal-page,.portal-page *{box-sizing:border-box}
.portal-page{
  font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif!important;
  color:#f3f6f3;background:#041a12;
  -webkit-text-size-adjust:100%;text-size-adjust:100%;
  min-height:100vh;margin:0;padding:0;
  position:relative;width:100%;
}
@supports (min-height:100dvh){.portal-page{min-height:100dvh}}
.portal-page .font-display,.portal-page h1{
  font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif!important;
  font-weight:800;letter-spacing:-0.03em;
}
.portal-shell{width:100%;max-width:28rem;margin:0 auto;font-size:14px;position:relative}
.portal-card{
  background:#f3f6f3;color:#0c1210;border-top:3px solid #c8f542;
  padding:1.25rem 1rem 7rem;
}
@media (min-width:640px){
  .portal-shell{max-width:28rem}
  .portal-card{
    border:1px solid #041a121f;border-top-width:3px;border-top-color:#c8f542;border-radius:1rem;
    padding:1.5rem 1.25rem;box-shadow:0 24px 60px -28px rgba(4,26,18,.65)
  }
}
.portal-page .portal-cta,
.portal-page button[type=submit],
.portal-page input[type=submit]{
  display:block;width:100%;min-height:48px;padding:.85rem 1rem;border:0;border-radius:.625rem;
  font-size:15px;font-weight:700;line-height:1.2;cursor:pointer;color:#041a12;background:#c8f542;
  text-align:center;-webkit-appearance:none;appearance:none
}
.portal-page button:disabled,[type=submit]:disabled{opacity:.55;cursor:not-allowed}
.portal-page .portal-tab-label{
  display:inline-flex;align-items:center;justify-content:center;flex:1;
  min-height:44px;border:0;border-radius:.5rem;font-size:13px;font-weight:600;
  background:transparent;color:#5c6b63;cursor:pointer;padding:.5rem .75rem;
  -webkit-appearance:none;appearance:none
}
.portal-tabs{display:flex;gap:.25rem;border-radius:.75rem;background:#dce5de;padding:.25rem;margin-top:1.25rem}
.portal-tab-radio{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0}
#portal-tab-plans:checked~.portal-tabs label[for=portal-tab-plans],
#portal-tab-voucher:checked~.portal-tabs label[for=portal-tab-voucher]{
  background:#041a12;color:#c8f542
}
.portal-page form.portal-panel-plans,
.portal-page form.portal-panel-voucher{display:none!important;margin-top:1rem}
.portal-page #portal-tab-plans:checked~.portal-panel-plans,
.portal-page #portal-tab-voucher:checked~.portal-panel-voucher{display:block!important}
.portal-plan{
  display:flex;align-items:center;gap:.75rem;width:100%;min-height:68px;
  margin:0 0 .65rem;padding:.75rem .9rem;border:1px solid #041a121f;
  border-radius:.75rem;background:#fff;color:#0c1210;cursor:pointer
}
.portal-plan:has(input:checked),.portal-plan.portal-plan-active{
  border-color:#041a12;background:#e8eee9;box-shadow:inset 0 0 0 1px #041a12
}
.portal-plan input[type=radio]{
  position:absolute;opacity:0;width:0;height:0;pointer-events:none
}
.portal-plan-icon{
  display:flex;align-items:center;justify-content:center;
  width:44px;height:44px;border-radius:.625rem;background:#dce5de;flex-shrink:0;color:#041a12
}
.portal-plan:has(input:checked) .portal-plan-icon,
.portal-plan.portal-plan-active .portal-plan-icon{background:#c8f542;color:#041a12}
.portal-plan-body{flex:1;min-width:0}
.portal-plan-title{font-size:15px;font-weight:600;line-height:1.25;margin:0}
.portal-plan-sub{font-size:12px;color:#5c6b63;margin:.15rem 0 0;line-height:1.3}
.portal-plan-price{font-size:15px;font-weight:700;white-space:nowrap;flex-shrink:0}
.portal-page .portal-link,.portal-page button.portal-link{
  width:auto!important;min-height:40px!important;border:0!important;
  background:transparent!important;color:#5c6b63!important;padding:.25rem!important;
  display:inline-flex!important;align-items:center;font-size:12px!important;font-weight:600;
  cursor:pointer
}
.portal-field,.portal-page input:not([type=checkbox]):not([type=radio]):not([type=hidden]):not([type=submit]){
  display:block;width:100%;min-height:48px;padding:.75rem 1rem;
  border:1px solid #041a121f;border-radius:.75rem;background:#fff;color:#0c1210;
  font-size:16px!important;line-height:1.35;-webkit-appearance:none;appearance:none
}
.portal-page label.portal-field-label{display:flex;flex-direction:column;gap:.35rem;width:100%}
.portal-page form{display:block;width:100%}
.portal-page a{color:#0d3d2c}
.portal-page .text-danger{color:#c0392b}
.portal-page .text-muted,.portal-page .text-secondary{color:#5c6b63}
.portal-banner{
  margin-top:1.25rem;border-radius:.75rem;background:#c8f542;color:#041a12;
  padding:1rem
}
.portal-sticky{
  position:fixed;left:0;right:0;bottom:0;z-index:20;
  background:#f3f6f3;border-top:1px solid #041a121f;
  padding:.75rem 1rem calc(.75rem + env(safe-area-inset-bottom,0px))
}
@media (min-width:640px){
  .portal-sticky{position:static;border:0;background:transparent;padding:1rem 0 0}
  .portal-card{padding-bottom:1.5rem}
}
.portal-connecting{
  position:fixed;inset:0;z-index:70;display:flex;align-items:flex-end;justify-content:center;
  background:rgba(4,26,18,.72);padding:0
}
.portal-connecting-card{
  width:100%;max-width:24rem;background:#f3f6f3;color:#0c1210;border-radius:1rem 1rem 0 0;
  padding:1.25rem 1.25rem calc(1.5rem + env(safe-area-inset-bottom,0px));text-align:center
}
@media (min-width:640px){
  .portal-connecting{align-items:center;padding:1rem}
  .portal-connecting-card{border-radius:1rem;padding:1.5rem}
}
.portal-page .portal-wifi-modal button.portal-link{
  width:auto!important;min-height:40px!important;border:0!important;
  background:transparent!important;padding:.25rem!important;
  display:inline-flex!important;align-items:center;justify-content:center
}
.portal-page .portal-wifi-modal{
  font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif
}
.portal-wifi-backdrop{
  position:absolute;inset:0;border:0;padding:0;margin:0;
  background:rgba(4,26,18,.55);cursor:pointer;-webkit-appearance:none;appearance:none
}
@keyframes portal-progress-slide{
  0%{transform:translateX(-100%)}
  100%{transform:translateX(200%)}
}
.portal-progress{animation:portal-progress-slide 1.2s ease-in-out infinite;height:100%;width:50%;border-radius:999px}
.portal-progress-track{
  margin:1.25rem auto 0;height:6px;width:12rem;max-width:100%;
  overflow:hidden;border-radius:999px;background:#dce5de
}
.portal-brand-mark{
  display:inline-flex;align-items:center;justify-content:center;
  height:1.75rem;width:1.75rem;border-radius:.375rem;
  background:#c8f542;color:#041a12;font-size:10px;font-weight:800;letter-spacing:-0.02em
}
`.replace(/\n/g, ""),
        }}
      />
      {children}
    </>
  );
}
