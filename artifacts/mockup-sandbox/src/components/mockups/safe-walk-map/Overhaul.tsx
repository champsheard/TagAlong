import { useState } from "react";
import { ChevronDown, Info, MapPin, Navigation, ShieldCheck } from "lucide-react";
import MapView from "./MapView.web";

const route = {
  type: "LineString" as const,
  coordinates: [
    [-122.4194, 37.7749],
    [-122.4183, 37.7757],
    [-122.4167, 37.7765],
    [-122.4152, 37.7771],
    [-122.4135, 37.7786],
  ] as [number, number][],
};

export function Overhaul() {
  const [showContext, setShowContext] = useState(false);

  return (
    <main className="sw-overhaul">
      <style>{`
        .sw-overhaul {
          --sw-ink: #193b31;
          --sw-moss: #426b49;
          --sw-leaf: #c9dc9d;
          --sw-paper: #f5f3e9;
          --sw-muted: #68766a;
          position: relative;
          width: 100%;
          min-height: 100dvh;
          overflow: hidden;
          color: var(--sw-ink);
          background: #e7e9dd;
          font-family: 'DM Sans', 'Avenir Next', sans-serif;
          isolation: isolate;
        }
        .sw-overhaul, .sw-overhaul * { box-sizing: border-box; }
        .sw-overhaul__map {
          position: absolute;
          z-index: 0;
          inset: 0;
        }
        .sw-overhaul__map > div { position: absolute !important; inset: 0; }
        .sw-overhaul .leaflet-container {
          height: 100%;
          width: 100%;
          background: #e4e8da;
          font-family: 'DM Sans', sans-serif;
        }
        .sw-overhaul .leaflet-tile { filter: saturate(.83) contrast(1.02); }
        .sw-overhaul .leaflet-tooltip {
          border: 1px solid rgba(25,59,49,.1);
          border-radius: 8px;
          color: var(--sw-ink);
          background: var(--sw-paper);
          box-shadow: 0 4px 12px rgba(28,50,37,.13);
          font: 700 11px 'DM Sans', sans-serif;
        }
        .sw-overhaul__top {
          position: absolute;
          z-index: 600;
          top: max(16px, env(safe-area-inset-top));
          left: 16px;
          right: 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          min-height: 54px;
          padding: 8px 13px 8px 11px;
          border: 1px solid rgba(255,255,255,.78);
          border-radius: 19px;
          background: rgba(248,247,239,.96);
          box-shadow: 0 8px 28px rgba(28,50,37,.14);
          animation: sw-rise .48s ease-out both;
        }
        .sw-overhaul__brand { display: flex; align-items: center; gap: 10px; }
        .sw-overhaul__mark {
          display: grid;
          width: 36px;
          height: 36px;
          place-items: center;
          border-radius: 12px;
          color: var(--sw-paper);
          background: var(--sw-ink);
        }
        .sw-overhaul__brand-name {
          font: 700 15px/1.1 'DM Sans', sans-serif;
          letter-spacing: -.035em;
        }
        .sw-overhaul__brand-kicker {
          display: block;
          margin-top: 4px;
          color: var(--sw-muted);
          font-size: 9px;
          font-weight: 800;
          letter-spacing: .14em;
          text-transform: uppercase;
        }
        .sw-overhaul__preview {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 8px 10px;
          border-radius: 999px;
          color: #34553b;
          background: #e8eddb;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .075em;
          text-transform: uppercase;
        }
        .sw-overhaul__preview-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #78974e;
          box-shadow: 0 0 0 3px rgba(120,151,78,.14);
        }
        .sw-overhaul__map-label {
          position: absolute;
          z-index: 500;
          top: 91px;
          left: 20px;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 8px 11px;
          border: 1px solid rgba(255,255,255,.8);
          border-radius: 999px;
          color: #3c5842;
          background: rgba(248,247,239,.91);
          box-shadow: 0 3px 12px rgba(28,50,37,.1);
          font-size: 10px;
          font-weight: 750;
          letter-spacing: .025em;
          animation: sw-rise .58s .08s ease-out both;
        }
        .sw-overhaul__bottom {
          position: absolute;
          z-index: 600;
          right: 0;
          bottom: 0;
          left: 0;
          padding: 10px 14px max(16px, env(safe-area-inset-bottom));
          animation: sw-rise .55s .1s ease-out both;
        }
        .sw-overhaul__sheet {
          max-width: 560px;
          margin: 0 auto;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,.92);
          border-radius: 24px;
          background: var(--sw-paper);
          box-shadow: 0 14px 42px rgba(28,50,37,.2);
        }
        .sw-overhaul__handle {
          width: 34px;
          height: 4px;
          margin: 9px auto 0;
          border-radius: 5px;
          background: #d6d8c9;
        }
        .sw-overhaul__sheet-content { padding: 13px 18px 17px; }
        .sw-overhaul__eyebrow {
          margin: 0 0 6px;
          color: #758064;
          font-size: 9px;
          font-weight: 850;
          letter-spacing: .16em;
          text-transform: uppercase;
        }
        .sw-overhaul__heading-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }
        .sw-overhaul__title {
          margin: 0;
          color: var(--sw-ink);
          font: 700 24px/1.08 'Fraunces', Georgia, serif;
          letter-spacing: -.045em;
        }
        .sw-overhaul__sample {
          flex: 0 0 auto;
          margin-top: 2px;
          padding: 6px 8px;
          border: 1px solid #d8dfc9;
          border-radius: 7px;
          color: #52643e;
          background: #edf0e4;
          font-size: 8px;
          font-weight: 850;
          letter-spacing: .1em;
          line-height: 1.15;
          text-align: center;
          text-transform: uppercase;
        }
        .sw-overhaul__endpoints {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-top: 18px;
          padding: 13px 0;
          border-top: 1px solid #e3e2d7;
          border-bottom: 1px solid #e3e2d7;
        }
        .sw-overhaul__endpoint {
          display: flex;
          align-items: center;
          min-width: 0;
          gap: 9px;
        }
        .sw-overhaul__endpoint-icon {
          display: grid;
          flex: 0 0 auto;
          width: 29px;
          height: 29px;
          place-items: center;
          border-radius: 10px;
          color: #355940;
          background: #e6eadb;
        }
        .sw-overhaul__endpoint:last-child .sw-overhaul__endpoint-icon {
          color: #f5f3e9;
          background: var(--sw-moss);
        }
        .sw-overhaul__endpoint-label {
          display: block;
          margin-bottom: 3px;
          color: #818678;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: .12em;
          text-transform: uppercase;
        }
        .sw-overhaul__endpoint-name {
          overflow: hidden;
          color: var(--sw-ink);
          font-size: 12px;
          font-weight: 700;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .sw-overhaul__notice {
          display: flex;
          align-items: flex-start;
          gap: 9px;
          margin-top: 12px;
          padding: 10px 11px;
          border-radius: 12px;
          color: #53604c;
          background: #e9ecdf;
          font-size: 10px;
          line-height: 1.45;
        }
        .sw-overhaul__notice svg { flex: 0 0 auto; margin-top: 1px; color: #66784d; }
        .sw-overhaul__notice strong { color: #344d38; font-weight: 800; }
        .sw-overhaul__details {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 11px;
          padding: 7px 1px 0;
          border: 0;
          color: #38583f;
          background: transparent;
          font: 700 11px 'DM Sans', sans-serif;
          text-align: left;
          cursor: pointer;
        }
        .sw-overhaul__details-label { display: inline-flex; align-items: center; gap: 7px; }
        .sw-overhaul__chevron { transition: transform .2s ease; }
        .sw-overhaul__chevron--open { transform: rotate(180deg); }
        .sw-overhaul__context {
          margin: 10px 0 0;
          padding: 10px 11px;
          border-left: 2px solid #9daf76;
          color: #606b5b;
          background: #efeee4;
          font-size: 10px;
          line-height: 1.5;
          animation: sw-rise .2s ease-out both;
        }
        @keyframes sw-rise {
          from { opacity: 0; transform: translateY(9px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (min-width: 700px) {
          .sw-overhaul__top { left: 24px; right: 24px; }
          .sw-overhaul__map-label { left: 28px; }
          .sw-overhaul__bottom { padding-right: 22px; padding-left: 22px; }
        }
        @media (max-width: 360px) {
          .sw-overhaul__top { left: 11px; right: 11px; }
          .sw-overhaul__map-label { left: 14px; }
          .sw-overhaul__bottom { padding-right: 9px; padding-left: 9px; }
          .sw-overhaul__sheet-content { padding-right: 14px; padding-left: 14px; }
          .sw-overhaul__title { font-size: 22px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .sw-overhaul *, .sw-overhaul *::before, .sw-overhaul *::after {
            animation-duration: .01ms !important;
            transition-duration: .01ms !important;
          }
        }
      `}</style>

      <div className="sw-overhaul__map" aria-label="OpenStreetMap route map">
        <MapView
          center={{ lat: 37.7764, lng: -122.4165 }}
          routes={[{ id: "sample-route", geometry: route, color: "#426b49" }]}
          markers={[
            { lat: 37.7749, lng: -122.4194, label: "Start" },
            { lat: 37.7786, lng: -122.4135, label: "Destination" },
          ]}
          fitPadding={{ top: 138, right: 28, bottom: 326, left: 28 }}
          attributionBottom={360}
        />
      </div>

      <header className="sw-overhaul__top">
        <div className="sw-overhaul__brand">
          <div className="sw-overhaul__mark" aria-hidden="true">
            <Navigation size={18} strokeWidth={2.1} />
          </div>
          <div>
            <div className="sw-overhaul__brand-name">Safe Walk</div>
            <span className="sw-overhaul__brand-kicker">A steadier way home</span>
          </div>
        </div>
        <div className="sw-overhaul__preview">
          <span className="sw-overhaul__preview-dot" />
          Route preview
        </div>
      </header>

      <div className="sw-overhaul__map-label">
        <span className="sw-overhaul__preview-dot" />
        Illustrative map · move map to explore
      </div>

      <section className="sw-overhaul__bottom" aria-label="Sample route information">
        <div className="sw-overhaul__sheet">
          <div className="sw-overhaul__handle" />
          <div className="sw-overhaul__sheet-content">
            <p className="sw-overhaul__eyebrow">Your route at a glance</p>
            <div className="sw-overhaul__heading-row">
              <h1 className="sw-overhaul__title">A route to review</h1>
              <span className="sw-overhaul__sample">Sample data<br />not live</span>
            </div>

            <div className="sw-overhaul__endpoints">
              <div className="sw-overhaul__endpoint">
                <span className="sw-overhaul__endpoint-icon"><MapPin size={15} /></span>
                <span>
                  <span className="sw-overhaul__endpoint-label">From</span>
                  <span className="sw-overhaul__endpoint-name">Start</span>
                </span>
              </div>
              <div className="sw-overhaul__endpoint">
                <span className="sw-overhaul__endpoint-icon"><MapPin size={15} /></span>
                <span>
                  <span className="sw-overhaul__endpoint-label">To</span>
                  <span className="sw-overhaul__endpoint-name">Destination</span>
                </span>
              </div>
            </div>

            <div className="sw-overhaul__notice">
              <ShieldCheck size={15} />
              <span><strong>Lighting is only one consideration.</strong> Map information can be incomplete and cannot guarantee a safe route.</span>
            </div>

            <button
              className="sw-overhaul__details"
              type="button"
              aria-expanded={showContext}
              onClick={() => setShowContext(value => !value)}
            >
              <span className="sw-overhaul__details-label"><Info size={14} /> What this map shows</span>
              <ChevronDown className={`sw-overhaul__chevron${showContext ? " sw-overhaul__chevron--open" : ""}`} size={16} />
            </button>
            {showContext && (
              <p className="sw-overhaul__context">
                This line and its endpoints are illustrative sample geometry. They do not represent a live walk, a person’s current position, or a lighting assessment. Pan the map to orient yourself.
              </p>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
