import { useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, Check, Crosshair, MapPin, Navigation, Search, ShieldCheck, UsersRound } from "lucide-react";
import "./_group.css";

type RouteOption = {
  label: string;
  minutes: number;
  detail: string;
  points: string;
};

const routes: RouteOption[] = [
  { label: "Best lit", minutes: 18, detail: "More of the route has lighting data", points: "84 / 100" },
  { label: "Quickest", minutes: 15, detail: "The shortest estimated walk", points: "71 / 100" },
];

export function Redesigned() {
  const [destination, setDestination] = useState("");
  const [selectedRoute, setSelectedRoute] = useState(0);
  const [view, setView] = useState<"plan" | "routes" | "started">("plan");

  const search = () => {
    if (destination.trim()) {
      setView("routes");
    }
  };

  return (
    <main className="sw-shell">
      <header className="sw-header">
        <div className="sw-brand">
          <div className="sw-brand-mark" aria-hidden="true"><span /></div>
          <div>
            <div className="sw-brand-name">safe walk</div>
            <div className="sw-brand-caption">A little more at ease</div>
          </div>
        </div>
        <div className="sw-contact-button" aria-label="Your trusted people">
          <UsersRound size={17} strokeWidth={1.7} /><span>People</span>
        </div>
      </header>

      <section className="sw-map" aria-label="A quiet map preview">
        <div className="sw-map-wash" />
        <div className="sw-map-block block-a" /><div className="sw-map-block block-b" />
        <div className="sw-map-block block-c" /><div className="sw-map-block block-d" />
        <div className="sw-map-park" />
        <svg className="sw-route-drawing" viewBox="0 0 390 286" preserveAspectRatio="none" aria-hidden="true">
          <path d="M53 225 C92 218 97 186 133 185 S176 208 195 175 S230 141 246 142 S278 159 298 119 S331 81 350 68" className="route-shadow" />
          <path d="M53 225 C92 218 97 186 133 185 S176 208 195 175 S230 141 246 142 S278 159 298 119 S331 81 350 68" className="route-line" />
        </svg>
        <div className="sw-map-pin sw-start-pin"><span /></div>
        <div className="sw-map-pin sw-end-pin"><MapPin size={15} fill="currentColor" strokeWidth={1.5} /></div>
        <div className="sw-map-current"><Crosshair size={15} /></div>
        <div className="sw-map-scale"><span />Illustration · not to scale</div>
        <div className="sw-locate" aria-hidden="true"><Crosshair size={17} /></div>
        <div className="sw-map-glass">
          <span className="sw-live-dot" />
          <span>{view === "started" ? "Walk in progress" : "A route, at a glance"}</span>
        </div>
      </section>

      <div className="sw-page-content">
        {view === "started" ? (
          <section className="sw-started-panel">
            <div className="sw-started-icon"><Check size={21} /></div>
            <p className="sw-kicker">YOUR WALK IS LIVE</p>
            <h1>You’re on your way.</h1>
            <p className="sw-lede">Your chosen route is ready. Sharing stays on only while this walk is active.</p>
            <div className="sw-live-route"><Navigation size={17} /><span>{routes[selectedRoute].label}</span><b>{routes[selectedRoute].minutes} min · sample</b></div>
            <button className="sw-secondary-button" type="button" onClick={() => setView("plan")}>Back to planning</button>
          </section>
        ) : (
          <>
            <section className="sw-intro">
              <div className="sw-kicker">{view === "routes" ? "YOUR ROUTE" : "A MOMENT TO PLAN"}</div>
              <h1>{view === "routes" ? "Choose the way." : "Where are you headed?"}</h1>
              <p>{view === "routes" ? "A clear view of your options, before you set off." : "Pick a destination. We’ll help you compare a couple of ways there."}</p>
            </section>

            {view === "plan" ? (
              <section className="sw-search-card">
                <div className="sw-origin-row">
                  <div className="sw-origin-symbol"><Crosshair size={15} /></div>
                  <div className="sw-origin-copy"><span>STARTING FROM</span><strong>Current location</strong></div>
                  <span className="sw-change-link">LOCATION</span>
                </div>
                <div className="sw-search-divider"><span /></div>
                <label className="sw-destination-label" htmlFor="destination">DESTINATION</label>
                <div className="sw-input-row">
                  <MapPin size={18} strokeWidth={1.7} />
                  <input
                    id="destination"
                    value={destination}
                    onChange={(event) => setDestination(event.target.value)}
                    onKeyDown={(event) => { if (event.key === "Enter") search(); }}
                    placeholder="Search a place or address"
                  />
                  {destination && <button className="sw-clear" onClick={() => setDestination("")} type="button" aria-label="Clear destination">×</button>}
                </div>
                <button className="sw-search-button" type="button" onClick={search} disabled={!destination.trim()}>
                  <Search size={16} /><span>Search</span><ArrowRight size={16} />
                </button>
                <p className="sw-search-hint">Search happens when you choose Search. No suggestions while you type.</p>
              </section>
            ) : (
              <section className="sw-options">
                <button className="sw-edit-trip" type="button" onClick={() => setView("plan")}><ArrowLeft size={15} /> Edit places</button>
                <div className="sw-trip-summary"><span>FROM</span><b>Current location</b><ArrowDown size={14} /><span>TO</span><b>{destination}</b></div>
                <div className="sw-route-heading"><span>ROUTE OPTIONS</span><span>ESTIMATES</span></div>
                <p className="sw-data-note">Illustrative values only · sample walk times and lighting estimates.</p>
                {routes.map((route, index) => (
                  <button className={`sw-route-option ${selectedRoute === index ? "is-selected" : ""}`} key={route.label} type="button" onClick={() => setSelectedRoute(index)}>
                    <span className="sw-route-radio">{selectedRoute === index && <span />}</span>
                    <span className="sw-route-info"><b>{route.label}</b><small>{route.detail}</small></span>
                    <span className="sw-route-metrics"><b>{route.minutes}<small> min</small></b><small>{route.points} light estimate</small></span>
                  </button>
                ))}
                <p className="sw-estimate-note">Lighting reflects available data, not a guarantee about current street conditions.</p>
              </section>
            )}

            <section className="sw-share-note">
              <div className="sw-shield"><ShieldCheck size={18} strokeWidth={1.7} /></div>
              <div><strong>You choose when to share.</strong><p>When you start, people you choose can follow your live location until the walk ends.</p></div>
            </section>

            {view === "routes" && (
              <button className="sw-start-button" type="button" onClick={() => setView("started")}>
                Start this walk <ArrowRight size={17} />
              </button>
            )}

            <section className="sw-shared">
              <div className="sw-section-heading">
                <div><span className="sw-kicker">A QUIET CHECK-IN</span><h2>Shared walks</h2></div>
              </div>
              <div className="sw-shared-empty">
                <div className="sw-empty-mark" aria-hidden="true"><span /></div>
                <div><strong>No shared walks right now</strong><p>Active walks appear here only when someone shares one with you.</p></div>
              </div>
            </section>
          </>
        )}

        <footer className="sw-footer"><span>SAFE WALK</span><span>Move at your own pace.</span></footer>
      </div>
      <style>{`
        .sw-shell {
          --forest: #203d34; --forest-deep: #172e28; --moss: #77886c; --citron: #c4d38b;
          --paper: #fbfaf5; --oat: #f1f0e8; --line: #dcded2; --muted: #69776d; --soft: #e8ebdf;
          min-height: 100dvh; width: 100%; overflow: hidden; background: var(--oat); color: var(--forest);
          font-family: 'DM Sans', 'Plus Jakarta Sans', sans-serif; padding-bottom: 28px;
        }
        .sw-shell * { box-sizing: border-box; }
        .sw-header { height: 74px; display: flex; align-items: center; justify-content: space-between; padding: 0 23px; background: var(--paper); }
        .sw-brand { display: flex; align-items: center; gap: 10px; }
        .sw-brand-mark { width: 34px; height: 34px; display: grid; place-items: center; border: 1px solid #9aaa85; border-radius: 50%; position: relative; }
        .sw-brand-mark:before, .sw-brand-mark:after { content:''; position:absolute; width: 12px; height: 12px; border:1px solid var(--moss); border-radius:50%; }
        .sw-brand-mark:after { width: 4px; height: 4px; background: var(--moss); border:0; }
        .sw-brand-name { font-family: 'Fraunces', Georgia, serif; font-weight: 600; font-size: 18px; letter-spacing: -.45px; line-height: 1.05; }
        .sw-brand-caption { font-size: 10px; letter-spacing: .04em; color: var(--muted); margin-top: 3px; }
        .sw-contact-button { height: 38px; border: 1px solid var(--line); border-radius: 99px; padding: 0 13px; display:flex; align-items:center; gap:7px; color:var(--forest); background:transparent; font:600 12px 'DM Sans',sans-serif; }
        .sw-map { height: 294px; position: relative; overflow: hidden; background: #e6e8dc; }
        .sw-map-wash { position:absolute; inset:0; opacity:.7; background:
          linear-gradient(26deg,transparent 0 18%,#d8ddce 18.3% 20%,transparent 20.3% 61%,#d9ddcf 61.4% 63%,transparent 63.3%),
          linear-gradient(107deg,transparent 0 22%,#faf9f1 22.4% 27%,transparent 27.4% 66%,#faf9f1 66.4% 71%,transparent 71.4%),
          repeating-linear-gradient(0deg,transparent 0 49px,rgba(255,255,255,.67) 50px 54px,transparent 55px 90px),
          repeating-linear-gradient(90deg,transparent 0 71px,rgba(255,255,255,.66) 72px 77px,transparent 78px 123px); }
        .sw-map-block { position:absolute; background:#dce1d3; border:1px solid rgba(255,255,255,.72); border-radius:4px; transform:rotate(-9deg); }
        .block-a { left:6%; top:12%; width:16%; height:24%; }.block-b { right:10%; top:20%; width:22%; height:21%; }
        .block-c { left:34%; bottom:5%; width:20%; height:21%; }.block-d { right:8%; bottom:2%; width:16%; height:20%; }
        .sw-map-park { position:absolute; left:26%; top:19%; width:28%; height:38%; border-radius:44% 32% 39% 28%; background:#cbd8be; border:1px solid rgba(255,255,255,.9); display:grid; place-items:center; transform:rotate(-8deg); }
        .sw-route-drawing { position:absolute; inset:0; width:100%; height:100%; z-index:2; }
        .route-shadow { fill:none; stroke:#f5f4ec; stroke-width:9; stroke-linecap:round; stroke-linejoin:round; }
        .route-line { fill:none; stroke:#687f62; stroke-width:3; stroke-linecap:round; stroke-linejoin:round; stroke-dasharray:1 0; }
        .sw-map-pin { position:absolute; z-index:3; display:grid; place-items:center; }
        .sw-start-pin { left:12.6%; top:72%; width:18px; height:18px; background:var(--paper); border:2px solid #687f62; border-radius:50%; }
        .sw-start-pin span { width:6px;height:6px;background:#687f62;border-radius:50%; }
        .sw-end-pin { right:8%; top:17%; width:30px;height:30px;background:var(--forest);color:var(--citron);border:3px solid var(--paper);border-radius:50% 50% 50% 5px; transform:rotate(-45deg); }
        .sw-end-pin svg { transform:rotate(45deg); }
        .sw-map-current { position:absolute; z-index:3; left:30%; bottom:22%; color:#687f62; background:var(--paper); border-radius:50%; width:26px;height:26px; display:grid;place-items:center;box-shadow:0 2px 8px #53665a22; }
        .sw-map-scale { position:absolute; bottom:13px; left:19px; display:flex;align-items:center;gap:7px;color:#6e7b70;font-size:10px; z-index:4; }
        .sw-map-scale span { width:19px;height:2px;background:#819078; }
        .sw-locate { position:absolute; right:17px; bottom:14px; width:38px;height:38px;border-radius:50%;border:1px solid #d5d9cc;background:var(--paper);color:var(--forest);display:grid;place-items:center;z-index:4; }
        .sw-map-glass { position:absolute; top:16px; left:16px; z-index:4; display:flex;align-items:center;gap:8px;padding:8px 11px;background:#fbfaf5ed;border:1px solid #ffffffa8;border-radius:99px;color:var(--forest);font-size:10px;font-weight:600; }
        .sw-live-dot { width:7px;height:7px;background:#869776;border-radius:50%; }
        .sw-page-content { max-width:520px; margin:0 auto; padding:0 22px; }
        .sw-intro { padding:25px 0 17px; }
        .sw-kicker { font:700 9px 'DM Sans',sans-serif; color:#75836c; letter-spacing:.17em; }
        .sw-intro h1, .sw-started-panel h1 { font:500 32px/1.08 'Fraunces', Georgia, serif; letter-spacing:-.85px; margin:7px 0 7px; color:var(--forest); }
        .sw-intro p, .sw-lede { font-size:13px; line-height:1.55; color:var(--muted); margin:0; }
        .sw-search-card { background:var(--paper); border:1px solid var(--line); border-radius:16px; padding:15px 15px 12px; box-shadow:0 4px 12px #273c3010; }
        .sw-origin-row { display:flex;align-items:center;gap:11px; }
        .sw-origin-symbol { width:30px;height:30px;border-radius:50%;background:#eef0e7;display:grid;place-items:center;color:#76876e; }
        .sw-origin-copy { display:flex; flex:1; flex-direction:column; gap:3px; }
        .sw-origin-copy span, .sw-destination-label { font-size:8px; letter-spacing:.14em; color:#828b7e; font-weight:700; }
        .sw-origin-copy strong { font-size:12px; font-weight:600; }
        .sw-change-link { border:0;background:none;color:#697c5e;font:600 11px 'DM Sans',sans-serif;padding:8px 2px; }
        .sw-search-divider { height:22px; margin-left:14px; border-left:1px dashed #b7c0ae; position:relative; }
        .sw-search-divider span { position:absolute; width:5px;height:5px;border-radius:50%;background:#b8c58e;left:-3px;bottom:0; }
        .sw-destination-label { display:block; margin:1px 0 7px 41px; }
        .sw-input-row { min-height:46px; display:flex;align-items:center;gap:10px;border:1px solid #c9cec0;border-radius:10px;padding:0 12px;color:#74836b;background:#fffefa; }
        .sw-input-row:focus-within { border-color:#869876; box-shadow:0 0 0 3px #e7ebdf; }
        .sw-input-row input { border:0;outline:0;min-width:0;flex:1;background:transparent;color:var(--forest);font:500 13px 'DM Sans',sans-serif; }
        .sw-input-row input::placeholder { color:#9a9f95; }
        .sw-clear { border:0;background:none;font-size:20px;color:#778276;line-height:1; }
        .sw-search-button { height:43px;width:100%;display:flex;align-items:center;justify-content:center;gap:9px;margin-top:10px;background:var(--forest);color:var(--paper);border:0;border-radius:10px;font:600 12px 'DM Sans',sans-serif;transition:opacity .2s, transform .2s; }
        .sw-search-button svg:last-child { margin-left:auto;margin-right:6px; }
        .sw-search-button svg:first-child { margin-left:auto; }
        .sw-search-button:disabled { opacity:.45; }
        .sw-search-button:not(:disabled):active, .sw-start-button:active { transform:translateY(1px); }
        .sw-search-hint { margin:8px 0 0; font-size:9px; line-height:1.4; color:#879084; text-align:center; }
        .sw-share-note { display:flex; gap:11px; align-items:flex-start; padding:13px 13px; margin-top:13px; border:1px solid #d8decc; border-radius:13px; background:#edf0e5; }
        .sw-shield { width:29px;height:29px;flex:none;display:grid;place-items:center;border-radius:50%;color:#53694f;background:#dfe5d4; }
        .sw-share-note strong { display:block;font-size:11px;line-height:1.3;font-weight:700; }
        .sw-share-note p { margin:4px 0 0; max-width:335px;font-size:10px;line-height:1.5;color:#647368; }
        .sw-shared { padding-top:21px; }
        .sw-section-heading { display:flex;justify-content:space-between;align-items:end;margin-bottom:9px; }
        .sw-section-heading h2 { font:500 21px/1.1 'Fraunces',Georgia,serif;margin:4px 0 0;letter-spacing:-.3px; }
        .sw-shared-empty { display:flex;align-items:center;gap:12px;border:1px solid #dfe1d7;border-radius:13px;background:#f7f6ef;padding:14px 13px; }
        .sw-empty-mark { width:32px;height:32px;flex:none;display:grid;place-items:center;border:1px solid #cbd2c3;border-radius:50%; }
        .sw-empty-mark span { width:8px;height:8px;border:1.5px solid #849178;border-radius:50%; }
        .sw-shared-empty strong { display:block;font-size:11px;font-weight:700;color:#31483b; }
        .sw-shared-empty p { margin:4px 0 0;font-size:10px;line-height:1.45;color:#7a8579; }
        .sw-footer { display:flex;justify-content:space-between;border-top:1px solid #dfe0d6;margin-top:22px;padding-top:12px;color:#899187;font-size:8px;letter-spacing:.1em; }
        .sw-footer span:last-child { letter-spacing:0;font-size:9px; }
        .sw-options { padding:3px 0 0; }
        .sw-edit-trip { display:flex;align-items:center;gap:6px;padding:6px 0;border:0;background:none;color:#60745a;font:600 11px 'DM Sans',sans-serif; }
        .sw-trip-summary { display:grid;grid-template-columns:1fr auto;gap:3px 8px;background:#e9ece2;border-radius:12px;padding:11px 13px;margin:5px 0 14px; }
        .sw-trip-summary span { font-size:8px;letter-spacing:.12em;color:#798675;font-weight:700; }
        .sw-trip-summary b { font-size:11px;font-weight:600; }
        .sw-trip-summary svg { grid-column:2;grid-row:1 / 3;align-self:center;color:#819073; }
        .sw-route-heading { display:flex;justify-content:space-between;color:#7f897d;font-size:8px;letter-spacing:.12em;font-weight:700;margin:0 2px 7px; }
        .sw-data-note { margin:0 2px 8px;font-size:9px;line-height:1.4;color:#788477; }
        .sw-route-option { width:100%;display:flex;align-items:center;gap:10px;text-align:left;border:1px solid var(--line);background:var(--paper);border-radius:12px;padding:11px 10px;margin:0 0 7px;color:var(--forest); }
        .sw-route-option.is-selected { border-color:#738569;background:#f5f6ef;box-shadow:inset 0 0 0 1px #738569; }
        .sw-route-radio { width:16px;height:16px;border:1.5px solid #9aa592;border-radius:50%;display:grid;place-items:center;flex:none; }
        .is-selected .sw-route-radio { border-color:#536c4b; }.sw-route-radio span { width:8px;height:8px;background:#536c4b;border-radius:50%; }
        .sw-route-info { flex:1;display:flex;flex-direction:column;gap:4px; }
        .sw-route-info b { font-size:12px; }.sw-route-info small { font-size:9px;color:#7b867c; }
        .sw-route-metrics { display:flex;flex-direction:column;align-items:end;gap:3px; }
        .sw-route-metrics b { font:500 19px 'Fraunces',Georgia,serif; }.sw-route-metrics b small { font:500 9px 'DM Sans',sans-serif; }
        .sw-route-metrics>small { font-size:8px;color:#788477; }
        .sw-estimate-note { font-size:9px;line-height:1.5;color:#7c857a;margin:7px 1px 0; }
        .sw-start-button { width:100%;height:47px;margin-top:12px;display:flex;align-items:center;justify-content:center;gap:12px;border:0;border-radius:11px;background:var(--forest);color:var(--paper);font:600 12px 'DM Sans',sans-serif; }
        .sw-started-panel { padding:27px 0 12px; }
        .sw-started-icon { width:42px;height:42px;display:grid;place-items:center;background:#e2e9d8;color:#53694c;border-radius:50%;margin-bottom:15px; }
        .sw-started-panel h1 { margin-top:7px; }.sw-lede { max-width:350px; }
        .sw-live-route { display:flex;align-items:center;gap:9px;background:#e9ece2;padding:13px;border-radius:11px;margin-top:18px;font-size:12px; }
        .sw-live-route svg { color:#687d5d; }.sw-live-route b { margin-left:auto;font-size:11px; }
        .sw-secondary-button { margin-top:14px;background:transparent;border:1px solid #cdd2c4;border-radius:10px;padding:11px 14px;color:var(--forest);font:600 11px 'DM Sans',sans-serif; }
        @media (min-width: 700px) {
          .sw-shell { min-height:100vh;padding-bottom:40px; }
          .sw-header { padding-left:max(32px,calc((100vw - 850px)/2));padding-right:max(32px,calc((100vw - 850px)/2)); }
          .sw-map { height:340px; }
          .sw-page-content { padding:0 30px; }
          .sw-intro { padding-top:30px; }
        }
        @media (prefers-reduced-motion: reduce) { .sw-search-button { transition:none; } }
      `}</style>
    </main>
  );
}
