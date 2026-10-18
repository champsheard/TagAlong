import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, MapPin, Navigation, Plus, X } from "lucide-react";
import MapView from "../safe-walk-map/MapView.web";
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

const sanFranciscoCenter = { lat: 37.7793, lng: -122.4192 };

export function Redesigned() {
  const [destination, setDestination] = useState("");
  const [selectedRoute, setSelectedRoute] = useState(0);
  const [view, setView] = useState<"plan" | "routes" | "started">("plan");
  const [isDemo, setIsDemo] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [contactsOpen, setContactsOpen] = useState(false);

  const search = () => {
    if (!destination.trim()) {
      setShowValidation(true);
      return;
    }
    setShowValidation(false);
    setIsDemo(false);
    setView("routes");
  };

  const compareRoutes = () => {
    if (!destination.trim()) {
      setShowValidation(true);
      return;
    }
    setShowValidation(false);
    setIsDemo(false);
    setView("routes");
  };

  const showDemo = () => {
    setDestination("");
    setShowValidation(false);
    setIsDemo(true);
    setView("routes");
  };

  const returnToPlan = () => {
    setView("plan");
    setIsDemo(false);
  };

  return (
    <main className="sw-screen">
      <div className="sw-map-layer" aria-label="OpenStreetMap map centered on San Francisco">
        <MapView center={sanFranciscoCenter} />
        <div className="sw-map-caption" aria-label="Sample map preview in San Francisco">
          <span className="sw-map-caption-mark" aria-hidden="true"><i /><i /><i /></span>
          <span><b>SAMPLE MAP</b><small>San Francisco · OpenStreetMap</small></span>
        </div>
      </div>

      <header className="sw-topbar">
        <div className="sw-brand">
          <div className="sw-mark" aria-hidden="true"><span>T</span></div>
          <div className="sw-brand-copy">
            <strong>Tagalong</strong>
            <span>A steadier way home</span>
          </div>
        </div>
        <button
          className="sw-contacts"
          type="button"
          aria-expanded={contactsOpen}
          onClick={() => setContactsOpen((open) => !open)}
        >
          {contactsOpen ? <X size={15} /> : <Plus size={15} />}
          <span>Contacts</span>
        </button>
        {contactsOpen && (
          <aside className="sw-contacts-popover">
            <strong>Your trusted people</strong>
            <p>Choose who can follow a walk when you decide to share.</p>
            <button type="button" onClick={() => setContactsOpen(false)}>Got it</button>
          </aside>
        )}
      </header>

      <section className={`sw-sheet ${view !== "plan" ? "sw-sheet-expanded" : ""}`} aria-label="Plan a walk">
        <div className="sw-sheet-scroll">
          <div className="sw-handle" aria-hidden="true"><span /></div>
          {view === "started" ? (
            <section className="sw-started">
              <div className="sw-started-icon"><Check size={19} /></div>
              <div className="sw-kicker">{isDemo ? "SAMPLE DEMO" : "WALK SETUP"}</div>
              <h1>{isDemo ? "Demo only." : "Ready when you are."}</h1>
              <p>{isDemo ? "This is a sample interaction, not a real route or live walk." : "Your route choice is ready. Nothing is shared unless you choose to start sharing."}</p>
              <div className="sw-route-summary"><Navigation size={16} /><span>{routes[selectedRoute].label}</span><b>{routes[selectedRoute].minutes} min · sample</b></div>
              <button className="sw-secondary" type="button" onClick={returnToPlan}>Back to planning</button>
            </section>
          ) : view === "routes" ? (
            <section className="sw-route-screen">
              <div className="sw-route-topline">
                <button className="sw-back" type="button" onClick={returnToPlan}><ArrowLeft size={15} /> Back</button>
                <span className="sw-map-pill"><i /> MAP</span>
              </div>
              <div className="sw-kicker">{isDemo ? "SAMPLE ONLY" : "PLAN A WALK"}</div>
              <h1>{isDemo ? "A sample comparison." : "Choose a route."}</h1>
              <p className="sw-route-lede">{isDemo ? "Illustrative options only. No destination, route, or live walk is being shown." : `Options for ${destination}. Compare before you set off.`}</p>
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
              <button className="sw-compare sw-start-action" type="button" onClick={() => setView("started")}>
                {isDemo ? "Continue sample" : "Choose this route"} <ArrowRight size={16} />
              </button>
              <button className="sw-demo-reset" type="button" onClick={returnToPlan}>Plan a walk instead</button>
            </section>
          ) : (
            <>
              <div className="sw-intro">
                <div className="sw-kicker">PLAN A WALK</div>
                <div className="sw-title-row">
                  <h1>Where to tonight?</h1>
                  <span className="sw-map-pill"><i /> MAP</span>
                </div>
                <p>Search a place to put it on the map. We’ll compare<br className="sw-desktop-break" /> the routes.</p>
              </div>

              <div className="sw-place-tiles">
                <div className="sw-place-tile">
                  <span className="sw-tile-label"><i className="sw-origin-dot" /> Start</span>
                  <strong>Current location</strong>
                </div>
                <div className="sw-place-tile sw-destination-tile">
                  <span className="sw-tile-label"><i className="sw-destination-dot" /> Destination</span>
                  <strong>{destination.trim() || "Add a place"}</strong>
                </div>
              </div>

              <label className="sw-destination-label" htmlFor="sw-destination">
                Where are you going? <span>· REQUIRED</span>
              </label>
              <div className={`sw-search-field ${showValidation ? "sw-field-error" : ""}`}>
                <MapPin size={16} aria-hidden="true" />
                <input
                  id="sw-destination"
                  value={destination}
                  onChange={(event) => {
                    setDestination(event.target.value);
                    setShowValidation(false);
                  }}
                  onKeyDown={(event) => { if (event.key === "Enter") search(); }}
                  placeholder="Search street, place, or landmark"
                  aria-describedby={showValidation ? "sw-validation" : undefined}
                />
                {destination && <button type="button" className="sw-clear" onClick={() => setDestination("")} aria-label="Clear destination"><X size={14} /></button>}
              </div>
              {showValidation && <p className="sw-validation" id="sw-validation">Add a destination to compare routes.</p>}

              <div className="sw-search-row">
                <span aria-hidden="true" />
                <button className="sw-search-button" type="button" onClick={search}>Search</button>
              </div>

              <div className="sw-actions-row">
                <button className="sw-compare" type="button" onClick={compareRoutes}>Compare routes</button>
                <button className="sw-demo" type="button" onClick={showDemo}>Demo</button>
              </div>

              <p className="sw-disclosure">You choose when to share, and when the trip ends.</p>
            </>
          )}
        </div>
      </section>

      <style>{`
        .sw-screen {
          --forest: var(--sw-evergreen);
          --forest-dark: var(--sw-evergreen-deep);
          --sage: #82958a;
          --sage-dark: #63796c;
          --paper: var(--sw-paper);
          --line: var(--sw-line);
          --muted: #5f7065;
          position: relative;
          width: 100%;
          height: 100dvh;
          min-height: 600px;
          overflow: hidden;
          background: #e7e9de;
          color: var(--forest);
          font-family: "DM Sans", "Plus Jakarta Sans", sans-serif;
        }
        .sw-screen * { box-sizing: border-box; }
        .sw-map-layer {
          position: absolute;
          inset: 0 0 58% 0;
          overflow: hidden;
          background: #e5e8dc;
        }
        .sw-map-layer > div:first-child { width: 100%; height: 100%; }
        .sw-map-caption {
          position: absolute;
          z-index: 500;
          left: 16px;
          bottom: 13px;
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 8px 11px 8px 9px;
          border: 1px solid rgba(35, 75, 61, .14);
          border-radius: 13px;
          background: rgba(251, 250, 244, .96);
          box-shadow: 0 5px 16px rgba(33, 54, 42, .14);
          color: var(--forest);
          pointer-events: none;
          backdrop-filter: blur(8px);
        }
        .sw-map-caption-mark {
          width: 29px;
          height: 29px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 2px;
          border-radius: 9px;
          background: #e8eddd;
        }
        .sw-map-caption-mark i { width: 3px; border-radius: 4px; background: #657d5b; }
        .sw-map-caption-mark i:nth-child(1) { height: 9px; }
        .sw-map-caption-mark i:nth-child(2) { height: 16px; background: #a4b76a; }
        .sw-map-caption-mark i:nth-child(3) { height: 12px; }
        .sw-map-caption > span:last-child { display: flex; flex-direction: column; gap: 3px; }
        .sw-map-caption b { font-size: 8px; line-height: 1; letter-spacing: .12em; }
        .sw-map-caption small { color: #627267; font-size: 9px; line-height: 1; }
        .sw-topbar {
          position: absolute;
          z-index: 20;
          top: 9px;
          left: 17px;
          right: 18px;
          height: 51px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          pointer-events: none;
        }
        .sw-brand, .sw-contacts, .sw-contacts-popover { pointer-events: auto; }
        .sw-brand {
          display: flex;
          align-items: center;
          gap: 9px;
          min-width: 180px;
          height: 50px;
          padding: 4px 13px 4px 10px;
          border: 1px solid rgba(215, 217, 203, .92);
          border-radius: 14px;
          background: rgba(251, 250, 245, .96);
          box-shadow: 0 4px 13px rgba(35, 55, 43, .15);
        }
        .sw-mark {
          width: 34px;
          height: 34px;
          flex: none;
          display: grid;
          place-items: center;
          border-radius: 50%;
          border: 1px solid #9aab8b;
          background: #193c32;
          color: #f5f4ea;
          box-shadow: inset 0 0 0 3px rgba(251, 250, 245, .1);
        }
        .sw-mark span { font: 600 11px/1 "DM Sans", sans-serif; letter-spacing: -.04em; }
        .sw-brand-copy { display: flex; flex-direction: column; gap: 2px; }
        .sw-brand-copy strong { font-size: 15px; line-height: 1; font-weight: 750; letter-spacing: -.035em; }
        .sw-brand-copy span { font-size: 10px; line-height: 1.15; font-weight: 600; color: #667168; }
        .sw-contacts {
          min-width: 104px;
          height: 43px;
          border: 0;
          border-radius: 15px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          background: var(--forest);
          color: #fbfaf5;
          box-shadow: 0 2px 8px rgba(35, 53, 42, .14);
          font: 700 12px "DM Sans", sans-serif;
          letter-spacing: .01em;
          cursor: pointer;
        }
        .sw-contacts svg { color: #bbd477; stroke-width: 2.4; }
        .sw-contacts-popover {
          position: absolute;
          right: 0;
          top: 54px;
          width: 224px;
          padding: 14px;
          border: 1px solid #d8d8cd;
          border-radius: 13px;
          background: var(--paper);
          box-shadow: 0 9px 24px rgba(36, 48, 39, .16);
          font-size: 12px;
        }
        .sw-contacts-popover strong { font-size: 12px; }
        .sw-contacts-popover p { margin: 6px 0 12px; color: var(--muted); line-height: 1.45; }
        .sw-contacts-popover button {
          border: 0; border-radius: 8px; padding: 7px 12px;
          color: #fff; background: var(--forest); font: 600 11px "DM Sans", sans-serif;
        }
        .sw-sheet {
          position: absolute;
          z-index: 10;
          inset: 42% 0 0;
          border-radius: 24px 24px 0 0;
          background: var(--paper);
          box-shadow: 0 -3px 18px rgba(37, 48, 40, .12);
        }
        .sw-sheet-scroll {
          height: 100%;
          overflow-y: auto;
          overscroll-behavior: contain;
          padding: 0 27px 20px;
          scrollbar-width: thin;
          scrollbar-color: #d9dbd1 transparent;
        }
        .sw-handle {
          width: 100%;
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .sw-handle span { width: 38px; height: 4px; border-radius: 8px; background: #c8cec0; }
        .sw-kicker {
          color: #73825d;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: .12em;
          line-height: 1;
        }
        .sw-intro { margin-top: 8px; }
        .sw-title-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .sw-intro h1, .sw-route-screen h1, .sw-started h1 {
          margin: 10px 0 3px;
          color: var(--forest);
          font: 750 25px/1.12 "DM Sans", "Plus Jakarta Sans", sans-serif;
          letter-spacing: -.055em;
        }
        .sw-title-row h1 { margin: 9px 0 3px; }
        .sw-intro > p {
          margin: 0;
          color: #606c64;
          font-size: 14px;
          line-height: 1.42;
          letter-spacing: -.015em;
        }
        .sw-map-pill {
          height: 27px;
          flex: none;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 0 11px;
          border-radius: 99px;
          background: #e9ecdf;
          color: #3c5141;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: .1em;
        }
        .sw-map-pill i { width: 7px; height: 7px; border-radius: 50%; background: #7b9467; }
        .sw-place-tiles {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-top: 15px;
        }
        .sw-place-tile {
          height: 53px;
          padding: 7px 10px;
          border: 1px solid #deddd3;
          border-radius: 14px;
          background: #f4f2ea;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 5px;
        }
        .sw-destination-tile { border-color: #7b8b69; background: #f3f4e9; }
        .sw-tile-label { display: flex; align-items: center; gap: 6px; font-size: 10px; line-height: 1; font-weight: 750; letter-spacing: .04em; color: #4d5c51; }
        .sw-tile-label i { width: 9px; height: 9px; display: inline-block; border-radius: 50%; }
        .sw-origin-dot { border: 1px solid #718578; background: var(--paper); }
        .sw-destination-dot { background: #93a873; border: 1px solid #71875c; }
        .sw-place-tile strong { font-size: 12px; line-height: 1; font-weight: 700; color: #354a3c; }
        .sw-destination-label {
          display: block;
          margin: 15px 0 9px;
          color: #29483b;
          font-size: 13px;
          line-height: 1.15;
          font-weight: 800;
          letter-spacing: .005em;
        }
        .sw-destination-label span { letter-spacing: .09em; }
        .sw-search-field {
          width: 100%;
          height: 54px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 14px;
          border: 1px solid #c9c9be;
          border-radius: 14px;
          background: #fdfcf8;
          color: #829087;
        }
        .sw-search-field:focus-within { border-color: #829488; box-shadow: 0 0 0 3px #e9ece3; }
        .sw-search-field input {
          width: 100%; min-width: 0; border: 0; outline: 0;
          background: transparent; color: var(--forest);
          font: 500 16px "DM Sans", sans-serif; letter-spacing: -.02em;
        }
        .sw-search-field input::placeholder { color: #898d86; opacity: 1; }
        .sw-clear { display: grid; place-items: center; padding: 4px; border: 0; background: transparent; color: #718078; cursor: pointer; }
        .sw-field-error { border-color: #9f6c5f; }
        .sw-validation { margin: 5px 0 0; color: #8c493f; font-size: 11px; }
        .sw-search-row { height: 60px; display: flex; align-items: center; justify-content: space-between; }
        .sw-search-button {
          width: 87px;
          height: 45px;
          border: 0;
          border-radius: 12px;
          background: #82958a;
          color: #fbfaf5;
          font: 750 14px "DM Sans", sans-serif;
          cursor: pointer;
          transition: transform .15s, background .15s;
        }
        .sw-search-button:hover { background: #6f8779; }
        .sw-actions-row { display: grid; grid-template-columns: 1fr 70px; gap: 9px; margin-top: 10px; }
        .sw-compare, .sw-demo {
          height: 54px;
          border: 0;
          border-radius: 14px;
          font: 750 15px "DM Sans", sans-serif;
          cursor: pointer;
          transition: transform .15s, background .15s;
        }
        .sw-compare { background: #82958a; color: #fbfaf5; }
        .sw-compare:hover { background: #6f8779; }
        .sw-demo { border: 1px solid #d5d7ca; background: #eef0e4; color: #394d3e; font-size: 13px; }
        .sw-demo:hover { background: #e4e8d9; }
        .sw-compare:active, .sw-demo:active, .sw-search-button:active { transform: translateY(1px); }
        .sw-disclosure { margin: 11px 0 0; color: #71766d; text-align: center; font-size: 12px; line-height: 1.4; letter-spacing: -.005em; }
        .sw-sheet-expanded .sw-sheet-scroll { padding-bottom: 26px; }
        .sw-route-screen { padding-top: 0; }
        .sw-route-topline { display: flex; align-items: center; justify-content: space-between; margin: -2px 0 19px; }
        .sw-back { border: 0; background: none; display: inline-flex; align-items: center; gap: 5px; padding: 6px 0; color: #617362; font: 650 11px "DM Sans", sans-serif; cursor: pointer; }
        .sw-route-screen h1 { margin-top: 9px; }
        .sw-route-lede { margin: 6px 0 15px; color: #68736c; font-size: 13px; line-height: 1.45; }
        .sw-route-heading { display: flex; justify-content: space-between; margin: 2px 1px 5px; color: #7c8779; font-size: 9px; font-weight: 800; letter-spacing: .12em; }
        .sw-data-note { margin: 0 1px 9px; color: #7b847a; font-size: 10px; line-height: 1.4; }
        .sw-route-option { width: 100%; display: flex; align-items: center; gap: 10px; margin-bottom: 7px; padding: 12px 10px; text-align: left; color: var(--forest); border: 1px solid #d9dacf; border-radius: 13px; background: #fdfcf8; cursor: pointer; }
        .sw-route-option.is-selected { border-color: #809174; background: #f4f5ed; box-shadow: inset 0 0 0 1px #809174; }
        .sw-route-radio { width: 16px; height: 16px; flex: none; display: grid; place-items: center; border: 1.5px solid #9ba698; border-radius: 50%; }
        .sw-route-radio span { width: 8px; height: 8px; border-radius: 50%; background: #5d7657; }
        .sw-route-info { flex: 1; display: flex; flex-direction: column; gap: 4px; }
        .sw-route-info b { font-size: 12px; }
        .sw-route-info small { color: #7a857c; font-size: 9px; }
        .sw-route-metrics { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; }
        .sw-route-metrics b { font: 600 19px "DM Sans", sans-serif; }
        .sw-route-metrics b small { font: 600 9px "DM Sans", sans-serif; }
        .sw-route-metrics > small { color: #788477; font-size: 8px; }
        .sw-estimate-note { margin: 8px 1px 10px; color: #788277; font-size: 10px; line-height: 1.45; }
        .sw-start-action { width: 100%; height: 48px; display: flex; align-items: center; justify-content: center; gap: 9px; font-size: 13px; }
        .sw-demo-reset { display: block; margin: 9px auto 0; padding: 7px; border: 0; background: none; color: #657469; font: 600 11px "DM Sans", sans-serif; cursor: pointer; }
        .sw-started { padding-top: 12px; }
        .sw-started-icon { width: 38px; height: 38px; display: grid; place-items: center; margin-bottom: 15px; border-radius: 50%; background: #e6ecde; color: #5c7555; }
        .sw-started h1 { margin: 9px 0 6px; }
        .sw-started > p { margin: 0; color: #69746c; font-size: 13px; line-height: 1.5; }
        .sw-route-summary { display: flex; align-items: center; gap: 9px; margin-top: 17px; padding: 13px; border-radius: 12px; background: #eef0e7; font-size: 12px; }
        .sw-route-summary svg { color: #75886c; }
        .sw-route-summary b { margin-left: auto; font-size: 10px; font-weight: 650; }
        .sw-secondary { margin-top: 14px; padding: 10px 13px; border: 1px solid #cdd2c5; border-radius: 10px; background: transparent; color: var(--forest); font: 650 11px "DM Sans", sans-serif; cursor: pointer; }
        @media (max-height: 740px) {
          .sw-sheet { inset-block-start: 39%; }
          .sw-sheet-scroll { padding-inline: 23px; }
          .sw-handle { height: 42px; }
        }
        @media (min-width: 600px) {
          .sw-screen { max-width: 520px; margin-inline: auto; }
          .sw-topbar { left: 22px; right: 22px; }
          .sw-sheet { border-radius: 26px 26px 0 0; }
          .sw-sheet-scroll { padding-inline: 30px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .sw-search-button, .sw-compare, .sw-demo { transition: none; }
        }
      `}</style>
    </main>
  );
}
