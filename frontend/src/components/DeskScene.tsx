import { DECOR_POS, DECOR_SLOTS, decorName, type Decor, type Wardrobe } from "../lib/deskCatalog";
import { FINDS_ART } from "../lib/findsArt";
import { wearLayers } from "../lib/wardrobeArt";

// The desk picture: the pre-drawn scene PNG (160x112) with the member's Desk Finds items drawn on
// top in their decor spots, and what the seated buddy wears. The overlay is a decorative SVG, so the
// alt text names what is on the desk instead. Placeholder art; spots and fittings are proposals.

type Props = {
  src: string;
  alt: string;
  decor?: Decor;
  /** The buddy shown in the picture (the first seated one) and what each buddy wears. */
  buddy?: string;
  wardrobe?: Wardrobe;
  className?: string;
};

export default function DeskScene({ src, alt, decor, buddy, wardrobe, className }: Props) {
  const placed = decor ? DECOR_SLOTS.filter((d) => decor[d] && FINDS_ART[decor[d]]) : [];
  const worn = buddy ? wearLayers(buddy, wardrobe?.[buddy]) : [];
  const names = placed.map((d) => decorName(decor![d]));
  const bits: string[] = [];
  if (names.length > 0) bits.push(`On the desk: ${names.join(", ")}`);
  if (worn.length > 0) bits.push("The buddy is wearing a tiny scarf");
  const fullAlt = bits.length > 0 ? `${alt}. ${bits.join(". ")}.` : alt;
  return (
    <span className="ds-scene">
      <img src={src} alt={fullAlt} width={160} height={112} className={className} />
      {(placed.length > 0 || worn.length > 0) && (
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
          {worn.map((layers, w) => (
            <g key={"w" + w}>{layers.map(([fill, path], i) => <path key={i} d={path} fill={fill} />)}</g>
          ))}
        </svg>
      )}
    </span>
  );
}
