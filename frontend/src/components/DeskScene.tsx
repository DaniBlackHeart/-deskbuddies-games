import { DECOR_POS, DECOR_SLOTS, decorName, type Decor } from "../lib/deskCatalog";
import { FINDS_ART } from "../lib/findsArt";

// The desk picture: the pre-drawn scene PNG (160x112) with the member's Desk Finds items drawn on
// top in their decor spots. The overlay is a decorative SVG, so the alt text names what is on the
// desk instead. Placeholder art; spots are a proposal.

type Props = {
  src: string;
  alt: string;
  decor?: Decor;
  className?: string;
};

export default function DeskScene({ src, alt, decor, className }: Props) {
  const placed = decor ? DECOR_SLOTS.filter((d) => decor[d] && FINDS_ART[decor[d]]) : [];
  const names = placed.map((d) => decorName(decor![d]));
  const fullAlt = names.length > 0 ? `${alt}. On the desk: ${names.join(", ")}.` : alt;
  return (
    <span className="ds-scene">
      <img src={src} alt={fullAlt} width={160} height={112} className={className} />
      {placed.length > 0 && (
        <svg className="ds-scene__over" viewBox="0 0 160 112" shapeRendering="crispEdges" aria-hidden="true" focusable="false">
          {placed.map((d) => {
            const art = FINDS_ART[decor![d]];
            const { x, y } = DECOR_POS[d];
            return (
              <g key={d} transform={`translate(${x} ${y})`}>
                {art.layers.map(([fill, path], i) => <path key={i} d={path} fill={fill} />)}
              </g>
            );
          })}
        </svg>
      )}
    </span>
  );
}
